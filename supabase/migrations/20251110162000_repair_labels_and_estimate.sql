-- Migration: Add estimate amount and label URLs to repair_tickets
-- Adds optional price estimation and storage URLs for generated Dymo labels

ALTER TABLE public.repair_tickets
  ADD COLUMN IF NOT EXISTS estimate_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS label_client_url text,
  ADD COLUMN IF NOT EXISTS label_tech_url text;

COMMENT ON COLUMN public.repair_tickets.estimate_amount IS 'Estimation du prix de réparation en EUR (affichée sur étiquettes)';
COMMENT ON COLUMN public.repair_tickets.label_client_url IS 'URL publique Supabase Storage du PDF étiquette client';
COMMENT ON COLUMN public.repair_tickets.label_tech_url IS 'URL publique Supabase Storage du PDF étiquette technicien';
