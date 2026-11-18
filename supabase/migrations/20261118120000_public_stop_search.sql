-- Public search metadata only; existing public lookup APIs stay compatible.
begin;
create function public.list_published_stop_search()
returns table(id uuid,name_de text,name_it text,name_en text,municipality text,
 latitude double precision,longitude double precision,is_accessible boolean,feedback_count bigint,
 municipality_de text,municipality_it text,point_search jsonb)
language sql stable security definer set search_path=public,pg_temp as $$
 select s.*,coalesce((select jsonb_agg(distinct jsonb_build_object('name_de',p.name_de,'name_it',p.name_it,'point_number',p.point_number))
 from public.stop_points p where p.stop_place_id=s.id),'[]'::jsonb)
 from public.list_published_stops_with_feedback_count() s;
$$;
revoke all on function public.list_published_stop_search() from public;
grant execute on function public.list_published_stop_search() to anon,authenticated;
notify pgrst,'reload schema';
commit;
