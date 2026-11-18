-- Stage 2: opt-in runtime, immutable versions and campaign provenance.
begin;

create table public.feedback_stop_datasets (
 id uuid primary key default gen_random_uuid(),
 environment_id uuid not null default public.feedback_environment_id() references public.feedback_environment(id),
 label text not null check(length(trim(label)) between 1 and 120),
 content_hash text not null,
 source_environment text,
 created_at timestamptz not null default now(),
 created_by uuid not null,
 unique(environment_id,id)
);
create table public.feedback_dataset_places (
 environment_id uuid not null default public.feedback_environment_id(),
 dataset_id uuid not null,
 id uuid not null,
 data jsonb not null,
 primary key(environment_id,dataset_id,id),
 foreign key(environment_id,dataset_id) references public.feedback_stop_datasets(environment_id,id)
);
create table public.feedback_dataset_points (
 environment_id uuid not null default public.feedback_environment_id(),
 dataset_id uuid not null,
 id uuid not null,
 stop_place_id uuid not null,
 data jsonb not null,
 primary key(environment_id,dataset_id,id),
 foreign key(environment_id,dataset_id,stop_place_id) references public.feedback_dataset_places(environment_id,dataset_id,id)
);
create table public.feedback_form_versions (
 id uuid primary key default gen_random_uuid(),
 environment_id uuid not null default public.feedback_environment_id() references public.feedback_environment(id),
 content_hash text not null,
 config jsonb not null,
 created_at timestamptz not null default now(),
 created_by uuid,
 unique(environment_id,id),unique(environment_id,content_hash)
);
create table public.feedback_campaigns (
 id uuid primary key default gen_random_uuid(),
 environment_id uuid not null default public.feedback_environment_id() references public.feedback_environment(id),
 name text not null check(length(trim(name)) between 1 and 120),
 purpose text not null check(purpose in ('practice','evaluation')),
 state text not null default 'draft' check(state in ('draft','active','closed','archived')),
 dataset_id uuid not null,
 form_version_id uuid not null,
 starts_at timestamptz,
 ends_at timestamptz,
 require_export boolean not null default true,
 created_at timestamptz not null default now(),
 created_by uuid not null,
 activated_at timestamptz,
 closed_at timestamptz,
 archived_at timestamptz,
 check(ends_at is null or starts_at is null or ends_at>starts_at),
 unique(environment_id,id),
 unique(environment_id,id,dataset_id,form_version_id),
 foreign key(environment_id,dataset_id) references public.feedback_stop_datasets(environment_id,id),
 foreign key(environment_id,form_version_id) references public.feedback_form_versions(environment_id,id)
);
create unique index feedback_one_active_campaign on public.feedback_campaigns(environment_id) where state='active';
create table public.feedback_runtime (
 environment_id uuid primary key default public.feedback_environment_id() references public.feedback_environment(id),
 dataset_id uuid,
 form_version_id uuid,
 campaign_id uuid,
 check((dataset_id is null)=(form_version_id is null)),
 foreign key(environment_id,dataset_id) references public.feedback_stop_datasets(environment_id,id),
 foreign key(environment_id,form_version_id) references public.feedback_form_versions(environment_id,id),
 foreign key(environment_id,campaign_id,dataset_id,form_version_id) references public.feedback_campaigns(environment_id,id,dataset_id,form_version_id)
);
insert into public.feedback_runtime(environment_id) values(public.feedback_environment_id());

alter table public.bus_stops add column dataset_version_id uuid;
alter table public.stop_points add column dataset_version_id uuid;
alter table public.bus_stops add foreign key(environment_id,dataset_version_id) references public.feedback_stop_datasets(environment_id,id);
alter table public.stop_points add foreign key(environment_id,dataset_version_id) references public.feedback_stop_datasets(environment_id,id);
alter table public.stop_feedback
 add column campaign_id uuid,
 add column dataset_version_id uuid,
 add column form_version_id uuid,
 add column public_visibility text not null default 'published' check(public_visibility in ('hidden','pending','published')),
 add column resolution_notes text not null default '' check(length(resolution_notes)<=2000),
 add column verified_at timestamptz,
 add column verification_due_at timestamptz,
 add foreign key(environment_id,dataset_version_id) references public.feedback_stop_datasets(environment_id,id),
 add foreign key(environment_id,form_version_id) references public.feedback_form_versions(environment_id,id),
 add foreign key(environment_id,campaign_id,dataset_version_id,form_version_id) references public.feedback_campaigns(environment_id,id,dataset_id,form_version_id);
