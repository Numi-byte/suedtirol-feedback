-- EFA provides Italian names only. Keep untranslated fields empty, not fabricated.
alter table public.bus_stops
  add column if not exists stop_id text;
alter table public.bus_stops drop constraint if exists bus_stops_name_de_check;
alter table public.bus_stops drop constraint if exists bus_stops_name_en_check;
create unique index if not exists bus_stops_stop_id_unique
  on public.bus_stops(stop_id) where stop_id is not null;

create or replace function public.import_efa_stop_place_batch(p_rows jsonb)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  r record;
  matches uuid[];
  affected integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'An EFA batch must be an array';
  end if;
  if jsonb_array_length(p_rows) not between 1 and 250 then
    raise exception 'An EFA batch must contain between 1 and 250 stops';
  end if;
  -- Serialize identity lookup and insertion against all other stop writers,
  -- including CSV imports, to prevent a race creating a second place.
  lock table public.bus_stops in share row exclusive mode;
  for r in select * from jsonb_to_recordset(p_rows) as x(
    id_version text, stop_id text, name_it text,
    latitude double precision, longitude double precision
  ) loop
    if r.id_version is null or r.id_version !~ '^\(it:apb:StopPlace:it:22021:[0-9]+,any\)$'
      or nullif(trim(r.stop_id), '') is null or nullif(trim(r.name_it), '') is null
      or r.latitude is null or not (r.latitude between -90 and 90)
      or r.longitude is null or not (r.longitude between -180 and 180)
    then raise exception 'Invalid EFA stop data'; end if;

    -- Match the complete source reference, ignoring only its version. Existing
    -- CSV private codes are retained; stopId is stored separately as stop_id.
    select array_agg(id) into matches from public.bus_stops
    where split_part(trim(both '()' from id_version), ',', 1) =
          split_part(trim(both '()' from r.id_version), ',', 1)
       or stop_id = trim(r.stop_id) or stop_code = trim(r.stop_id);
    if coalesce(cardinality(matches), 0) > 1 then
      raise exception 'Multiple existing stops match EFA place %. Resolve duplicates before retrying.', r.id_version;
    end if;
    if cardinality(matches) = 1 then
      if exists (select 1 from public.bus_stops where id = matches[1] and (
        (id_version is not null and split_part(trim(both '()' from id_version), ',', 1) <>
          split_part(trim(both '()' from r.id_version), ',', 1))
        or (stop_id is not null and stop_id <> trim(r.stop_id))
      )) then raise exception 'Conflicting source identity for EFA place %.', r.id_version; end if;
      update public.bus_stops set
        id_version = r.id_version, stop_id = trim(r.stop_id), name_it = trim(r.name_it),
        latitude = r.latitude, longitude = r.longitude,
        is_published = false, updated_at = now()
      where id = matches[1];
    else
      insert into public.bus_stops (
        id_version, stop_id, stop_code, name_it, name_de, name_en,
        latitude, longitude, municipality, is_published, created_by
      ) values (
        r.id_version, trim(r.stop_id), trim(r.stop_id), trim(r.name_it), '', '',
        r.latitude, r.longitude, '', false, auth.uid()
      );
    end if;
    affected := affected + 1;
  end loop;
  return affected;
end;
$$;

revoke all on function public.import_efa_stop_place_batch(jsonb) from public;
grant execute on function public.import_efa_stop_place_batch(jsonb) to authenticated;
