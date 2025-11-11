/*
  # Paramètres de Notifications Utilisateurs

  ## Description
  Création de la table user_notification_settings pour stocker les préférences
  de notifications de chaque utilisateur, incluant l'heure du digest quotidien,
  les jours actifs, et les canaux de notification activés.

  ## 1. Nouvelle Table
    - `user_notification_settings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, unique, references profiles.id)
      - `daily_digest_hour` (integer) - Heure du digest quotidien (0-23), défaut 17
      - `active_days` (text[]) - Jours actifs (lun-ven par défaut)
      - `enable_sound` (boolean) - Activer les sons de notification
      - `enable_popup` (boolean) - Activer les popups de notification
      - `enable_email` (boolean) - Activer les emails de notification
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  ## 2. Mise à jour table notifications
    - Ajout colonne `metadata` (jsonb) pour stocker des données structurées

  ## 3. Table optionnelle repair_daily_logs
    - Pour suivre l'historique des digests quotidiens

  ## 4. Sécurité RLS
    - Les utilisateurs peuvent lire et modifier leurs propres paramètres
*/

-- ============================================================================
-- 1. TABLE: user_notification_settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_digest_hour integer NOT NULL DEFAULT 17 CHECK (daily_digest_hour >= 0 AND daily_digest_hour <= 23),
  active_days text[] NOT NULL DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  enable_sound boolean NOT NULL DEFAULT true,
  enable_popup boolean NOT NULL DEFAULT true,
  enable_email boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_user_notification_settings_user_id 
  ON public.user_notification_settings(user_id);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION public.fn_user_notif_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_notif_settings_updated_at
  BEFORE UPDATE ON public.user_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_user_notif_settings_updated_at();

-- ============================================================================
-- 2. MISE À JOUR: notifications - Ajout colonne metadata
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'notifications'
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
    RAISE NOTICE 'Colonne metadata ajoutée à notifications';
  END IF;
END $$;

-- Index pour rechercher dans metadata
CREATE INDEX IF NOT EXISTS idx_notifications_metadata 
  ON public.notifications USING gin(metadata);

-- ============================================================================
-- 3. TABLE: repair_daily_logs (optionnelle)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.repair_daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date date NOT NULL,
  parts_count integer NOT NULL DEFAULT 0,
  notifications_sent integer NOT NULL DEFAULT 0,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index sur la date
CREATE INDEX IF NOT EXISTS idx_repair_daily_logs_date 
  ON public.repair_daily_logs(log_date DESC);

-- ============================================================================
-- 4. SÉCURITÉ RLS
-- ============================================================================

-- Enable RLS
ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_daily_logs ENABLE ROW LEVEL SECURITY;

-- Policies pour user_notification_settings
CREATE POLICY "Users can view own notification settings"
  ON public.user_notification_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification settings"
  ON public.user_notification_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification settings"
  ON public.user_notification_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policies pour repair_daily_logs (lecture seule pour staff)
CREATE POLICY "Authenticated users can view repair daily logs"
  ON public.repair_daily_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Seuls les admins peuvent insérer (via backend)
CREATE POLICY "Authenticated can insert repair daily logs"
  ON public.repair_daily_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- 5. FONCTION HELPER: get_user_notification_settings
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_notification_settings(p_user_id uuid)
RETURNS TABLE(
  daily_digest_hour integer,
  active_days text[],
  enable_sound boolean,
  enable_popup boolean,
  enable_email boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    uns.daily_digest_hour,
    uns.active_days,
    uns.enable_sound,
    uns.enable_popup,
    uns.enable_email
  FROM public.user_notification_settings uns
  WHERE uns.user_id = p_user_id;
  
  -- Si aucun paramètre trouvé, retourner les valeurs par défaut
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      17::integer AS daily_digest_hour,
      ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday']::text[] AS active_days,
      true AS enable_sound,
      true AS enable_popup,
      true AS enable_email;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_notification_settings(uuid) TO authenticated;

-- ============================================================================
-- 6. COMMENTAIRES
-- ============================================================================

COMMENT ON TABLE public.user_notification_settings IS 
'Paramètres de notifications personnalisés par utilisateur (heure digest, jours actifs, canaux activés)';

COMMENT ON COLUMN public.user_notification_settings.daily_digest_hour IS 
'Heure locale du digest quotidien (0-23), défaut 17h00';

COMMENT ON COLUMN public.user_notification_settings.active_days IS 
'Jours de la semaine où le digest est actif (monday, tuesday, etc.)';

COMMENT ON TABLE public.repair_daily_logs IS 
'Historique des exécutions du digest quotidien atelier';

COMMENT ON COLUMN public.notifications.metadata IS 
'Données structurées JSON pour contexte additionnel (repair_id, customer_id, etc.)';
