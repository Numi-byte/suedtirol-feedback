-- Disposable database only. No changes survive this transaction.
\set ON_ERROR_STOP on
begin;
create or replace function pg_temp.check_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %', message; end if; end; $$;
create or replace function pg_temp.must_fail(statement text) returns void language plpgsql as $$
begin
  begin execute statement; exception when check_violation or not_null_violation then return; end;
  raise exception 'Expected municipality constraint failure: %', statement;
end; $$;
insert into auth.users(id) values ('bdee91d9-c969-4bd4-b336-8f7e780ead3e') on conflict do nothing;
insert into public.bus_stops(id, name_de, name_it, name_en, municipality, latitude, longitude, created_by, is_published, id_version, stop_code)
values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Ort', 'Luogo', 'Place', 'Legacy name', 46.5, 11.35,
  'bdee91d9-c969-4bd4-b336-8f7e780ead3e', true, '(it:apb:StopPlace:it:22021:99999,any)', 'muni-99999');
select pg_temp.check_true((select municipality = 'Legacy name' and municipality_de = '' and municipality_it = ''
  from public.bus_stops where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'), 'legacy fallback retained without guessing translations');
select pg_temp.must_fail($q$update public.bus_stops set municipality_de = 'Bozen' where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'$q$);
select pg_temp.must_fail($q$update public.bus_stops set municipality_it = 'Bolzano' where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'$q$);
select pg_temp.must_fail($q$update public.bus_stops set municipality_de = null where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'$q$);
select pg_temp.must_fail($q$update public.bus_stops set municipality_de = 'Bozen', municipality_it = '  ' where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'$q$);
update public.bus_stops set municipality_de = 'Bozen', municipality_it = 'Bolzano', municipality = 'Bolzano'
  where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
insert into public.stop_points(id, stop_place_id, point_ref, id_version, point_number, latitude, longitude, name_de, name_it, created_by)
values ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'it:apb:ScheduledStopPoint:it:22021:99999:1:1', '(it:apb:ScheduledStopPoint:it:22021:99999:1:1,any)',
  '1', 46.5, 11.35, 'Steig', 'Banchina', 'bdee91d9-c969-4bd4-b336-8f7e780ead3e');
grant select, insert, update on public.bus_stops to authenticated;
set local request.jwt.claim.sub = 'bdee91d9-c969-4bd4-b336-8f7e780ead3e';
set local role authenticated;
select public.import_efa_stop_place_batch('[{"id_version":"(it:apb:StopPlace:it:22021:99999,any)","name_it":"Nuovo nome","latitude":46.5,"longitude":11.35}]');
select public.import_efa_stop_place_batch('[{"id_version":"(it:apb:StopPlace:it:22021:99998,any)","name_it":"Import senza traduzioni","latitude":46.5,"longitude":11.35}]');
select public.import_stop_place_batch('[{"name_de":"Ort aktualisiert","name_it":"Luogo aggiornato","name_en":"Updated place","stop_code":"muni-99999","id_version":"(it:apb:StopPlace:it:22021:99999,any)","publication_timestamp":"2026-10-22T12:00:00Z","latitude":46.5,"longitude":11.35}]', true);
reset role;
select pg_temp.check_true((select municipality_de = 'Bozen' and municipality_it = 'Bolzano'
  from public.bus_stops where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'), 'EFA and CSV reimports preserve both staff translations');
select pg_temp.check_true((select municipality_de = '' and municipality_it = '' and not is_published
  from public.bus_stops where id_version = '(it:apb:StopPlace:it:22021:99998,any)'), 'new EFA stops import without fabricated translations');
update public.bus_stops set is_published = true where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
set local role anon;
select municipality_de = 'Bozen' and municipality_it = 'Bolzano' and municipality = 'Bolzano' as public_names_ok
  from public.list_published_stops_with_feedback_count() where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' \gset
select municipality_de = 'Bozen' and municipality_it = 'Bolzano' as point_names_ok
  from public.get_published_stop_point('ffffffff-ffff-4fff-8fff-ffffffffffff') \gset
reset role;
select pg_temp.check_true(:'public_names_ok'::boolean and :'point_names_ok'::boolean, 'both public RPCs expose parent municipality names to visitors');
update public.bus_stops set archived_at = now() where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
set local role anon;
select count(*) = 0 as archived_place_hidden from public.list_published_stops_with_feedback_count() \gset
select count(*) = 0 as archived_point_hidden from public.get_published_stop_point('ffffffff-ffff-4fff-8fff-ffffffffffff') \gset
reset role;
select pg_temp.check_true(:'archived_place_hidden'::boolean and :'archived_point_hidden'::boolean, 'archive/publication protections remain unchanged');
select pg_temp.check_true(not exists(select 1 from information_schema.columns where table_schema = 'public'
  and table_name in ('stop_points','feedback_test_results') and column_name in ('municipality_de','municipality_it')),
  'municipality translation columns belong only to bus_stops');
rollback;
\echo 'PASS: bilingual municipality constraints, legacy fallback, EFA/CSV compatibility, translation retention and public RPC privacy'
