-- Apply before deploying both updated apps. Existing reports/photos are retained.
begin;
alter table public.feedback_categories add column icon jsonb;
-- Preserve the current public wording when replacing its hardcoded defaults.
-- Keep labels that were explicitly customized in the database.
update public.feedback_categories set
 label_de=case when label_de='Mülleimer fehlt' then 'Abfallbehälter fehlt' else label_de end,
 label_it=case when label_it='Manca il cestino' then 'Manca il cestino dei rifiuti' else label_it end
where slug='waste_bin';
alter table public.feedback_categories add constraint feedback_category_slug_format check (slug ~ '^[a-z][a-z0-9_]{0,63}$');
alter table public.feedback_categories add constraint feedback_category_labels_length check (
 char_length(btrim(label_de)) between 1 and 160 and char_length(btrim(label_it)) between 1 and 160 and char_length(btrim(label_en)) between 1 and 160);
alter table public.feedback_categories add constraint feedback_category_icon_size check (icon is null or (jsonb_typeof(icon)='object' and octet_length(icon::text)<=32768));
alter table public.feedback_categories drop constraint feedback_categories_sort_order_key;
alter table public.feedback_categories add constraint feedback_categories_sort_order_key unique(sort_order) deferrable initially immediate;

create table public.feedback_form_settings (
 singleton boolean primary key default true check(singleton),
 photos_enabled boolean not null default true,
 max_photo_bytes integer not null default 10485760 check(max_photo_bytes between 65536 and 10485760),
 updated_at timestamptz not null default now(),updated_by uuid
);
insert into public.feedback_form_settings(singleton) values(true);
alter table public.feedback_form_settings enable row level security;
revoke all on public.feedback_form_settings from public,anon,authenticated;
-- Retired categories remain readable as labels for historical public threads.
drop policy "Active feedback categories are public" on public.feedback_categories;
create policy "Feedback category labels are public" on public.feedback_categories for select to anon,authenticated using(true);

create table public.feedback_configuration_events (
 id bigint generated always as identity primary key,actor_id uuid not null,
 category_slug text,operation text not null,created_at timestamptz not null default now()
);
alter table public.feedback_configuration_events enable row level security;
revoke all on public.feedback_configuration_events from public,anon,authenticated;
revoke all on sequence public.feedback_configuration_events_id_seq from public,anon,authenticated;

create function public.get_feedback_form_config() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('photos_enabled',s.photos_enabled,'max_photo_bytes',s.max_photo_bytes,
 'categories',(select coalesce(jsonb_agg(jsonb_build_object('slug',c.slug,'label_de',c.label_de,'label_it',c.label_it,'label_en',c.label_en,'sort_order',c.sort_order,'is_active',c.is_active,'icon',c.icon) order by c.sort_order),'[]'::jsonb) from public.feedback_categories c))
 from public.feedback_form_settings s where singleton;
$$;
revoke all on function public.get_feedback_form_config() from public;
grant execute on function public.get_feedback_form_config() to anon,authenticated;

create function public.set_feedback_photo_settings(p_enabled boolean,p_max_bytes integer) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_portal_owner() then raise exception 'Owner access required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext('feedback-form-configuration'));
 if p_enabled is null or p_max_bytes is null or p_max_bytes not between 65536 and 10485760 then raise exception 'Photo size must be between 64 KiB and 10 MiB'; end if;
 update public.feedback_form_settings set photos_enabled=p_enabled,max_photo_bytes=p_max_bytes,updated_by=auth.uid(),updated_at=now() where singleton;
 update storage.buckets set file_size_limit=p_max_bytes,allowed_mime_types=array['image/jpeg','image/png','image/webp'],public=false where id='feedback-photos';
 insert into public.feedback_configuration_events(actor_id,operation) values(auth.uid(),'photo_settings');
end;
$$;
revoke all on function public.set_feedback_photo_settings(boolean,integer) from public;
grant execute on function public.set_feedback_photo_settings(boolean,integer) to authenticated;

