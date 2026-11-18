-- Storage has its own JWT/database context and does not promise PostgREST's
-- request.headers GUC. Use local project grants/capabilities there, and retain
-- header checks whenever a PostgREST request context is present.
begin;
create function public.feedback_storage_context_matches() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select nullif(current_setting('request.headers',true),'') is null or public.feedback_environment_matches();
$$;
create function public.feedback_storage_staff_access() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select public.feedback_storage_context_matches() and (
  coalesce(auth.uid()='bdee91d9-c969-4bd4-b336-8f7e780ead3e'::uuid,false) or
  exists(select 1 from public.portal_staff where user_id=auth.uid() and is_active and can_view_feedback)
 );
$$;
revoke all on function public.feedback_storage_context_matches(),public.feedback_storage_staff_access() from public;
grant execute on function public.feedback_storage_context_matches(),public.feedback_storage_staff_access() to anon,authenticated;
drop policy "Private feedback storage reads require staff" on storage.objects;
drop policy "Feedback section private photos" on storage.objects;
create policy "Feedback photos require local staff grants" on storage.objects as restrictive for select to anon,authenticated
 using(bucket_id<>'feedback-photos' or public.feedback_storage_staff_access());

create or replace function public.feedback_upload_path_is_valid(object_name text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock_shared(hashtext('feedback-runtime'));
 if not public.feedback_storage_context_matches() then return false; end if;
 return (select photos_enabled from public.feedback_form_settings where singleton) and exists(
  select 1 from public.feedback_upload_capabilities u join public.stop_feedback f on f.id=u.feedback_id and f.environment_id=u.environment_id
  where u.environment_id=public.feedback_environment_id() and u.storage_path=object_name and u.expires_at>now()
  and not exists(select 1 from public.stop_feedback_photos p where p.feedback_id=u.feedback_id));
end;
$$;

alter table public.feedback_cleanup_jobs add column uploads_revoked_at timestamptz;
-- Retained submission receipts are tombstones for late Storage metadata writes,
-- including after the operational report has been removed.
create function public.feedback_storage_cleanup_revoked(p_name text) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare prefix text;
begin
 prefix=split_part(p_name,'/',1);
 if prefix !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then return false; end if;
 return exists(select 1 from public.feedback_campaign_submissions s join public.feedback_cleanup_jobs j on j.campaign_id=s.campaign_id and j.environment_id=s.environment_id
  where s.feedback_id=prefix::uuid and j.uploads_revoked_at is not null);
end;
$$;
create function public.feedback_storage_cleanup_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.bucket_id='feedback-photos' or (tg_op='UPDATE' and old.bucket_id='feedback-photos') then
  perform pg_advisory_xact_lock_shared(hashtext('feedback-runtime'));
  if (new.bucket_id='feedback-photos' and public.feedback_storage_cleanup_revoked(new.name)) or
   (tg_op='UPDATE' and old.bucket_id='feedback-photos' and public.feedback_storage_cleanup_revoked(old.name)) then
   raise exception 'Campaign upload permission has been revoked for cleanup' using errcode='42501';
  end if;
 end if;
 return new;
end;
$$;
-- A trigger also covers final metadata writes made by an internal Storage role
-- after its initial permission check. It never deletes Storage metadata.
create trigger feedback_storage_cleanup before insert or update of name,bucket_id on storage.objects
 for each row execute function public.feedback_storage_cleanup_guard();
revoke all on function public.feedback_storage_cleanup_revoked(text),public.feedback_storage_cleanup_guard() from public,anon,authenticated;

-- Revoke first, then allow a settling period before any photo/report deletion.
-- Preserve the first revocation time across retries and expired leases.
do $$ declare definition text; begin
 definition=pg_get_functiondef('public.claim_feedback_cleanup(uuid)'::regprocedure);
 definition=replace(definition,'lease_token=gen_random_uuid(),lease_until=',
  'uploads_revoked_at=coalesce(uploads_revoked_at,clock_timestamp()),lease_token=gen_random_uuid(),lease_until=');
 definition=replace(definition,'return jsonb_build_object(''id'',job.id,''campaign_id'',job.campaign_id,''lease_token'',job.lease_token);',
  'return jsonb_build_object(''id'',job.id,''campaign_id'',job.campaign_id,''lease_token'',job.lease_token,''waiting'',job.uploads_revoked_at>clock_timestamp()-interval ''2 minutes'');');
 execute definition;
 definition=pg_get_functiondef('public.feedback_require_cleanup_lease(uuid,uuid,uuid)'::regprocedure);
 definition=replace(definition,'blocker=public.feedback_cleanup_blocker(job.campaign_id);',
  'if job.uploads_revoked_at is null or job.uploads_revoked_at>clock_timestamp()-interval ''2 minutes'' then raise exception ''Waiting for in-flight uploads to settle''; end if; blocker=public.feedback_cleanup_blocker(job.campaign_id);');
 execute definition;
end; $$;
notify pgrst,'reload schema';
commit;
