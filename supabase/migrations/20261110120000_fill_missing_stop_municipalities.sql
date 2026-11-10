-- Missing municipalities only. No stop names, publication or archive state changes.
begin;
alter table public.bus_stops add column municipality_names_missing boolean generated always as
  (btrim(municipality_de)='' or btrim(municipality_it)='') stored;
create index bus_stops_missing_municipalities_idx on public.bus_stops(id) where municipality_names_missing;
create function public.list_stops_missing_municipality(p_after uuid default null, p_limit integer default 250)
returns table(id uuid,id_version text,name_it text,municipality_de text,municipality_it text)
language plpgsql stable security invoker set search_path = public,pg_temp as $$
begin
  if not public.portal_has_access('database') then raise exception 'Database access required' using errcode='42501'; end if;
  if p_limit is null or p_limit not between 1 and 250 then raise exception 'Invalid page size'; end if;
  return query select s.id,s.id_version,s.name_it,s.municipality_de,s.municipality_it from public.bus_stops s
    where s.municipality_names_missing and (p_after is null or s.id>p_after)
    order by s.id limit p_limit;
end;
$$;
revoke all on function public.list_stops_missing_municipality(uuid,integer) from public;
grant execute on function public.list_stops_missing_municipality(uuid,integer) to authenticated;

create function public.fill_missing_stop_municipalities(p_rows jsonb) returns jsonb
language plpgsql security invoker set search_path = public,pg_temp as $$
declare item record; current_stop public.bus_stops%rowtype; changed integer:=0; details jsonb:='[]'::jsonb; reason text;
begin
  if not public.portal_has_access('database') then raise exception 'Database access required' using errcode='42501'; end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 250 then raise exception 'A batch must contain 1–250 stops'; end if;
  for item in select * from jsonb_to_recordset(p_rows) as r(id uuid,source_id text,municipality_de text,municipality_it text) loop
    if item.id is null or item.source_id is null or item.source_id !~ '^it:22021:[^[:space:](),]+$'
      or nullif(btrim(item.municipality_de),'') is null or nullif(btrim(item.municipality_it),'') is null
      or char_length(item.municipality_de)>200 or char_length(item.municipality_it)>200 then raise exception 'Invalid municipality batch'; end if;
    select * into current_stop from public.bus_stops s where s.id=item.id for update;
    reason:=null;
    if not found then reason:='stop_not_found';
    elsif substring(current_stop.id_version from '^\(it:apb:StopPlace:(it:22021:[^[:space:](),]+),[^()]+\)$') is distinct from item.source_id then reason:='source_changed';
    elsif btrim(current_stop.municipality_de)<>'' and btrim(current_stop.municipality_it)<>'' then reason:='already_complete';
    elsif (btrim(current_stop.municipality_de)<>'' and btrim(current_stop.municipality_de)<>item.municipality_de)
      or (btrim(current_stop.municipality_it)<>'' and btrim(current_stop.municipality_it)<>item.municipality_it) then reason:='existing_translation_conflict';
    end if;
    if reason is not null then details:=details||jsonb_build_array(jsonb_build_object('id',item.id,'sourceId',item.source_id,'reason',reason)); continue; end if;
    update public.bus_stops set
      municipality_de=case when btrim(municipality_de)='' then item.municipality_de else municipality_de end,
      municipality_it=case when btrim(municipality_it)='' then item.municipality_it else municipality_it end,
      municipality=case when btrim(municipality)='' then item.municipality_it else municipality end,
      updated_at=now() where id=item.id;
    changed:=changed+1;
  end loop;
  return jsonb_build_object('updated',changed,'details',details);
end;
$$;
revoke all on function public.fill_missing_stop_municipalities(jsonb) from public;
grant execute on function public.fill_missing_stop_municipalities(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