alter table public.feedback_replies add column public_body text,add column public_updated_at timestamptz;
update public.feedback_replies set public_body=body,public_updated_at=updated_at;
alter table public.feedback_test_results
 add column campaign_id uuid,
 add column dataset_version_id uuid,
 add column form_version_id uuid,
 add column campaign_purpose text check(campaign_purpose in ('practice','evaluation')),
 add foreign key(environment_id,campaign_id,dataset_version_id,form_version_id) references public.feedback_campaigns(environment_id,id,dataset_id,form_version_id);
alter table public.feedback_test_results drop constraint feedback_test_results_test_phase_check;
alter table public.feedback_test_results add constraint feedback_test_results_test_phase_check check(test_phase in ('official_testing','practice'));
create index feedback_campaign_reports on public.stop_feedback(environment_id,campaign_id,id);
create index feedback_campaign_results on public.feedback_test_results(environment_id,campaign_id,feedback_id);
create index feedback_verification_due on public.stop_feedback(verification_due_at) where verification_due_at is not null;

-- Append-only receipt independent of operational report lifetime.
create table public.feedback_campaign_submissions (
 feedback_id uuid primary key,
 environment_id uuid not null,
 campaign_id uuid not null,
 dataset_version_id uuid not null,
 form_version_id uuid not null,
 submitted_at timestamptz not null,
 foreign key(environment_id,campaign_id,dataset_version_id,form_version_id) references public.feedback_campaigns(environment_id,id,dataset_id,form_version_id)
);
create table public.feedback_evaluation_exclusions (
 feedback_id uuid primary key references public.feedback_test_results(feedback_id),
 environment_id uuid not null default public.feedback_environment_id() references public.feedback_environment(id),
 excluded boolean not null,
 reason text not null check(length(trim(reason)) between 1 and 1000),
 updated_at timestamptz not null default clock_timestamp(),
 updated_by uuid not null
);

create function public.feedback_immutable_version() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin raise exception 'Snapshots and submission receipts are immutable'; end;
$$;
revoke all on function public.feedback_immutable_version() from public,anon,authenticated;
do $$
declare t text;
begin
 foreach t in array array['feedback_stop_datasets','feedback_dataset_places','feedback_dataset_points','feedback_form_versions','feedback_campaign_submissions','feedback_test_results'] loop
  execute format('create trigger feedback_immutable before update or delete on public.%I for each row execute function public.feedback_immutable_version()',t);
 end loop;
 foreach t in array array['feedback_stop_datasets','feedback_dataset_places','feedback_dataset_points','feedback_form_versions','feedback_campaigns','feedback_runtime','feedback_campaign_submissions','feedback_evaluation_exclusions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy "Environment managers read" on public.%I for select to authenticated using(public.feedback_environment_matches() and (public.portal_has_access(''feedbackSettings'') or public.portal_has_access(''feedback'')))',t);
 end loop;
end;
$$;
drop policy "Environment managers read" on public.feedback_dataset_places;
drop policy "Environment managers read" on public.feedback_dataset_points;
create policy "Database staff read versioned places" on public.feedback_dataset_places for select to authenticated
 using(public.feedback_environment_matches() and public.portal_has_access('database'));
create policy "Database staff read versioned points" on public.feedback_dataset_points for select to authenticated
 using(public.feedback_environment_matches() and public.portal_has_access('database'));
drop policy "Feedback section reads" on public.feedback_test_results;
create policy "Feedback section reads" on public.feedback_test_results as restrictive for select to authenticated
 using(public.portal_has_access('feedback') or public.portal_has_access('feedbackSettings'));

