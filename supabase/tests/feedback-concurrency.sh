#!/usr/bin/env bash
# Called only by the disposable local runner, after its committed fixture.
set -euo pipefail
test_container=${1:?Disposable test container required}
first_log=$(mktemp)
second_log=$(mktemp)
cleanup_logs() { rm -f "$first_log" "$second_log"; }
trap cleanup_logs EXIT
run() { docker --host=unix:///var/run/docker.sock exec -i "$test_container" psql -U postgres -v ON_ERROR_STOP=1; }
await_marker() {
  for attempt in {1..100}; do
    if rg -q "$1" "$first_log"; then return; fi
    sleep 0.05
  done
  cat "$first_log" >&2
  echo 'Concurrent transaction failed to reach its synchronization point' >&2
  exit 1
}
run > "$first_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout='8s';
set local request.jwt.claim.sub='bdee91d9-c969-4bd4-b336-8f7e780ead3e';
select set_config('request.headers',jsonb_build_object('x-feedback-environment',id,'x-feedback-project',project_ref)::text,true) from public.feedback_environment;
select pg_advisory_xact_lock(hashtext('feedback-runtime'));
\echo RUNTIME_LOCKED
select pg_sleep(1);
select public.transition_feedback_campaign(public.feedback_environment_id(),(select id from public.feedback_campaigns),'active');
commit;
SQL
first_pid=$!
await_marker '^RUNTIME_LOCKED$'
if ! run > "$second_log" 2>&1 <<'SQL'
begin;
set local statement_timeout='8s';
set local request.jwt.claim.sub='bdee91d9-c969-4bd4-b336-8f7e780ead3e';
select set_config('request.headers',jsonb_build_object('x-feedback-environment',id,'x-feedback-project',project_ref)::text,true) from public.feedback_environment;
do $$ declare rejected boolean=false; begin
 begin perform public.set_feedback_photo_settings(false,1048576);
 exception when raise_exception then
  if sqlerrm not like '%frozen%' then raise; end if; rejected=true;
 end;
 if not rejected then raise exception 'Configuration unexpectedly changed after activation'; end if;
end; $$;
commit;
SQL
then cat "$first_log" "$second_log" >&2; exit 1; fi
if ! wait "$first_pid"; then cat "$first_log" "$second_log" >&2; exit 1; fi

run > "$first_log" 2>&1 <<'SQL'
begin;
set local request.jwt.claim.sub='bdee91d9-c969-4bd4-b336-8f7e780ead3e';
select set_config('request.headers',jsonb_build_object('x-feedback-environment',id,'x-feedback-project',project_ref)::text,true) from public.feedback_environment;
select public.transition_feedback_campaign(public.feedback_environment_id(),(select id from public.feedback_campaigns),'closed');
select (public.begin_feedback_evaluation_export(public.feedback_environment_id(),(select id from public.feedback_campaigns))).id as receipt \gset
select public.finish_feedback_evaluation_export(public.feedback_environment_id(),:'receipt',true,repeat('a',64),0);
select public.confirm_feedback_evaluation_export(public.feedback_environment_id(),:'receipt',repeat('a',64));
select public.schedule_feedback_cleanup(public.feedback_environment_id(),(select id from public.feedback_campaigns),now()+interval '1 hour','Concurrency campaign');
update public.feedback_cleanup_jobs set scheduled_at=now()-interval '1 hour';
commit;
SQL
run > "$first_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout='8s';
select set_config('request.headers',jsonb_build_object('x-feedback-environment',id,'x-feedback-project',project_ref)::text,true) from public.feedback_environment;
set local role service_role;
do $$ begin
 if public.claim_feedback_cleanup((current_setting('request.headers')::jsonb->>'x-feedback-environment')::uuid) is null then raise exception 'First worker did not claim the job'; end if;
end; $$;
\echo WORKER_LOCKED
select pg_sleep(1);
commit;
SQL
first_pid=$!
await_marker '^WORKER_LOCKED$'
if ! run > "$second_log" 2>&1 <<'SQL'
begin;
set local statement_timeout='8s';
select set_config('request.headers',jsonb_build_object('x-feedback-environment',id,'x-feedback-project',project_ref)::text,true) from public.feedback_environment;
select public.feedback_environment_id() as env \gset
set local role service_role;
do $$ declare claimed jsonb; begin
 select public.claim_feedback_cleanup((current_setting('request.headers')::jsonb->>'x-feedback-environment')::uuid) into claimed;
 if claimed is not null then raise exception 'Second worker claimed an unexpired lease'; end if;
end; $$;
commit;
SQL
then cat "$first_log" "$second_log" >&2; exit 1; fi
if ! wait "$first_pid"; then cat "$first_log" "$second_log" >&2; exit 1; fi
echo 'PASS: concurrent configuration/activation uses consistent locks and concurrent cleanup workers cannot share a lease'
