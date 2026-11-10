\set ON_ERROR_STOP on
begin;
create function pg_temp.check_true(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'Assertion failed: %',message; end if; end; $$;
create function pg_temp.must_fail(statement text,expected_state text default '42501') returns void language plpgsql as $$
begin begin execute statement; exception when others then if sqlstate<>expected_state then raise; end if; return; end; raise exception 'Expected failure: %',statement; end; $$;
do $$ begin execute format('grant usage on schema %I to anon,authenticated',(select nspname from pg_namespace where oid=pg_my_temp_schema())); end; $$;
insert into auth.users(id,email) values('bdee91d9-c969-4bd4-b336-8f7e780ead3e','owner@example.test'),('99999999-9999-4999-8999-999999999999','import@example.test');
insert into public.portal_staff(user_id,can_manage_stops,can_manage_database,can_view_feedback) values('99999999-9999-4999-8999-999999999999',true,false,false);
insert into public.bus_stops(id,name_de,name_it,name_en,municipality,municipality_de,municipality_it,latitude,longitude,created_by,is_published,id_version,archived_at) values
 ('11111111-1111-4111-8111-111111111111','Ort','Luogo','Place','Legacy municipality','','',46.5,11.35,'bdee91d9-c969-4bd4-b336-8f7e780ead3e',true,'(it:apb:StopPlace:it:22021:2553,any)',null),
 ('22222222-2222-4222-8222-222222222222','Ort','Luogo','Place','Existing','Custom German','Custom Italian',46.5,11.35,'bdee91d9-c969-4bd4-b336-8f7e780ead3e',true,'(it:apb:StopPlace:it:22021:2553,any)',null),
 ('33333333-3333-4333-8333-333333333333','Ort','Luogo','Place','','','',46.5,11.35,'bdee91d9-c969-4bd4-b336-8f7e780ead3e',false,'(it:apb:StopPlace:it:22021:25531,any)',null),
 ('44444444-4444-4444-8444-444444444444','Ort','Luogo','Place','','  ',' ',46.5,11.35,'bdee91d9-c969-4bd4-b336-8f7e780ead3e',false,'(it:apb:StopPlace:it:22021:6,any)',now());
set local role anon;
select pg_temp.must_fail('select * from public.list_stops_missing_municipality()');
select pg_temp.must_fail($q$select public.fill_missing_stop_municipalities('[]')$q$);
reset role;
set local request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
set local role authenticated;
select pg_temp.must_fail('select * from public.list_stops_missing_municipality()');
select pg_temp.must_fail($q$select public.fill_missing_stop_municipalities('[]')$q$);
reset role;
set local request.jwt.claim.sub='bdee91d9-c969-4bd4-b336-8f7e780ead3e';
set local role authenticated;
select pg_temp.check_true((select count(*)=3 from public.list_stops_missing_municipality()),'all missing rows include whitespace and archived records');
select pg_temp.check_true((select count(*)=1 from public.list_stops_missing_municipality('33333333-3333-4333-8333-333333333333',250)),'keyset paging does not repeat earlier rows');
select pg_temp.check_true((public.fill_missing_stop_municipalities('[
 {"id":"11111111-1111-4111-8111-111111111111","source_id":"it:22021:2553","municipality_de":"Meran","municipality_it":"Merano"},
 {"id":"22222222-2222-4222-8222-222222222222","source_id":"it:22021:2553","municipality_de":"Meran","municipality_it":"Merano"},
 {"id":"33333333-3333-4333-8333-333333333333","source_id":"it:22021:2553","municipality_de":"Meran","municipality_it":"Merano"},
 {"id":"44444444-4444-4444-8444-444444444444","source_id":"it:22021:6","municipality_de":"Graun im Vinschgau","municipality_it":"Curon Venosta"}
]')->>'updated')::int=2,'only exact source IDs and currently missing fields are filled');
select pg_temp.check_true((select municipality_de='Meran' and municipality_it='Merano' and municipality='Legacy municipality' and is_published and archived_at is null from public.bus_stops where id='11111111-1111-4111-8111-111111111111'),'fill preserves existing legacy text and publication');
select pg_temp.check_true((select municipality_de='Custom German' and municipality_it='Custom Italian' from public.bus_stops where id='22222222-2222-4222-8222-222222222222'),'concurrently completed translations cannot be overwritten');
select pg_temp.check_true((select municipality_de='' from public.bus_stops where id='33333333-3333-4333-8333-333333333333'),'similar stop suffix cannot match');
select pg_temp.check_true((select municipality_de='Graun im Vinschgau' and municipality_it='Curon Venosta' and not is_published and archived_at is not null and not municipality_names_missing from public.bus_stops where id='44444444-4444-4444-8444-444444444444'),'frazione fills actual comune while preserving archive state');
select pg_temp.check_true((public.fill_missing_stop_municipalities('[{"id":"11111111-1111-4111-8111-111111111111","source_id":"it:22021:2553","municipality_de":"Meran","municipality_it":"Merano"}]')->>'updated')::int=0,'rerunning is idempotent');
select pg_temp.must_fail($q$select public.fill_missing_stop_municipalities('[]')$q$,'P0001');
reset role;
rollback;
\echo 'PASS: missing municipality keyset scan, database-only permissions, exact ID matching, non-overwrite, archives, whitespace, and idempotency'
