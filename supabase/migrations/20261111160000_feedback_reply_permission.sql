begin;
alter table public.portal_staff add column can_reply_feedback boolean not null default false;
-- Retain the existing designated responder's access, where already approved for the inbox.
update public.portal_staff set can_reply_feedback=true where user_id='bcd1c5c0-8bee-430b-ba38-75530e2b8a30' and can_view_feedback;
alter table public.portal_staff add constraint reply_requires_feedback check(not can_reply_feedback or can_view_feedback);
create function public.can_reply_to_feedback() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select public.portal_has_access('feedback') and (public.is_portal_owner() or exists (
 select 1 from public.portal_staff where user_id=auth.uid() and is_active and can_view_feedback and can_reply_feedback));
$$;
revoke all on function public.can_reply_to_feedback() from public;
grant execute on function public.can_reply_to_feedback() to anon,authenticated;
create function public.set_portal_user_access(p_user_id uuid,p_active boolean,p_stops boolean,p_database boolean,p_feedback boolean,p_feedback_settings boolean,p_reply_feedback boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_portal_owner() then raise exception 'Owner access required' using errcode='42501'; end if;
 if p_user_id='bdee91d9-c969-4bd4-b336-8f7e780ead3e'::uuid then raise exception 'Owner access cannot be changed'; end if;
 if p_user_id is null or p_active is null or p_stops is null or p_database is null or p_feedback is null or p_feedback_settings is null or p_reply_feedback is null then raise exception 'All access settings are required'; end if;
 if p_active and not (p_stops or p_database or p_feedback or p_feedback_settings) then raise exception 'Choose at least one section for an active account'; end if;
 if p_reply_feedback and not p_feedback then raise exception 'Reply access requires feedback access'; end if;
 insert into public.portal_staff(user_id,is_active,can_manage_stops,can_manage_database,can_view_feedback,can_manage_feedback,can_reply_feedback)
 values(p_user_id,p_active,p_stops,p_database,p_feedback,p_feedback_settings,p_reply_feedback)
 on conflict(user_id) do update set is_active=excluded.is_active,can_manage_stops=excluded.can_manage_stops,
 can_manage_database=excluded.can_manage_database,can_view_feedback=excluded.can_view_feedback,can_manage_feedback=excluded.can_manage_feedback,can_reply_feedback=excluded.can_reply_feedback;
 perform public.record_portal_user_event(p_user_id,'access_updated');
end;
$$;
revoke all on function public.set_portal_user_access(uuid,boolean,boolean,boolean,boolean,boolean,boolean) from public;
grant execute on function public.set_portal_user_access(uuid,boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;

-- Older callers retain the child permission only while retaining its parent.
create or replace function public.set_portal_user_access(p_user_id uuid,p_active boolean,p_stops boolean,p_database boolean,p_feedback boolean,p_feedback_settings boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_portal_owner() then raise exception 'Owner access required' using errcode='42501'; end if;
 perform public.set_portal_user_access(p_user_id,p_active,p_stops,p_database,p_feedback,p_feedback_settings,
 p_feedback and coalesce((select can_reply_feedback from public.portal_staff where user_id=p_user_id),false));
end;
$$;
drop function public.list_portal_users(integer,text);
create function public.list_portal_users(p_page integer default 1, p_search text default '')
returns table(user_id uuid,email text,created_at timestamptz,is_active boolean,can_manage_stops boolean,can_manage_database boolean,can_view_feedback boolean,can_manage_feedback boolean,can_reply_feedback boolean,is_owner boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_portal_owner() then raise exception 'Owner access required' using errcode = '42501'; end if;
  if p_page is null or p_page < 1 or p_page > 10000 or char_length(p_search) > 200 then raise exception 'Invalid page or search'; end if;
  return query select u.id,u.email::text,u.created_at,
    coalesce(s.is_active,false),coalesce(s.can_manage_stops,false),coalesce(s.can_manage_database,false),coalesce(s.can_view_feedback,false),coalesce(s.can_manage_feedback,false),coalesce(s.can_reply_feedback,false),
    u.id='bdee91d9-c969-4bd4-b336-8f7e780ead3e'::uuid
  from auth.users u left join public.portal_staff s on s.user_id=u.id
  where coalesce(u.email,'') ilike '%' || replace(replace(replace(coalesce(p_search,''),'\','\\'),'%','\%'),'_','\_') || '%'
  order by u.created_at desc,u.id limit 26 offset (p_page-1)*25;
end;
$$;
revoke all on function public.list_portal_users(integer,text) from public;
grant execute on function public.list_portal_users(integer,text) to authenticated;

create or replace function public.reply_to_feedback(p_feedback_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_reply_to_feedback() then raise exception 'Reply access required' using errcode='42501'; end if;
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


notify pgrst,'reload schema';
commit;
