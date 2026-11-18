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
insert into public.portal_staff(user_id,can_manage_database,can_view_feedback,can_manage_feedback,can_reply_feedback) values('99999999-9999-4999-8999-999999999999',true,true,true,true);
insert into public.bus_stops(id,name_de,name_it,name_en,municipality,latitude,longitude,created_by,is_published,stop_code) values
 ('11111111-1111-4111-8111-111111111111','Ort','Luogo','Place','Bozen',46.5,11.35,'bdee91d9-c969-4bd4-b336-8f7e780ead3e',true,'it:22021:999');
insert into public.stop_points(id,stop_place_id,point_ref,id_version,point_number,latitude,longitude,name_de,name_it,created_by) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111','it:apb:ScheduledStopPoint:it:22021:999:1:1','(it:apb:ScheduledStopPoint:it:22021:999:1:1,any)','1',46.5,11.35,'Nord','Nord','bdee91d9-c969-4bd4-b336-8f7e780ead3e');
select public.create_stop_point_feedback('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',array['seating'],'low') as historical \gset
set constraints all immediate;set constraints all deferred;
set local request.jwt.claim.sub='bdee91d9-c969-4bd4-b336-8f7e780ead3e';
select public.reply_to_feedback(:'historical','Existing public reply');
select public.feedback_environment_id() as env \gset
select jsonb_build_object('x-feedback-environment',:'env','x-feedback-project','production-project')::text as headers \gset
set local role authenticated;
select public.initialize_feedback_environment(:'env','production','Production','production-project');
set local request.headers=:'headers';
select public.snapshot_feedback_stop_dataset(:'env','Production v1') as dataset \gset
select pg_temp.check_true((select count(*)=0 from public.list_published_stops_with_feedback_count()),'configured environment does not expose unpublished working data');
select pg_temp.must_fail(format('select public.create_feedback_campaign(%L,''Wrong'',''evaluation'',%L)',:'env',:'dataset'),'P0001');
set local request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
select pg_temp.must_fail(format('select public.publish_feedback_production(%L,%L)',:'env',:'dataset'));
set local request.jwt.claim.sub='bdee91d9-c969-4bd4-b336-8f7e780ead3e';
select public.publish_feedback_production(:'env',:'dataset');
select pg_temp.check_true((select count(*)=1 from public.list_published_stops_with_feedback_count()),'owner publishes a versioned production dataset');
select pg_temp.check_true((select reply_body='Existing public reply' from public.list_public_stop_point_threads('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')),'historical public reply preserved');
reset role;
select form_version_id as form from public.feedback_runtime \gset
set local request.jwt.claim.sub='';set local role anon;
select public.create_stop_point_feedback('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',array['seating'],'high',p_environment=>:'env',p_dataset_version=>:'dataset',p_form_version=>:'form') as report \gset
set constraints all immediate;set constraints all deferred;
reset role;
select pg_temp.check_true((select public_visibility='pending' and campaign_id is null from public.stop_feedback where id=:'report'),'production submissions pending moderation and no campaign');
select pg_temp.check_true(not exists(select 1 from public.feedback_test_results where feedback_id=:'report'),'production submissions do not contaminate evaluation snapshots');
set local request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';set local role authenticated;
select public.reply_to_feedback(:'report','Draft one');
select public.moderate_feedback(:'env',:'report','resolved',null,'Resolution note',true);
select pg_temp.must_fail(format('select public.moderate_feedback(%L,%L,''resolved'',''published'',''Unauthorized'')',:'env',:'report'));
select pg_temp.check_true((select count(*)=1 from public.list_public_stop_point_threads('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')),'status and a saved reply do not publish');
set local request.jwt.claim.sub='bdee91d9-c969-4bd4-b336-8f7e780ead3e';
select public.moderate_feedback(:'env',:'report','resolved','published','Owner approved',false);
select pg_temp.check_true((select reply_body='Draft one' from public.list_public_stop_point_threads('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1') where feedback_id=:'report'),'owner approves current reply draft');
set local request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
select public.reply_to_feedback(:'report','Draft two');
select public.moderate_feedback(:'env',:'report','in_review',null,'Needs rechecking',false);
select pg_temp.check_true((select reply_body='Draft one' from public.list_public_stop_point_threads('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1') where feedback_id=:'report'),'staff edits remain drafts while previous approved reply stays public');
select public.moderate_feedback(:'env',:'report','in_review','hidden','Moderation',false);
select pg_temp.check_true((select count(*)=1 from public.list_public_stop_point_threads('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')),'moderators can hide content without publication rights');
select pg_temp.must_fail('update public.bus_stops set name_de=''Unauthorized live edit''','P0001');
set local request.jwt.claim.sub='bdee91d9-c969-4bd4-b336-8f7e780ead3e';
select pg_temp.must_fail(format('select public.schedule_feedback_cleanup(%L,%L,now()+interval ''1 hour'',''Wrong'')',:'env',:'dataset'),'P0001');
select public.moderate_feedback(:'env',:'report','resolved','published','Published again',false);
reset role;
update public.stop_feedback set created_at=now()-interval '5 years',verification_due_at=now()-interval '1 year' where id=:'report';
select pg_temp.must_fail(format('delete from public.stop_feedback where id=%L',:'report'));
select pg_temp.check_true(exists(select 1 from public.stop_feedback where id=:'report' and public_visibility='published' and status='resolved'),'age neither deletes reports nor changes status or visibility');
set local role authenticated;
select public.pause_feedback_publication(:'env');
set local request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
select pg_temp.must_fail('update public.bus_stops set archived_at=now()');
reset role;
select pg_temp.check_true(exists(select 1 from public.feedback_management_audit where action='published' and actor_id='bdee91d9-c969-4bd4-b336-8f7e780ead3e'),'production publication is audited');
select pg_temp.check_true((select campaign_id is null and environment_id is null from public.feedback_test_results where feedback_id=:'historical'),'migration and production activation do not guess historical provenance');
rollback;
\echo 'PASS: owner-only production publication, draft replies, separate status and visibility, moderation, verification, preserved historical data and no age deletion'
