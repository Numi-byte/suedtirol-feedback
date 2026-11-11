-- Owner and section permissions, using real database roles in a disposable DB.
\set ON_ERROR_STOP on
begin;
create function pg_temp.check_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %', message; end if; end; $$;
create function pg_temp.must_fail(statement text, expected_state text default '42501') returns void language plpgsql as $$
begin
  begin execute statement; exception when others then
    if sqlstate <> expected_state then raise exception 'Expected %, got %: %', expected_state, sqlstate, sqlerrm; end if;
    return;
  end;
  raise exception 'Expected failure: %',statement;
end; $$;
do $$ begin execute format('grant usage on schema %I to anon,authenticated',(select nspname from pg_namespace where oid=pg_my_temp_schema())); end; $$;
insert into auth.users(id,email) values
 ('bdee91d9-c969-4bd4-b336-8f7e780ead3e','owner@example.test'),
 ('99999999-9999-4999-8999-999999999999','operator@example.test');
set local role anon;
select pg_temp.check_true(not public.is_portal_owner(),'anonymous is not owner');
select pg_temp.check_true(public.get_portal_access() = '{"users":false,"feedbackSettings":false,"stops":false,"database":false,"feedback":false}'::jsonb,'anonymous has no sections');
select pg_temp.must_fail('select * from public.list_portal_users()');
reset role;
set local request.jwt.claim.sub='bdee91d9-c969-4bd4-b336-8f7e780ead3e';
set local role authenticated;
select pg_temp.check_true(public.is_portal_owner() and public.is_portal_staff(),'fixed owner has permanent access without a membership row');
select pg_temp.check_true((select count(*)=2 from public.list_portal_users()),'owner may list account identities');
select pg_temp.must_fail($q$select public.set_portal_user_access('bdee91d9-c969-4bd4-b336-8f7e780ead3e',false,false,false,false)$q$,'P0001');
select public.set_portal_user_access('99999999-9999-4999-8999-999999999999',true,true,false,false);
reset role;
insert into public.bus_stops(id,name_de,name_it,name_en,municipality,latitude,longitude,created_by,is_published,id_version) values
 ('11111111-1111-4111-8111-111111111111','Ort','Luogo','Place','Bozen',46.5,11.35,'bdee91d9-c969-4bd4-b336-8f7e780ead3e',true,'(it:apb:StopPlace:it:22021:311,any)');
insert into public.stop_points(id,stop_place_id,point_ref,id_version,point_number,latitude,longitude,name_de,name_it,created_by) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111','it:apb:ScheduledStopPoint:it:22021:311:1:1','(it:apb:ScheduledStopPoint:it:22021:311:1:1,any)','1',46.5,11.35,'Nord','Nord','bdee91d9-c969-4bd4-b336-8f7e780ead3e');
select public.create_stop_point_feedback('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',array['seating'],'low');
set constraints all immediate;
set local request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
set local role authenticated;
select pg_temp.check_true(public.portal_has_access('stops') and not public.portal_has_access('database') and not public.portal_has_access('feedback'),'import-only permissions are independent');
select pg_temp.must_fail('select * from public.list_portal_users()');
select pg_temp.must_fail($q$select public.set_portal_user_access(auth.uid(),true,true,true,true)$q$);
select pg_temp.must_fail($q$select public.record_portal_user_event(auth.uid(),'access_updated')$q$);
select pg_temp.must_fail($q$insert into public.portal_staff(user_id) values(auth.uid())$q$);
select pg_temp.check_true((select count(*)=0 from public.stop_feedback),'import-only user cannot read private feedback');
select pg_temp.check_true((select count(*)=0 from public.bus_stops),'import-only user cannot list private database rows');
update public.bus_stops set name_de='BYPASS';
select public.import_stop_point_batch('[{"id_version":"(it:apb:ScheduledStopPoint:it:22021:311:1:1,any)","point_number":"1","latitude":46.5,"longitude":11.35,"name_de":"Import update","name_it":"Nord"}]');
reset role;
select pg_temp.check_true((select name_de='Ort' from public.bus_stops),'direct editing cannot bypass database permission');
select pg_temp.check_true((select name_de='Import update' from public.stop_points),'bounded importer works without direct table write privilege');
set local request.jwt.claim.sub='bdee91d9-c969-4bd4-b336-8f7e780ead3e';
set local role authenticated;
select public.set_portal_user_access('99999999-9999-4999-8999-999999999999',true,false,true,false);
reset role;
set local request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
set local role authenticated;
select pg_temp.must_fail($q$select public.import_stop_point_batch('[]')$q$);
select pg_temp.must_fail($q$select public.import_stop_place_batch('[]',false)$q$);
select pg_temp.must_fail($q$select public.import_efa_stop_place_batch('[]')$q$);
update public.bus_stops set name_de='Database edit';
select pg_temp.check_true((select name_de='Database edit' from public.bus_stops),'database permission allows stop editing');
select pg_temp.check_true((select count(*)=0 from public.stop_feedback),'database permission does not expose contact data');
reset role;
set local request.jwt.claim.sub='bdee91d9-c969-4bd4-b336-8f7e780ead3e';
set local role authenticated;
select public.set_portal_user_access('99999999-9999-4999-8999-999999999999',true,false,false,true);
reset role;
set local request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
set local role authenticated;
select pg_temp.check_true((select count(*)=1 from public.stop_feedback),'explicit feedback permission allows inbox reads');
update public.bus_stops set name_de='FEEDBACK BYPASS';
reset role;
select pg_temp.check_true((select name_de='Database edit' from public.bus_stops),'feedback permission is read-only for stops');
set local request.jwt.claim.sub='bdee91d9-c969-4bd4-b336-8f7e780ead3e';
set local role authenticated;
select public.set_portal_user_access('99999999-9999-4999-8999-999999999999',false,true,true,true);
reset role;
set local request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
set local role authenticated;
select pg_temp.check_true(not public.is_portal_staff(),'deactivation removes portal access for existing JWTs');
select pg_temp.check_true((select count(*)=0 from public.stop_feedback),'deactivated account loses private reads');
select pg_temp.must_fail($q$select public.import_stop_point_batch('[]')$q$);
select pg_temp.must_fail($q$select public.update_feedback_status(gen_random_uuid(),'in_review')$q$);
reset role;
select pg_temp.check_true((select count(*)=4 from public.portal_user_management_events where event='access_updated'),'permission changes are audited without storing passwords');
rollback;
\echo 'PASS: fixed owner, account listing, non-escalation, independent section rights, bounded imports, deactivation and audit'
