-- Disposable PostgreSQL only. Tests direct SQL access as real API roles, not UI guards.
\set ON_ERROR_STOP on
begin;
create function pg_temp.check_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %', message; end if; end; $$;
create function pg_temp.must_fail(statement text, expected_state text default '42501') returns void language plpgsql as $$
begin
  begin execute statement; exception when others then
    if sqlstate <> expected_state then raise exception 'Expected SQLSTATE %, got %: %', expected_state, sqlstate, sqlerrm; end if;
    return;
  end;
  raise exception 'Expected failure: %', statement;
end; $$;
do $$ begin execute format('grant usage on schema %I to anon, authenticated', (select nspname from pg_namespace where oid = pg_my_temp_schema())); end; $$;
insert into auth.users(id) values
 ('bdee91d9-c969-4bd4-b336-8f7e780ead3e'), ('99999999-9999-4999-8999-999999999999');
insert into public.portal_staff(user_id) values ('bdee91d9-c969-4bd4-b336-8f7e780ead3e');
insert into public.bus_stops(id,name_de,name_it,name_en,municipality,latitude,longitude,created_by,is_published) values
 ('11111111-1111-4111-8111-111111111111','Ort','Luogo','Place','Bozen',46.5,11.35,'bdee91d9-c969-4bd4-b336-8f7e780ead3e',true);
insert into public.stop_points(id,stop_place_id,point_ref,id_version,point_number,latitude,longitude,name_de,name_it,created_by) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111','it:apb:ScheduledStopPoint:it:22021:311:1:1','(it:apb:ScheduledStopPoint:it:22021:311:1:1,any)','1',46.5,11.35,'Nord','Nord','bdee91d9-c969-4bd4-b336-8f7e780ead3e');
-- Mimic the real storage service's role grants; policies still enforce access.
grant usage on schema storage to anon, authenticated;
grant insert, select on storage.objects to anon, authenticated;

set local role anon;
select pg_temp.check_true(not public.is_portal_staff(), 'anonymous is not staff');
select public.create_stop_point_feedback('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', array['seating'], 'low', 'PRIVATE', 'private@example.com', true, 'de',
 '12345678-1234-4234-8234-123456789abc', 'jpg') as report_id \gset
select pg_temp.check_true((select count(*) = 1 from public.list_public_stop_point_threads('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')), 'public discussion remains readable');
select pg_temp.must_fail('select email from public.stop_feedback');
select pg_temp.must_fail('select * from public.feedback_upload_capabilities');
select pg_temp.must_fail('select * from public.portal_staff');
select pg_temp.check_true(not public.feedback_upload_path_is_valid(:'report_id' || '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg'), 'public report ID cannot authorize arbitrary photo');
select pg_temp.check_true(not public.feedback_upload_path_is_valid(:'report_id' || '/12345678-1234-4234-8234-123456789abc.png'), 'capability authorizes only one exact extension');
select pg_temp.check_true(public.feedback_upload_path_is_valid(:'report_id' || '/12345678-1234-4234-8234-123456789abc.jpg'), 'valid capability authorizes expected upload');
select pg_temp.must_fail(format('insert into storage.objects(bucket_id,name) values (''feedback-photos'', %L)', :'report_id' || '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg'));
insert into storage.objects(bucket_id,name) values ('feedback-photos', :'report_id' || '/12345678-1234-4234-8234-123456789abc.jpg');
select public.register_feedback_photo(:'report_id', :'report_id' || '/12345678-1234-4234-8234-123456789abc.jpg');
select public.register_feedback_photo(:'report_id', :'report_id' || '/12345678-1234-4234-8234-123456789abc.jpg');
select pg_temp.check_true(not public.feedback_upload_path_is_valid(:'report_id' || '/12345678-1234-4234-8234-123456789abc.jpg'), 'registered report cannot accept another object');
select pg_temp.check_true((select count(*)=0 from storage.objects), 'anonymous cannot read private storage');
select pg_temp.must_fail(format('select public.register_feedback_photo(%L, %L)', :'report_id', :'report_id' || '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg'));
select pg_temp.must_fail($q$select public.create_stop_point_feedback('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',array_fill('seating'::text,array[11]),'low')$q$, 'P0001');
select pg_temp.must_fail($q$select public.create_stop_point_feedback('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',array['seating'],'low',repeat('x',501))$q$, 'P0001');
select pg_temp.must_fail($q$select public.create_stop_point_feedback('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',array['seating'],'low',p_photo_extension=>'svg')$q$, 'P0001');
reset role;
-- Complete deferred snapshot capture now, while the transaction still rolls back.
set constraints all immediate;
select pg_temp.check_true((select count(*)=1 from public.feedback_test_results), 'valid submission still captures structured results');
select pg_temp.check_true((select count(*)=1 from public.stop_feedback_photos), 'photo registration is idempotent');
set constraints all deferred;
set local role anon;
select public.create_stop_point_feedback('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', array['seating'], 'low', p_upload_token => '12345678-1234-4234-8234-123456789abd', p_photo_extension => 'png') as expired_id \gset
select pg_temp.check_true(public.feedback_upload_path_is_valid(:'expired_id' || '/12345678-1234-4234-8234-123456789abd.png'), 'unused capability initially works');
reset role;
update public.feedback_upload_capabilities set expires_at = now() - interval '1 minute';
set local role anon;
select pg_temp.check_true(not public.feedback_upload_path_is_valid(:'expired_id' || '/12345678-1234-4234-8234-123456789abd.png'), 'unused expired capability denied');
reset role;

