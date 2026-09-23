-- Grant the additional protected-portal account permission to create and edit
-- public feedback replies while retaining the original reply author.
create or replace function public.reply_to_feedback(p_feedback_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  allowed_authors constant uuid[] := array[
    'bdee91d9-c969-4bd4-b336-8f7e780ead3e'::uuid,
    'bcd1c5c0-8bee-430b-ba38-75530e2b8a30'::uuid
  ];
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not (auth.uid() = any(allowed_authors)) then raise exception 'Not authorized to reply'; end if;
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