-- The old configuration remains available during the additive deployment stage.
alter function public.get_feedback_form_config() rename to feedback_form_config_payload;
revoke all on function public.feedback_form_config_payload() from public,anon,authenticated;
create function public.feedback_current_form_version() returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare payload jsonb; hash text; result uuid;
begin
 payload=public.feedback_form_config_payload();
 hash=encode(sha256(convert_to(payload::text,'UTF8')),'hex');
 insert into public.feedback_form_versions(content_hash,config,created_by) values(hash,payload,auth.uid())
 on conflict(environment_id,content_hash) do nothing;
 select id into result from public.feedback_form_versions where environment_id=public.feedback_environment_id() and content_hash=hash;
 return result;
end;
$$;
revoke all on function public.feedback_current_form_version() from public,anon,authenticated;

create function public.get_feedback_runtime_context() returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 perform public.assert_feedback_environment();
 select jsonb_build_object('environment_id',e.id,'kind',e.kind,'label',e.label,'project_ref',e.project_ref,
  'dataset_version_id',r.dataset_id,'form_version_id',r.form_version_id,'campaign_id',r.campaign_id,
  'campaign_name',c.name,'campaign_state',c.state,'starts_at',c.starts_at,'ends_at',c.ends_at,
  'accepting_submissions',case when e.kind='unconfigured' then true when e.kind='production' then r.dataset_id is not null
   else coalesce(c.state='active' and (c.starts_at is null or c.starts_at<=now()) and (c.ends_at is null or c.ends_at>now()),false) end)
 into result from public.feedback_environment e join public.feedback_runtime r on r.environment_id=e.id
 left join public.feedback_campaigns c on c.id=r.campaign_id where e.singleton;
 return result;
end;
$$;
create function public.get_feedback_form_config() returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 return public.feedback_form_config_payload() || jsonb_build_object('runtime',public.get_feedback_runtime_context());
end;
$$;
revoke all on function public.get_feedback_runtime_context(),public.get_feedback_form_config() from public;
grant execute on function public.get_feedback_runtime_context(),public.get_feedback_form_config() to anon,authenticated;

create function public.feedback_require_manager(p_environment uuid,p_owner boolean default false) returns void
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if p_environment is null then raise exception 'Select an environment'; end if;
 perform public.assert_feedback_environment(p_environment);
 if not public.portal_has_access('feedbackSettings') or (p_owner and not public.is_portal_owner()) then
  raise exception 'Environment management access required' using errcode='42501';
 end if;
 if (select kind='unconfigured' from public.feedback_environment) then raise exception 'Initialize the separate environment first'; end if;
end;
$$;
revoke all on function public.feedback_require_manager(uuid,boolean) from public,anon,authenticated;

