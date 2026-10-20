-- Starts the official test dataset when applied. Deliberately no historic backfill.
begin;

create table public.feedback_test_results (
  feedback_id uuid primary key,
  test_phase text not null default 'official_testing' check (test_phase = 'official_testing'),
  submitted_at timestamptz not null,
  captured_at timestamptz not null default clock_timestamp(),
  stop_place_id uuid not null,
  stop_place_id_version text,
  stop_place_name_de text not null,
  stop_place_name_it text not null,
  stop_place_name_en text not null,
  municipality text not null,
  stop_point_id uuid not null,
  stop_point_ref text not null,
  stop_point_number text not null,
  stop_point_name_de text not null,
  stop_point_name_it text not null,
  transport_type text not null check (transport_type in ('bus', 'train', 'cable_car')),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  category_slugs text[] not null check (cardinality(category_slugs) > 0),
  category_labels_de text[] not null,
  category_labels_it text[] not null,
  category_labels_en text[] not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  language text not null check (language in ('de', 'it', 'en')),
  check (cardinality(category_slugs) = cardinality(category_labels_de)
    and cardinality(category_slugs) = cardinality(category_labels_it)
    and cardinality(category_slugs) = cardinality(category_labels_en))
);

-- No source foreign keys: deleting/reimporting operational data must not erase
-- test history. Only explicitly listed structured fields are copied below.
comment on table public.feedback_test_results is
  'Structured snapshots of feedback submitted after activation; no historic backfill, free text, contact details, photos, or replies. App roles have read-only staff access.';
comment on column public.feedback_test_results.feedback_id is
  'Internal source report identifier for deduplication; this dataset is not irreversibly anonymous.';
comment on column public.feedback_test_results.latitude is 'Selected stop point latitude, not the visitor location.';
comment on column public.feedback_test_results.longitude is 'Selected stop point longitude, not the visitor location.';
comment on column public.feedback_test_results.category_slugs is
  'Selected issues in display order; the three label arrays use the same order and retain submission-time labels.';

create index feedback_test_results_submitted_idx on public.feedback_test_results (submitted_at desc);
create index feedback_test_results_point_submitted_idx on public.feedback_test_results (stop_point_id, submitted_at desc);

alter table public.feedback_test_results enable row level security;
-- Explicit revocation also covers Supabase projects with permissive default grants.
revoke all on public.feedback_test_results from public, anon, authenticated;
grant select on public.feedback_test_results to authenticated;
create policy "Staff read structured test results"
  on public.feedback_test_results for select to authenticated
  using (auth.uid() is not null);

create function public.capture_structured_test_feedback() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare captured integer;
begin
  insert into public.feedback_test_results (
    feedback_id, submitted_at, stop_place_id, stop_place_id_version,
    stop_place_name_de, stop_place_name_it, stop_place_name_en, municipality,
    stop_point_id, stop_point_ref, stop_point_number, stop_point_name_de, stop_point_name_it,
    transport_type, latitude, longitude, category_slugs,
    category_labels_de, category_labels_it, category_labels_en, severity, language
  )
  select feedback.id, feedback.created_at, places.id, places.id_version,
    places.name_de, places.name_it, places.name_en, places.municipality,
    points.id, points.point_ref, points.point_number, points.name_de, points.name_it,
    points.transport_type, points.latitude, points.longitude, issues.slugs,
    issues.labels_de, issues.labels_it, issues.labels_en, feedback.severity, feedback.language
  from public.stop_feedback feedback
  join public.stop_points points on points.id = feedback.stop_point_id and points.stop_place_id = feedback.bus_stop_id
  join public.bus_stops places on places.id = feedback.bus_stop_id
  cross join lateral (
    select array_agg(definitions.slug order by definitions.sort_order) as slugs,
      array_agg(definitions.label_de order by definitions.sort_order) as labels_de,
      array_agg(definitions.label_it order by definitions.sort_order) as labels_it,
      array_agg(definitions.label_en order by definitions.sort_order) as labels_en
    from public.stop_feedback_categories chosen
    join public.feedback_categories definitions on definitions.slug = chosen.category_slug
    where chosen.feedback_id = feedback.id
  ) issues
  where feedback.id = new.id;
  get diagnostics captured = row_count;
  if captured <> 1 then raise exception 'Unable to capture structured test feedback'; end if;
  return null;
end;
$$;
revoke all on function public.capture_structured_test_feedback() from public, anon, authenticated;

-- The submission RPC inserts category links after the report. Wait until commit
-- so the complete snapshot and the report succeed or roll back together.
-- Only INSERT events are captured; edits to older reports cannot backfill them.
create constraint trigger capture_structured_test_feedback
  after insert on public.stop_feedback deferrable initially deferred
  for each row execute function public.capture_structured_test_feedback();

notify pgrst, 'reload schema';
commit;
