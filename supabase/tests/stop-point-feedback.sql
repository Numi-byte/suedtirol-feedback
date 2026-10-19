-- Run after all migrations in a DISPOSABLE PostgreSQL/Supabase test database.
-- Fixture changes, including the temporary legacy trigger bypass, are rolled back.
\set ON_ERROR_STOP on
begin;
create function pg_temp.check_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %', message; end if; end; $$;
create function pg_temp.must_fail(statement text) returns void language plpgsql as $$
begin
  begin execute statement; exception when others then return; end;
  raise exception 'Expected failure: %', statement;
end; $$;
do $$ begin execute format('grant usage on schema %I to anon, authenticated', (select nspname from pg_namespace where oid = pg_my_temp_schema())); end; $$;
insert into auth.users(id) values ('bdee91d9-c969-4bd4-b336-8f7e780ead3e') on conflict do nothing;
insert into public.bus_stops(id, name_de, name_it, name_en, municipality, latitude, longitude, created_by, is_published, id_version) values
 ('11111111-1111-4111-8111-111111111111','Test Ort','Test luogo','Test place','Bozen',46.5,11.35,'bdee91d9-c969-4bd4-b336-8f7e780ead3e',true,'(it:apb:StopPlace:it:22021:311,any)'),
 ('22222222-2222-4222-8222-222222222222','Privat','Privato','Hidden','Bozen',46.5,11.35,'bdee91d9-c969-4bd4-b336-8f7e780ead3e',false,'(it:apb:StopPlace:it:22021:312,any)');
insert into public.stop_points(id, stop_place_id, point_ref, id_version, point_number, latitude, longitude, name_de, name_it, created_by) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111','it:apb:ScheduledStopPoint:it:22021:311:1:1','(it:apb:ScheduledStopPoint:it:22021:311:1:1,any)','1',46.5,11.35,'Steig Nord','Banchina nord','bdee91d9-c969-4bd4-b336-8f7e780ead3e'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','11111111-1111-4111-8111-111111111111','it:apb:ScheduledStopPoint:it:22021:311:1:2','(it:apb:ScheduledStopPoint:it:22021:311:1:2,any)','2',46.501,11.351,'Steig Süd','Banchina sud','bdee91d9-c969-4bd4-b336-8f7e780ead3e'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','22222222-2222-4222-8222-222222222222','it:apb:ScheduledStopPoint:it:22021:312:1:1','(it:apb:ScheduledStopPoint:it:22021:312:1:1,any)','1',46.5,11.35,'Privat','Privato','bdee91d9-c969-4bd4-b336-8f7e780ead3e');
select pg_temp.check_true((select bool_and(transport_type = 'bus') from public.stop_points), 'all points default to bus');
alter table public.stop_feedback disable trigger require_feedback_stop_point;
insert into public.stop_feedback(id,bus_stop_id,severity,language) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','low','de');
alter table public.stop_feedback enable trigger require_feedback_stop_point;
insert into public.stop_feedback_categories values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','seating');

grant select on public.stop_feedback to anon;
grant update on public.stop_points to anon;
set local role anon;
select public.create_stop_point_feedback('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',array['seating'],'medium','Private description','private@example.com',true,'en');
select pg_temp.check_true((select count(*)=1 from public.list_public_stop_point_threads('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')), 'point one has exactly its own report');
select pg_temp.check_true((select count(*)=0 from public.list_public_stop_point_threads('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2')), 'sibling point has no reports or legacy place reports');
select pg_temp.check_true((select count(*)=2 from public.list_published_stop_points('11111111-1111-4111-8111-111111111111')), 'all public points returned');
select pg_temp.check_true((select count(*)=0 from public.get_published_stop_point('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1')), 'unpublished point detail hidden');
select pg_temp.must_fail($q$select public.create_stop_point_feedback('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',array['seating'],'low')$q$);
select pg_temp.must_fail($q$select public.create_stop_point_feedback(null,array['seating'],'low')$q$);
select pg_temp.must_fail($q$select public.create_stop_point_feedback('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',array['invalid'],'low')$q$);
select pg_temp.must_fail($q$select public.create_feedback_report('11111111-1111-4111-8111-111111111111',array['seating'],'low')$q$);
select pg_temp.must_fail($q$insert into public.stop_feedback(bus_stop_id,severity,language) values ('11111111-1111-4111-8111-111111111111','low','en')$q$);
select pg_temp.must_fail($q$select email from public.list_public_stop_point_threads('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')$q$);
select pg_temp.must_fail($q$select * from public.list_public_feedback_threads('11111111-1111-4111-8111-111111111111')$q$);
select pg_temp.check_true((select count(*)=0 from public.stop_feedback), 'anonymous table reads expose no reports');
update public.stop_points set transport_type='train';
select pg_temp.check_true((select bool_and(transport_type='bus') from public.list_published_stop_points('11111111-1111-4111-8111-111111111111')), 'anonymous users cannot change transport types');
reset role;
select pg_temp.check_true((select count(*)=2 from public.stop_feedback), 'failed requests create no partial reports');
select pg_temp.check_true((select bus_stop_id='11111111-1111-4111-8111-111111111111' from public.stop_feedback where stop_point_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 'parent is derived from point');
select pg_temp.must_fail($q$insert into public.stop_feedback(bus_stop_id,stop_point_id,severity,language) values ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','low','en')$q$);
select pg_temp.must_fail($q$delete from public.stop_points where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'$q$);

set local request.jwt.claim.sub='bdee91d9-c969-4bd4-b336-8f7e780ead3e';
grant select on public.stop_feedback, public.bus_stops to authenticated;
set local role authenticated;
update public.stop_points set transport_type='train' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
select pg_temp.must_fail($q$update public.stop_points set transport_type='plane' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'$q$);
select public.import_stop_point_batch('[{"id_version":"(it:apb:ScheduledStopPoint:it:22021:311:1:1,any)","point_number":"1","latitude":46.5,"longitude":11.35,"name_de":"Steig Nord","name_it":"Banchina nord"}]');
select pg_temp.check_true((select transport_type='train' from public.get_published_stop_point('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')), 'reimport preserves staff transport choice');
select public.update_feedback_status('cccccccc-cccc-4ccc-8ccc-cccccccccccc','in_review');
select public.reply_to_feedback((select id from public.stop_feedback where stop_point_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),'Point-one reply');
reset role;
set local role anon;
select pg_temp.check_true((select reply_body='Point-one reply' from public.list_public_stop_point_threads('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')), 'reply stays in its point thread');
select pg_temp.check_true((select count(*)=0 from public.list_public_stop_point_threads('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2')), 'reply not shown for sibling');
reset role;
update public.bus_stops set archived_at=now() where id='11111111-1111-4111-8111-111111111111';
set local role anon;
select pg_temp.check_true((select count(*)=0 from public.list_published_stop_points('11111111-1111-4111-8111-111111111111')), 'archived points hidden');
select pg_temp.check_true((select count(*)=0 from public.list_public_stop_point_threads('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')), 'archived discussions hidden');
select pg_temp.must_fail($q$select public.create_stop_point_feedback('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',array['seating'],'low')$q$);
reset role;
select pg_temp.check_true((select stop_point_id is null and status='in_review' from public.stop_feedback where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'), 'legacy report retained and reviewable without reassignment');
rollback;
\echo 'PASS: point isolation, publication, permissions, replies, defaults, reimport, retention and legacy workflow'
