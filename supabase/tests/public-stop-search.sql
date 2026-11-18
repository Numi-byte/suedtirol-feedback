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

set local role anon;
select pg_temp.check_true((select count(*)=1 from public.list_published_stop_search()),'public index exposes published places only');
select pg_temp.check_true((select point_search @> '[{"name_it":"Nord","point_number":"1"}]'::jsonb from public.list_published_stop_search()),'point names and numbers searchable under their actual parent');
select pg_temp.check_true((select to_jsonb(s)::text not like '%PRIVATE_MANAGER_TEST%' from public.list_published_stop_search() s),'search metadata excludes private report text');
select pg_temp.check_true((select bool_and(not (p ? 'created_by') and not (p ? 'id_version') and not (p ? 'stop_place_id')) from public.list_published_stop_search() s cross join lateral jsonb_array_elements(s.point_search) p),'point search projection contains only public names and numbers');
reset role;
update public.bus_stops set is_published=false;
set local role anon;
select pg_temp.check_true((select count(*)=0 from public.list_published_stop_search()),'unpublished places and child names excluded');
reset role;
update public.bus_stops set is_published=true,archived_at=now();
set local role anon;
select pg_temp.check_true((select count(*)=0 from public.list_published_stop_search()),'archived places and child names excluded');
reset role;
rollback;
\echo 'PASS: public stop search includes child names while excluding unpublished/archived places and private metadata'
