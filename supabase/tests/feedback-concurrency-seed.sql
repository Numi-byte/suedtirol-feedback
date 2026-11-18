-- Disposable fixture committed only for the two-session concurrency checks.
begin;
insert into auth.users(id,email) values('bdee91d9-c969-4bd4-b336-8f7e780ead3e','concurrency-owner@example.test');
insert into public.bus_stops(id,name_de,name_it,name_en,municipality,latitude,longitude,created_by,is_published,stop_code)
values('11111111-1111-4111-8111-111111111111','Ort','Luogo','Place','Bozen',46.5,11.35,'bdee91d9-c969-4bd4-b336-8f7e780ead3e',true,'it:22021:999');
insert into public.stop_points(id,stop_place_id,point_ref,id_version,point_number,latitude,longitude,name_de,name_it,created_by)
values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111','it:apb:ScheduledStopPoint:it:22021:999:1:1','(it:apb:ScheduledStopPoint:it:22021:999:1:1,any)','1',46.5,11.35,'Nord','Nord','bdee91d9-c969-4bd4-b336-8f7e780ead3e');
set local request.jwt.claim.sub='bdee91d9-c969-4bd4-b336-8f7e780ead3e';
select public.initialize_feedback_environment(public.feedback_environment_id(),'testing','Concurrency','concurrency-project');
select set_config('request.headers',jsonb_build_object('x-feedback-environment',id,'x-feedback-project',project_ref)::text,true) from public.feedback_environment;
select public.snapshot_feedback_stop_dataset(public.feedback_environment_id(),'Concurrency v1') as dataset \gset
select public.create_feedback_campaign(public.feedback_environment_id(),'Concurrency campaign','evaluation',:'dataset');
commit;
