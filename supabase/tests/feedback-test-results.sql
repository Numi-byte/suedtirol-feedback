\set ON_ERROR_STOP on
create function pg_temp.check_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %', message; end if; end; $$;
create function pg_temp.must_fail(statement text, expected_state text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate <> expected_state then raise; end if;
    return;
  end;
  raise exception 'Expected failure (%): %', expected_state, statement;
end; $$;
do $$ begin execute format('grant usage on schema %I to anon, authenticated', (select nspname from pg_namespace where oid = pg_my_temp_schema())); end; $$;

select pg_temp.check_true((select count(*) = 1 from public.stop_feedback), 'historic feedback exists before activation');
select pg_temp.check_true((select count(*) = 0 from public.feedback_test_results), 'activation never backfills historic reports');

begin;
set local role anon;
select public.create_stop_point_feedback('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  array['lighting','seating','seating'], 'high', 'PRIVATE_DESCRIPTION_MARKER', 'private-marker@example.com', true, 'en') as first_id \gset
commit;
select pg_temp.check_true((select count(*) = 1 from public.feedback_test_results), 'anonymous RPC commits exactly one complete snapshot');
select pg_temp.check_true((select feedback_id = :'first_id' and test_phase = 'official_testing'
  and stop_point_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  and stop_place_id = '33333333-3333-4333-8333-333333333333'
  and stop_place_id_version = '(it:apb:StopPlace:it:22021:999,any)'
  and stop_place_name_it = 'Stazione test' and municipality = 'Bozen'
  and stop_point_ref = 'it:apb:ScheduledStopPoint:it:22021:999:1:7'
  and stop_point_number = '7' and stop_point_name_de = 'Steig sieben'
  and stop_point_name_it = 'Banchina sette' and transport_type = 'bus'
  and latitude = 46.501 and longitude = 11.351 and severity = 'high' and language = 'en'
  and submitted_at = (select created_at from public.stop_feedback where id = :'first_id')
  and captured_at >= submitted_at
  and category_slugs = array['seating','lighting']
  and category_labels_de = (select array_agg(label_de order by sort_order) from public.feedback_categories where slug in ('seating','lighting'))
  and category_labels_it = (select array_agg(label_it order by sort_order) from public.feedback_categories where slug in ('seating','lighting'))
  and category_labels_en = (select array_agg(label_en order by sort_order) from public.feedback_categories where slug in ('seating','lighting'))
  from public.feedback_test_results), 'snapshot retains complete point data, sorted deduplicated issues, labels and timestamps');
select pg_temp.check_true((select description = 'PRIVATE_DESCRIPTION_MARKER' and email = 'private-marker@example.com'
  and consent_to_contact from public.stop_feedback where id = :'first_id'), 'normal private feedback workflow still accepts contact details');
select pg_temp.check_true((select bool_and(to_jsonb(results)::text not like '%PRIVATE_DESCRIPTION_MARKER%'
  and to_jsonb(results)::text not like '%private-marker@example.com%') from public.feedback_test_results results), 'private values never copied');
select pg_temp.check_true(not exists(select 1 from information_schema.columns where table_schema = 'public'
  and table_name = 'feedback_test_results' and column_name in
  ('email','description','consent_to_contact','reply_body','body','photo','storage_path','created_by','author_id','user_id','ip_address')),
  'snapshot has no contact, free text, photo, reply or visitor identity fields');

set role anon;
select pg_temp.must_fail('select * from public.feedback_test_results', '42501');
select pg_temp.must_fail('insert into public.feedback_test_results default values', '42501');
select pg_temp.must_fail('update public.feedback_test_results set severity = ''low''', '42501');
select pg_temp.must_fail('delete from public.feedback_test_results', '42501');
select pg_temp.must_fail('truncate public.feedback_test_results', '42501');
select pg_temp.must_fail('select public.capture_structured_test_feedback()', '42501');
reset role;
set role authenticated;
select pg_temp.check_true((select count(*) = 0 from public.feedback_test_results), 'missing authenticated identity cannot read snapshots');
reset role;
set request.jwt.claim.sub = 'bdee91d9-c969-4bd4-b336-8f7e780ead3e';
set role authenticated;
select pg_temp.check_true((select count(*) = 1 from public.feedback_test_results), 'authenticated staff can read the test table');
select pg_temp.must_fail('insert into public.feedback_test_results select * from public.feedback_test_results', '42501');
select pg_temp.must_fail('update public.feedback_test_results set severity = ''low''', '42501');
select pg_temp.must_fail('delete from public.feedback_test_results', '42501');
select pg_temp.must_fail('truncate public.feedback_test_results', '42501');
select pg_temp.must_fail('select public.capture_structured_test_feedback()', '42501');
select public.reply_to_feedback(:'first_id', 'PRIVATE_REPLY_MARKER');
select public.update_feedback_status(:'first_id', 'in_review');
reset role;

-- Changes to operational data cannot rewrite the submission-time snapshot.
create temp table original_snapshot as select to_jsonb(results) as data from public.feedback_test_results results;
begin;
update public.bus_stops set name_it = 'Renamed', municipality = 'Elsewhere';
update public.stop_points set name_de = 'Renamed', latitude = 47, transport_type = 'train';
update public.feedback_categories set label_de = 'Changed label' where slug = 'seating';
update public.stop_feedback set description = 'PRIVATE_EDIT_MARKER', email = 'private-edit@example.com' where id = :'first_id';
-- Editing a historic report's categories must not enroll that report in the test.
insert into public.stop_feedback_categories(feedback_id, category_slug)
  select id, 'lighting' from public.stop_feedback where id <> :'first_id';
select pg_temp.check_true((select count(*) = 1 from public.feedback_test_results), 'edits and replies do not capture old reports or duplicate results');
select pg_temp.check_true((select to_jsonb(results) = (select data from original_snapshot)
  from public.feedback_test_results results), 'snapshots retain original names, labels, location and submission data');
rollback;

-- Multiple reports in one transaction, including all transport types/languages.
begin;
update public.stop_points set transport_type = 'train';
set local role anon;
select public.create_stop_point_feedback('dddddddd-dddd-4ddd-8ddd-dddddddddddd', array['accessibility'], 'low', p_language => 'it') as train_id \gset
reset role;
-- Flush the first report before changing the point's type in this synthetic batch.
set constraints capture_structured_test_feedback immediate;
set constraints capture_structured_test_feedback deferred;
update public.stop_points set transport_type = 'cable_car';
set local role anon;
select public.create_stop_point_feedback('dddddddd-dddd-4ddd-8ddd-dddddddddddd', array['weather_protection'], 'medium', p_language => 'de') as cable_id \gset
commit;
select pg_temp.check_true((select count(*) = 3 from public.feedback_test_results), 'each report in a batch is captured once');
select pg_temp.check_true((select transport_type = 'train' and language = 'it' and severity = 'low'
  from public.feedback_test_results where feedback_id = :'train_id'), 'train report captured');
select pg_temp.check_true((select transport_type = 'cable_car' and language = 'de' and severity = 'medium'
  from public.feedback_test_results where feedback_id = :'cable_id'), 'cable car report captured');

begin;
set local role anon;
select public.create_stop_point_feedback('dddddddd-dddd-4ddd-8ddd-dddddddddddd', array['seating'], 'low');
rollback;
select pg_temp.check_true((select count(*) = 3 from public.feedback_test_results)
  and (select count(*) = 4 from public.stop_feedback), 'rolled-back submissions leave no source or snapshot');
set role anon;
select pg_temp.must_fail($q$select public.create_stop_point_feedback('dddddddd-dddd-4ddd-8ddd-dddddddddddd', array['seating'], 'invalid')$q$, 'P0001');
reset role;

-- Force an actual failure during deferred capture, not during RPC validation.
alter table public.feedback_test_results add constraint test_reject_low check (severity <> 'low') not valid;
select pg_temp.must_fail($q$do $capture$ begin
  perform public.create_stop_point_feedback('dddddddd-dddd-4ddd-8ddd-dddddddddddd', array['seating'], 'low');
  set constraints capture_structured_test_feedback immediate;
end $capture$ $q$, '23514');
alter table public.feedback_test_results drop constraint test_reject_low;
select pg_temp.check_true((select count(*) = 3 from public.feedback_test_results)
  and (select count(*) = 4 from public.stop_feedback)
  and (select count(*) = 5 from public.stop_feedback_categories), 'capture failure rolls back report and all category links');

alter table public.stop_feedback disable trigger capture_structured_test_feedback;
select public.create_stop_point_feedback('dddddddd-dddd-4ddd-8ddd-dddddddddddd', array['seating'], 'low') as paused_id \gset
select pg_temp.check_true((select count(*) = 3 from public.feedback_test_results), 'pause leaves normal submissions working');
alter table public.stop_feedback enable trigger capture_structured_test_feedback;
select public.create_stop_point_feedback('dddddddd-dddd-4ddd-8ddd-dddddddddddd', array['lighting'], 'high') as resumed_id \gset
select pg_temp.check_true((select count(*) = 4 from public.feedback_test_results)
  and not exists(select 1 from public.feedback_test_results where feedback_id = :'paused_id')
  and exists(select 1 from public.feedback_test_results where feedback_id = :'resumed_id'), 'resume captures future reports only');

delete from public.stop_feedback;
delete from public.stop_points;
delete from public.bus_stops;
select pg_temp.check_true((select count(*) = 4 from public.feedback_test_results), 'test results survive source feedback, replies, points and places being deleted');
select pg_temp.check_true((select to_jsonb(results) = (select data from original_snapshot)
  from public.feedback_test_results results where feedback_id = :'first_id'), 'retained snapshot is unchanged');
\echo 'PASS: activation, complete atomic capture, privacy, staff read-only access, rollback, transport, frozen history, pause/resume and retention'
