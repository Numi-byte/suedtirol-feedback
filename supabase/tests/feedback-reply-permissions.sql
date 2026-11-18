-- Real API roles against disposable PostgreSQL; never the hosted project.
\set ON_ERROR_STOP on
begin;
create function pg_temp.check_true(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %',message; end if; end; $$;
create function pg_temp.must_fail(statement text,expected_state text default '42501') returns void language plpgsql as $$
begin
 begin execute statement; exception when others then
  if sqlstate<>expected_state then raise exception 'Expected %, got %: %',expected_state,sqlstate,sqlerrm; end if; return;
 end; raise exception 'Expected failure: %',statement;
end; $$;
do $$ begin execute format('grant usage on schema %I to anon,authenticated',(select nspname from pg_namespace where oid=pg_my_temp_schema())); end; $$;
insert into auth.users(id,email) values
 ('bdee91d9-c969-4bd4-b336-8f7e780ead3e','owner@example.test'),('99999999-9999-4999-8999-999999999999','manager@example.test');
insert into public.portal_staff(user_id,can_manage_stops,can_manage_database,can_view_feedback) values('99999999-9999-4999-8999-999999999999',true,true,true);
insert into public.bus_stops(id,name_de,name_it,name_en,municipality,latitude,longitude,created_by,is_published) values
 ('11111111-1111-4111-8111-111111111111','Ort','Luogo','Place','Bozen',46.5,11.35,'bdee91d9-c969-4bd4-b336-8f7e780ead3e',true);
insert into public.stop_points(id,stop_place_id,point_ref,id_version,point_number,latitude,longitude,name_de,name_it,created_by) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111','it:apb:ScheduledStopPoint:it:22021:311:1:1','(it:apb:ScheduledStopPoint:it:22021:311:1:1,any)','1',46.5,11.35,'Nord','Nord','bdee91d9-c969-4bd4-b336-8f7e780ead3e');
select public.create_stop_point_feedback('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',array['seating'],'low','PRIVATE_MANAGER_TEST');
set constraints all immediate;
set constraints all deferred;

set local request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
set local role authenticated;
select pg_temp.check_true(not public.can_reply_to_feedback(),'inbox permission does not imply reply permission');
select pg_temp.must_fail($q$select public.reply_to_feedback((select id from public.stop_feedback limit 1),'Denied')$q$);
select pg_temp.must_fail('select public.set_portal_user_access(auth.uid(),true,false,false,true,false,true)');
reset role;
set local request.jwt.claim.sub='bdee91d9-c969-4bd4-b336-8f7e780ead3e';
set local role authenticated;
select pg_temp.check_true(public.can_reply_to_feedback(),'owner retains reply access');
select pg_temp.must_fail($q$select public.set_portal_user_access('99999999-9999-4999-8999-999999999999',true,true,false,false,false,true)$q$,'P0001');
select public.set_portal_user_access('99999999-9999-4999-8999-999999999999',true,false,false,true,false,true);
select pg_temp.check_true((select can_reply_feedback from public.list_portal_users() where user_id='99999999-9999-4999-8999-999999999999'),'owner lists subordinate permission');
reset role;
set local request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
set local role authenticated;
select pg_temp.check_true(public.can_reply_to_feedback(),'explicit grant allows replying');
select public.reply_to_feedback((select id from public.stop_feedback limit 1),'Authorized reply');
select pg_temp.check_true((select body='Authorized reply' from public.feedback_replies limit 1),'reply persisted');
reset role;
set local request.jwt.claim.sub='bdee91d9-c969-4bd4-b336-8f7e780ead3e';
set local role authenticated;
select public.set_portal_user_access('99999999-9999-4999-8999-999999999999',true,false,false,true,false,false);
reset role;
set local request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
set local role authenticated;
select pg_temp.check_true(not public.can_reply_to_feedback(),'revocation applies to existing sessions');
select pg_temp.must_fail($q$select public.reply_to_feedback((select id from public.stop_feedback limit 1),'Denied edit')$q$);
select pg_temp.check_true((select body='Authorized reply' from public.feedback_replies limit 1),'revocation retains existing reply');
reset role;
set local request.jwt.claim.sub='bdee91d9-c969-4bd4-b336-8f7e780ead3e';
set local role authenticated;
select public.set_portal_user_access('99999999-9999-4999-8999-999999999999',true,false,false,true,false,true);
select public.set_portal_user_access('99999999-9999-4999-8999-999999999999',false,false,false,true,false);
reset role;
set local request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
set local role authenticated;
select pg_temp.check_true(not public.can_reply_to_feedback(),'deactivation overrides saved reply grant');
reset role;
set local request.jwt.claim.sub='bdee91d9-c969-4bd4-b336-8f7e780ead3e';
set local role authenticated;
select public.set_portal_user_access('99999999-9999-4999-8999-999999999999',true,true,false,false,false);
reset role;
select pg_temp.check_true((select not can_reply_feedback from public.portal_staff where user_id='99999999-9999-4999-8999-999999999999'),'legacy parent removal clears child grant');
rollback;
\echo 'PASS: reply grant, parent dependency, owner-only assignment, revocation, deactivation and legacy compatibility'
