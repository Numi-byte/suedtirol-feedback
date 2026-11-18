\set ON_ERROR_STOP on
begin;
create function pg_temp.check_true(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %',message; end if; end; $$;
create function pg_temp.must_fail(statement text,expected_state text default '42501') returns void language plpgsql as $$
begin begin execute statement; exception when others then
 if sqlstate<>expected_state then raise exception 'Expected %, got %: %',expected_state,sqlstate,sqlerrm; end if; return;
 end; raise exception 'Expected failure: %',statement; end; $$;
do $$ begin execute format('grant usage on schema %I to anon,authenticated,service_role',(select nspname from pg_namespace where oid=pg_my_temp_schema())); end; $$;
insert into auth.users(id,email) values('bdee91d9-c969-4bd4-b336-8f7e780ead3e','owner@example.test'),('99999999-9999-4999-8999-999999999999','manager@example.test');
insert into auth.users(id,email) values('77777777-7777-4777-8777-777777777777','config-only@example.test');
insert into public.portal_staff(user_id,can_manage_database,can_view_feedback,can_manage_feedback,can_reply_feedback) values('99999999-9999-4999-8999-999999999999',true,true,true,true);
insert into public.portal_staff(user_id,can_manage_stops,can_manage_database,can_view_feedback,can_manage_feedback) values('77777777-7777-4777-8777-777777777777',false,false,false,true);
insert into public.bus_stops(id,name_de,name_it,name_en,municipality,latitude,longitude,created_by,is_published,stop_code) values
 ('11111111-1111-4111-8111-111111111111','Ort','Luogo','Place','Bozen',46.5,11.35,'bdee91d9-c969-4bd4-b336-8f7e780ead3e',true,'it:22021:999');
insert into public.stop_points(id,stop_place_id,point_ref,id_version,point_number,latitude,longitude,name_de,name_it,created_by) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111','it:apb:ScheduledStopPoint:it:22021:999:1:1','(it:apb:ScheduledStopPoint:it:22021:999:1:1,any)','1',46.5,11.35,'Nord','Nord','bdee91d9-c969-4bd4-b336-8f7e780ead3e');
select public.create_stop_point_feedback('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',array['seating'],'low') as historical \gset
set constraints all immediate;
set constraints all deferred;
select public.feedback_environment_id() as env \gset
select jsonb_build_object('x-feedback-environment',:'env','x-feedback-project','testing-project')::text as headers \gset
set local request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
set local role authenticated;
select pg_temp.must_fail(format('select public.initialize_feedback_environment(%L,''testing'',''Pilot'',''testing-project'')',:'env'));
reset role;
set local request.jwt.claim.sub='bdee91d9-c969-4bd4-b336-8f7e780ead3e';
set local role authenticated;
select public.initialize_feedback_environment(:'env','testing','Pilot','testing-project');
select pg_temp.check_true(not public.is_portal_owner(),'missing environment header disables owner rights');
select pg_temp.check_true((select count(*)=0 from public.bus_stops),'unbound reads cannot see private rows');
set local request.headers=:'headers';
select pg_temp.check_true(public.is_portal_owner(),'owner is authorized only with project and environment binding');
select pg_temp.must_fail(format('select public.initialize_feedback_environment(%L,''production'',''Other'',''other-project'')',:'env'),'P0001');
select pg_temp.must_fail('select public.snapshot_feedback_stop_dataset(''22222222-2222-4222-8222-222222222222'',''Cross-environment'')');
select pg_temp.must_fail('update public.stop_points set environment_id=''22222222-2222-4222-8222-222222222222''','23503');
reset role;
select pg_temp.check_true((select campaign_id is null and environment_id is null and dataset_version_id is null and form_version_id is null from public.feedback_test_results where feedback_id=:'historical'),'historical snapshots remain unassigned');
set local request.headers='{"x-feedback-environment":"22222222-2222-4222-8222-222222222222","x-feedback-project":"testing-project"}';
set local role authenticated;
select pg_temp.check_true(not public.portal_has_access('database'),'wrong environment fails closed');
set local request.headers=:'headers';
set local request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
select public.snapshot_feedback_stop_dataset(:'env','Pilot dataset') as dataset \gset
select public.create_feedback_campaign(:'env','Evaluation 1','evaluation',:'dataset') as campaign \gset
set local request.jwt.claim.sub='77777777-7777-4777-8777-777777777777';
select pg_temp.check_true((select count(*)=0 from public.feedback_dataset_places),'config-only access cannot read private stop-version payloads');
select pg_temp.check_true((select count(*)=1 from public.feedback_stop_datasets),'config managers can choose a version by metadata');
select pg_temp.must_fail(format('select public.snapshot_feedback_stop_dataset(%L,''Denied'')',:'env'));
select pg_temp.must_fail(format('select public.record_feedback_dataset_export(%L,%L)',:'env',:'dataset'));
set local request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
select pg_temp.must_fail(format('select public.create_feedback_campaign(%L,''No export'',''practice'',%L,null,null,false)',:'env',:'dataset'));
select public.transition_feedback_campaign(:'env',:'campaign','active');
select pg_temp.must_fail('update public.bus_stops set name_de=''Changed''','P0001');
select pg_temp.must_fail('select public.set_feedback_photo_settings(false,1048576)','P0001');
select pg_temp.must_fail('select public.publish_feedback_production(''22222222-2222-4222-8222-222222222222'',''22222222-2222-4222-8222-222222222222'')');
reset role;
select form_version_id as form from public.feedback_campaigns where id=:'campaign' \gset
set local request.jwt.claim.sub='';
set local role anon;
select pg_temp.must_fail($q$select public.create_stop_point_feedback('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',array['seating'],'low')$q$,'P0001');
select public.create_stop_point_feedback('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',array['seating'],'high',p_upload_token=>'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',p_photo_extension=>'jpg',p_environment=>:'env',p_campaign=>:'campaign',p_dataset_version=>:'dataset',p_form_version=>:'form') as report1 \gset
select public.create_stop_point_feedback('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',array['seating'],'low',p_upload_token=>'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',p_photo_extension=>'png',p_environment=>:'env',p_campaign=>:'campaign',p_dataset_version=>:'dataset',p_form_version=>:'form') as report2 \gset
set constraints all immediate;
set constraints all deferred;
select pg_temp.check_true((select count(*)=1 from public.list_public_stop_point_threads('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')),'new test discussions hidden; historical visibility preserved');
reset role;
select pg_temp.check_true((select count(*)=2 from public.feedback_test_results where campaign_id=:'campaign' and environment_id=:'env' and dataset_version_id=:'dataset' and form_version_id=:'form'),'snapshot tags captured at submission');
select pg_temp.must_fail(format('update public.feedback_test_results set severity=''low'' where feedback_id=%L',:'report1'),'P0001');
select pg_temp.must_fail(format('update public.stop_feedback set campaign_id=null where id=%L',:'report1'),'P0001');
insert into storage.objects(bucket_id,name) values('feedback-photos',:'report1'||'/cccccccc-cccc-4ccc-8ccc-ccccccccccc1.jpg'),('feedback-photos',:'report2'||'/cccccccc-cccc-4ccc-8ccc-ccccccccccc2.png');
grant usage on schema storage to anon,authenticated;
grant select,insert on storage.objects to anon,authenticated;
set local request.headers='';
set local request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
set local role authenticated;
select pg_temp.check_true((select count(*)=2 from storage.objects),'native Storage JWT context reads local authorized photos without PostgREST headers');
set local request.headers='{"x-feedback-environment":"22222222-2222-4222-8222-222222222222","x-feedback-project":"testing-project"}';
select pg_temp.check_true((select count(*)=0 from storage.objects),'explicitly wrong PostgREST environment cannot read Storage metadata');
select pg_temp.check_true(not public.feedback_upload_path_is_valid(:'report2'||'/cccccccc-cccc-4ccc-8ccc-ccccccccccc2.png'),'explicitly wrong environment cannot use an upload capability through PostgREST');
set local request.headers='';
set local request.jwt.claim.sub='77777777-7777-4777-8777-777777777777';
select pg_temp.check_true((select count(*)=0 from storage.objects),'config-only native Storage context cannot read private photos');
set local request.jwt.claim.sub='';
reset role;
set local role anon;
select pg_temp.check_true(public.feedback_upload_path_is_valid(:'report2'||'/cccccccc-cccc-4ccc-8ccc-ccccccccccc2.png'),'native Storage context accepts only a locally issued capability');
reset role;
set local request.headers=:'headers';
set local role anon;
select public.register_feedback_photo(:'report1',:'report1'||'/cccccccc-cccc-4ccc-8ccc-ccccccccccc1.jpg');
reset role;
alter table public.stop_feedback disable trigger capture_structured_test_feedback;
set local role anon;
select pg_temp.must_fail(format('select public.create_stop_point_feedback(''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'',array[''seating''],''low'',p_environment=>%L,p_campaign=>%L,p_dataset_version=>%L,p_form_version=>%L)',:'env',:'campaign',:'dataset',:'form'),'P0001');
reset role;
alter table public.stop_feedback enable trigger capture_structured_test_feedback;
set local request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
set local role authenticated;
select public.reply_to_feedback(:'report1','Test discussion');
select public.moderate_feedback(:'env',:'report1','resolved','hidden','Review note');
select pg_temp.check_true((select count(*)=1 from public.list_public_stop_point_threads('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')),'resolving does not publish a discussion');
select public.transition_feedback_campaign(:'env',:'campaign','closed');
select pg_temp.check_true((public.get_feedback_runtime_context()->>'accepting_submissions')::boolean=false,'closed campaign cannot receive submissions');
select pg_temp.check_true(public.get_feedback_cleanup_preview(:'env',:'campaign')->>'blocker' is not null,'cleanup blocked without export');
select (public.begin_feedback_evaluation_export(:'env',:'campaign')).id as failed_export \gset
select public.finish_feedback_evaluation_export(:'env',:'failed_export',false);
select pg_temp.check_true(public.get_feedback_cleanup_preview(:'env',:'campaign')->>'blocker' like '%failed%','failed export blocks cleanup');
select (public.begin_feedback_evaluation_export(:'env',:'campaign')).id as first_export \gset
select pg_temp.check_true(public.finish_feedback_evaluation_export(:'env',:'first_export',true,repeat('a',64),2),'complete export records receipt');
select pg_temp.must_fail(format('select public.confirm_feedback_evaluation_export(%L,%L,%L)',:'env',:'first_export',repeat('a',64)));
reset role;
set local request.jwt.claim.sub='bdee91d9-c969-4bd4-b336-8f7e780ead3e';
set local role authenticated;
select public.confirm_feedback_evaluation_export(:'env',:'first_export',repeat('a',64));
select public.set_feedback_evaluation_exclusion(:'env',:'report1',true,'Duplicate during training');
select pg_temp.check_true(public.get_feedback_cleanup_preview(:'env',:'campaign')->>'blocker' like '%changed%','new exclusion invalidates old export');
select (public.begin_feedback_evaluation_export(:'env',:'campaign')).id as final_export \gset
select public.finish_feedback_evaluation_export(:'env',:'final_export',true,repeat('b',64),2);
select public.confirm_feedback_evaluation_export(:'env',:'final_export',repeat('b',64));
select pg_temp.check_true(public.get_feedback_cleanup_preview(:'env',:'campaign')->>'blocker' is null,'capture and confirmed export enable scheduling');
reset role;
savepoint incomplete_capture;
insert into public.feedback_campaign_submissions(feedback_id,environment_id,campaign_id,dataset_version_id,form_version_id,submitted_at) values(gen_random_uuid(),:'env',:'campaign',:'dataset',:'form',now());
set local role authenticated;
select pg_temp.check_true(public.get_feedback_cleanup_preview(:'env',:'campaign')->>'blocker' like '%incomplete%','missing snapshot blocks cleanup even if an export exists');
select pg_temp.must_fail(format('select public.schedule_feedback_cleanup(%L,%L,now()+interval ''1 hour'',''Evaluation 1'')',:'env',:'campaign'),'P0001');
rollback to savepoint incomplete_capture;
set local role authenticated;
select public.schedule_feedback_cleanup(:'env',:'campaign',now()+interval '20 minutes','Evaluation 1') as job \gset
select pg_temp.must_fail(format('delete from public.stop_feedback where id=%L',:'report1'));
select pg_temp.must_fail(format('select public.claim_feedback_cleanup(%L)',:'env'));
reset role;
update public.feedback_cleanup_jobs set scheduled_at=now()-interval '1 hour' where id=:'job';
set local request.jwt.claim.sub='';
set local role service_role;
select public.claim_feedback_cleanup(:'env') as claimed \gset
select :'claimed'::jsonb->>'lease_token' as token \gset
select pg_temp.check_true((:'claimed'::jsonb->>'id')::uuid=:'job','worker consumes only the owner-approved due job');
select pg_temp.check_true((:'claimed'::jsonb->>'waiting')::boolean,'new cleanup first waits for in-flight uploads');
select pg_temp.must_fail(format('select public.list_feedback_cleanup_photos(%L,%L,%L)',:'env',:'job',:'token'),'P0001');
reset role;
update public.feedback_cleanup_jobs set uploads_revoked_at=clock_timestamp()-interval '3 minutes' where id=:'job';
set local role service_role;
reset role;
set local request.jwt.claim.sub='bdee91d9-c969-4bd4-b336-8f7e780ead3e';
set local role authenticated;
select pg_temp.must_fail(format('select public.begin_feedback_evaluation_export(%L,%L)',:'env',:'campaign'),'P0001');
select pg_temp.must_fail(format('select public.set_feedback_evaluation_exclusion(%L,%L,false,''Changed during cleanup'')',:'env',:'report1'),'P0001');
reset role;
set local request.jwt.claim.sub='';
set local role service_role;
select pg_temp.must_fail(format('select public.complete_feedback_cleanup(%L,%L,%L)',:'env',:'job',:'token'),'P0001');
select pg_temp.check_true((select count(*)=2 from public.list_feedback_cleanup_photos(:'env',:'job',:'token')),'registered and unregistered photos both included');
reset role;
select pg_temp.check_true((select count(*)=0 from public.feedback_upload_capabilities where feedback_id in(:'report1',:'report2')),'upload permissions revoked before deletion');
-- Emulate a successful Storage API removal in this disposable database only.
delete from storage.objects where bucket_id='feedback-photos';
select pg_temp.must_fail(format('insert into storage.objects(bucket_id,name) values (''feedback-photos'',%L)',:'report2'||'/cccccccc-cccc-4ccc-8ccc-ccccccccccc2.png'));
set local role service_role;
select pg_temp.check_true(public.complete_feedback_cleanup(:'env',:'job',:'token')=2,'worker deletes exactly the campaign reports');
reset role;
select pg_temp.check_true((select count(*)=0 from public.stop_feedback where campaign_id=:'campaign'),'test reports removed');
select pg_temp.check_true((select count(*)=0 from public.feedback_replies where feedback_id=:'report1'),'test replies removed');
select pg_temp.check_true((select count(*)=0 from public.stop_feedback_photos where feedback_id=:'report1'),'test photo metadata removed');
select pg_temp.check_true((select count(*)=2 from public.feedback_test_results where campaign_id=:'campaign'),'evaluation snapshots preserved');
select pg_temp.check_true(exists(select 1 from public.feedback_evaluation_exclusions where feedback_id=:'report1' and excluded),'exclusion preserved separately');
select pg_temp.must_fail(format('insert into storage.objects(bucket_id,name) values (''feedback-photos'',%L)',:'report2'||'/cccccccc-cccc-4ccc-8ccc-ccccccccccc2.png'));
select pg_temp.check_true(exists(select 1 from public.stop_feedback where id=:'historical'),'historical operational records preserved');
select pg_temp.check_true(exists(select 1 from public.feedback_management_audit where action='cleanup_completed' and detail->>'requested_by'='bdee91d9-c969-4bd4-b336-8f7e780ead3e'),'cleanup audited with owner authorization');
rollback;
\echo 'PASS: explicit environment authorization, immutable versions, campaign capture, legacy preservation, export/exclusion safeguards, scoped Storage cleanup and retained results'
