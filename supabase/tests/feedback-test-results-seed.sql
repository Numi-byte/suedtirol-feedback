-- Applied BEFORE the capture migration, only in a disposable database.
insert into auth.users(id) values ('bdee91d9-c969-4bd4-b336-8f7e780ead3e');
insert into public.bus_stops(id, name_de, name_it, name_en, municipality, latitude, longitude, created_by, is_published, id_version)
values ('33333333-3333-4333-8333-333333333333', 'Test Bahnhof', 'Stazione test', 'Test station', 'Bozen',
  46.5, 11.35, 'bdee91d9-c969-4bd4-b336-8f7e780ead3e', true, '(it:apb:StopPlace:it:22021:999,any)');
insert into public.stop_points(id, stop_place_id, point_ref, id_version, point_number, latitude, longitude, name_de, name_it, created_by)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '33333333-3333-4333-8333-333333333333',
  'it:apb:ScheduledStopPoint:it:22021:999:1:7', '(it:apb:ScheduledStopPoint:it:22021:999:1:7,any)',
  '7', 46.501, 11.351, 'Steig sieben', 'Banchina sette', 'bdee91d9-c969-4bd4-b336-8f7e780ead3e');
select public.create_stop_point_feedback('dddddddd-dddd-4ddd-8ddd-dddddddddddd', array['seating'], 'low');
