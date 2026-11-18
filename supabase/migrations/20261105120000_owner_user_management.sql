-- Apply before deploying section permissions / owner-only user management.
begin;
alter table public.portal_staff
  add column is_active boolean not null default true,
  add column can_manage_stops boolean not null default true,
  add column can_manage_database boolean not null default true,
  add column can_view_feedback boolean not null default true;

create function public.is_portal_owner() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(auth.uid() = 'bdee91d9-c969-4bd4-b336-8f7e780ead3e'::uuid, false);
$$;
revoke all on function public.is_portal_owner() from public;
grant execute on function public.is_portal_owner() to anon, authenticated;

create function public.portal_has_access(p_section text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select p_section in ('users','stops','database','feedback') and (
    public.is_portal_owner() or exists (
      select 1 from public.portal_staff where user_id = auth.uid() and is_active and
        case p_section when 'stops' then can_manage_stops when 'database' then can_manage_database
          when 'feedback' then can_view_feedback else false end
    )
  );
$$;
revoke all on function public.portal_has_access(text) from public;
grant execute on function public.portal_has_access(text) to anon, authenticated;
create or replace function public.is_portal_staff() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.portal_has_access('stops') or public.portal_has_access('database') or public.portal_has_access('feedback') or public.is_portal_owner();
$$;
create function public.get_portal_access() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('users',public.is_portal_owner(),'stops',public.portal_has_access('stops'),
    'database',public.portal_has_access('database'),'feedback',public.portal_has_access('feedback'));
$$;
revoke all on function public.get_portal_access() from public;
grant execute on function public.get_portal_access() to anon, authenticated;

create table public.portal_user_management_events (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  target_id uuid not null,
  event text not null check (event in ('access_updated','account_create_requested','account_created','account_create_failed','credentials_update_requested','credentials_updated','credentials_update_failed')),
  created_at timestamptz not null default now()
);
alter table public.portal_user_management_events enable row level security;
revoke all on public.portal_user_management_events from public, anon, authenticated;
revoke all on sequence public.portal_user_management_events_id_seq from public, anon, authenticated;
create function public.record_portal_user_event(p_user_id uuid, p_event text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_portal_owner() then raise exception 'Owner access required' using errcode = '42501'; end if;
  insert into public.portal_user_management_events(actor_id,target_id,event) values(auth.uid(),p_user_id,p_event);
end;
$$;
revoke all on function public.record_portal_user_event(uuid,text) from public;
grant execute on function public.record_portal_user_event(uuid,text) to authenticated;

create function public.set_portal_user_access(p_user_id uuid, p_active boolean, p_stops boolean, p_database boolean, p_feedback boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_portal_owner() then raise exception 'Owner access required' using errcode = '42501'; end if;
  if p_user_id = 'bdee91d9-c969-4bd4-b336-8f7e780ead3e'::uuid then raise exception 'Owner access cannot be changed'; end if;
  if p_user_id is null or p_active is null or p_stops is null or p_database is null or p_feedback is null then raise exception 'All access settings are required'; end if;
  if p_active and not (p_stops or p_database or p_feedback) then raise exception 'Choose at least one section for an active account'; end if;
  insert into public.portal_staff(user_id,is_active,can_manage_stops,can_manage_database,can_view_feedback)
  values(p_user_id,p_active,p_stops,p_database,p_feedback)
  on conflict(user_id) do update set is_active=excluded.is_active,can_manage_stops=excluded.can_manage_stops,
    can_manage_database=excluded.can_manage_database,can_view_feedback=excluded.can_view_feedback;
  perform public.record_portal_user_event(p_user_id,'access_updated');
end;
$$;
revoke all on function public.set_portal_user_access(uuid,boolean,boolean,boolean,boolean) from public;
grant execute on function public.set_portal_user_access(uuid,boolean,boolean,boolean,boolean) to authenticated;

-- Only the owner can list Auth identities. No credential/hash fields are exposed.
create function public.list_portal_users(p_page integer default 1, p_search text default '')
returns table(user_id uuid,email text,created_at timestamptz,is_active boolean,can_manage_stops boolean,can_manage_database boolean,can_view_feedback boolean,is_owner boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_portal_owner() then raise exception 'Owner access required' using errcode = '42501'; end if;
  if p_page is null or p_page < 1 or p_page > 10000 or char_length(p_search) > 200 then raise exception 'Invalid page or search'; end if;
  return query select u.id,u.email::text,u.created_at,
    coalesce(s.is_active,false),coalesce(s.can_manage_stops,false),coalesce(s.can_manage_database,false),coalesce(s.can_view_feedback,false),
    u.id='bdee91d9-c969-4bd4-b336-8f7e780ead3e'::uuid
  from auth.users u left join public.portal_staff s on s.user_id=u.id
  where coalesce(u.email,'') ilike '%' || replace(replace(replace(coalesce(p_search,''),'\','\\'),'%','\%'),'_','\_') || '%'
  order by u.created_at desc,u.id limit 26 offset (p_page-1)*25;
end;
$$;
revoke all on function public.list_portal_users(integer,text) from public;
grant execute on function public.list_portal_users(integer,text) to authenticated;

-- Separate direct database editing from import privileges. Importers use the
-- validated, bounded RPCs below; they cannot bypass their section via table API.
create policy "Section scoped reads" on public.bus_stops as restrictive for select to authenticated
  using ((select public.portal_has_access('database')) or (select public.portal_has_access('feedback')));
create policy "Database section inserts" on public.bus_stops as restrictive for insert to authenticated
  with check ((select public.portal_has_access('database')));
create policy "Database section updates" on public.bus_stops as restrictive for update to authenticated
  using ((select public.portal_has_access('database'))) with check ((select public.portal_has_access('database')));
create policy "Section scoped reads" on public.stop_points as restrictive for select to authenticated
  using ((select public.portal_has_access('database')) or (select public.portal_has_access('feedback')));
create policy "Database section inserts" on public.stop_points as restrictive for insert to authenticated
  with check ((select public.portal_has_access('database')));
create policy "Database section updates" on public.stop_points as restrictive for update to authenticated
  using ((select public.portal_has_access('database'))) with check ((select public.portal_has_access('database')));
create policy "Feedback section reads" on public.stop_feedback as restrictive for select to authenticated
  using ((select public.portal_has_access('feedback')));
create policy "Feedback section reads" on public.stop_feedback_categories as restrictive for select to authenticated
  using ((select public.portal_has_access('feedback')));
create policy "Feedback section reads" on public.stop_feedback_photos as restrictive for select to authenticated
  using ((select public.portal_has_access('feedback')));
create policy "Feedback section reads" on public.feedback_replies as restrictive for select to authenticated
  using ((select public.portal_has_access('feedback')));
create policy "Feedback section reads" on public.feedback_test_results as restrictive for select to authenticated
  using ((select public.portal_has_access('feedback')));
create policy "Feedback section private photos" on storage.objects as restrictive for select to anon,authenticated
  using (bucket_id <> 'feedback-photos' or (select public.portal_has_access('feedback')));
create or replace function public.import_stop_place_batch(p_rows jsonb, p_published boolean)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected integer;
begin
  if not public.portal_has_access('stops') then raise exception 'Staff access required' using errcode = '42501'; end if;
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

create or replace function public.import_stop_point_batch(p_rows jsonb)
returns jsonb
language plpgsql
security definer
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
  if not public.portal_has_access('stops') then raise exception 'Staff access required' using errcode = '42501'; end if;
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

create or replace function public.import_efa_stop_place_batch(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  matches uuid[];
  affected integer := 0;
begin
  if not public.portal_has_access('stops') then raise exception 'Staff access required' using errcode = '42501'; end if;
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
    if r.id_version is null or r.id_version !~ '^\(it:apb:StopPlace:it:22021:[^[:space:](),]+,any\)$'
      or (r.stop_id is not null and nullif(trim(r.stop_id), '') is null)
      or nullif(trim(r.name_it), '') is null
      or r.latitude is null or not (r.latitude between -90 and 90)
      or r.longitude is null or not (r.longitude between -180 and 180)
    then raise exception 'Invalid EFA stop data'; end if;

    -- Match the complete source reference, ignoring only its version. Existing
    -- CSV private codes are retained; stopId is stored separately as stop_id.
    select array_agg(id) into matches from public.bus_stops
    where split_part(trim(both '()' from id_version), ',', 1) =
          split_part(trim(both '()' from r.id_version), ',', 1)
       or (nullif(trim(id_version), '') is null
           and (stop_id = trim(r.stop_id) or stop_code = trim(r.stop_id)));
    if coalesce(cardinality(matches), 0) > 1 then
      raise exception 'Multiple existing stops match EFA place %. Resolve duplicates before retrying.', r.id_version;
    end if;
    if cardinality(matches) = 1 then
      if exists (select 1 from public.bus_stops where id = matches[1] and (
        (nullif(trim(id_version), '') is not null and split_part(trim(both '()' from id_version), ',', 1) <>
          split_part(trim(both '()' from r.id_version), ',', 1))
      )) then raise exception 'Conflicting source identity for EFA place %.', r.id_version; end if;
      update public.bus_stops set
        id_version = r.id_version, stop_id = coalesce(trim(r.stop_id), stop_id), name_it = trim(r.name_it),
        latitude = r.latitude, longitude = r.longitude,
        is_published = false, updated_at = now()
      where id = matches[1];
    else
      insert into public.bus_stops (
        id_version, stop_id, stop_code, name_it, name_de, name_en,
        latitude, longitude, municipality, is_published, created_by
      ) values (
        r.id_version, trim(r.stop_id), null, trim(r.name_it), '', '',
        r.latitude, r.longitude, '', false, auth.uid()
      );
    end if;
    affected := affected + 1;
  end loop;
  return affected;
end;
$$;

create or replace function public.update_feedback_status(p_feedback_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.portal_has_access('feedback') then raise exception 'Staff access required' using errcode = '42501'; end if;
  if p_status not in ('new', 'in_review', 'resolved', 'dismissed') then raise exception 'Invalid status'; end if;

  update public.stop_feedback
  set status = p_status,
      reviewed_at = case when p_status = 'new' then null else now() end,
      reviewed_by = case when p_status = 'new' then null else auth.uid() end,
      updated_at = now()
  where id = p_feedback_id;

  if not found then raise exception 'Feedback not found'; end if;
end;
$$;

create or replace function public.reply_to_feedback(p_feedback_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  allowed_authors constant uuid[] := array[
    'bdee91d9-c969-4bd4-b336-8f7e780ead3e'::uuid,
    'bcd1c5c0-8bee-430b-ba38-75530e2b8a30'::uuid
  ];
begin
  if not public.portal_has_access('feedback') then raise exception 'Staff access required' using errcode = '42501'; end if;
  if not (auth.uid() = any(allowed_authors)) then raise exception 'Not authorized to reply'; end if;
  if nullif(trim(p_body), '') is null or char_length(trim(p_body)) > 2000 then
    raise exception 'Reply must contain between 1 and 2000 characters';
  end if;
  if not exists (select 1 from public.stop_feedback where id = p_feedback_id) then
    raise exception 'Feedback not found';
  end if;

  insert into public.feedback_replies (feedback_id, body, author_id)
  values (p_feedback_id, trim(p_body), auth.uid())
  on conflict (feedback_id) do update
    set body = excluded.body, author_id = excluded.author_id, updated_at = now();
end;
$$;

notify pgrst, 'reload schema';
commit;
