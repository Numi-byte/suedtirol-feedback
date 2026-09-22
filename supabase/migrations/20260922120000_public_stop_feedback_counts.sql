-- Expose only aggregate feedback totals for the public stop finder. Individual
-- feedback remains protected by row-level security.
create or replace function public.list_published_stops_with_feedback_count()
returns table (
  id uuid,
  name_de text,
  name_it text,
  name_en text,
  municipality text,
  latitude double precision,
  longitude double precision,
  is_accessible boolean,
  feedback_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select stops.id, stops.name_de, stops.name_it, stops.name_en,
    stops.municipality, stops.latitude, stops.longitude, stops.is_accessible,
    count(feedback.id) as feedback_count
  from public.bus_stops stops
  left join public.stop_feedback feedback on feedback.bus_stop_id = stops.id
  where stops.is_published and stops.archived_at is null
  group by stops.id;
$$;

revoke all on function public.list_published_stops_with_feedback_count() from public;
grant execute on function public.list_published_stops_with_feedback_count() to anon, authenticated;
