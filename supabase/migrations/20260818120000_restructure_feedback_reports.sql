-- Category-based stop feedback wizard. Apply after the two 20260811 migrations.
-- Existing rating feedback is retained; the old overall_rating remains nullable so
-- both historic rows and the new reporting flow can coexist safely.

alter table public.stop_feedback
  alter column overall_rating drop not null,
  add column if not exists severity text
    check (severity is null or severity in ('low', 'medium', 'high')),
  add column if not exists description text
    check (description is null or char_length(description) <= 500);

create table if not exists public.feedback_categories (
  slug text primary key,
  sort_order smallint not null unique check (sort_order > 0),
  label_de text not null,
  label_it text not null,
  label_en text not null,
  is_active boolean not null default true
);

insert into public.feedback_categories (slug, sort_order, label_de, label_it, label_en) values
  ('weather_protection', 1, 'Witterungsschutz fehlt', 'Manca la protezione dalle intemperie', 'Weather protection is missing'),
  ('seating', 2, 'Sitzplatz fehlt', 'Mancano posti a sedere', 'Seating is missing'),
  ('safe_sidewalk', 3, 'Sicherer Gehweg zur Haltestelle fehlt', 'Manca un percorso pedonale sicuro verso la fermata', 'Safe footpath to the stop is missing'),
  ('safe_crossing', 4, 'Keine sichere Querung der Straße zur Haltestelle', 'Manca un attraversamento sicuro verso la fermata', 'Safe road crossing to the stop is missing'),
  ('passenger_information', 5, 'Fahrgastinformation fehlt oder ist mangelhaft', 'Le informazioni ai passeggeri mancano o sono insufficienti', 'Passenger information is missing or inadequate'),
  ('lighting', 6, 'Beleuchtung fehlt', 'Manca l’illuminazione', 'Lighting is missing'),
  ('accessibility', 7, 'Barrierefreiheit nicht gegeben', 'La fermata non è accessibile', 'Accessibility is inadequate'),
  ('shading', 8, 'Beschattung fehlt', 'Manca l’ombreggiatura', 'Shade is missing'),
  ('bicycle_parking', 9, 'Fahrradabstellplatz fehlt', 'Manca il parcheggio per biciclette', 'Bicycle parking is missing'),
  ('waste_bin', 10, 'Mülleimer fehlt', 'Manca il cestino', 'Waste bin is missing')
on conflict (slug) do update set
  sort_order = excluded.sort_order,
  label_de = excluded.label_de,
  label_it = excluded.label_it,
  label_en = excluded.label_en;

create table if not exists public.stop_feedback_categories (
  feedback_id uuid not null references public.stop_feedback(id) on delete cascade,
  category_slug text not null references public.feedback_categories(slug),
  primary key (feedback_id, category_slug)
);

create table if not exists public.stop_feedback_photos (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.stop_feedback(id) on delete cascade,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists stop_feedback_severity_idx on public.stop_feedback (severity, created_at desc);
create index if not exists stop_feedback_categories_category_idx on public.stop_feedback_categories (category_slug);
create index if not exists stop_feedback_photos_feedback_idx on public.stop_feedback_photos (feedback_id);

alter table public.feedback_categories enable row level security;
alter table public.stop_feedback_categories enable row level security;
alter table public.stop_feedback_photos enable row level security;

create policy "Active feedback categories are public"
on public.feedback_categories for select to anon, authenticated using (is_active);

create policy "Authenticated users read feedback categories"
on public.stop_feedback_categories for select to authenticated using (true);

create policy "Authenticated users read feedback photos"
on public.stop_feedback_photos for select to authenticated using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-photos', 'feedback-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Anyone can upload feedback photos"
on storage.objects for insert to anon, authenticated
with check (bucket_id = 'feedback-photos');

create policy "Authenticated users read feedback photos bucket"
on storage.objects for select to authenticated
using (bucket_id = 'feedback-photos');

-- Enforce the new report requirements only for rows submitted through this flow.
alter table public.stop_feedback
  add constraint stop_feedback_category_report_check
  check (
    (severity is null and description is null)
    or (severity is not null and overall_rating is null)
  );

-- A security-definer function keeps the feedback row and its category links in
-- one transaction. Callers cannot attach categories to arbitrary existing rows.
create or replace function public.create_feedback_report(
  p_bus_stop_id uuid,
  p_categories text[],
  p_severity text,
  p_description text default null,
  p_email text default null,
  p_consent_to_contact boolean default false,
  p_language text default 'de'
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare new_id uuid;
begin
  if coalesce(array_length(p_categories, 1), 0) = 0 then raise exception 'At least one category is required'; end if;
  if p_severity not in ('low', 'medium', 'high') then raise exception 'Invalid severity'; end if;
  if p_language not in ('de', 'it', 'en') then raise exception 'Invalid language'; end if;
  if p_consent_to_contact and nullif(trim(p_email), '') is null then raise exception 'Email is required for contact'; end if;
  if not exists (select 1 from public.bus_stops where id = p_bus_stop_id and is_published) then raise exception 'Stop not found'; end if;
  if exists (select 1 from unnest(p_categories) slug where not exists (select 1 from public.feedback_categories c where c.slug = slug and c.is_active)) then raise exception 'Invalid category'; end if;

  insert into public.stop_feedback (bus_stop_id, severity, description, email, consent_to_contact, language)
  values (p_bus_stop_id, p_severity, nullif(trim(p_description), ''), case when p_consent_to_contact then nullif(trim(p_email), '') end, p_consent_to_contact, p_language)
  returning id into new_id;
  insert into public.stop_feedback_categories (feedback_id, category_slug)
  select new_id, slug from (select distinct unnest(p_categories) slug) selected;
  return new_id;
end;
$$;

create or replace function public.register_feedback_photo(p_feedback_id uuid, p_storage_path text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if split_part(p_storage_path, '/', 1) <> p_feedback_id::text then raise exception 'Invalid photo path'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'feedback-photos' and name = p_storage_path) then raise exception 'Photo not found'; end if;
  insert into public.stop_feedback_photos (feedback_id, storage_path) values (p_feedback_id, p_storage_path);
end;
$$;

revoke all on function public.create_feedback_report(uuid, text[], text, text, text, boolean, text) from public;
grant execute on function public.create_feedback_report(uuid, text[], text, text, text, boolean, text) to anon, authenticated;
revoke all on function public.register_feedback_photo(uuid, text) from public;
grant execute on function public.register_feedback_photo(uuid, text) to anon, authenticated;
