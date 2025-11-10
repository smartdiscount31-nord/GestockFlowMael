-- Migration: Repair ticket human-readable number and daily counter
-- - Adds repair_number column on repair_tickets
-- - Creates repair_counters table (per-day sequence)
-- - Creates next_repair_number() function
-- - Creates BEFORE INSERT trigger to auto-fill repair_number
-- - Backfills existing rows based on created_at (Europe/Paris)

-- 1) Column and unique index (nullable-compatible)
alter table if exists repair_tickets
  add column if not exists repair_number text;

create unique index if not exists uq_repair_tickets_repair_number
  on repair_tickets(repair_number)
  where repair_number is not null;

-- 2) Daily counters table
create table if not exists repair_counters (
  day date primary key,
  seq integer not null default 0
);

-- 3) Function to generate next number (DDMMYY-XXX, Europe/Paris)
create or replace function next_repair_number() returns text
language plpgsql
as $$
declare
  tz text := 'Europe/Paris';
  d date;
  next_seq integer;
  dstr text;
  seqstr text;
begin
  -- Current day in Europe/Paris (without time)
  d := (now() at time zone tz)::date;

  -- Upsert counter for the day, atomically increment and return
  insert into repair_counters(day, seq) values (d, 1)
  on conflict (day) do update set seq = repair_counters.seq + 1
  returning seq into next_seq;

  dstr := to_char(d, 'DDMMYY');
  seqstr := lpad(next_seq::text, 3, '0');

  return dstr || '-' || seqstr;
end;
$$;

-- 4) Trigger to set repair_number before insert if null
create or replace function set_repair_number_before_insert()
returns trigger
language plpgsql
as $$
begin
  if new.repair_number is null then
    new.repair_number := next_repair_number();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_repair_number on repair_tickets;
create trigger trg_set_repair_number
before insert on repair_tickets
for each row
execute function set_repair_number_before_insert();

-- 5) Backfill existing tickets without repair_number using created_at (Europe/Paris)
with base as (
  select
    id,
    to_char( (created_at at time zone 'Europe/Paris')::date, 'DDMMYY') as dstr,
    to_char( row_number() over (
      partition by (created_at at time zone 'Europe/Paris')::date
      order by created_at
    ), 'FM000') as seq
  from repair_tickets
  where repair_number is null
),
upd as (
  update repair_tickets t
  set repair_number = b.dstr || '-' || b.seq
  from base b
  where t.id = b.id
  returning 1
)
select count(*) as updated from upd;
