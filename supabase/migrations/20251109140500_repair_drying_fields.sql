/*
  Add drying timer fields to repair_tickets
  - drying_start_at: timestamp when drying started
  - drying_duration_min: planned duration in minutes (default 0)
  - drying_end_at: computed end time (start + duration)
  - drying_acknowledged_at: when user acknowledges end of drying
*/

ALTER TABLE public.repair_tickets
  ADD COLUMN IF NOT EXISTS drying_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS drying_duration_min integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS drying_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS drying_acknowledged_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_repair_tickets_drying_end_at ON public.repair_tickets(drying_end_at);