create function public.snapshot_feedback_stop_dataset(p_environment uuid,p_label text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; hash text;
begin
 perform public.feedback_require_manager(p_environment);
 if not public.portal_has_access('database') then raise exception 'Database access required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext('feedback-runtime'));
 if not exists(select 1 from public.bus_stops where archived_at is null) then raise exception 'The dataset is empty'; end if;
 if (select count(*) from public.bus_stops where archived_at is null)>20000 or
   (select count(*) from public.stop_points p join public.bus_stops s on s.id=p.stop_place_id where s.archived_at is null)>100000 then
  raise exception 'Dataset snapshot limit exceeded (20,000 places / 100,000 points)'; end if;
 select encode(sha256(convert_to(coalesce(jsonb_agg(row_data order by kind,id)::text,''),'UTF8')),'hex') into hash from (
  select 'place' kind,id,to_jsonb(s)-array['created_at','updated_at','created_by','environment_id','dataset_version_id','municipality_names_missing'] row_data from public.bus_stops s where archived_at is null
  union all select 'point',p.id,to_jsonb(p)-array['created_at','updated_at','created_by','environment_id','dataset_version_id'] from public.stop_points p join public.bus_stops s on s.id=p.stop_place_id where s.archived_at is null
 ) version_rows;
 insert into public.feedback_stop_datasets(label,content_hash,created_by) values(trim(p_label),hash,auth.uid()) returning id into result;
 insert into public.feedback_dataset_places(dataset_id,id,data)
 select result,id,to_jsonb(s)-array['created_at','updated_at','created_by','environment_id','dataset_version_id','municipality_names_missing'] from public.bus_stops s where archived_at is null;
 insert into public.feedback_dataset_points(dataset_id,id,stop_place_id,data)
 select result,p.id,p.stop_place_id,to_jsonb(p)-array['created_at','updated_at','created_by','environment_id','dataset_version_id'] from public.stop_points p join public.bus_stops s on s.id=p.stop_place_id where s.archived_at is null;
 perform public.audit_feedback_management('snapshot_created','stop_dataset',result::text);
 return result;
end;
$$;

-- Applying a saved version changes working rows atomically. Historical parents
-- and reports remain; places outside this version are archived, never deleted.
create function public.feedback_apply_stop_dataset(p_dataset uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.feedback_stop_datasets where id=p_dataset and environment_id=public.feedback_environment_id()) then raise exception 'Dataset not found in this environment'; end if;
 perform set_config('app.feedback_dataset_activation','yes',true);
 update public.bus_stops set archived_at=coalesce(archived_at,now()),is_published=false,dataset_version_id=null
 where id not in(select id from public.feedback_dataset_places where dataset_id=p_dataset);
 update public.stop_points set dataset_version_id=null where id not in(select id from public.feedback_dataset_points where dataset_id=p_dataset);
 insert into public.bus_stops(id,stop_code,name_de,name_it,name_en,municipality,municipality_de,municipality_it,latitude,longitude,is_accessible,is_published,stop_id,id_version,publication_timestamp,archived_at,dataset_version_id,created_by)
 select s.id,s.stop_code,s.name_de,s.name_it,s.name_en,s.municipality,s.municipality_de,s.municipality_it,s.latitude,s.longitude,s.is_accessible,s.is_published,s.stop_id,s.id_version,s.publication_timestamp,null,p_dataset,auth.uid()
 from public.feedback_dataset_places d cross join lateral jsonb_populate_record(null::public.bus_stops,d.data) s where d.dataset_id=p_dataset
 on conflict(id) do update set stop_code=excluded.stop_code,name_de=excluded.name_de,name_it=excluded.name_it,name_en=excluded.name_en,
 municipality=excluded.municipality,municipality_de=excluded.municipality_de,municipality_it=excluded.municipality_it,latitude=excluded.latitude,longitude=excluded.longitude,
 is_accessible=excluded.is_accessible,is_published=excluded.is_published,stop_id=excluded.stop_id,id_version=excluded.id_version,publication_timestamp=excluded.publication_timestamp,archived_at=null,dataset_version_id=p_dataset,updated_at=now();
 insert into public.stop_points(id,stop_place_id,point_ref,id_version,point_number,latitude,longitude,name_de,name_it,transport_type,dataset_version_id,created_by)
 select p.id,p.stop_place_id,p.point_ref,p.id_version,p.point_number,p.latitude,p.longitude,p.name_de,p.name_it,p.transport_type,p_dataset,auth.uid()
 from public.feedback_dataset_points d cross join lateral jsonb_populate_record(null::public.stop_points,d.data) p where d.dataset_id=p_dataset
 on conflict(id) do update set stop_place_id=excluded.stop_place_id,point_ref=excluded.point_ref,id_version=excluded.id_version,point_number=excluded.point_number,
 latitude=excluded.latitude,longitude=excluded.longitude,name_de=excluded.name_de,name_it=excluded.name_it,transport_type=excluded.transport_type,dataset_version_id=p_dataset,updated_at=now();
 perform set_config('app.feedback_dataset_activation','',true);
end;
$$;
revoke all on function public.feedback_apply_stop_dataset(uuid) from public,anon,authenticated;

create function public.create_feedback_campaign(p_environment uuid,p_name text,p_purpose text,p_dataset uuid,p_starts_at timestamptz default null,p_ends_at timestamptz default null,p_require_export boolean default true) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; form_id uuid;
begin
 perform public.feedback_require_manager(p_environment);
 if (select kind='production' from public.feedback_environment) then raise exception 'Test campaigns cannot run in production'; end if;
 if p_require_export is false and not public.is_portal_owner() then raise exception 'Only the owner may waive the required export' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext('feedback-runtime'));
 perform pg_advisory_xact_lock(hashtext('feedback-form-configuration'));
 form_id=public.feedback_current_form_version();
 insert into public.feedback_campaigns(name,purpose,dataset_id,form_version_id,starts_at,ends_at,require_export,created_by)
 values(trim(p_name),p_purpose,p_dataset,form_id,p_starts_at,p_ends_at,p_require_export,auth.uid()) returning id into result;
 perform public.audit_feedback_management('created','campaign',result::text);
 return result;
