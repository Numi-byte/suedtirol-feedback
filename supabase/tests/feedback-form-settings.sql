-- Disposable PostgreSQL only: real roles, policies, config RPCs and historical data.
\set ON_ERROR_STOP on
begin;
create function pg_temp.check_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %', message; end if; end; $$;
create function pg_temp.must_fail(statement text, expected_state text default '42501') returns void language plpgsql as $$
begin
 begin execute statement; exception when others then
  if sqlstate <> expected_state then raise exception 'Expected %, got %: %',expected_state,sqlstate,sqlerrm; end if; return;
 end; raise exception 'Expected failure: %',statement;
end; $$;
do $$ begin execute format('grant usage on schema %I to anon,authenticated',(select nspname from pg_namespace where oid=pg_my_temp_schema())); end; $$;
insert into auth.users(id,email) values
 ('bdee91d9-c969-4bd4-b336-8f7e780ead3e','owner@example.test'),('99999999-9999-4999-8999-999999999999','staff@example.test');
insert into public.portal_staff(user_id,can_manage_stops,can_manage_database,can_view_feedback) values('99999999-9999-4999-8999-999999999999',true,true,true);
insert into public.bus_stops(id,name_de,name_it,name_en,municipality,latitude,longitude,created_by,is_published) values
 ('11111111-1111-4111-8111-111111111111','Ort','Luogo','Place','Bozen',46.5,11.35,'bdee91d9-c969-4bd4-b336-8f7e780ead3e',true);