set local request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
set local role authenticated;
select pg_temp.check_true(not public.is_portal_staff(), 'ordinary authenticated user is not staff');
select pg_temp.check_true((select count(*)=0 from public.stop_feedback), 'ordinary account cannot read reports');
select pg_temp.check_true((select count(*)=0 from public.feedback_test_results), 'ordinary account cannot read test results');
select pg_temp.check_true((select count(*)=0 from public.stop_feedback_photos), 'ordinary account cannot read photo links');
select pg_temp.check_true((select count(*)=0 from storage.objects), 'ordinary account cannot read private objects');
select pg_temp.must_fail('insert into public.portal_staff(user_id) values (auth.uid())');
select pg_temp.must_fail('truncate public.stop_feedback');
select pg_temp.must_fail('delete from public.stop_feedback');
select pg_temp.must_fail($q$select public.import_stop_place_batch('[]'::jsonb,false)$q$);
select pg_temp.must_fail($q$select public.import_stop_point_batch('[]'::jsonb)$q$);
select pg_temp.must_fail($q$select public.import_efa_stop_place_batch('[]'::jsonb)$q$);
select pg_temp.must_fail(format('select public.update_feedback_status(%L, ''in_review'')', :'report_id'));
select pg_temp.must_fail(format('select public.reply_to_feedback(%L, ''unauthorized reply'')', :'report_id'));
update public.bus_stops set name_de='ATTACK';
update public.stop_points set transport_type='train';
reset role;
select pg_temp.check_true((select name_de='Ort' from public.bus_stops), 'ordinary account cannot change stops');
select pg_temp.check_true((select transport_type='bus' from public.stop_points), 'ordinary account cannot change points');

set local request.jwt.claim.sub='bdee91d9-c969-4bd4-b336-8f7e780ead3e';
set local role authenticated;
select pg_temp.check_true(public.is_portal_staff(), 'approved account is staff');
select pg_temp.check_true((select count(*)=2 from public.stop_feedback), 'staff can read reports');
select pg_temp.check_true((select count(*)=1 from storage.objects), 'staff can read report photos');
select public.update_feedback_status(:'report_id','in_review');
select public.reply_to_feedback(:'report_id','Authorized reply');
update public.stop_points set transport_type='train';
reset role;
-- Revocation is effective on the next statement; auth account stays intact.
delete from public.portal_staff;
set local role authenticated;
select pg_temp.check_true(not public.is_portal_staff(), 'removed staff member loses access');
select pg_temp.check_true((select count(*)=0 from public.stop_feedback), 'revocation hides reports');
select pg_temp.must_fail(format('select public.update_feedback_status(%L, ''resolved'')', :'report_id'));
reset role;
rollback;
\echo 'PASS: staff isolation, direct API-role permissions, revocation, upload capabilities, validation, private storage, snapshots'
