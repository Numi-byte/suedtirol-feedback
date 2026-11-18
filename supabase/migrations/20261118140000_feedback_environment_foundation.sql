-- Stage 1: additive boundaries. Nothing is published, deleted, or assigned to a
-- historical campaign. Initialize each physically separate project explicitly.
begin;

create table public.feedback_environment (
  singleton boolean primary key default true check (singleton),
  id uuid not null unique default gen_random_uuid(),
  kind text not null default 'unconfigured' check (kind in ('unconfigured','production','staging','testing')),
  label text not null default 'Nicht eingerichtet' check (length(label) between 1 and 100),
  project_ref text unique,
  initialized_at timestamptz,
  check ((kind='unconfigured' and project_ref is null and initialized_at is null)
    or (kind<>'unconfigured' and project_ref ~ '^[a-z0-9-]{3,100}$' and initialized_at is not null))
);
insert into public.feedback_environment(singleton) values(true);
alter table public.feedback_environment enable row level security;
revoke all on public.feedback_environment from public,anon,authenticated;

create function public.feedback_environment_id() returns uuid
language sql stable security definer set search_path=public,pg_temp as $$
 select id from public.feedback_environment where singleton;
$$;
create function public.feedback_environment_matches() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select kind='unconfigured' or (
  coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-feedback-environment','')=id::text
  and coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-feedback-project','')=project_ref
 ) from public.feedback_environment where singleton;
$$;
create function public.assert_feedback_environment(p_environment uuid default null) returns void
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.feedback_environment_matches() or
   (p_environment is not null and p_environment<>public.feedback_environment_id()) then
   raise exception 'Explicit authorization for this environment is required' using errcode='42501';
 end if;
end;
$$;
revoke all on function public.feedback_environment_id(),public.feedback_environment_matches(),public.assert_feedback_environment(uuid) from public;
grant execute on function public.feedback_environment_id(),public.feedback_environment_matches() to anon,authenticated;

create table public.feedback_management_audit (
  id bigint generated always as identity primary key,
  environment_id uuid not null references public.feedback_environment(id),
  actor_id uuid,
  action text not null,
  object_type text not null,
  object_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);
alter table public.feedback_management_audit enable row level security;
revoke all on public.feedback_management_audit from public,anon,authenticated;
grant select on public.feedback_management_audit to authenticated;
create policy "Owner reads environment audit" on public.feedback_management_audit for select to authenticated
 using(public.is_portal_owner() and public.feedback_environment_matches());
create function public.audit_feedback_management(p_action text,p_type text,p_id text,p_detail jsonb default '{}'::jsonb) returns void
language sql security definer set search_path=public,pg_temp as $$
 insert into public.feedback_management_audit(environment_id,actor_id,action,object_type,object_id,detail)
 values(public.feedback_environment_id(),auth.uid(),p_action,p_type,p_id,p_detail);
$$;
revoke all on function public.audit_feedback_management(text,text,text,jsonb) from public,anon,authenticated;

