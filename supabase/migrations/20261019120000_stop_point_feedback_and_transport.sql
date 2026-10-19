-- Apply before deploying the point-based public client and protected editor.
-- Historic reports retain a NULL point: their original platform is unknown.
begin;

alter table public.stop_points add column transport_type text not null default 'bus'
  check (transport_type in ('bus', 'train', 'cable_car'));
alter table public.stop_points add constraint stop_points_id_place_unique unique (id, stop_place_id);
alter table public.stop_feedback add column stop_point_id uuid;
alter table public.stop_feedback add constraint stop_feedback_point_place_fkey
  foreign key (stop_point_id, bus_stop_id) references public.stop_points(id, stop_place_id) on delete restrict;
create index stop_feedback_point_created_idx on public.stop_feedback(stop_point_id, created_at desc);

-- Preserve updates/replies to old reports, while requiring a point on every new report.
create function public.require_feedback_stop_point() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.stop_point_id is null then raise exception 'Select a stop point before submitting feedback'; end if;
  return new;
end;
$$;
create trigger require_feedback_stop_point before insert on public.stop_feedback
  for each row execute function public.require_feedback_stop_point();

-- All new public writes use the atomic RPC below. Old clients cannot accidentally
-- create place-level reports or bypass category/point validation with a table insert.
revoke insert on public.stop_feedback from anon, authenticated;
drop policy if exists "Anyone can submit feedback for published stops" on public.stop_feedback;
revoke all on function public.create_feedback_report(uuid, text[], text, text, text, boolean, text) from public, anon, authenticated;

create function public.create_stop_point_feedback(
  p_stop_point_id uuid, p_categories text[], p_severity text,
  p_description text default null, p_email text default null,
  p_consent_to_contact boolean default false, p_language text default 'de'
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare place_id uuid; new_id uuid;
begin
  if coalesce(array_length(p_categories, 1), 0) = 0 then raise exception 'At least one category is required'; end if;
  if p_severity is null or p_severity not in ('low', 'medium', 'high') then raise exception 'Invalid severity'; end if;
  if p_language is null or p_language not in ('de', 'it', 'en') then raise exception 'Invalid language'; end if;
  if p_consent_to_contact is null then raise exception 'Contact preference is required'; end if;
  if p_consent_to_contact and nullif(trim(p_email), '') is null then raise exception 'Email is required for contact'; end if;
  select points.stop_place_id into place_id from public.stop_points points
    join public.bus_stops places on places.id = points.stop_place_id
    where points.id = p_stop_point_id and places.is_published and places.archived_at is null
    for share of points, places;
  if place_id is null then raise exception 'Published stop point not found'; end if;
  if exists (select 1 from unnest(p_categories) slug where not exists
    (select 1 from public.feedback_categories c where c.slug = slug and c.is_active)) then raise exception 'Invalid category'; end if;
  insert into public.stop_feedback(bus_stop_id, stop_point_id, severity, description, email, consent_to_contact, language)
    values (place_id, p_stop_point_id, p_severity, nullif(trim(p_description), ''),
      case when p_consent_to_contact then nullif(trim(p_email), '') end, p_consent_to_contact, p_language)
    returning id into new_id;
  insert into public.stop_feedback_categories(feedback_id, category_slug)
    select new_id, slug from (select distinct unnest(p_categories) slug) chosen;
  return new_id;
end;
$$;
revoke all on function public.create_stop_point_feedback(uuid, text[], text, text, text, boolean, text) from public;
grant execute on function public.create_stop_point_feedback(uuid, text[], text, text, text, boolean, text) to anon, authenticated;

drop function public.list_published_stop_points(uuid);
create function public.list_published_stop_points(p_stop_place_id uuid)
returns table (id uuid, point_number text, latitude double precision, longitude double precision, name_de text, name_it text, transport_type text)
language sql stable security definer set search_path = public, pg_temp as $$
  select points.id, points.point_number, points.latitude, points.longitude, points.name_de, points.name_it, points.transport_type
  from public.stop_points points join public.bus_stops places on places.id = points.stop_place_id
  where places.id = p_stop_place_id and places.is_published and places.archived_at is null
  order by points.point_number, points.id;
$$;
revoke all on function public.list_published_stop_points(uuid) from public;
grant execute on function public.list_published_stop_points(uuid) to anon, authenticated;

create function public.get_published_stop_point(p_stop_point_id uuid)
returns table (id uuid, stop_place_id uuid, point_number text, name_de text, name_it text,
  transport_type text, place_name_de text, place_name_it text, place_name_en text, municipality text)
language sql stable security definer set search_path = public, pg_temp as $$
  select points.id, points.stop_place_id, points.point_number, points.name_de, points.name_it,
    points.transport_type, places.name_de, places.name_it, places.name_en, places.municipality
  from public.stop_points points join public.bus_stops places on places.id = points.stop_place_id
  where points.id = p_stop_point_id and places.is_published and places.archived_at is null;
$$;
revoke all on function public.get_published_stop_point(uuid) from public;
grant execute on function public.get_published_stop_point(uuid) to anon, authenticated;

-- Threads are scoped to exactly one published point; legacy place reports never
-- bleed into a sibling platform's discussion. Private report fields stay private.
create function public.list_public_stop_point_threads(p_stop_point_id uuid)
returns table (feedback_id uuid, submitted_at timestamptz, category_slugs text[], reply_body text, replied_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select feedback.id, feedback.created_at,
    array_agg(categories.category_slug order by definitions.sort_order), replies.body, replies.updated_at
  from public.stop_feedback feedback
  join public.stop_points points on points.id = feedback.stop_point_id and points.stop_place_id = feedback.bus_stop_id
  join public.bus_stops places on places.id = points.stop_place_id and places.is_published and places.archived_at is null
  join public.stop_feedback_categories categories on categories.feedback_id = feedback.id
  join public.feedback_categories definitions on definitions.slug = categories.category_slug and definitions.is_active
  left join public.feedback_replies replies on replies.feedback_id = feedback.id
  where points.id = p_stop_point_id
  group by feedback.id, feedback.created_at, replies.body, replies.updated_at
  order by feedback.created_at desc limit 100;
$$;
revoke all on function public.list_public_stop_point_threads(uuid) from public;
grant execute on function public.list_public_stop_point_threads(uuid) to anon, authenticated;
revoke all on function public.list_public_feedback_threads(uuid) from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