end;
$$;

create function public.transition_feedback_campaign(p_environment uuid,p_campaign uuid,p_state text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.feedback_campaigns;
begin
 perform public.feedback_require_manager(p_environment);
 perform pg_advisory_xact_lock(hashtext('feedback-runtime'));
 perform pg_advisory_xact_lock(hashtext('feedback-form-configuration'));
 select * into c from public.feedback_campaigns where id=p_campaign and environment_id=p_environment for update;
 if not found then raise exception 'Campaign not found'; end if;
 if (c.state='draft' and p_state='active') then
  if (select kind='production' from public.feedback_environment) then raise exception 'Production cannot activate test campaigns'; end if;
  if c.ends_at is not null and c.ends_at<=now() then raise exception 'Campaign end is in the past'; end if;
  if public.feedback_current_form_version()<>c.form_version_id then raise exception 'Form changed. Create a new campaign with the current form version'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.stop_feedback'::regclass and tgname='capture_structured_test_feedback' and tgenabled in ('O','A')) then raise exception 'Evaluation capture is disabled'; end if;
  perform public.feedback_apply_stop_dataset(c.dataset_id);
  update public.feedback_campaigns set state='active',activated_at=now() where id=p_campaign;
  update public.feedback_runtime set dataset_id=c.dataset_id,form_version_id=c.form_version_id,campaign_id=c.id where environment_id=p_environment;
 elsif (c.state='active' and p_state='closed') or (c.state='draft' and p_state='closed') then
  update public.feedback_campaigns set state='closed',closed_at=now() where id=p_campaign;
  update public.feedback_runtime set dataset_id=null,form_version_id=null,campaign_id=null where campaign_id=p_campaign;
 elsif c.state='closed' and p_state='archived' then
  update public.feedback_campaigns set state='archived',archived_at=now() where id=p_campaign;
 else raise exception 'Invalid campaign transition'; end if;
 perform public.audit_feedback_management('state_changed','campaign',p_campaign::text,jsonb_build_object('from',c.state,'to',p_state));
end;
$$;

create function public.publish_feedback_production(p_environment uuid,p_dataset uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare form_id uuid;
begin
 perform public.feedback_require_manager(p_environment,true);
 if (select kind<>'production' from public.feedback_environment) then raise exception 'Select the production project'; end if;
 perform pg_advisory_xact_lock(hashtext('feedback-runtime'));
 perform pg_advisory_xact_lock(hashtext('feedback-form-configuration'));
 form_id=public.feedback_current_form_version();
 perform public.feedback_apply_stop_dataset(p_dataset);
 update public.feedback_runtime set dataset_id=p_dataset,form_version_id=form_id,campaign_id=null where environment_id=p_environment;
 perform public.audit_feedback_management('published','production',p_dataset::text,jsonb_build_object('form_version',form_id));
end;
$$;
create function public.pause_feedback_publication(p_environment uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.feedback_require_manager(p_environment,true);
 perform pg_advisory_xact_lock(hashtext('feedback-runtime'));
 if exists(select 1 from public.feedback_runtime where campaign_id is not null) then raise exception 'Close the active campaign first'; end if;
 update public.feedback_runtime set dataset_id=null,form_version_id=null where environment_id=p_environment;
 perform public.audit_feedback_management('paused','publication',p_environment::text);
end;
$$;

create function public.feedback_version_write_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare initialized boolean; kind text;
begin
 select e.kind,e.kind<>'unconfigured' into kind,initialized from public.feedback_environment e;
 if not initialized then return case when tg_op='DELETE' then old else new end; end if;
 perform pg_advisory_xact_lock_shared(hashtext('feedback-runtime'));
 if coalesce(current_setting('app.feedback_dataset_activation',true),'')<>'yes' then
  if exists(select 1 from public.feedback_runtime where dataset_id is not null) then
   raise exception 'The published dataset and form are frozen. Close the campaign or pause publication before editing';
  end if;
  if kind='production' and not public.is_portal_owner() and tg_table_name='bus_stops' and tg_op<>'DELETE' and
    ((to_jsonb(new)->>'is_published')::boolean and (tg_op='INSERT' or not (to_jsonb(old)->>'is_published')::boolean)) then
   raise exception 'Production publication requires an owner-approved dataset' using errcode='42501';
  end if;
 end if;
 return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function public.feedback_version_write_guard() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['bus_stops','stop_points','feedback_categories','feedback_form_settings'] loop
  execute format('create trigger feedback_version_write before insert or update or delete on public.%I for each row execute function public.feedback_version_write_guard()',t);
 end loop;
end; $$;

-- Old clients work during stage 1. After initialization they must supply all
-- expected versions, so an in-flight form cannot enter a different campaign.
alter function public.create_stop_point_feedback(uuid,text[],text,text,text,boolean,text,uuid,text) rename to feedback_submit_legacy;
revoke all on function public.feedback_submit_legacy(uuid,text[],text,text,text,boolean,text,uuid,text) from public,anon,authenticated;
create function public.create_stop_point_feedback(
 p_stop_point_id uuid,p_categories text[],p_severity text,p_description text default null,p_email text default null,
 p_consent_to_contact boolean default false,p_language text default 'de',p_upload_token uuid default null,p_photo_extension text default null,
 p_environment uuid default null,p_campaign uuid default null,p_dataset_version uuid default null,p_form_version uuid default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare context jsonb; result uuid;
begin
 perform pg_advisory_xact_lock_shared(hashtext('feedback-runtime'));
 context=public.get_feedback_runtime_context();
 if context->>'kind'<>'unconfigured' then
  perform public.assert_feedback_environment(p_environment);
  if p_environment is null or not (context->>'accepting_submissions')::boolean or
   p_campaign is distinct from (context->>'campaign_id')::uuid or
   p_dataset_version is distinct from (context->>'dataset_version_id')::uuid or
   p_form_version is distinct from (context->>'form_version_id')::uuid then
   raise exception 'The environment, campaign or form changed. Reload the form';
  end if;
  if not exists(select 1 from public.stop_points where id=p_stop_point_id and dataset_version_id=p_dataset_version) then raise exception 'Point does not belong to the active dataset'; end if;
 end if;
 result=public.feedback_submit_legacy(p_stop_point_id,p_categories,p_severity,p_description,p_email,p_consent_to_contact,p_language,p_upload_token,p_photo_extension);
 return result;
end;
$$;
revoke all on function public.create_stop_point_feedback(uuid,text[],text,text,text,boolean,text,uuid,text,uuid,uuid,uuid,uuid) from public;
grant execute on function public.create_stop_point_feedback(uuid,text[],text,text,text,boolean,text,uuid,text,uuid,uuid,uuid,uuid) to anon,authenticated;

create function public.feedback_submission_context() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.feedback_runtime; kind text; c public.feedback_campaigns;
begin
 perform pg_advisory_xact_lock_shared(hashtext('feedback-runtime'));
 select e.kind into kind from public.feedback_environment e;
 if tg_op='UPDATE' then
  if (new.campaign_id,new.dataset_version_id,new.form_version_id) is distinct from (old.campaign_id,old.dataset_version_id,old.form_version_id) then raise exception 'Submission provenance is immutable'; end if;
  if kind='production' and new.public_visibility='published' and old.public_visibility<>'published' and not public.is_portal_owner() then raise exception 'Only the owner may publish production discussions' using errcode='42501'; end if;
  return new;
 end if;
 if kind='unconfigured' then return new; end if;
 select * into r from public.feedback_runtime where environment_id=new.environment_id;
 if r.dataset_id is null then raise exception 'No published dataset'; end if;
 new.dataset_version_id=r.dataset_id; new.form_version_id=r.form_version_id; new.campaign_id=r.campaign_id;
 new.public_visibility=case when kind='production' then 'pending' else 'hidden' end;
 new.verification_due_at=case when kind='production' then now()+interval '90 days' else null end;
 if kind<>'production' then
  select * into c from public.feedback_campaigns where id=r.campaign_id;
  if c.state is distinct from 'active' or (c.starts_at is not null and c.starts_at>now()) or (c.ends_at is not null and c.ends_at<=now()) then raise exception 'No active campaign in its submission window'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.stop_feedback'::regclass and tgname='capture_structured_test_feedback' and tgenabled in ('O','A')) then raise exception 'Evaluation capture is disabled'; end if;
  insert into public.feedback_campaign_submissions(feedback_id,environment_id,campaign_id,dataset_version_id,form_version_id,submitted_at)
  values(new.id,new.environment_id,new.campaign_id,new.dataset_version_id,new.form_version_id,new.created_at);
 end if;
 return new;
end;
$$;
revoke all on function public.feedback_submission_context() from public,anon,authenticated;
create trigger feedback_submission_context before insert or update on public.stop_feedback for each row execute function public.feedback_submission_context();

create or replace function public.capture_structured_test_feedback() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare captured integer;
begin
 if new.campaign_id is null and (select kind<>'unconfigured' from public.feedback_environment) then return null; end if;
 insert into public.feedback_test_results(feedback_id,submitted_at,stop_place_id,stop_place_id_version,stop_place_name_de,stop_place_name_it,stop_place_name_en,municipality,
  stop_point_id,stop_point_ref,stop_point_number,stop_point_name_de,stop_point_name_it,transport_type,latitude,longitude,category_slugs,category_labels_de,category_labels_it,category_labels_en,severity,language,
  environment_id,campaign_id,dataset_version_id,form_version_id,campaign_purpose,test_phase)
 select f.id,f.created_at,s.id,s.id_version,s.name_de,s.name_it,s.name_en,s.municipality,
  p.id,p.point_ref,p.point_number,p.name_de,p.name_it,p.transport_type,p.latitude,p.longitude,issues.slugs,issues.de,issues.it,issues.en,f.severity,f.language,
  case when f.campaign_id is not null then f.environment_id end,f.campaign_id,f.dataset_version_id,f.form_version_id,c.purpose,
  case when c.purpose='practice' then 'practice' else 'official_testing' end
 from public.stop_feedback f join public.bus_stops s on s.id=f.bus_stop_id and s.environment_id=f.environment_id
 join public.stop_points p on p.id=f.stop_point_id and p.stop_place_id=f.bus_stop_id and p.environment_id=f.environment_id
 left join public.feedback_campaigns c on c.id=f.campaign_id
 cross join lateral(select array_agg(d.slug order by d.sort_order) slugs,array_agg(d.label_de order by d.sort_order) de,
 array_agg(d.label_it order by d.sort_order) it,array_agg(d.label_en order by d.sort_order) en from public.stop_feedback_categories chosen
 join public.feedback_categories d on d.slug=chosen.category_slug where chosen.feedback_id=f.id) issues where f.id=new.id;
 get diagnostics captured=row_count;
 if captured<>1 then raise exception 'Unable to capture evaluation snapshot'; end if;
 return null;
end;
$$;

create function public.set_feedback_evaluation_exclusion(p_environment uuid,p_feedback uuid,p_excluded boolean,p_reason text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.feedback_require_manager(p_environment);
 if not exists(select 1 from public.feedback_test_results where feedback_id=p_feedback and (environment_id is null or environment_id=p_environment)) then raise exception 'Evaluation result not found'; end if;
 insert into public.feedback_evaluation_exclusions(feedback_id,excluded,reason,updated_by) values(p_feedback,p_excluded,trim(p_reason),auth.uid())
 on conflict(feedback_id) do update set excluded=excluded.excluded,reason=excluded.reason,updated_by=auth.uid(),updated_at=clock_timestamp();
 perform public.audit_feedback_management('exclusion_changed','evaluation',p_feedback::text,jsonb_build_object('excluded',p_excluded,'reason',trim(p_reason)));
end;
$$;

create function public.moderate_feedback(p_environment uuid,p_feedback uuid,p_status text,p_visibility text,p_notes text,p_verified boolean default false) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare kind text; existing_visibility text; effective_visibility text;
begin
 perform public.assert_feedback_environment(p_environment);
 if p_environment is null or not public.portal_has_access('feedback') then raise exception 'Feedback access required' using errcode='42501'; end if;
 select e.kind into kind from public.feedback_environment e;
 select public_visibility into existing_visibility from public.stop_feedback where id=p_feedback and environment_id=p_environment for update;
 if not found then raise exception 'Feedback not found'; end if;
 effective_visibility=coalesce(p_visibility,existing_visibility);
 if p_visibility='published' and kind='production' and not public.is_portal_owner() then raise exception 'Only the owner may publish production discussions' using errcode='42501'; end if;
 if p_status is null or p_status not in ('new','in_review','resolved','dismissed') or effective_visibility not in ('hidden','pending','published') then raise exception 'Invalid moderation state'; end if;
 update public.stop_feedback set status=p_status,public_visibility=effective_visibility,resolution_notes=coalesce(trim(p_notes),''),
 reviewed_at=case when p_status='new' then null else now() end,
 reviewed_by=case when p_status='new' then null else auth.uid() end,
 verified_at=case when p_verified then now() else verified_at end,
 verification_due_at=case when p_verified then now()+interval '90 days' else coalesce(verification_due_at,created_at+interval '90 days') end
 where id=p_feedback and environment_id=p_environment;
 if not found then raise exception 'Feedback not found'; end if;
 if p_visibility='published' then
  perform set_config('app.feedback_publish',p_feedback::text,true);
  update public.feedback_replies set public_body=body,public_updated_at=updated_at where feedback_id=p_feedback and environment_id=p_environment;
  perform set_config('app.feedback_publish','',true);
 end if;
 perform public.audit_feedback_management('moderated','feedback',p_feedback::text,jsonb_build_object('status',p_status,'visibility',effective_visibility,'verified',p_verified));
end;
$$;

create function public.feedback_reply_publication_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare kind text;
begin
 select e.kind into kind from public.feedback_environment e;
 if kind='unconfigured' or (kind<>'production' and exists(select 1 from public.stop_feedback where id=new.feedback_id and public_visibility='published')) then
  new.public_body=new.body;new.public_updated_at=new.updated_at;
 elsif kind='production' and (coalesce(current_setting('app.feedback_publish',true),'')<>new.feedback_id::text or not public.is_portal_owner()) then
  new.public_body=case when tg_op='UPDATE' then old.public_body end;
  new.public_updated_at=case when tg_op='UPDATE' then old.public_updated_at end;
 end if;
 return new;
end;
$$;
revoke all on function public.feedback_reply_publication_guard() from public,anon,authenticated;
create trigger feedback_reply_publication before insert or update on public.feedback_replies for each row execute function public.feedback_reply_publication_guard();

do $$ declare signature text; begin
 foreach signature in array array[
 'snapshot_feedback_stop_dataset(uuid,text)','create_feedback_campaign(uuid,text,text,uuid,timestamptz,timestamptz,boolean)',
 'transition_feedback_campaign(uuid,uuid,text)','publish_feedback_production(uuid,uuid)','pause_feedback_publication(uuid)',
 'set_feedback_evaluation_exclusion(uuid,uuid,boolean,text)','moderate_feedback(uuid,uuid,text,text,text,boolean)'
 ] loop
  execute 'revoke all on function public.'||signature||' from public,anon';
  execute 'grant execute on function public.'||signature||' to authenticated';
 end loop;
end; $$;
notify pgrst,'reload schema';
commit;
