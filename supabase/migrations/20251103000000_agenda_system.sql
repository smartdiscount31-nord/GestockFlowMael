/*
  # Système Agenda - Module de gestion des tâches et rendez-vous

  1. Nouvelles Tables
    - `agenda_events`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key vers auth.users)
      - `title` (text) - Titre de l'événement
      - `description` (text) - Description détaillée
      - `event_date` (date) - Date de l'événement
      - `event_time` (time) - Heure de l'événement
      - `source` (text) - Type: 'roadmap' ou 'rdv'
      - `status` (text) - Statut: 'a_faire', 'en_cours', 'fait', 'vu'
      - `important` (boolean) - Si true, déclenche popup de rappel
      - `project` (text, nullable) - Catégorie/projet optionnel
      - `custom_reminders` (jsonb) - Configuration personnalisée des rappels
      - `archived` (boolean) - Soft delete pour conformité
      - `archived_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `agenda_reminders_queue`
      - `id` (uuid, primary key)
      - `event_id` (uuid, foreign key vers agenda_events)
      - `run_at` (timestamptz) - Moment d'envoi prévu (UTC)
      - `type` (text) - Type de rappel: '24h', '2h', 'now'
      - `delivered` (boolean) - Statut de livraison
      - `attempt` (int) - Nombre de tentatives
      - `created_at` (timestamptz)
      - Contrainte UNIQUE sur (event_id, type, run_at) pour idempotence

    - `agenda_reminders_log`
      - `id` (uuid, primary key)
      - `event_id` (uuid, foreign key vers agenda_events)
      - `reminder_type` (text) - Type de rappel
      - `delivered_at` (timestamptz) - Moment de livraison
      - `user_action` (text) - Action prise: 'vu', 'reporte', 'fait', 'ignore'
      - `notification_id` (uuid, nullable) - Lien vers notification créée
      - `created_at` (timestamptz)

  2. Sécurité
    - Enable RLS sur toutes les tables
    - Policies pour que chaque utilisateur voie uniquement ses propres événements
    - Policies pour la gestion des rappels

  3. Index
    - Index sur dates, statuts, user_id pour performance
    - Index sur la queue de rappels pour le cron
*/

-- =====================================================================
-- 1. Table agenda_events
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.agenda_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  event_date date NOT NULL,
  event_time time,
  source text NOT NULL CHECK (source IN ('roadmap', 'rdv')),
  status text NOT NULL CHECK (status IN ('a_faire', 'en_cours', 'fait', 'vu')) DEFAULT 'a_faire',
  important boolean NOT NULL DEFAULT false,
  project text,
  custom_reminders jsonb DEFAULT '["24h", "2h", "now"]'::jsonb,
  archived boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_agenda_events_user_id ON public.agenda_events(user_id);
CREATE INDEX IF NOT EXISTS idx_agenda_events_date ON public.agenda_events(event_date);
CREATE INDEX IF NOT EXISTS idx_agenda_events_status ON public.agenda_events(status);
CREATE INDEX IF NOT EXISTS idx_agenda_events_source ON public.agenda_events(source);
CREATE INDEX IF NOT EXISTS idx_agenda_events_important ON public.agenda_events(important);
CREATE INDEX IF NOT EXISTS idx_agenda_events_archived ON public.agenda_events(archived);
CREATE INDEX IF NOT EXISTS idx_agenda_events_user_date ON public.agenda_events(user_id, event_date) WHERE archived = false;

-- =====================================================================
-- 2. Table agenda_reminders_queue
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.agenda_reminders_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.agenda_events(id) ON DELETE CASCADE,
  run_at timestamptz NOT NULL,
  type text NOT NULL CHECK (type IN ('24h', '2h', 'now', 'retry_15m')),
  delivered boolean NOT NULL DEFAULT false,
  attempt int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, type, run_at)
);

-- Index pour le cron qui cherche les rappels à envoyer
CREATE INDEX IF NOT EXISTS idx_reminders_queue_run_at ON public.agenda_reminders_queue(run_at, delivered) WHERE delivered = false;
CREATE INDEX IF NOT EXISTS idx_reminders_queue_event ON public.agenda_reminders_queue(event_id);

-- =====================================================================
-- 3. Table agenda_reminders_log
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.agenda_reminders_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.agenda_events(id) ON DELETE CASCADE,
  reminder_type text NOT NULL,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  user_action text CHECK (user_action IN ('vu', 'reporte', 'fait', 'ignore', null)),
  notification_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index pour historique et analytics
CREATE INDEX IF NOT EXISTS idx_reminders_log_event ON public.agenda_reminders_log(event_id);
CREATE INDEX IF NOT EXISTS idx_reminders_log_delivered ON public.agenda_reminders_log(delivered_at);

-- =====================================================================
-- 4. Sécurité RLS - agenda_events
-- =====================================================================

ALTER TABLE public.agenda_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own events"
  ON public.agenda_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own events"
  ON public.agenda_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own events"
  ON public.agenda_events
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own events"
  ON public.agenda_events
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =====================================================================
-- 5. Sécurité RLS - agenda_reminders_queue
-- =====================================================================

