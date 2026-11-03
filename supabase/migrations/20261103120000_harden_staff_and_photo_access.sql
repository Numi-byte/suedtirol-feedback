-- Apply before deploying the hardened applications. See docs/security/REVIEW.md.
-- This migration changes authorization; review staff membership before rollout.
begin;

create table public.portal_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.portal_staff enable row level security;
revoke all on public.portal_staff from public, anon, authenticated;
-- Only the two previously designated reply accounts are known staff. Never
-- infer staff membership from self-signup, email domains or user_metadata.
insert into public.portal_staff(user_id)
select id from auth.users where id in (
  'bdee91d9-c969-4bd4-b336-8f7e780ead3e'::uuid,
  'bcd1c5c0-8bee-430b-ba38-75530e2b8a30'::uuid
);
create function public.is_portal_staff() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.portal_staff where user_id = auth.uid());
$$;
revoke all on function public.is_portal_staff() from public;
grant execute on function public.is_portal_staff() to anon, authenticated;

-- Restrictive policies intersect existing permissive policies, including
-- deployment-specific ones, rather than accidentally broadening access.
create policy "Only approved portal staff" on public.bus_stops
  as restrictive for all to authenticated
  using ((select public.is_portal_staff())) with check ((select public.is_portal_staff()));
create policy "Only approved portal staff" on public.stop_points
  as restrictive for all to authenticated
  using ((select public.is_portal_staff())) with check ((select public.is_portal_staff()));
create policy "Only approved portal staff" on public.stop_feedback
  as restrictive for all to authenticated
  using ((select public.is_portal_staff())) with check ((select public.is_portal_staff()));
create policy "Only approved portal staff" on public.stop_feedback_categories
  as restrictive for all to authenticated
  using ((select public.is_portal_staff())) with check ((select public.is_portal_staff()));
create policy "Only approved portal staff" on public.stop_feedback_photos
  as restrictive for all to authenticated
  using ((select public.is_portal_staff())) with check ((select public.is_portal_staff()));
create policy "Only approved portal staff" on public.feedback_replies
  as restrictive for all to authenticated
  using ((select public.is_portal_staff())) with check ((select public.is_portal_staff()));
create policy "Only approved portal staff" on public.feedback_test_results
  as restrictive for all to authenticated
  using ((select public.is_portal_staff())) with check ((select public.is_portal_staff()));

-- RLS does not protect TRUNCATE. Remove default broad grants explicitly.
revoke all on public.stop_feedback, public.stop_feedback_categories,
  public.stop_feedback_photos, public.feedback_replies, public.feedback_test_results
  from public, anon, authenticated;
grant select on public.stop_feedback, public.stop_feedback_categories,
  public.stop_feedback_photos, public.feedback_replies, public.feedback_test_results to authenticated;
revoke all on public.bus_stops, public.stop_points from public, anon, authenticated;
grant select, insert, update on public.bus_stops, public.stop_points to authenticated;
revoke all on public.feedback_categories from public, anon, authenticated;
grant select on public.feedback_categories to anon, authenticated;
-- Public projections are delivered by the explicitly scoped RPCs.
-- Permanent deletion stays unavailable to app roles; staff archive instead.
create policy "Private feedback storage reads require staff" on storage.objects
  as restrictive for select to anon, authenticated
  using (bucket_id <> 'feedback-photos' or (select public.is_portal_staff()));

create or replace function public.import_stop_place_batch(p_rows jsonb, p_published boolean)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  affected integer;
begin
  if not public.is_portal_staff() then raise exception 'Staff access required' using errcode = '42501'; end if;
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
  if not public.is_portal_staff() then raise exception 'Staff access required' using errcode = '42501'; end if;
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
security invoker
set search_path = public, pg_temp
as $$
declare
  r record;
  matches uuid[];
  affected integer := 0;
begin
  if not public.is_portal_staff() then raise exception 'Staff access required' using errcode = '42501'; end if;
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
  if not public.is_portal_staff() then raise exception 'Staff access required' using errcode = '42501'; end if;
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
  if not public.is_portal_staff() then raise exception 'Staff access required' using errcode = '42501'; end if;
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

-- An independent, private, short-lived capability authorizes one exact object.
-- Public discussion IDs are deliberately insufficient to authorize uploads.
create table public.feedback_upload_capabilities (
  feedback_id uuid primary key references public.stop_feedback(id) on delete cascade,
  storage_path text not null unique,
  expires_at timestamptz not null default (now() + interval '15 minutes')
);
create index feedback_upload_capabilities_expiry_idx on public.feedback_upload_capabilities(expires_at);
alter table public.feedback_upload_capabilities enable row level security;
revoke all on public.feedback_upload_capabilities from public, anon, authenticated;

