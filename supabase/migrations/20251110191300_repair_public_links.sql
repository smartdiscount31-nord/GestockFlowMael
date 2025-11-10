-- Migration: repair_public_links (public links for repair status)
-- Creates a table to store public tokens linked to repair tickets for client-accessible status pages.

create table if not exists public.repair_public_links (
  id uuid primary key default gen_random_uuid(),
  repair_id uuid not null references public.repair_tickets(id) on delete cascade,
  token uuid not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists repair_public_links_repair_id_idx on public.repair_public_links(repair_id);

-- RLS: enabled; by default no policies (service role bypasses RLS)
alter table public.repair_public_links enable row level security;

-- Optional read policy for debugging (commented out by default)
-- create policy "debug_read_links" on public.repair_public_links for select to authenticated using (true);

comment on table public.repair_public_links is 'Stores public tokens for client-facing repair status pages (used by Netlify Functions).';