-- Defence in depth: the public renderer never accepts arbitrary tags/attributes.
-- Reject malformed icon JSON here too, including direct RPC attempts.
create function public.feedback_icon_node_is_safe(p_node jsonb,p_depth integer) returns boolean
language plpgsql immutable set search_path=public,pg_temp as $$
declare tag text; allowed text[]; item record; value text; child jsonb;
begin
 if p_depth>8 or jsonb_typeof(p_node)<>'object' then return false; end if;
 tag:=p_node->>'tag';
 if tag is null or tag not in ('svg','g','path','circle','ellipse','rect','line','polyline','polygon') or (tag='svg' and p_depth<>0) then return false; end if;
 if exists(select 1 from jsonb_object_keys(p_node) k where k not in ('tag','attrs','children')) then return false; end if;
 if jsonb_typeof(p_node->'attrs') is distinct from 'object' or jsonb_typeof(p_node->'children') is distinct from 'array' then return false; end if;
 if tag not in ('g','svg') and jsonb_array_length(p_node->'children')>0 then return false; end if;
 allowed:=array['fill','stroke','strokeWidth','strokeLinecap','strokeLinejoin','fillRule','clipRule','opacity','fillOpacity','strokeOpacity','transform'] ||
 case tag when 'path' then array['d','pathLength'] when 'circle' then array['cx','cy','r'] when 'ellipse' then array['cx','cy','rx','ry']
 when 'rect' then array['x','y','width','height','rx','ry'] when 'line' then array['x1','y1','x2','y2'] when 'polyline' then array['points'] when 'polygon' then array['points'] else array[]::text[] end;
 for item in select * from jsonb_each(p_node->'attrs') loop
   if not(item.key=any(allowed)) or jsonb_typeof(item.value)<>'string' then return false; end if;
   value:=item.value#>>'{}';
   if char_length(value) not between 1 and 4096 then return false; end if;
   if item.key in ('fill','stroke') then if value not in ('none','currentColor') then return false; end if;
   elsif item.key='strokeLinecap' then if value not in ('butt','round','square') then return false; end if;
   elsif item.key='strokeLinejoin' then if value not in ('miter','round','bevel') then return false; end if;
   elsif item.key in ('fillRule','clipRule') then if value not in ('evenodd','nonzero') then return false; end if;
   elsif item.key='d' then if value !~ '^[MmLlHhVvCcSsQqTtAaZz0-9[:space:].,eE+\-]+$' then return false; end if;
   elsif item.key='transform' then if value !~ '^([[:space:]]*(matrix|translate|scale|rotate|skewX|skewY)\([0-9[:space:].,eE+\-]+\)[[:space:]]*)+$' then return false; end if;
   elsif value !~ '^[0-9[:space:].,eE+\-]+$' then return false;
   end if;
 end loop;
 for child in select * from jsonb_array_elements(p_node->'children') loop
   if not public.feedback_icon_node_is_safe(child,p_depth+1) then return false; end if;
 end loop;
 return true;
