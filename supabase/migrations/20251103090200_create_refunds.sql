-- 20251103_create_refunds.sql
-- Modélisation des remboursements (refunds) et de leurs lignes

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='refunds'
  ) THEN
    CREATE TABLE public.refunds (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      channel text NOT NULL CHECK (channel IN ('amazon','store')),
      invoice_id uuid NULL REFERENCES public.invoices(id),
      order_id text NULL,
      refund_amount_gross numeric NOT NULL DEFAULT 0,
      refund_taxable_base numeric NOT NULL DEFAULT 0,
      refund_vat_amount numeric NOT NULL DEFAULT 0,
      fees numeric NOT NULL DEFAULT 0,
      reason_code text NULL,
      processed_at timestamptz NOT NULL DEFAULT now(),
      source_event_id text NOT NULL UNIQUE,
      source_report text NULL,
      created_at timestamptz DEFAULT now(),
      created_by uuid NULL
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='refund_items'
  ) THEN
    CREATE TABLE public.refund_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      refund_id uuid NOT NULL REFERENCES public.refunds(id) ON DELETE CASCADE,
      invoice_item_id uuid NULL REFERENCES public.invoice_items(id),
      product_id uuid NOT NULL REFERENCES public.products(id),
      qty numeric NOT NULL,
      unit_price numeric NOT NULL,
      vat_rate numeric NOT NULL,
      vat_regime text NOT NULL CHECK (vat_regime IN ('normal','margin'))
    );
  END IF;
END
$$;

-- Indexes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_refund_items_refund') THEN
    CREATE INDEX idx_refund_items_refund ON public.refund_items (refund_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_refunds_processed_at') THEN
    CREATE INDEX idx_refunds_processed_at ON public.refunds (processed_at DESC);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_refunds_channel') THEN
    CREATE INDEX idx_refunds_channel ON public.refunds (channel);
  END IF;
END
$$;
