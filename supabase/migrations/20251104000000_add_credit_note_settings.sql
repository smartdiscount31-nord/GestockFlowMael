/*
  # Add Credit Note Settings to Company Settings

  1. Changes
    - Add `credit_note_footer_text` column to `company_settings` table
    - Add `credit_note_terms` column to `company_settings` table

  2. Details
    - `credit_note_footer_text`: Text to display in the footer of credit notes (avoirs)
    - `credit_note_terms`: Terms and conditions specific to credit notes
    - Both fields are optional (nullable) and default to NULL
    - If these fields are NULL, the system will fall back to the general footer_text and terms_and_conditions

  3. Notes
    - This allows credit notes to have their own specific text while still supporting fallback to general settings
    - Existing data is preserved - no data is modified
*/

-- Add credit_note_footer_text column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'company_settings'
    AND column_name = 'credit_note_footer_text'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN credit_note_footer_text TEXT NULL;
  END IF;
END $$;

-- Add credit_note_terms column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'company_settings'
    AND column_name = 'credit_note_terms'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN credit_note_terms TEXT NULL;
  END IF;
END $$;