create function public.initialize_feedback_environment(p_environment uuid,p_kind text,p_label text,p_project_ref text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is distinct from 'bdee91d9-c969-4bd4-b336-8f7e780ead3e'::uuid then
  raise exception 'Owner access required' using errcode='42501';
 end if;
 if p_kind is null or p_kind not in ('production','staging','testing') or
   nullif(trim(p_label),'') is null or length(p_label)>100 or
   p_project_ref is null or p_project_ref !~ '^[a-z0-9-]{3,100}$' then raise exception 'Invalid environment'; end if;
 perform 1 from public.feedback_environment where id=p_environment and kind='unconfigured' for update;
 if not found then raise exception 'Environment is already fixed or does not match'; end if;
 update public.feedback_environment set kind=p_kind,label=trim(p_label),project_ref=p_project_ref,initialized_at=now() where singleton;
 perform public.audit_feedback_management('initialized','environment',p_environment::text,jsonb_build_object('kind',p_kind,'project_ref',p_project_ref));
end;
$$;
revoke all on function public.initialize_feedback_environment(uuid,text,text,text) from public;
grant execute on function public.initialize_feedback_environment(uuid,text,text,text) to authenticated;

-- Existing operational rows acquire only the identity of their current physical
-- project. Historic evaluation rows deliberately retain NULL provenance.
do $$
declare t text;
begin
 foreach t in array array['bus_stops','stop_points','stop_feedback','feedback_replies','stop_feedback_categories','stop_feedback_photos','feedback_upload_capabilities'] loop
  execute format('alter table public.%I add column environment_id uuid not null default public.feedback_environment_id() references public.feedback_environment(id)',t);
 end loop;
end;
$$;
alter table public.feedback_test_results add column environment_id uuid references public.feedback_environment(id);
alter table public.feedback_test_results add constraint feedback_result_environment_key unique(environment_id,feedback_id);
alter table public.bus_stops add constraint bus_stops_environment_key unique(environment_id,id);
alter table public.stop_points add constraint stop_points_environment_key unique(environment_id,id);
alter table public.stop_points add constraint stop_points_environment_parent_key unique(environment_id,id,stop_place_id);
alter table public.stop_feedback add constraint stop_feedback_environment_key unique(environment_id,id);

-- Replace, rather than duplicate, relationships so PostgREST keeps one
-- unambiguous relation per parent. Cross-project identifiers cannot be linked.
do $$
declare r record;
begin
 for r in select c.conrelid::regclass as child,c.conname from pg_constraint c
 where c.contype='f' and (
  (c.conrelid='public.stop_points'::regclass and c.confrelid='public.bus_stops'::regclass) or
  (c.conrelid='public.stop_feedback'::regclass and c.confrelid in ('public.bus_stops'::regclass,'public.stop_points'::regclass)) or
  (c.conrelid in ('public.feedback_replies'::regclass,'public.stop_feedback_categories'::regclass,'public.stop_feedback_photos'::regclass,'public.feedback_upload_capabilities'::regclass) and c.confrelid='public.stop_feedback'::regclass)
 ) loop execute format('alter table %s drop constraint %I',r.child,r.conname); end loop;
end;
$$;
alter table public.stop_points add foreign key(environment_id,stop_place_id) references public.bus_stops(environment_id,id) on delete cascade;
alter table public.stop_feedback add foreign key(environment_id,bus_stop_id) references public.bus_stops(environment_id,id) on delete cascade;
alter table public.stop_feedback add foreign key(environment_id,stop_point_id,bus_stop_id) references public.stop_points(environment_id,id,stop_place_id);
alter table public.feedback_replies add foreign key(environment_id,feedback_id) references public.stop_feedback(environment_id,id) on delete cascade;
alter table public.stop_feedback_categories add foreign key(environment_id,feedback_id) references public.stop_feedback(environment_id,id) on delete cascade;
alter table public.stop_feedback_photos add foreign key(environment_id,feedback_id) references public.stop_feedback(environment_id,id) on delete cascade;
alter table public.feedback_upload_capabilities add foreign key(environment_id,feedback_id) references public.stop_feedback(environment_id,id) on delete cascade;

create or replace function public.is_portal_owner() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(auth.uid()='bdee91d9-c969-4bd4-b336-8f7e780ead3e'::uuid,false) and public.feedback_environment_matches();
$$;
create or replace function public.portal_has_access(p_section text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select public.feedback_environment_matches() and p_section in ('users','stops','database','feedback','feedbackSettings') and (
  public.is_portal_owner() or exists(select 1 from public.portal_staff where user_id=auth.uid() and is_active and
   case p_section when 'stops' then can_manage_stops when 'database' then can_manage_database
    when 'feedback' then can_view_feedback when 'feedbackSettings' then can_manage_feedback else false end)
 );
$$;

create function public.feedback_environment_write_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare value jsonb; old_value jsonb;
begin
 perform public.assert_feedback_environment();
 value=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if value ? 'environment_id' and (value->>'environment_id')::uuid is distinct from public.feedback_environment_id() then
  raise exception 'Cross-environment write rejected' using errcode='23503';
 end if;
 if tg_op='UPDATE' and value ? 'environment_id' and value->>'environment_id' is distinct from to_jsonb(old)->>'environment_id' then
  raise exception 'Environment identity is immutable';
 end if;
 if tg_op='DELETE' and (select kind<>'unconfigured' from public.feedback_environment) and
   not public.is_portal_owner() and nullif(current_setting('app.feedback_cleanup_job',true),'') is null then
  raise exception 'Owner access required for destructive operations' using errcode='42501';
 end if;
 if tg_op='UPDATE' and tg_table_name='bus_stops' and value->>'archived_at' is not null
   and to_jsonb(old)->>'archived_at' is null and (select kind<>'unconfigured' from public.feedback_environment)
   and not public.is_portal_owner() and coalesce(current_setting('app.feedback_dataset_activation',true),'')<>'yes' then
  raise exception 'Only the owner may archive stop places' using errcode='42501';
 end if;
 -- Only metadata is audited: never passwords, report text, emails or photos.
 if auth.uid() is not null and public.is_portal_staff() then
  old_value=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  perform public.audit_feedback_management(lower(tg_op),tg_table_name,
   coalesce(value->>'id',value->>'feedback_id',value->>'user_id',value->>'slug'),
   jsonb_build_object('changed_fields',coalesce((select jsonb_agg(k) from jsonb_object_keys(value) k
    where tg_op<>'UPDATE' or value->k is distinct from old_value->k),'[]'::jsonb)));
 end if;
 return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function public.feedback_environment_write_guard() from public,anon,authenticated;
do $$
declare t text;
begin
 foreach t in array array['bus_stops','stop_points','stop_feedback','feedback_replies','stop_feedback_categories','stop_feedback_photos','feedback_upload_capabilities','portal_staff','feedback_categories','feedback_form_settings'] loop
  execute format('create trigger feedback_environment_write before insert or update or delete on public.%I for each row execute function public.feedback_environment_write_guard()',t);
 end loop;
 foreach t in array array['bus_stops','stop_points','stop_feedback','feedback_replies','stop_feedback_categories','stop_feedback_photos','feedback_test_results'] loop
  execute format('create policy "Explicit environment authorization" on public.%I as restrictive for select to authenticated using(public.feedback_environment_matches())',t);
 end loop;
end;
$$;

notify pgrst,'reload schema';
commit;
