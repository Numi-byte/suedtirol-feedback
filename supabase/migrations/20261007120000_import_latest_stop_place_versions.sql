-- Keep the complete third CSV field, including its parenthesized version.
alter table public.bus_stops
    add column if not exists id_version text,
    add column if not exists publication_timestamp timestamptz;

-- Invoker rights retain the existing authenticated staff RLS policies.
create or replace function public.import_stop_place_batch(p_rows jsonb, p_published boolean)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
affected integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'An import batch must be an array';
end if;
  if jsonb_array_length(p_rows) not between 1 and 250 then
    raise exception 'An import batch must contain between 1 and 250 stops';
end if;
  if exists (
    select 1 from jsonb_to_recordset(p_rows) as r(
      name_de text, name_it text, name_en text, stop_code text, id_version text,
      publication_timestamp timestamptz, latitude double precision, longitude double precision
    ) where nullif(trim(name_de), '') is null or nullif(trim(name_it), '') is null
      or nullif(trim(name_en), '') is null or nullif(trim(stop_code), '') is null
      or nullif(trim(id_version), '') is null or publication_timestamp is null
      or not isfinite(publication_timestamp)
      or latitude is null or longitude is null
      or not (latitude between -90 and 90) or not (longitude between -180 and 180)
  ) then raise exception 'The import batch contains invalid stop data'; end if;

insert into public.bus_stops as existing (
    name_de, name_it, name_en, stop_code, id_version, publication_timestamp,
    latitude, longitude, municipality, is_published, created_by
  )
select name_de, name_it, name_en, stop_code, id_version, publication_timestamp,
       latitude, longitude, '', coalesce(p_published, false), auth.uid()
from (
         select distinct on (trim(stop_code))
             trim(name_de) as name_de, trim(name_it) as name_it, trim(name_en) as name_en,
             trim(stop_code) as stop_code, trim(id_version) as id_version,
             publication_timestamp, latitude, longitude
         from jsonb_to_recordset(p_rows) as r(
             name_de text, name_it text, name_en text, stop_code text, id_version text,
             publication_timestamp timestamptz, latitude double precision, longitude double precision
             )
         order by trim(stop_code), publication_timestamp desc
     ) as latest
    on conflict (stop_code) do update set
    name_de = excluded.name_de, name_it = excluded.name_it, name_en = excluded.name_en,
                                   id_version = excluded.id_version, publication_timestamp = excluded.publication_timestamp,
                                   latitude = excluded.latitude, longitude = excluded.longitude, updated_at = now()
                               where existing.publication_timestamp is null
                                  or excluded.publication_timestamp > existing.publication_timestamp;
get diagnostics affected = row_count;
return affected;
end;
$$;

revoke all on function public.import_stop_place_batch(jsonb, boolean) from public;
grant execute on function public.import_stop_place_batch(jsonb, boolean) to authenticated;
