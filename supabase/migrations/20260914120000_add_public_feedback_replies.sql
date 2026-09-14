-- Public, anonymous feedback threads with replies written by the designated
-- protected-portal account. Personal feedback fields never enter the public
-- projection: a thread contains only its selected categories and the reply.

create table public.feedback_replies (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null unique references public.stop_feedback(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  author_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index feedback_replies_feedback_idx on public.feedback_replies (feedback_id);
alter table public.feedback_replies enable row level security;

-- Portal users may read replies alongside the feedback inbox. Writes remain
-- behind reply_to_feedback(), where the single authorized UUID is enforced.
create policy "Authenticated users read feedback replies"
on public.feedback_replies for select to authenticated using (true);

create or replace function public.reply_to_feedback(p_feedback_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  allowed_author constant uuid := 'bdee91d9-c969-4bd4-b336-8f7e780ead3e';
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if auth.uid() <> allowed_author then raise exception 'Not authorized to reply'; end if;
  if nullif(trim(p_body), '') is null or char_length(trim(p_body)) > 2000 then
    raise exception 'Reply must contain between 1 and 2000 characters';
  end if;
  if not exists (select 1 from public.stop_feedback where id = p_feedback_id) then
    raise exception 'Feedback not found';
  end if;

  insert into public.feedback_replies (feedback_id, body, author_id)
  values (p_feedback_id, trim(p_body), auth.uid())
  on conflict (feedback_id) do update
    set body = excluded.body, author_id = excluded.author_id, updated_at = now();
end;
$$;

revoke all on function public.reply_to_feedback(uuid, text) from public;
grant execute on function public.reply_to_feedback(uuid, text) to authenticated;

-- SECURITY DEFINER is intentional: anon visitors cannot select stop_feedback
-- directly. This narrowly scoped result omits descriptions, email addresses,
-- severity, photos, status and every other potentially identifying field.
create or replace function public.list_public_feedback_threads(p_bus_stop_id uuid)
returns table (
  feedback_id uuid,
  submitted_at timestamptz,
  category_slugs text[],
  reply_body text,
  replied_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    feedback.id,
    feedback.created_at,
    array_agg(categories.category_slug order by definitions.sort_order),
    replies.body,
    replies.updated_at
  from public.stop_feedback feedback
  join public.bus_stops stops
    on stops.id = feedback.bus_stop_id and stops.is_published and stops.archived_at is null
  join public.stop_feedback_categories categories on categories.feedback_id = feedback.id
  join public.feedback_categories definitions
    on definitions.slug = categories.category_slug and definitions.is_active
  left join public.feedback_replies replies on replies.feedback_id = feedback.id
  where feedback.bus_stop_id = p_bus_stop_id
  group by feedback.id, feedback.created_at, replies.body, replies.updated_at
  order by feedback.created_at desc
  limit 100;
$$;

revoke all on function public.list_public_feedback_threads(uuid) from public;
grant execute on function public.list_public_feedback_threads(uuid) to anon, authenticated;