end;
$$;
revoke all on function public.feedback_icon_node_is_safe(jsonb,integer) from public;
create function public.feedback_icon_is_safe(p_icon jsonb) returns boolean
language plpgsql immutable set search_path=public,pg_temp as $$
declare value jsonb; node_count integer;
begin
 if p_icon is null then return true; end if;
 if jsonb_typeof(p_icon)<>'object' or octet_length(p_icon::text)>32768 or jsonb_typeof(p_icon->'viewBox') is distinct from 'array' then return false; end if;
 if jsonb_array_length(p_icon->'viewBox')<>4 or jsonb_typeof(p_icon->'nodes') is distinct from 'array' then return false; end if;
 if jsonb_array_length(p_icon->'nodes') not between 1 and 64 then return false; end if;
 for value in select * from jsonb_array_elements(p_icon->'viewBox') loop
   if jsonb_typeof(value)<>'number' or abs((value#>>'{}')::numeric)>4096 then return false; end if;
 end loop;
 if (p_icon->'viewBox'->>2)::numeric<=0 or (p_icon->'viewBox'->>3)::numeric<=0 then return false; end if;
 if not public.feedback_icon_node_is_safe(jsonb_build_object('tag','svg','attrs',p_icon->'attrs','children',p_icon->'nodes'),0) then return false; end if;
 with recursive nodes as (
  select n as node from jsonb_array_elements(p_icon->'nodes') n
  union all select c from nodes cross join lateral jsonb_array_elements(nodes.node->'children') c
 ) select count(*) into node_count from nodes;
 return node_count<=64;
end;
$$;
revoke all on function public.feedback_icon_is_safe(jsonb) from public;

create function public.save_feedback_category(p_slug text,p_label_de text,p_label_it text,p_label_en text,p_active boolean,p_position integer,p_icon jsonb default null,p_replace_icon boolean default false) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare existed boolean; total integer; was_active boolean;
begin
 if not public.is_portal_owner() then raise exception 'Owner access required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext('feedback-form-configuration'));
 if p_slug is null or p_slug !~ '^[a-z][a-z0-9_]{0,63}$' or p_active is null or p_position is null or p_position not between 1 and 50
   or nullif(btrim(p_label_de),'') is null or nullif(btrim(p_label_it),'') is null or nullif(btrim(p_label_en),'') is null
   or char_length(p_label_de)>160 or char_length(p_label_it)>160 or char_length(p_label_en)>160 then raise exception 'Valid slug, three labels and a position (1–50) are required'; end if;
 if p_replace_icon is null or not public.feedback_icon_is_safe(p_icon) then raise exception 'Invalid icon data'; end if;
 select is_active into was_active from public.feedback_categories where slug=p_slug;
 existed:=found;
 select count(*) into total from public.feedback_categories;
 if not existed and total>=50 then raise exception 'At most 50 category definitions are supported'; end if;
 if p_active and not coalesce(was_active,false) and (select count(*) from public.feedback_categories where is_active)>=30 then raise exception 'At most 30 categories may be active'; end if;
 if not p_active and coalesce(was_active,false) and (select count(*) from public.feedback_categories where is_active)<=1 then raise exception 'Keep at least one active category'; end if;
 set constraints feedback_categories_sort_order_key deferred;
 insert into public.feedback_categories(slug,label_de,label_it,label_en,is_active,sort_order,icon)
 values(p_slug,btrim(p_label_de),btrim(p_label_it),btrim(p_label_en),p_active,1000,case when p_replace_icon then p_icon else null end)
 on conflict(slug) do update set label_de=excluded.label_de,label_it=excluded.label_it,label_en=excluded.label_en,is_active=excluded.is_active,
 icon=case when p_replace_icon then p_icon else public.feedback_categories.icon end;
 select count(*) into total from public.feedback_categories;
 p_position:=least(p_position,total);
 with ranked as (select slug,row_number() over(order by sort_order,slug) as rn from public.feedback_categories where slug<>p_slug)
 update public.feedback_categories c set sort_order=case when r.rn>=p_position then r.rn+1 else r.rn end from ranked r where c.slug=r.slug;
 update public.feedback_categories set sort_order=p_position where slug=p_slug;
 set constraints feedback_categories_sort_order_key immediate;
 insert into public.feedback_configuration_events(actor_id,category_slug,operation) values(auth.uid(),p_slug,case when existed then 'category_updated' else 'category_created' end);
end;
$$;
revoke all on function public.save_feedback_category(text,text,text,text,boolean,integer,jsonb,boolean) from public;
grant execute on function public.save_feedback_category(text,text,text,text,boolean,integer,jsonb,boolean) to authenticated;

create or replace function public.get_portal_access() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('users',public.is_portal_owner(),'feedbackSettings',public.is_portal_owner(),
 'stops',public.portal_has_access('stops'),'database',public.portal_has_access('database'),'feedback',public.portal_has_access('feedback'));
$$;
create or replace function public.create_stop_point_feedback(
  p_stop_point_id uuid, p_categories text[], p_severity text,
  p_description text default null, p_email text default null,
  p_consent_to_contact boolean default false, p_language text default 'de',
  p_upload_token uuid default null, p_photo_extension text default null
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare place_id uuid; new_id uuid;
begin
  perform pg_advisory_xact_lock_shared(hashtext('feedback-form-configuration'));
  if p_upload_token is not null and not (select photos_enabled from public.feedback_form_settings where singleton) then raise exception 'Photo uploads are disabled'; end if;
  if coalesce(cardinality(p_categories), 0) not between 1 and 30 then raise exception 'Choose between 1 and 30 categories'; end if;
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
  if exists (select 1 from unnest(p_categories) as requested(slug) where not exists
    (select 1 from public.feedback_categories c where c.slug = requested.slug and c.is_active)) then raise exception 'Invalid category'; end if;
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

create or replace function public.feedback_upload_path_is_valid(object_name text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select (select photos_enabled from public.feedback_form_settings where singleton) and exists (
    select 1 from public.feedback_upload_capabilities capability
    where capability.storage_path = object_name and capability.expires_at > now()
      and not exists (select 1 from public.stop_feedback_photos photo where photo.feedback_id = capability.feedback_id)
  );
$$;

create or replace function public.register_feedback_photo(p_feedback_id uuid, p_storage_path text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform pg_advisory_xact_lock_shared(hashtext('feedback-form-configuration'));
  if not (select photos_enabled from public.feedback_form_settings where singleton) then raise exception 'Photo uploads are disabled'; end if;
  -- Serialize registrations for a report, including simultaneous requests.
  perform 1 from public.feedback_upload_capabilities
    where feedback_id = p_feedback_id and storage_path = p_storage_path and expires_at > now()
    for update;
  if not found then raise exception 'Invalid or expired photo capability' using errcode = '42501'; end if;
  if exists (select 1 from public.stop_feedback_photos where feedback_id = p_feedback_id and storage_path = p_storage_path) then return; end if;
  if exists (select 1 from public.stop_feedback_photos where feedback_id = p_feedback_id) then raise exception 'A report may have only one photo'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'feedback-photos' and name = p_storage_path) then raise exception 'Photo not found'; end if;
  if not exists (select 1 from storage.objects o,public.feedback_form_settings s where o.bucket_id='feedback-photos' and o.name=p_storage_path and s.singleton and (o.metadata->>'size')::bigint between 1 and s.max_photo_bytes and o.metadata->>'mimetype' in ('image/jpeg','image/png','image/webp')) then raise exception 'Photo does not meet the current size/type policy'; end if;
  insert into public.stop_feedback_photos(feedback_id, storage_path) values (p_feedback_id, p_storage_path);
end;
$$;

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
  join public.feedback_categories definitions on definitions.slug = categories.category_slug
  left join public.feedback_replies replies on replies.feedback_id = recent.id
  group by recent.id, recent.created_at, replies.body, replies.updated_at
  order by recent.created_at desc, recent.id desc;
$$;

notify pgrst,'reload schema';
commit;
