-- Apply before deploying either app. Translation fields belong to bus_stops only.
begin;

alter table public.bus_stops
  add column municipality_de text not null default '',
  add column municipality_it text not null default '',
  add constraint bus_stops_municipality_pair_check check (
    (btrim(municipality_de) = '' and btrim(municipality_it) = '')
    or (btrim(municipality_de) <> '' and btrim(municipality_it) <> '')
  );

-- Existing values have no reliable language tag. Preserve the legacy field as
-- a fallback instead of inventing translations. Importers omit both new fields
-- on insert and preserve them on update; staff saves require both in the apps.
comment on column public.bus_stops.municipality is
  'Legacy display fallback for untranslated stops; portal saves also write the Italian municipality here for compatibility.';
comment on column public.bus_stops.municipality_de is
  'German municipality name. Required together with municipality_it on portal saves; both may remain empty for legacy/imported stops.';
comment on column public.bus_stops.municipality_it is
  'Italian municipality name. Required together with municipality_de on portal saves; both may remain empty for legacy/imported stops.';

-- Preserve the existing output fields and permissions, adding only public
-- municipality translations from the parent place.
drop function public.list_published_stops_with_feedback_count();
create function public.list_published_stops_with_feedback_count()
returns table (
  id uuid, name_de text, name_it text, name_en text, municipality text,
  latitude double precision, longitude double precision, is_accessible boolean,
  feedback_count bigint, municipality_de text, municipality_it text
)
language sql stable security definer set search_path = public, pg_temp as $$
  select stops.id, stops.name_de, stops.name_it, stops.name_en,
    stops.municipality, stops.latitude, stops.longitude, stops.is_accessible,
    count(feedback.id), stops.municipality_de, stops.municipality_it
  from public.bus_stops stops
  left join public.stop_feedback feedback on feedback.bus_stop_id = stops.id
  where stops.is_published and stops.archived_at is null
  group by stops.id;
$$;
revoke all on function public.list_published_stops_with_feedback_count() from public;
grant execute on function public.list_published_stops_with_feedback_count() to anon, authenticated;

drop function public.get_published_stop_point(uuid);
create function public.get_published_stop_point(p_stop_point_id uuid)
returns table (
  id uuid, stop_place_id uuid, point_number text, name_de text, name_it text,
  transport_type text, place_name_de text, place_name_it text, place_name_en text,
  municipality text, municipality_de text, municipality_it text
)
language sql stable security definer set search_path = public, pg_temp as $$
  select points.id, points.stop_place_id, points.point_number, points.name_de, points.name_it,
    points.transport_type, places.name_de, places.name_it, places.name_en,
    places.municipality, places.municipality_de, places.municipality_it
  from public.stop_points points join public.bus_stops places on places.id = points.stop_place_id
  where points.id = p_stop_point_id and places.is_published and places.archived_at is null;
$$;
revoke all on function public.get_published_stop_point(uuid) from public;
grant execute on function public.get_published_stop_point(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
