-- Create table for repair call logs
create extension if not exists "uuid-ossp";

create table if not exists public.repair_call_logs (
  id uuid primary key default uuid_generate_v4(),
  repair_id uuid not null references public.repair_tickets(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid null references public.profiles(id) on delete set null,
  note text null
);

create index if not exists idx_repair_call_logs_repair_id on public.repair_call_logs(repair_id);
create index if not exists idx_repair_call_logs_created_at on public.repair_call_logs(created_at desc);

-- Row Level Security (optional: mirror repair_tickets policy)
alter table public.repair_call_logs enable row level security;

-- Minimal permissive policy mirroring tickets visibility; adjust as needed
-- Allow authenticated users to select/insert
create policy if not exists repair_call_logs_select on public.repair_call_logs
  for select to authenticated using (true);

create policy if not exists repair_call_logs_insert on public.repair_call_logs
  for insert to authenticated with check (true);
