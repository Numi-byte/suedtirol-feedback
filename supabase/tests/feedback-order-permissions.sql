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
select array_agg(slug order by sort_order)::text as initial_order from public.feedback_categories \gset
select array_agg(slug order by sort_order desc)::text as reversed_order from public.feedback_categories \gset
set local role anon;
select pg_temp.must_fail(format('select public.reorder_feedback_categories(%L,%L)',:'reversed_order',:'initial_order'));
reset role;
set local request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
set local role authenticated;
select pg_temp.check_true(not public.portal_has_access('feedbackSettings'),'existing staff are not implicitly granted configuration access');
select pg_temp.must_fail(format('select public.reorder_feedback_categories(%L,%L)',:'reversed_order',:'initial_order'));
select pg_temp.must_fail('select public.set_portal_user_access(auth.uid(),true,false,false,false,true)');
reset role;
set local request.jwt.claim.sub='bdee91d9-c969-4bd4-b336-8f7e780ead3e';
set local role authenticated;
select public.set_portal_user_access('99999999-9999-4999-8999-999999999999',true,false,false,false,true);
select pg_temp.check_true((select can_manage_feedback from public.list_portal_users() where user_id='99999999-9999-4999-8999-999999999999'),'owner can see the new permission in the user list');
-- An old deployment's five-argument call preserves the permission.
select public.set_portal_user_access('99999999-9999-4999-8999-999999999999',true,false,false,false);
reset role;
set local request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
set local role authenticated;
select pg_temp.check_true(public.get_portal_access()='{"users":false,"stops":false,"database":false,"feedback":false,"feedbackSettings":true}'::jsonb,'feedback management is independent from user management and inbox access');
select pg_temp.check_true(public.is_portal_staff(),'a config-only user can sign in to the portal');
select pg_temp.must_fail('select * from public.list_portal_users()');
select pg_temp.must_fail('select public.set_portal_user_access(auth.uid(),true,true,true,true,true)');
select pg_temp.must_fail('select public.set_portal_user_access(auth.uid(),true,true,true,true)');
select pg_temp.must_fail($q$select public.import_stop_place_batch('[]',false)$q$);
select pg_temp.must_fail($q$update public.portal_staff set can_view_feedback=true where user_id=auth.uid()$q$);
select pg_temp.check_true((select count(*)=0 from public.bus_stops),'config access does not grant database reads');
select pg_temp.check_true((select count(*)=0 from public.stop_feedback),'config access does not grant private feedback reads');
select public.set_feedback_photo_settings(false,2097152);
select pg_temp.check_true(public.get_feedback_form_config()->>'photos_enabled'='false','delegated manager may change photo policy');
select public.reorder_feedback_categories(:'reversed_order',:'initial_order');
select pg_temp.check_true((select array_agg(slug order by sort_order)=:'reversed_order'::text[] from public.feedback_categories),'full reorder applied atomically');
select pg_temp.must_fail(format('select public.reorder_feedback_categories(%L,%L)',:'initial_order',:'initial_order'),'40001');
select pg_temp.must_fail(format('select public.reorder_feedback_categories(array[''seating'',''seating''],%L)',:'reversed_order'),'P0001');
select pg_temp.must_fail(format('select public.reorder_feedback_categories(array[''unknown''],%L)',:'reversed_order'),'P0001');
select pg_temp.must_fail(format('select public.reorder_feedback_categories(null,%L)',:'reversed_order'),'P0001');
select pg_temp.check_true((select array_agg(slug order by sort_order)=:'reversed_order'::text[] from public.feedback_categories),'invalid or stale saves cannot change the order');
-- A normal category edit has no position field and must retain the latest order.
select public.save_feedback_category('seating','Bearbeitet','Modificato','Edited',true,null);
select pg_temp.check_true((select array_agg(slug order by sort_order)=:'reversed_order'::text[] from public.feedback_categories),'metadata edits preserve current positions');
select public.save_feedback_category('custom_issue','Neu','Nuova','New',true,null);
select pg_temp.check_true((public.get_feedback_form_config()->'categories'->10->>'slug')='custom_issue','new categories append automatically');
select pg_temp.must_fail(format('select public.reorder_feedback_categories(%L,%L)',:'initial_order',:'reversed_order'),'40001');
select pg_temp.must_fail($q$select public.save_feedback_category('seating','D','I','E',true,null,'{"viewBox":[0,0,24,24],"attrs":{},"nodes":[{"tag":"script","attrs":{},"children":[]}]}',true)$q$,'P0001');
reset role;
select pg_temp.check_true((select count(*)=11 and count(distinct sort_order)=11 and min(sort_order)=1 and max(sort_order)=11 from public.feedback_categories),'positions remain unique and contiguous');
select pg_temp.check_true((select count(*)=1 from public.feedback_configuration_events where actor_id='99999999-9999-4999-8999-999999999999' and operation='categories_reordered'),'one audit event per successful reorder');
set local request.jwt.claim.sub='bdee91d9-c969-4bd4-b336-8f7e780ead3e';
set local role authenticated;
select public.set_portal_user_access('99999999-9999-4999-8999-999999999999',false,false,false,false,false);
reset role;
set local request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
set local role authenticated;
select pg_temp.check_true(not public.is_portal_staff() and not public.portal_has_access('feedbackSettings'),'deactivation/revocation takes effect for an existing JWT');
select pg_temp.must_fail('select public.set_feedback_photo_settings(true,1048576)');
select pg_temp.must_fail($q$select public.save_feedback_category('seating','D','I','E',true,null)$q$);
select pg_temp.must_fail(format('select public.reorder_feedback_categories(%L,%L)',:'initial_order',:'reversed_order'));
reset role;
rollback;
\echo 'PASS: delegated feedback access, non-escalation/revocation, atomic complete ordering, stale/invalid saves, automatic positions and SVG restrictions'
