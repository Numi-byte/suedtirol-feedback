-- Requires 20261007120000_import_latest_stop_place_versions.sql first.
create or replace function public.stop_point_parent_ref(p_id_version text)
returns text
language sql
immutable
strict
set search_path = public, pg_temp
as $$
  select parts[1] || ':StopPlace:' || parts[2] || ':' || parts[3] || ':' || parts[4]
  from regexp_match(trim(p_id_version),
    '^\(([^(),]+):ScheduledStopPoint:([^:(),]+):([^:(),]+):([^:(),]+):([^:(),]+):([^:(),]+),([^(),]+)\)$') as match(parts);
$$;

create index if not exists bus_stops_source_ref_idx
  on public.bus_stops ((split_part(trim(both '()' from id_version), ',', 1)))
  where id_version is not null;

create table public.stop_points (
  id uuid primary key default gen_random_uuid(),
  stop_place_id uuid not null references public.bus_stops(id) on delete cascade,
  point_ref text not null unique,
  id_version text not null check (public.stop_point_parent_ref(id_version) is not null),
  point_number text not null check (char_length(trim(point_number)) > 0),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  name_de text not null check (char_length(trim(name_de)) > 0),
  name_it text not null check (char_length(trim(name_it)) > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (point_ref = split_part(trim(both '()' from id_version), ',', 1))
);
create index stop_points_place_idx on public.stop_points(stop_place_id);

alter table public.stop_points enable row level security;
create policy "Staff read stop points" on public.stop_points for select to authenticated using (true);
create policy "Staff add stop points" on public.stop_points for insert to authenticated with check (created_by = auth.uid());
create policy "Staff update stop points" on public.stop_points for update to authenticated using (true) with check (true);
grant select, insert, update on public.stop_points to authenticated;

create or replace function public.import_stop_point_batch(p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  item record;
  parent_id uuid;
  parent_ref text;
  parent_count integer;
  imported integer := 0;
  unmatched integer := 0;
  errors jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'An import batch must be an array'; end if;
  if jsonb_array_length(p_rows) not between 1 and 250 then
    raise exception 'An import batch must contain between 1 and 250 points';
  end if;
  for item in select * from jsonb_to_recordset(p_rows) as r(
    id_version text, point_number text, latitude double precision, longitude double precision, name_de text, name_it text
  ) loop
    parent_ref := public.stop_point_parent_ref(item.id_version);
    if parent_ref is null or nullif(trim(item.point_number), '') is null
      or nullif(trim(item.name_de), '') is null or nullif(trim(item.name_it), '') is null
      or item.latitude is null or item.longitude is null
      or not (item.latitude between -90 and 90) or not (item.longitude between -180 and 180)
    then raise exception 'The import batch contains invalid point data'; end if;

    select count(*), (array_agg(id))[1] into parent_count, parent_id
    from public.bus_stops
    where split_part(trim(both '()' from id_version), ',', 1) = parent_ref;
    if parent_count <> 1 then
      unmatched := unmatched + 1;
      errors := errors || jsonb_build_array(format('%s: %s matching stop places for %s. Import the stop place first or resolve duplicate place identifiers.',
        item.id_version, parent_count, parent_ref));
      continue;
    end if;

    insert into public.stop_points as existing (
      stop_place_id, point_ref, id_version, point_number, latitude, longitude, name_de, name_it, created_by
    ) values (
      parent_id, split_part(trim(both '()' from item.id_version), ',', 1), trim(item.id_version),
      trim(item.point_number), item.latitude, item.longitude, trim(item.name_de), trim(item.name_it), auth.uid()
    ) on conflict (point_ref) do update set
      stop_place_id = excluded.stop_place_id, id_version = excluded.id_version,
      point_number = excluded.point_number, latitude = excluded.latitude, longitude = excluded.longitude,
      name_de = excluded.name_de, name_it = excluded.name_it, updated_at = now();
    imported := imported + 1;
  end loop;
  return jsonb_build_object('imported', imported, 'unmatched', unmatched, 'errors', errors);
end;
$$;
revoke all on function public.import_stop_point_batch(jsonb) from public;
grant execute on function public.import_stop_point_batch(jsonb) to authenticated;

-- Public reads always enforce publication, even with an authenticated cookie.
-- Only the names, point number and map coordinates are exposed.
create or replace function public.list_published_stop_points(p_stop_place_id uuid)
returns table (id uuid, point_number text, latitude double precision, longitude double precision, name_de text, name_it text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select points.id, points.point_number, points.latitude, points.longitude, points.name_de, points.name_it
  from public.stop_points points
  join public.bus_stops places on places.id = points.stop_place_id
  where places.id = p_stop_place_id and places.is_published and places.archived_at is null
  order by points.point_number, points.point_ref;
$$;
revoke all on function public.list_published_stop_points(uuid) from public;
grant execute on function public.list_published_stop_points(uuid) to anon, authenticated;