insert into public.stop_points(id,stop_place_id,point_ref,id_version,point_number,latitude,longitude,name_de,name_it,created_by) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111','it:apb:ScheduledStopPoint:it:22021:311:1:1','(it:apb:ScheduledStopPoint:it:22021:311:1:1,any)','1',46.5,11.35,'Nord','Nord','bdee91d9-c969-4bd4-b336-8f7e780ead3e');
grant usage on schema storage to anon,authenticated;
grant select,insert on storage.objects to anon,authenticated;
set local role anon;
select pg_temp.check_true(public.get_feedback_form_config()->>'photos_enabled'='true','public form has safe defaults');
select pg_temp.must_fail('select * from public.feedback_form_settings');
select pg_temp.must_fail('select * from public.feedback_configuration_events');
select pg_temp.must_fail('select public.set_feedback_photo_settings(false,1048576)');
select pg_temp.must_fail($q$select public.save_feedback_category('attack','D','I','E',true,1)$q$);
select public.create_stop_point_feedback('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',array['seating'],'low',p_upload_token=>'12345678-1234-4234-8234-123456789abc',p_photo_extension=>'jpg') as old_id \gset
insert into storage.objects(bucket_id,name) values('feedback-photos',:'old_id'||'/12345678-1234-4234-8234-123456789abc.jpg');
select public.register_feedback_photo(:'old_id',:'old_id'||'/12345678-1234-4234-8234-123456789abc.jpg');
select public.create_stop_point_feedback('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',array['seating'],'low',p_upload_token=>'12345678-1234-4234-8234-123456789abd',p_photo_extension=>'jpg') as pending_id \gset
reset role;
set constraints all immediate;
set constraints all deferred;
set local request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
set local role authenticated;
select pg_temp.check_true(public.portal_has_access('feedback') and public.get_portal_access()->>'feedbackSettings'='false','all section rights do not confer feedback configuration');
select pg_temp.must_fail('select public.set_feedback_photo_settings(false,1048576)');
select pg_temp.must_fail($q$select public.save_feedback_category('attack','D','I','E',true,1)$q$);
select pg_temp.must_fail('update public.feedback_form_settings set photos_enabled=false');
select pg_temp.must_fail($q$update public.feedback_categories set label_en='ATTACK'$q$);
reset role;
set local request.jwt.claim.sub='bdee91d9-c969-4bd4-b336-8f7e780ead3e';
set local role authenticated;
select pg_temp.check_true(public.get_portal_access()->>'feedbackSettings'='true','fixed owner has configuration permission');
select public.set_feedback_photo_settings(false,1048576);
select pg_temp.must_fail('select public.set_feedback_photo_settings(true,10485761)','P0001');
select pg_temp.must_fail('select public.set_feedback_photo_settings(null,1048576)','P0001');
reset role;
select pg_temp.check_true((select not public and file_size_limit=1048576 and allowed_mime_types=array['image/jpeg','image/png','image/webp'] from storage.buckets where id='feedback-photos'),'bucket metadata and configuration change atomically');
select pg_temp.check_true((select count(*)=1 from public.stop_feedback_photos),'disabling uploads retains existing photos');
-- Even an object uploaded before disabling cannot be registered afterwards.
insert into storage.objects(bucket_id,name) values('feedback-photos',:'pending_id'||'/12345678-1234-4234-8234-123456789abd.jpg');
set local role anon;
select pg_temp.check_true(not public.feedback_upload_path_is_valid(:'pending_id'||'/12345678-1234-4234-8234-123456789abd.jpg'),'outstanding capabilities disabled');
select pg_temp.must_fail(format('select public.register_feedback_photo(%L,%L)',:'pending_id',:'pending_id'||'/12345678-1234-4234-8234-123456789abd.jpg'),'P0001');
select pg_temp.must_fail($q$select public.create_stop_point_feedback('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',array['seating'],'low',p_upload_token=>'12345678-1234-4234-8234-123456789abe',p_photo_extension=>'png')$q$,'P0001');
select pg_temp.must_fail(format('insert into storage.objects(bucket_id,name) values(''feedback-photos'',%L)',:'pending_id'||'/12345678-1234-4234-8234-123456789abd.jpg'));
select public.create_stop_point_feedback('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',array['seating'],'low');
reset role;
set local role authenticated;
select public.set_feedback_photo_settings(true,1048576);
reset role;
set local role anon;
select public.create_stop_point_feedback('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',array['seating'],'low',p_upload_token=>'12345678-1234-4234-8234-123456789abe',p_photo_extension=>'png') as large_id \gset
-- Storage service enforces bucket size on HTTP uploads; this synthetic object tests registration's second check.
insert into storage.objects(bucket_id,name,metadata) values('feedback-photos',:'large_id'||'/12345678-1234-4234-8234-123456789abe.png','{"size":1048577,"mimetype":"image/png"}');
select pg_temp.must_fail(format('select public.register_feedback_photo(%L,%L)',:'large_id',:'large_id'||'/12345678-1234-4234-8234-123456789abe.png'),'P0001');
reset role;
update storage.objects set metadata='{"size":1,"mimetype":"image/svg+xml"}' where name=:'large_id'||'/12345678-1234-4234-8234-123456789abe.png';
set local role anon;
select pg_temp.must_fail(format('select public.register_feedback_photo(%L,%L)',:'large_id',:'large_id'||'/12345678-1234-4234-8234-123456789abe.png'),'P0001');
reset role;
update storage.objects set metadata='{"size":1048576,"mimetype":"image/png"}' where name=:'large_id'||'/12345678-1234-4234-8234-123456789abe.png';
set local role anon;
select public.register_feedback_photo(:'large_id',:'large_id'||'/12345678-1234-4234-8234-123456789abe.png');
reset role;
set local role authenticated;
select public.save_feedback_category('custom_issue','Neue Kategorie','Nuova categoria','New category',true,1,
 '{"viewBox":[0,0,24,24],"attrs":{"fill":"currentColor"},"nodes":[{"tag":"path","attrs":{"d":"M1 2L20 22Z"},"children":[]}]}',true);
