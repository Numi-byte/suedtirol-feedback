create extension if not exists pgcrypto;

create table public.bus_stops (
  id uuid primary key default gen_random_uuid(),
  name_de text not null check (char_length(trim(name_de)) > 0),
  name_it text not null check (char_length(trim(name_it)) > 0),
  name_en text not null check (char_length(trim(name_en)) > 0),
  municipality text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  stop_code text unique,
  is_accessible boolean not null default false,
  is_published boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bus_stops_location_idx on public.bus_stops (latitude, longitude);
create index bus_stops_published_idx on public.bus_stops (is_published) where is_published;

create table public.stop_feedback (
  id uuid primary key default gen_random_uuid(),
  bus_stop_id uuid not null references public.bus_stops(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  language text not null check (language in ('de', 'it', 'en')),
  created_at timestamptz not null default now()
);

create index stop_feedback_stop_idx on public.stop_feedback (bus_stop_id, created_at desc);

alter table public.bus_stops enable row level security;
alter table public.stop_feedback enable row level security;

create policy "Published stops are public"
on public.bus_stops for select using (is_published or auth.uid() is not null);

create policy "Authenticated users manage stops"
on public.bus_stops for all to authenticated
using (true) with check (created_by = auth.uid());

create policy "Anyone can submit feedback for published stops"
on public.stop_feedback for insert to anon, authenticated
with check (exists (select 1 from public.bus_stops where id = bus_stop_id and is_published));

create policy "Authenticated users read feedback"
on public.stop_feedback for select to authenticated using (true);