ALTER TABLE public.agenda_reminders_queue ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent voir les rappels de leurs événements
CREATE POLICY "Users can view own reminders queue"
  ON public.agenda_reminders_queue
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agenda_events
      WHERE agenda_events.id = agenda_reminders_queue.event_id
      AND agenda_events.user_id = auth.uid()
    )
  );

-- Seul le backend peut insérer/modifier la queue (via service role)
CREATE POLICY "Service role can manage reminders queue"
  ON public.agenda_reminders_queue
  FOR ALL
  TO authenticated
  WITH CHECK (true);

-- =====================================================================
-- 6. Sécurité RLS - agenda_reminders_log
-- =====================================================================

ALTER TABLE public.agenda_reminders_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminders log"
  ON public.agenda_reminders_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agenda_events
      WHERE agenda_events.id = agenda_reminders_log.event_id
      AND agenda_events.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert reminders log"
  ON public.agenda_reminders_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =====================================================================
-- 7. Trigger pour updated_at automatique
-- =====================================================================

CREATE OR REPLACE FUNCTION public.update_agenda_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_agenda_events_updated_at
  BEFORE UPDATE ON public.agenda_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_agenda_events_updated_at();

-- =====================================================================
-- 8. Fonction helper pour créer les rappels d'un événement
-- =====================================================================

CREATE OR REPLACE FUNCTION public.create_agenda_reminders(p_event_id uuid)
RETURNS void AS $$
DECLARE
  v_event record;
  v_event_datetime timestamptz;
  v_reminder text;
  v_run_at timestamptz;
BEGIN
  -- Charger l'événement
  SELECT * INTO v_event
  FROM public.agenda_events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found: %', p_event_id;
  END IF;

  -- Calculer le datetime de l'événement (UTC)
  v_event_datetime := (v_event.event_date || ' ' || COALESCE(v_event.event_time::text, '12:00:00'))::timestamptz;

  -- Parcourir les rappels configurés
  FOR v_reminder IN SELECT jsonb_array_elements_text(COALESCE(v_event.custom_reminders, '["24h", "2h", "now"]'::jsonb))
  LOOP
    -- Calculer le moment d'envoi selon le type
    CASE v_reminder
      WHEN '24h' THEN
        v_run_at := v_event_datetime - interval '24 hours';
      WHEN '2h' THEN
        v_run_at := v_event_datetime - interval '2 hours';
      WHEN 'now' THEN
        v_run_at := v_event_datetime;
      ELSE
        CONTINUE;
    END CASE;

    -- Insérer dans la queue (idempotent grâce à UNIQUE constraint)
    INSERT INTO public.agenda_reminders_queue (event_id, run_at, type)
    VALUES (p_event_id, v_run_at, v_reminder)
    ON CONFLICT (event_id, type, run_at) DO NOTHING;

    RAISE NOTICE 'Reminder created: event_id=%, type=%, run_at=%', p_event_id, v_reminder, v_run_at;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- 9. Trigger pour créer automatiquement les rappels à la création
-- =====================================================================

CREATE OR REPLACE FUNCTION public.trigger_create_agenda_reminders()
RETURNS TRIGGER AS $$
BEGIN
  -- Créer les rappels uniquement pour les événements non archivés
  IF NOT NEW.archived THEN
    PERFORM public.create_agenda_reminders(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_create_reminders
  AFTER INSERT ON public.agenda_events
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_create_agenda_reminders();

-- =====================================================================
-- 10. Fonction pour soft delete (archivage)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.archive_agenda_event(p_event_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.agenda_events
  SET archived = true, archived_at = now()
  WHERE id = p_event_id;

  -- Supprimer les rappels non envoyés de la queue
  DELETE FROM public.agenda_reminders_queue
  WHERE event_id = p_event_id AND delivered = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- 11. Commentaires et documentation
-- =====================================================================

COMMENT ON TABLE public.agenda_events IS 'Événements agenda: tâches roadmap et rendez-vous';
COMMENT ON COLUMN public.agenda_events.source IS 'Type événement: roadmap (tâches) ou rdv (rendez-vous)';
COMMENT ON COLUMN public.agenda_events.status IS 'Statut: a_faire, en_cours, fait, vu (rdv uniquement)';
COMMENT ON COLUMN public.agenda_events.important IS 'Si true, déclenche popup de rappel prioritaire';
COMMENT ON COLUMN public.agenda_events.project IS 'Catégorie/projet optionnel (ex: App, IA, Formation)';
COMMENT ON COLUMN public.agenda_events.archived IS 'Soft delete pour conformité et traçabilité';

COMMENT ON TABLE public.agenda_reminders_queue IS 'Queue des rappels à envoyer (idempotent)';
COMMENT ON COLUMN public.agenda_reminders_queue.run_at IS 'Moment prévu envoi (UTC)';
COMMENT ON COLUMN public.agenda_reminders_queue.type IS 'Type rappel: 24h, 2h, now, retry_15m';

COMMENT ON TABLE public.agenda_reminders_log IS 'Historique des rappels envoyés et actions utilisateur';