drop function public.create_stop_point_feedback(uuid, text[], text, text, text, boolean, text);
create function public.create_stop_point_feedback(
  p_stop_point_id uuid, p_categories text[], p_severity text,
  p_description text default null, p_email text default null,
  p_consent_to_contact boolean default false, p_language text default 'de',
  p_upload_token uuid default null, p_photo_extension text default null
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare place_id uuid; new_id uuid;
begin
  if coalesce(cardinality(p_categories), 0) not between 1 and 10 then raise exception 'Choose between 1 and 10 categories'; end if;
  if char_length(p_description) > 500 or char_length(p_email) > 320 then raise exception 'Report field too long'; end if;
  if (p_upload_token is null) <> (p_photo_extension is null)
    or (p_photo_extension is not null and p_photo_extension not in ('jpg', 'png', 'webp')) then
    raise exception 'Invalid photo capability';
  end if;
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
  if p_upload_token is not null then
    insert into public.feedback_upload_capabilities(feedback_id, storage_path)
    values (new_id, new_id::text || '/' || p_upload_token::text || '.' || p_photo_extension);
  end if;
  return new_id;
end;
$$;
revoke all on function public.create_stop_point_feedback(uuid, text[], text, text, text, boolean, text, uuid, text) from public;
grant execute on function public.create_stop_point_feedback(uuid, text[], text, text, text, boolean, text, uuid, text) to anon, authenticated;

create or replace function public.feedback_upload_path_is_valid(object_name text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.feedback_upload_capabilities capability
    where capability.storage_path = object_name and capability.expires_at > now()
      and not exists (select 1 from public.stop_feedback_photos photo where photo.feedback_id = capability.feedback_id)
  );
$$;
-- Also intersects any older permissive upload policy on the same bucket.
create policy "Feedback uploads require a private capability" on storage.objects
  as restrictive for insert to anon, authenticated
  with check (bucket_id <> 'feedback-photos' or public.feedback_upload_path_is_valid(name));

create or replace function public.register_feedback_photo(p_feedback_id uuid, p_storage_path text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Serialize registrations for a report, including simultaneous requests.
  perform 1 from public.feedback_upload_capabilities
    where feedback_id = p_feedback_id and storage_path = p_storage_path and expires_at > now()
    for update;
  if not found then raise exception 'Invalid or expired photo capability' using errcode = '42501'; end if;
  if exists (select 1 from public.stop_feedback_photos where feedback_id = p_feedback_id and storage_path = p_storage_path) then return; end if;
  if exists (select 1 from public.stop_feedback_photos where feedback_id = p_feedback_id) then raise exception 'A report may have only one photo'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'feedback-photos' and name = p_storage_path) then raise exception 'Photo not found'; end if;
  insert into public.stop_feedback_photos(feedback_id, storage_path) values (p_feedback_id, p_storage_path);
end;
$$;

-- Limit joined thread work to the newest 100 reports BEFORE aggregating issues.
create or replace function public.list_public_stop_point_threads(p_stop_point_id uuid)
returns table (feedback_id uuid, submitted_at timestamptz, category_slugs text[], reply_body text, replied_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  with recent as materialized (
    select feedback.id, feedback.created_at
    from public.stop_feedback feedback
    join public.stop_points points on points.id = feedback.stop_point_id and points.stop_place_id = feedback.bus_stop_id
    join public.bus_stops places on places.id = points.stop_place_id
    where points.id = p_stop_point_id and places.is_published and places.archived_at is null
    order by feedback.created_at desc, feedback.id desc limit 100
  )
  select recent.id, recent.created_at, array_agg(categories.category_slug order by definitions.sort_order), replies.body, replies.updated_at
  from recent
  join public.stop_feedback_categories categories on categories.feedback_id = recent.id
  join public.feedback_categories definitions on definitions.slug = categories.category_slug and definitions.is_active
  left join public.feedback_replies replies on replies.feedback_id = recent.id
  group by recent.id, recent.created_at, replies.body, replies.updated_at
  order by recent.created_at desc, recent.id desc;
$$;
create index stop_feedback_point_recent_idx on public.stop_feedback(stop_point_id, created_at desc, id desc);
notify pgrst, 'reload schema';
commit;
