-- Administrative workflow and storage hardening for the protected feedback inbox.
-- Reports are retained when a stop is retired, and uploaded objects must belong
-- to a real report and use the report UUID as their first path segment.

alter table public.stop_feedback
  add column if not exists status text not null default 'new'
    check (status in ('new', 'in_review', 'resolved', 'dismissed')),
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.stop_feedback
  add constraint stop_feedback_contact_consistency_check
  check (
    (consent_to_contact and email is not null and char_length(trim(email)) > 3)
    or (not consent_to_contact and email is null)
  ) not valid;

alter table public.stop_feedback
  add constraint stop_feedback_review_consistency_check
  check (
    (status = 'new' and reviewed_at is null and reviewed_by is null)
    or (status <> 'new' and reviewed_at is not null and reviewed_by is not null)
  ) not valid;

create index if not exists stop_feedback_inbox_idx
  on public.stop_feedback (status, created_at desc);
create index if not exists stop_feedback_stop_created_idx
  on public.stop_feedback (bus_stop_id, created_at desc);

-- Feedback is an audit record and must not disappear when a stop is removed.
alter table public.stop_feedback drop constraint if exists stop_feedback_bus_stop_id_fkey;
alter table public.stop_feedback
  add constraint stop_feedback_bus_stop_id_fkey
  foreign key (bus_stop_id) references public.bus_stops(id) on delete restrict;

create or replace function public.feedback_upload_path_is_valid(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    object_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f-]+\.(jpg|jpeg|png|webp)$'
    and exists (
      select 1 from public.stop_feedback
      where id::text = split_part(object_name, '/', 1)
    );
$$;

revoke all on function public.feedback_upload_path_is_valid(text) from public;
grant execute on function public.feedback_upload_path_is_valid(text) to anon, authenticated;

drop policy if exists "Anyone can upload feedback photos" on storage.objects;
create policy "Feedback photos use a report-owned path"
on storage.objects for insert to anon, authenticated
with check (
  bucket_id = 'feedback-photos'
  and public.feedback_upload_path_is_valid(name)
);

-- Updating workflow fields is deliberately kept out of direct table grants.
-- This function records the acting administrator and keeps status metadata
-- internally consistent in one operation.
create or replace function public.update_feedback_status(p_feedback_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_status not in ('new', 'in_review', 'resolved', 'dismissed') then raise exception 'Invalid status'; end if;

  update public.stop_feedback
  set status = p_status,
      reviewed_at = case when p_status = 'new' then null else now() end,
      reviewed_by = case when p_status = 'new' then null else auth.uid() end,
      updated_at = now()
  where id = p_feedback_id;

  if not found then raise exception 'Feedback not found'; end if;
end;
$$;

revoke all on function public.update_feedback_status(uuid, text) from public;
grant execute on function public.update_feedback_status(uuid, text) to authenticated;
