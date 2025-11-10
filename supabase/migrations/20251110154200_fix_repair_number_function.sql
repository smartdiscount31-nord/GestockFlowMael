-- Migration: Fix next_repair_number() to avoid duplicates by aligning with max-of-day
-- Context: Unique violation on uq_repair_tickets_repair_number due to desync of repair_counters.seq
-- Strategy: Use GREATEST(seq+1, max_for_day+1) atomically on UPSERT; seed insert with max_for_day+1 as well

-- 1) Replace function
CREATE OR REPLACE FUNCTION public.next_repair_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  tz text := 'Europe/Paris';
  d date;
  dstr text;
  max_seq integer := 0;
  next_seq integer := 0;
BEGIN
  -- Compute day and DDMMAA string in Europe/Paris
  d := (now() AT TIME ZONE tz)::date;
  dstr := to_char(d, 'DDMMYY');

  -- Max suffix already used today (e.g., 101125-XYZ → XYZ)
  SELECT COALESCE(MAX((split_part(rt.repair_number, '-', 2))::int), 0)
    INTO max_seq
  FROM public.repair_tickets rt
  WHERE rt.repair_number IS NOT NULL
    AND split_part(rt.repair_number, '-', 1) = dstr;

  -- Seed/advance the per-day counter atomically
  INSERT INTO public.repair_counters(day, seq)
  VALUES (d, GREATEST(max_seq + 1, 1))
  ON CONFLICT (day) DO UPDATE
    SET seq = GREATEST(public.repair_counters.seq + 1, max_seq + 1)
  RETURNING seq INTO next_seq;

  RETURN dstr || '-' || lpad(next_seq::text, 3, '0');
END;
$$;

COMMENT ON FUNCTION public.next_repair_number() IS
'Génère un numéro DDMMAA-XXX sans doublon en tenant compte du max déjà attribué pour la journée (Europe/Paris).';

-- 2) (Optional sanity) Align today''s counter with max already used if lower
DO $$
DECLARE
  tz text := 'Europe/Paris';
  d date := (now() AT TIME ZONE tz)::date;
  dstr text := to_char((now() AT TIME ZONE tz)::date, 'DDMMYY');
  max_seq integer := 0;
BEGIN
  SELECT COALESCE(MAX((split_part(rt.repair_number, '-', 2))::int), 0)
    INTO max_seq
  FROM public.repair_tickets rt
  WHERE rt.repair_number IS NOT NULL
    AND split_part(rt.repair_number, '-', 1) = dstr;

  INSERT INTO public.repair_counters(day, seq)
  VALUES (d, max_seq)
  ON CONFLICT (day) DO UPDATE
    SET seq = GREATEST(public.repair_counters.seq, EXCLUDED.seq);
END $$;
