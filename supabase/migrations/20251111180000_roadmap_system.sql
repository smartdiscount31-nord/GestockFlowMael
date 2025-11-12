/*
  # Roadmap System - Feuille de route + Calendrier + Rappels

  1. New Tables
    - `user_settings_roadmap`
      - User-specific roadmap settings (reminders, EOD hour, Telegram configuration)
    - `roadmap_templates`
      - Weekly recurring task templates (e.g., "Monday morning meeting")
    - `roadmap_entries`
      - Actual task entries for specific dates (from templates or manual)
    - `events`
      - Calendar events with optional recurrence
    - `event_reminders`
      - Reminder configurations for events
    - `roadmap_notifications`
      - Generated notifications (reminders, daily summaries)
    - `user_telegram_bots`
      - Personal Telegram bot configurations per user

  2. Views
    - `user_telegram_bots_public`
      - Secure view exposing bot info WITHOUT token/secret

  3. Security
    - Enable RLS on all tables
    - Policies restricting access to user_id = auth.uid()
    - Direct access to user_telegram_bots blocked (use public view only)

  4. Indexes
    - Optimized for common queries (user+date, user+day_of_week, scheduled_at)
*/

-- User settings for roadmap module
CREATE TABLE IF NOT EXISTS user_settings_roadmap (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_reminder_days integer[] DEFAULT '{2,3}',
  eod_hour integer DEFAULT 20 CHECK (eod_hour >= 0 AND eod_hour <= 23),
  telegram_enabled boolean DEFAULT false,
  telegram_chat_id text,
  telegram_mode text DEFAULT 'shared' CHECK (telegram_mode IN ('shared', 'personal')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Weekly recurring task templates
CREATE TABLE IF NOT EXISTS roadmap_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
  title text NOT NULL,
  start_time time,
  end_time time,
  position integer DEFAULT 0,
  active boolean DEFAULT true,
  applies_from date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Actual task entries for specific dates
CREATE TABLE IF NOT EXISTS roadmap_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  title text NOT NULL,
  start_time time,
  end_time time,
  status text DEFAULT 'todo' CHECK (status IN ('todo', 'vu', 'fait')),
  origin text DEFAULT 'manual' CHECK (origin IN ('template', 'manual')),
  template_id uuid REFERENCES roadmap_templates(id) ON DELETE SET NULL,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Calendar events with recurrence support
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  date date NOT NULL,
  start_time time,
  end_time time,
  recurrence jsonb,
  location text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Event reminder configurations
CREATE TABLE IF NOT EXISTS event_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  days_before integer NOT NULL CHECK (days_before >= 0),
  at time DEFAULT '09:00',
  channel text DEFAULT 'in_app' CHECK (channel IN ('in_app', 'telegram')),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Generated notifications (in-app and Telegram)
CREATE TABLE IF NOT EXISTS roadmap_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('reminder', 'summary')),
  payload jsonb NOT NULL,
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  channel text DEFAULT 'in_app' CHECK (channel IN ('in_app', 'telegram')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at timestamptz DEFAULT now()
);

-- Personal Telegram bot configurations (secure table)
CREATE TABLE IF NOT EXISTS user_telegram_bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_username text NOT NULL,
  bot_token text NOT NULL,
  webhook_secret text NOT NULL,
  webhook_url text NOT NULL,
  chat_id text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Secure view for Telegram bots (NEVER exposes token/secret)
CREATE OR REPLACE VIEW user_telegram_bots_public AS
SELECT
  id,
  user_id,
  bot_username,
  webhook_url,
  chat_id,
  status,
  created_at,
  updated_at
FROM user_telegram_bots;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_roadmap_templates_user_day ON roadmap_templates(user_id, day_of_week) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_roadmap_entries_user_date ON roadmap_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_events_user_date ON events(user_id, date);
CREATE INDEX IF NOT EXISTS idx_roadmap_notifications_user_scheduled ON roadmap_notifications(user_id, scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_roadmap_notifications_user_unread ON roadmap_notifications(user_id, created_at) WHERE sent_at IS NULL;

-- Enable Row Level Security
ALTER TABLE user_settings_roadmap ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_telegram_bots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_settings_roadmap
CREATE POLICY "Users can view own roadmap settings"
  ON user_settings_roadmap FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own roadmap settings"
  ON user_settings_roadmap FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own roadmap settings"
  ON user_settings_roadmap FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for roadmap_templates
CREATE POLICY "Users can view own templates"
  ON roadmap_templates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own templates"
  ON roadmap_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
  ON roadmap_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
  ON roadmap_templates FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for roadmap_entries
CREATE POLICY "Users can view own entries"
  ON roadmap_entries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries"
  ON roadmap_entries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entries"
  ON roadmap_entries FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own entries"
  ON roadmap_entries FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for events
CREATE POLICY "Users can view own events"
  ON events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own events"
  ON events FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own events"
  ON events FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for event_reminders
CREATE POLICY "Users can view own event reminders"
  ON event_reminders FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_reminders.event_id
    AND events.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own event reminders"
  ON event_reminders FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_reminders.event_id
    AND events.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own event reminders"
  ON event_reminders FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_reminders.event_id
    AND events.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_reminders.event_id
    AND events.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own event reminders"
  ON event_reminders FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_reminders.event_id
    AND events.user_id = auth.uid()
  ));

-- RLS Policies for roadmap_notifications
CREATE POLICY "Users can view own notifications"
  ON roadmap_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON roadmap_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_telegram_bots (BLOCK direct access)
-- Force usage of user_telegram_bots_public view instead
CREATE POLICY "Block direct access to telegram bots"
  ON user_telegram_bots FOR SELECT
  TO authenticated
  USING (false);

-- RLS for the public view (read-only)
CREATE POLICY "Users can view own telegram bots via public view"
  ON user_telegram_bots FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can access everything (for serverless functions)
CREATE POLICY "Service role full access to user_telegram_bots"
  ON user_telegram_bots
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_user_settings_roadmap_updated_at BEFORE UPDATE ON user_settings_roadmap FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_roadmap_templates_updated_at BEFORE UPDATE ON roadmap_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_roadmap_entries_updated_at BEFORE UPDATE ON roadmap_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_telegram_bots_updated_at BEFORE UPDATE ON user_telegram_bots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
