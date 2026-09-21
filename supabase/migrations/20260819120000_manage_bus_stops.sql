-- Editing and retiring bus stops from the protected portal.
--
-- Retiring is a soft delete. stop_feedback references bus_stops with
-- "on delete restrict", so a real delete of a stop that carries feedback is
-- refused by the database. Keeping the row instead means the reports survive
-- and the inbox can still name the stop each one concerns, while the stop
-- disappears from the public map and from the active list.

alter table public.bus_stops
  add column if not exists archived_at timestamptz;

create index if not exists bus_stops_active_idx
  on public.bus_stops (created_at desc) where archived_at is null;

-- Archived stops leave the public map; signed-in staff keep seeing them.
drop policy if exists "Published stops are public" on public.bus_stops;
create policy "Published stops are public"
on public.bus_stops for select
using ((is_published and archived_at is null) or auth.uid() is not null);

-- The previous single policy required created_by to equal the acting user on
-- every write, which stopped one administrator from editing another's stop.
-- Ownership is still enforced on insert.
drop policy if exists "Authenticated users manage stops" on public.bus_stops;

drop policy if exists "Authenticated users add stops" on public.bus_stops;
drop policy if exists "Authenticated users edit stops" on public.bus_stops;
drop policy if exists "Authenticated users remove stops" on public.bus_stops;

create policy "Authenticated users add stops"
on public.bus_stops for insert to authenticated
with check (created_by = auth.uid());

create policy "Authenticated users edit stops"
on public.bus_stops for update to authenticated
using (true) with check (true);

create policy "Authenticated users remove stops"
on public.bus_stops for delete to authenticated
using (true);

-- An archived stop is no longer a valid target for new feedback.
drop policy if exists "Anyone can submit feedback for published stops" on public.stop_feedback;
create policy "Anyone can submit feedback for published stops"
on public.stop_feedback for insert to anon, authenticated
with check (exists (
  select 1 from public.bus_stops
  where id = bus_stop_id and is_published and archived_at is null
));

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
  if not exists (select 1 from public.bus_stops where id = p_bus_stop_id and is_published and archived_at is null) then raise exception 'Stop not found'; end if;
  if exists (select 1 from unnest(p_categories) slug where not exists (select 1 from public.feedback_categories c where c.slug = slug and c.is_active)) then raise exception 'Invalid category'; end if;

  insert into public.stop_feedback (bus_stop_id, severity, description, email, consent_to_contact, language)
  values (p_bus_stop_id, p_severity, nullif(trim(p_description), ''), case when p_consent_to_contact then nullif(trim(p_email), '') end, p_consent_to_contact, p_language)
  returning id into new_id;
  insert into public.stop_feedback_categories (feedback_id, category_slug)
  select new_id, slug from (select distinct unnest(p_categories) slug) selected;
  return new_id;
end;
$$;
