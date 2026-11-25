-- VerticalTec Branch Installation Check List Schema
-- Run this in Supabase Dashboard -> SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.checklists (
  id uuid primary key default gen_random_uuid(),
  store_id text not null default '',
  shop_name text not null default '',
  engineer_in_charge text not null default '',
  doc_datetime text not null default '',
  address text not null default '',
  total_work_days integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_checklists_updated_at on public.checklists (updated_at desc);
create index if not exists idx_checklists_store_id on public.checklists (store_id);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_checklists_updated_at on public.checklists;
create trigger trg_checklists_updated_at
  before update on public.checklists
  for each row
  execute function public.handle_updated_at();

-- Grant Data API access
grant select, insert, update, delete on table public.checklists to anon, authenticated;

-- Enable RLS
alter table public.checklists enable row level security;

-- Internal no-login mode policies (anon + authenticated)
drop policy if exists "Allow public read checklists" on public.checklists;
create policy "Allow public read checklists"
  on public.checklists for select
  to anon, authenticated
  using (true);

drop policy if exists "Allow public insert checklists" on public.checklists;
create policy "Allow public insert checklists"
  on public.checklists for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Allow public update checklists" on public.checklists;
create policy "Allow public update checklists"
  on public.checklists for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Allow public delete checklists" on public.checklists;
create policy "Allow public delete checklists"
  on public.checklists for delete
  to anon, authenticated
  using (true);

-- Storage bucket for checklist photos
insert into storage.buckets (id, name, public)
values ('checklist-photos', 'checklist-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Allow public read checklist-photos" on storage.objects;
create policy "Allow public read checklist-photos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'checklist-photos');

drop policy if exists "Allow public upload checklist-photos" on storage.objects;
create policy "Allow public upload checklist-photos"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'checklist-photos');

drop policy if exists "Allow public update checklist-photos" on storage.objects;
create policy "Allow public update checklist-photos"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'checklist-photos')
  with check (bucket_id = 'checklist-photos');

drop policy if exists "Allow public delete checklist-photos" on storage.objects;
create policy "Allow public delete checklist-photos"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'checklist-photos');
