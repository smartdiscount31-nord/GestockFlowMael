/*
  Fix notifications schema and repair reminder trigger to avoid errors like:
  "column \"type\" of relation \"notifications\" does not exist"

  - Add missing columns on public.notifications if absent (idempotent)
  - Ensure sane defaults
  - Update fn_repair_create_notification_on_reminder to use helper public.create_notification
*/

-- 1) Harden notifications table (add missing columns if needed)
DO $$
BEGIN
  -- Core text columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notifications' AND column_name='type'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notifications' AND column_name='title'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN title text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notifications' AND column_name='message'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN message text;
  END IF;

  -- Optional metadata columns used by UI/logic
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notifications' AND column_name='severity'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN severity text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notifications' AND column_name='link'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN link text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notifications' AND column_name='read'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN read boolean;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notifications' AND column_name='created_at'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN created_at timestamptz;
  END IF;

  -- Set/ensure defaults when columns exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notifications' AND column_name='severity'
  ) THEN
    ALTER TABLE public.notifications ALTER COLUMN severity SET DEFAULT 'info';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notifications' AND column_name='read'
  ) THEN
    ALTER TABLE public.notifications ALTER COLUMN read SET DEFAULT false;
    -- Backfill nulls defensively
    UPDATE public.notifications SET read = false WHERE read IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notifications' AND column_name='created_at'
  ) THEN
    ALTER TABLE public.notifications ALTER COLUMN created_at SET DEFAULT now();
    -- Backfill nulls defensively
    UPDATE public.notifications SET created_at = now() WHERE created_at IS NULL;
  END IF;
END $$;

-- 2) Ensure helper function public.create_notification exists
CREATE OR REPLACE FUNCTION public.create_notification(
  p_type text,
  p_title text,
  p_message text,
  p_severity text DEFAULT 'info',
  p_link text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO public.notifications (type, title, message, severity, link, user_id)
  VALUES (p_type, p_title, p_message, p_severity, p_link, p_user_id)
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3) Update trigger function to use create_notification helper
CREATE OR REPLACE FUNCTION public.fn_repair_create_notification_on_reminder()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_name text;
  v_device_model text;
BEGIN
  -- Gather context for message
  SELECT c.name, rt.device_model
  INTO v_customer_name, v_device_model
  FROM public.repair_tickets rt
  JOIN public.customers c ON rt.customer_id = c.id
  WHERE rt.id = NEW.repair_id;

  -- Create a notification only if the table exists (keeps function portable)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='notifications'
  ) THEN
    PERFORM public.create_notification(
      'reminder',                                   -- type
      'Rappel Atelier',                              -- title
      format('Rappel pour %s - %s: %s', v_customer_name, v_device_model, NEW.message), -- message
      'info',                                       -- severity
      NULL,                                         -- link
      COALESCE(NEW.created_by, auth.uid())          -- user_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
