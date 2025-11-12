/*
  # Create UI Preferences Table

  1. New Tables
    - `ui_preferences`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `key` (text, preference key like 'theme')
      - `value` (jsonb, preference value)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - Unique constraint on (user_id, key)

  2. Security
    - Enable RLS on `ui_preferences` table
    - Add policies for authenticated users to manage their own preferences

  3. Indexes
    - Composite index on (user_id, key) for fast lookups
*/

-- Create ui_preferences table
CREATE TABLE IF NOT EXISTS ui_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, key)
);

-- Enable Row Level Security
ALTER TABLE ui_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ui_preferences
CREATE POLICY "Users can view own preferences"
  ON ui_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON ui_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON ui_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences"
  ON ui_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_ui_preferences_user_key ON ui_preferences(user_id, key);

-- Trigger for updated_at (uses existing function)
CREATE TRIGGER update_ui_preferences_updated_at
  BEFORE UPDATE ON ui_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