select pg_temp.check_true((public.get_feedback_form_config()->'categories'->0->>'slug')='custom_issue','new category inserts at requested position');
select public.save_feedback_category('custom_issue','Neue Kategorie','Nuova categoria','New category',true,4);
select pg_temp.check_true((public.get_feedback_form_config()->'categories'->3->>'slug')='custom_issue','reordering is collision free');
select pg_temp.check_true((public.get_feedback_form_config()->'categories'->3->'icon') is distinct from 'null'::jsonb,'ordinary label edit preserves assigned icon');
select pg_temp.must_fail($q$select public.save_feedback_category('custom_issue','','I','E',true,1)$q$,'P0001');
select pg_temp.must_fail($q$select public.save_feedback_category('BAD KEY','D','I','E',true,1)$q$,'P0001');
select pg_temp.must_fail($q$select public.save_feedback_category('custom_issue','D','I','E',true,1,'{"viewBox":[0,0,24,24],"attrs":{},"nodes":[{"tag":"script","attrs":{},"children":[]}]}',true)$q$,'P0001');
select pg_temp.must_fail($q$select public.save_feedback_category('custom_issue','D','I','E',true,1,'{"viewBox":[0,0,24,24],"attrs":{"onLoad":"alert(1)"},"nodes":[{"tag":"path","attrs":{"d":"M0 0"},"children":[]}]}',true)$q$,'P0001');
select pg_temp.must_fail($q$select public.save_feedback_category('custom_issue','D','I','E',true,1,'{"viewBox":[0,0,24,24],"attrs":{"fill":"url(https://example.test)"},"nodes":[{"tag":"path","attrs":{"d":"M0 0"},"children":[]}]}',true)$q$,'P0001');
reset role;
set constraints all deferred;
set local role anon;
select public.create_stop_point_feedback('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',array['custom_issue'],'low') as custom_id \gset
reset role;
set constraints all immediate;
set constraints all deferred;
set local role authenticated;
select public.save_feedback_category('custom_issue','Geänderte Kategorie','Categoria modificata','Edited category',false,2,null,true);
reset role;
select pg_temp.check_true((select category_labels_en=array['New category'] from public.feedback_test_results where feedback_id=:'custom_id'),'submission snapshot preserves original labels');
select pg_temp.check_true((select icon is null and not is_active from public.feedback_categories where slug='custom_issue'),'explicit icon removal and category retirement retained');
set local role anon;
select pg_temp.check_true((select 'custom_issue'=any(category_slugs) from public.list_public_stop_point_threads('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1') where feedback_id=:'custom_id'),'retired category remains visible in public history');
select pg_temp.check_true((select label_en='Edited category' from public.feedback_categories where slug='custom_issue'),'public can resolve retired category labels');
select pg_temp.must_fail($q$select public.create_stop_point_feedback('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',array['custom_issue'],'low')$q$,'P0001');
reset role;
set local role authenticated;
do $$ declare i integer; begin
 for i in 1..20 loop perform public.save_feedback_category('extra_'||i,'D','I','E',true,50); end loop;
end; $$;
select pg_temp.must_fail($q$select public.save_feedback_category('excess_active','D','I','E',true,50)$q$,'P0001');
do $$ declare i integer; begin
 for i in 1..19 loop perform public.save_feedback_category('retired_'||i,'D','I','E',false,50); end loop;
end; $$;
select pg_temp.must_fail($q$select public.save_feedback_category('excess_total','D','I','E',false,50)$q$,'P0001');
do $$ declare category record; begin
 for category in select slug from public.feedback_categories where is_active and slug<>'seating' loop
  perform public.save_feedback_category(category.slug,'D','I','E',false,1);
 end loop;
end; $$;
select pg_temp.must_fail($q$select public.save_feedback_category('seating','D','I','E',false,1)$q$,'P0001');
reset role;
select pg_temp.check_true((select count(*)=50 and count(distinct sort_order)=50 and max(sort_order)=50 and min(sort_order)=1 from public.feedback_categories),'ordering remains contiguous with 50 definitions');
select pg_temp.check_true((select count(*)>0 and bool_and(actor_id='bdee91d9-c969-4bd4-b336-8f7e780ead3e') from public.feedback_configuration_events),'configuration edits audited without SVG source or report data');
rollback;
\echo 'PASS: owner-only configuration, photo policy/size/MIME, safe icons, translated categories/order/caps, retirement and historical snapshots'
