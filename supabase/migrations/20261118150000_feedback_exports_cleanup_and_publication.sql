-- Stage 3: public visibility, export receipts and owner-authorized cleanup.
begin;

create function public.feedback_public_point_is_current(p_point uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select public.feedback_environment_matches() and exists(select 1 from public.stop_points p,public.feedback_environment e,public.feedback_runtime r
 where p.id=p_point and r.environment_id=e.id and (e.kind='unconfigured' or (r.dataset_id is not null and p.dataset_version_id=r.dataset_id)));
$$;
create or replace function public.list_published_stops_with_feedback_count()
returns table(id uuid,name_de text,name_it text,name_en text,municipality text,latitude double precision,longitude double precision,is_accessible boolean,feedback_count bigint,municipality_de text,municipality_it text)
language sql stable security definer set search_path=public,pg_temp as $$
 select s.id,s.name_de,s.name_it,s.name_en,s.municipality,s.latitude,s.longitude,s.is_accessible,
 count(f.id),s.municipality_de,s.municipality_it
 from public.bus_stops s cross join public.feedback_environment e cross join public.feedback_runtime r
 left join public.stop_feedback f on f.bus_stop_id=s.id and f.public_visibility='published'
 where public.feedback_environment_matches() and s.is_published and s.archived_at is null
 and (e.kind='unconfigured' or (r.dataset_id is not null and s.dataset_version_id=r.dataset_id)) group by s.id;
$$;
create or replace function public.list_published_stop_search()
returns table(id uuid,name_de text,name_it text,name_en text,municipality text,latitude double precision,longitude double precision,is_accessible boolean,feedback_count bigint,municipality_de text,municipality_it text,point_search jsonb)
language sql stable security definer set search_path=public,pg_temp as $$
 select s.*,coalesce((select jsonb_agg(distinct jsonb_build_object('name_de',p.name_de,'name_it',p.name_it,'point_number',p.point_number))
 from public.stop_points p where p.stop_place_id=s.id and public.feedback_public_point_is_current(p.id)),'[]'::jsonb)
 from public.list_published_stops_with_feedback_count() s;
$$;
create or replace function public.list_published_stop_points(p_stop_place_id uuid)
returns table(id uuid,point_number text,latitude double precision,longitude double precision,name_de text,name_it text,transport_type text)
language sql stable security definer set search_path=public,pg_temp as $$
 select p.id,p.point_number,p.latitude,p.longitude,p.name_de,p.name_it,p.transport_type from public.stop_points p join public.bus_stops s on s.id=p.stop_place_id
 where s.id=p_stop_place_id and s.is_published and s.archived_at is null and public.feedback_public_point_is_current(p.id) order by p.point_number,p.id;
$$;
create or replace function public.get_published_stop_point(p_stop_point_id uuid)
returns table(id uuid,stop_place_id uuid,point_number text,name_de text,name_it text,transport_type text,place_name_de text,place_name_it text,place_name_en text,municipality text,municipality_de text,municipality_it text)
language sql stable security definer set search_path=public,pg_temp as $$
 select p.id,p.stop_place_id,p.point_number,p.name_de,p.name_it,p.transport_type,s.name_de,s.name_it,s.name_en,s.municipality,s.municipality_de,s.municipality_it
 from public.stop_points p join public.bus_stops s on s.id=p.stop_place_id
 where p.id=p_stop_point_id and s.is_published and s.archived_at is null and public.feedback_public_point_is_current(p.id);
$$;
create or replace function public.list_public_stop_point_threads(p_stop_point_id uuid)
returns table(feedback_id uuid,submitted_at timestamptz,category_slugs text[],reply_body text,replied_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 with recent as materialized(select f.id,f.created_at from public.stop_feedback f join public.stop_points p on p.id=f.stop_point_id and p.stop_place_id=f.bus_stop_id
 join public.bus_stops s on s.id=p.stop_place_id where p.id=p_stop_point_id and s.is_published and s.archived_at is null
 and f.public_visibility='published' and public.feedback_public_point_is_current(p.id) order by f.created_at desc,f.id desc limit 100)
 select recent.id,recent.created_at,array_agg(c.category_slug order by d.sort_order),r.public_body,r.public_updated_at from recent
 join public.stop_feedback_categories c on c.feedback_id=recent.id join public.feedback_categories d on d.slug=c.category_slug
 left join public.feedback_replies r on r.feedback_id=recent.id group by recent.id,recent.created_at,r.public_body,r.public_updated_at
 order by recent.created_at desc,recent.id desc;
$$;
revoke all on function public.feedback_public_point_is_current(uuid) from public;
grant execute on function public.feedback_public_point_is_current(uuid) to anon,authenticated;

create table public.feedback_evaluation_exports (
 id uuid primary key default gen_random_uuid(),
 environment_id uuid not null default public.feedback_environment_id() references public.feedback_environment(id),
 campaign_id uuid,
 status text not null default 'pending' check(status in ('pending','completed','failed')),
 result_count bigint not null,
 fingerprint text not null,
 csv_sha256 text,
 created_at timestamptz not null default clock_timestamp(),
 finished_at timestamptz,
 created_by uuid not null,
 confirmed_at timestamptz,
 confirmed_by uuid,
 foreign key(environment_id,campaign_id) references public.feedback_campaigns(environment_id,id)
);
create index feedback_latest_export on public.feedback_evaluation_exports(campaign_id,created_at desc,id);
create table public.feedback_cleanup_jobs (
 id uuid primary key default gen_random_uuid(),
 environment_id uuid not null default public.feedback_environment_id() references public.feedback_environment(id),
 campaign_id uuid not null unique,
 scheduled_at timestamptz not null,
 state text not null default 'pending' check(state in ('pending','blocked','running','failed','completed','cancelled')),
 requested_by uuid not null,
 requested_at timestamptz not null default clock_timestamp(),
 last_attempt_at timestamptz,
 lease_token uuid,
 lease_until timestamptz,
 last_error text,
 completed_at timestamptz,
 removed_reports bigint,
 foreign key(environment_id,campaign_id) references public.feedback_campaigns(environment_id,id)
);
create index feedback_due_cleanup on public.feedback_cleanup_jobs(scheduled_at) where state in ('pending','blocked','running');
do $$ declare t text; begin
 foreach t in array array['feedback_evaluation_exports','feedback_cleanup_jobs'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy "Environment managers read" on public.%I for select to authenticated using(public.portal_has_access(''feedbackSettings'') and public.feedback_environment_matches())',t);
 end loop;
end; $$;

create function public.feedback_evaluation_fingerprint(p_campaign uuid) returns text
language sql stable security definer set search_path=public,pg_temp as $$
 select encode(sha256(convert_to(coalesce(string_agg(r.feedback_id::text||':'||r.captured_at::text||':'||coalesce(x.excluded::text,'false')||':'||coalesce(x.reason,'')||':'||coalesce(x.updated_at::text,''),'|' order by r.feedback_id),''),'UTF8')),'hex')
 from public.feedback_test_results r left join public.feedback_evaluation_exclusions x on x.feedback_id=r.feedback_id
 where r.campaign_id is not distinct from p_campaign and (r.environment_id is null or r.environment_id=public.feedback_environment_id());
$$;
create function public.begin_feedback_evaluation_export(p_environment uuid,p_campaign uuid) returns public.feedback_evaluation_exports
language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.feedback_evaluation_exports; count_results bigint;
begin
 perform public.feedback_require_manager(p_environment);
 if p_campaign is not null and not exists(select 1 from public.feedback_campaigns where id=p_campaign and environment_id=p_environment) then raise exception 'Campaign not found'; end if;
 select count(*) into count_results from public.feedback_test_results where campaign_id is not distinct from p_campaign and (environment_id is null or environment_id=p_environment);
 if count_results>100000 then raise exception 'Campaign exceeds the bounded export limit'; end if;
 insert into public.feedback_evaluation_exports(campaign_id,result_count,fingerprint,created_by)
 values(p_campaign,count_results,public.feedback_evaluation_fingerprint(p_campaign),auth.uid()) returning * into result;
 perform public.audit_feedback_management('export_started','evaluation_export',result.id::text,jsonb_build_object('campaign_id',p_campaign));
 return result;
end;
$$;
create function public.finish_feedback_evaluation_export(p_environment uuid,p_export uuid,p_success boolean,p_sha256 text default null,p_rows bigint default null) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare receipt public.feedback_evaluation_exports; ok boolean;
begin
 perform public.feedback_require_manager(p_environment);
 select * into receipt from public.feedback_evaluation_exports where id=p_export and environment_id=p_environment and created_by=auth.uid() and status='pending' for update;
 if not found then raise exception 'Pending export not found'; end if;
 ok=coalesce(p_success,false) and p_sha256 ~ '^[a-f0-9]{64}$' and p_rows=receipt.result_count
  and receipt.fingerprint=public.feedback_evaluation_fingerprint(receipt.campaign_id);
 update public.feedback_evaluation_exports set status=case when coalesce(ok,false) then 'completed' else 'failed' end,
 csv_sha256=case when ok then p_sha256 end,finished_at=clock_timestamp() where id=p_export;
 perform public.audit_feedback_management(case when ok then 'export_completed' else 'export_failed' end,'evaluation_export',p_export::text);
 return coalesce(ok,false);
end;
$$;
create function public.confirm_feedback_evaluation_export(p_environment uuid,p_export uuid,p_sha256 text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.feedback_require_manager(p_environment,true);
 update public.feedback_evaluation_exports set confirmed_at=clock_timestamp(),confirmed_by=auth.uid()
 where id=p_export and environment_id=p_environment and status='completed' and csv_sha256=p_sha256
 and fingerprint=public.feedback_evaluation_fingerprint(campaign_id);
 if not found then raise exception 'Export failed, changed or is not complete'; end if;
 perform public.audit_feedback_management('export_copy_confirmed','evaluation_export',p_export::text);
end;
$$;

create function public.feedback_cleanup_blocker(p_campaign uuid) returns text
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare c public.feedback_campaigns; receipt public.feedback_evaluation_exports;
begin
 if (select kind not in ('staging','testing') from public.feedback_environment) then return 'Cleanup is only available in separate staging/testing projects'; end if;
 select * into c from public.feedback_campaigns where id=p_campaign and environment_id=public.feedback_environment_id();
 if not found or c.state not in ('closed','archived') then return 'Close the campaign before cleanup'; end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.stop_feedback'::regclass and tgname='capture_structured_test_feedback' and tgenabled in ('O','A')) then return 'Evaluation capture is disabled'; end if;
 if exists(select 1 from public.feedback_campaign_submissions s left join public.feedback_test_results r on r.feedback_id=s.feedback_id
  where s.campaign_id=p_campaign and (r.feedback_id is null or (r.environment_id,r.campaign_id,r.dataset_version_id,r.form_version_id) is distinct from (s.environment_id,s.campaign_id,s.dataset_version_id,s.form_version_id)))
  or exists(select 1 from public.stop_feedback f left join public.feedback_campaign_submissions s on s.feedback_id=f.id where f.campaign_id=p_campaign and s.feedback_id is null)
 then return 'Evaluation capture is incomplete; cleanup is blocked'; end if;
 if c.require_export then
  select * into receipt from public.feedback_evaluation_exports where campaign_id=p_campaign order by created_at desc,id desc limit 1;
  if not found or receipt.status<>'completed' then return 'The latest required evaluation export is missing, pending or failed'; end if;
  if receipt.confirmed_at is null then return 'The owner must confirm that the evaluation export was saved'; end if;
  if receipt.fingerprint<>public.feedback_evaluation_fingerprint(p_campaign) then return 'Evaluation or exclusions changed; export again'; end if;
 end if;
 return null;
end;
$$;
create function public.get_feedback_cleanup_preview(p_environment uuid,p_campaign uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 perform public.feedback_require_manager(p_environment);
 if not exists(select 1 from public.feedback_campaigns where id=p_campaign and environment_id=p_environment) then raise exception 'Campaign not found'; end if;
 return jsonb_build_object('reports',(select count(*) from public.stop_feedback where campaign_id=p_campaign),
 'replies',(select count(*) from public.feedback_replies r join public.stop_feedback f on f.id=r.feedback_id where f.campaign_id=p_campaign),
 'photos',(select count(*) from public.stop_feedback_photos p join public.stop_feedback f on f.id=p.feedback_id where f.campaign_id=p_campaign),
 'upload_permissions',(select count(*) from public.feedback_upload_capabilities u join public.stop_feedback f on f.id=u.feedback_id where f.campaign_id=p_campaign),
 'preserved_results',(select count(*) from public.feedback_test_results where campaign_id=p_campaign),
 'blocker',public.feedback_cleanup_blocker(p_campaign));
end;
$$;
create function public.schedule_feedback_cleanup(p_environment uuid,p_campaign uuid,p_after timestamptz,p_confirmation text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; blocker text;
begin
 perform public.feedback_require_manager(p_environment,true);
 perform pg_advisory_xact_lock(hashtext('feedback-runtime'));
 if p_after is null or not isfinite(p_after) or p_after<now()+interval '15 minutes' then raise exception 'Schedule at least 15 minutes ahead'; end if;
 if p_confirmation is distinct from (select name from public.feedback_campaigns where id=p_campaign) then raise exception 'Enter the exact campaign name to confirm cleanup'; end if;
 blocker=public.feedback_cleanup_blocker(p_campaign);
 if blocker is not null then raise exception '%',blocker; end if;
 insert into public.feedback_cleanup_jobs(campaign_id,scheduled_at,requested_by) values(p_campaign,p_after,auth.uid())
 on conflict(campaign_id) do update set state='pending',scheduled_at=p_after,requested_by=auth.uid(),requested_at=clock_timestamp(),last_error=null,lease_until=null,lease_token=null
 where feedback_cleanup_jobs.state in ('pending','blocked','failed','cancelled') returning id into result;
 if result is null then raise exception 'Cleanup is already running or completed'; end if;
 perform public.audit_feedback_management('cleanup_scheduled','campaign',p_campaign::text,jsonb_build_object('job_id',result,'scheduled_at',p_after));
 return result;
end;
$$;
create function public.cancel_feedback_cleanup(p_environment uuid,p_job uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.feedback_require_manager(p_environment,true);
 update public.feedback_cleanup_jobs set state='cancelled' where id=p_job and environment_id=p_environment and state in ('pending','blocked','failed');
 if not found then raise exception 'Only an unstarted cleanup may be cancelled'; end if;
 perform public.audit_feedback_management('cleanup_cancelled','cleanup_job',p_job::text);
end;
$$;

-- Worker functions are callable only by the private server role. The worker
-- cannot invent campaigns or production targets; it consumes owner-signed jobs.
create function public.claim_feedback_cleanup(p_environment uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare job public.feedback_cleanup_jobs; blocker text;
begin
 if p_environment is null then raise exception 'Environment required'; end if;
 perform public.assert_feedback_environment(p_environment);
 perform pg_advisory_xact_lock(hashtext('feedback-runtime'));
 select * into job from public.feedback_cleanup_jobs where environment_id=p_environment and scheduled_at<=now()
  and (state in ('pending','blocked') or (state='running' and lease_until<now()))
  and (last_attempt_at is null or last_attempt_at<now()-interval '5 minutes') order by scheduled_at,id for update skip locked limit 1;
 if not found then return null; end if;
 blocker=public.feedback_cleanup_blocker(job.campaign_id);
 if blocker is not null then
  update public.feedback_cleanup_jobs set state='blocked',last_error=blocker,last_attempt_at=clock_timestamp() where id=job.id;
  perform public.audit_feedback_management('cleanup_blocked','cleanup_job',job.id::text,jsonb_build_object('reason',blocker));
  return jsonb_build_object('blocked',true,'id',job.id);
 end if;
 update public.feedback_cleanup_jobs set state='running',lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',last_attempt_at=clock_timestamp(),last_error=null where id=job.id returning * into job;
 -- Serialized with both submissions and Storage capability checks. Existing
 -- in-flight uploads finish before capabilities are revoked.
 update public.stop_feedback set public_visibility='hidden' where campaign_id=job.campaign_id;
 perform set_config('app.feedback_cleanup_job',job.id::text,true);
 delete from public.feedback_upload_capabilities where feedback_id in(select id from public.stop_feedback where campaign_id=job.campaign_id);
 perform set_config('app.feedback_cleanup_job','',true);
 perform public.audit_feedback_management('cleanup_claimed','cleanup_job',job.id::text,jsonb_build_object('requested_by',job.requested_by));
 return jsonb_build_object('id',job.id,'campaign_id',job.campaign_id,'lease_token',job.lease_token);
end;
$$;
create function public.feedback_require_cleanup_lease(p_environment uuid,p_job uuid,p_token uuid) returns public.feedback_cleanup_jobs
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare job public.feedback_cleanup_jobs; blocker text;
begin
 perform public.assert_feedback_environment(p_environment);
 select * into job from public.feedback_cleanup_jobs where id=p_job and environment_id=p_environment and state='running' and lease_token=p_token and lease_until>now();
 if not found or p_environment is null or p_token is null then raise exception 'Invalid cleanup lease' using errcode='42501'; end if;
 blocker=public.feedback_cleanup_blocker(job.campaign_id);
 if blocker is not null then raise exception '%',blocker; end if;
 return job;
end;
$$;
create function public.list_feedback_cleanup_photos(p_environment uuid,p_job uuid,p_token uuid) returns table(name text)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare job public.feedback_cleanup_jobs;
begin
 job=public.feedback_require_cleanup_lease(p_environment,p_job,p_token);
 -- Includes objects left by an upload that failed before registration.
 return query select o.name from storage.objects o join public.stop_feedback f on split_part(o.name,'/',1)=f.id::text
 where o.bucket_id='feedback-photos' and f.campaign_id=job.campaign_id order by o.name limit 100;
end;
$$;
create function public.complete_feedback_cleanup(p_environment uuid,p_job uuid,p_token uuid) returns bigint
language plpgsql security definer set search_path=public,pg_temp as $$
declare job public.feedback_cleanup_jobs; removed bigint;
begin
 perform pg_advisory_xact_lock(hashtext('feedback-runtime'));
 job=public.feedback_require_cleanup_lease(p_environment,p_job,p_token);
 perform 1 from public.feedback_cleanup_jobs where id=p_job for update;
 if exists(select 1 from storage.objects o join public.stop_feedback f on split_part(o.name,'/',1)=f.id::text where o.bucket_id='feedback-photos' and f.campaign_id=job.campaign_id) then
  raise exception 'Remove remaining photos through the Storage API first'; end if;
 perform set_config('app.feedback_cleanup_job',job.id::text,true);
 delete from public.stop_feedback where campaign_id=job.campaign_id and environment_id=p_environment;
 get diagnostics removed=row_count;
 perform set_config('app.feedback_cleanup_job','',true);
 update public.feedback_cleanup_jobs set state='completed',completed_at=clock_timestamp(),lease_token=null,lease_until=null,removed_reports=removed where id=p_job;
 perform public.audit_feedback_management('cleanup_completed','cleanup_job',p_job::text,jsonb_build_object('removed_reports',removed,'requested_by',job.requested_by));
 return removed;
end;
$$;
create function public.fail_feedback_cleanup(p_environment uuid,p_job uuid,p_token uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.assert_feedback_environment(p_environment);
 update public.feedback_cleanup_jobs set state='failed',last_error='Storage or cleanup failed. Results are preserved; review and reschedule.',lease_until=null,lease_token=null
 where id=p_job and environment_id=p_environment and state='running' and lease_token=p_token;
 if not found then raise exception 'Invalid cleanup lease' using errcode='42501'; end if;
 perform public.audit_feedback_management('cleanup_failed','cleanup_job',p_job::text);
end;
$$;

-- Never allow a direct destructive bypass to the campaign/export safeguards.
create function public.feedback_cleanup_delete_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare kind text; job_id uuid;
begin
 select e.kind into kind from public.feedback_environment e;
 if kind='unconfigured' then return old; end if;
 job_id=nullif(current_setting('app.feedback_cleanup_job',true),'')::uuid;
 if kind='production' or job_id is null or not exists(select 1 from public.feedback_cleanup_jobs j
  where j.id=job_id and j.environment_id=old.environment_id and j.campaign_id=old.campaign_id and j.state='running' and j.lease_until>now()) then
  raise exception 'Report deletion requires an approved campaign cleanup; production reports are preserved' using errcode='42501';
 end if;
 return old;
end;
$$;
create trigger feedback_cleanup_delete before delete on public.stop_feedback for each row execute function public.feedback_cleanup_delete_guard();
revoke all on function public.feedback_cleanup_delete_guard(),public.feedback_evaluation_fingerprint(uuid),public.feedback_cleanup_blocker(uuid),public.feedback_require_cleanup_lease(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function public.feedback_upload_path_is_valid(object_name text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock_shared(hashtext('feedback-runtime'));
 if not public.feedback_environment_matches() then return false; end if;
 return (select photos_enabled from public.feedback_form_settings where singleton) and exists(select 1 from public.feedback_upload_capabilities u
 where u.storage_path=object_name and u.expires_at>now() and not exists(select 1 from public.stop_feedback_photos p where p.feedback_id=u.feedback_id));
end;
$$;
-- Registration shares the runtime lock too, closing the cleanup/upload race.
alter function public.register_feedback_photo(uuid,text) rename to feedback_register_photo_legacy;
revoke all on function public.feedback_register_photo_legacy(uuid,text) from public,anon,authenticated;
create function public.register_feedback_photo(p_feedback_id uuid,p_storage_path text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock_shared(hashtext('feedback-runtime'));
 perform public.assert_feedback_environment();
 perform public.feedback_register_photo_legacy(p_feedback_id,p_storage_path);
end;
$$;
revoke all on function public.register_feedback_photo(uuid,text) from public;
grant execute on function public.register_feedback_photo(uuid,text) to anon,authenticated;

do $$ declare signature text; begin
 foreach signature in array array['begin_feedback_evaluation_export(uuid,uuid)','finish_feedback_evaluation_export(uuid,uuid,boolean,text,bigint)',
 'confirm_feedback_evaluation_export(uuid,uuid,text)','get_feedback_cleanup_preview(uuid,uuid)','schedule_feedback_cleanup(uuid,uuid,timestamptz,text)','cancel_feedback_cleanup(uuid,uuid)'] loop
  execute 'revoke all on function public.'||signature||' from public,anon';
  execute 'grant execute on function public.'||signature||' to authenticated';
 end loop;
 foreach signature in array array['claim_feedback_cleanup(uuid)','list_feedback_cleanup_photos(uuid,uuid,uuid)','complete_feedback_cleanup(uuid,uuid,uuid)','fail_feedback_cleanup(uuid,uuid,uuid)'] loop
  execute 'revoke all on function public.'||signature||' from public,anon,authenticated';
  execute 'grant execute on function public.'||signature||' to service_role';
 end loop;
end; $$;
notify pgrst,'reload schema';
commit;
