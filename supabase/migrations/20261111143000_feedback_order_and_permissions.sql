-- Apply after the feedback-form management migration, before deploying the portal.
begin;
alter table public.portal_staff add column can_manage_feedback boolean not null default false;

create or replace function public.portal_has_access(p_section text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select p_section in ('users','stops','database','feedback','feedbackSettings') and (
   public.is_portal_owner() or exists (
     select 1 from public.portal_staff where user_id=auth.uid() and is_active and
       case p_section when 'stops' then can_manage_stops when 'database' then can_manage_database
         when 'feedback' then can_view_feedback when 'feedbackSettings' then can_manage_feedback else false end
   )
 );
$$;
create or replace function public.is_portal_staff() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select public.portal_has_access('stops') or public.portal_has_access('database')
   or public.portal_has_access('feedback') or public.portal_has_access('feedbackSettings');
$$;
create or replace function public.get_portal_access() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('users',public.is_portal_owner(),'feedbackSettings',public.portal_has_access('feedbackSettings'),
 'stops',public.portal_has_access('stops'),'database',public.portal_has_access('database'),'feedback',public.portal_has_access('feedback'));
$$;

create function public.set_portal_user_access(p_user_id uuid,p_active boolean,p_stops boolean,p_database boolean,p_feedback boolean,p_feedback_settings boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_portal_owner() then raise exception 'Owner access required' using errcode='42501'; end if;
 if p_user_id='bdee91d9-c969-4bd4-b336-8f7e780ead3e'::uuid then raise exception 'Owner access cannot be changed'; end if;
 if p_user_id is null or p_active is null or p_stops is null or p_database is null or p_feedback is null or p_feedback_settings is null then raise exception 'All access settings are required'; end if;
 if p_active and not (p_stops or p_database or p_feedback or p_feedback_settings) then raise exception 'Choose at least one section for an active account'; end if;
 insert into public.portal_staff(user_id,is_active,can_manage_stops,can_manage_database,can_view_feedback,can_manage_feedback)
 values(p_user_id,p_active,p_stops,p_database,p_feedback,p_feedback_settings)
 on conflict(user_id) do update set is_active=excluded.is_active,can_manage_stops=excluded.can_manage_stops,
 can_manage_database=excluded.can_manage_database,can_view_feedback=excluded.can_view_feedback,can_manage_feedback=excluded.can_manage_feedback;
 perform public.record_portal_user_event(p_user_id,'access_updated');
end;
$$;
revoke all on function public.set_portal_user_access(uuid,boolean,boolean,boolean,boolean,boolean) from public;
grant execute on function public.set_portal_user_access(uuid,boolean,boolean,boolean,boolean,boolean) to authenticated;
-- Older portal deployments keep the new permission unchanged when saving old flags.
create or replace function public.set_portal_user_access(p_user_id uuid,p_active boolean,p_stops boolean,p_database boolean,p_feedback boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_portal_owner() then raise exception 'Owner access required' using errcode='42501'; end if;
 perform public.set_portal_user_access(p_user_id,p_active,p_stops,p_database,p_feedback,
   coalesce((select can_manage_feedback from public.portal_staff where user_id=p_user_id),false));
end;
$$;

drop function public.list_portal_users(integer,text);
create function public.list_portal_users(p_page integer default 1, p_search text default '')
returns table(user_id uuid,email text,created_at timestamptz,is_active boolean,can_manage_stops boolean,can_manage_database boolean,can_view_feedback boolean,can_manage_feedback boolean,is_owner boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_portal_owner() then raise exception 'Owner access required' using errcode = '42501'; end if;
  if p_page is null or p_page < 1 or p_page > 10000 or char_length(p_search) > 200 then raise exception 'Invalid page or search'; end if;
  return query select u.id,u.email::text,u.created_at,
    coalesce(s.is_active,false),coalesce(s.can_manage_stops,false),coalesce(s.can_manage_database,false),coalesce(s.can_view_feedback,false),coalesce(s.can_manage_feedback,false),
    u.id='bdee91d9-c969-4bd4-b336-8f7e780ead3e'::uuid
  from auth.users u left join public.portal_staff s on s.user_id=u.id
  where coalesce(u.email,'') ilike '%' || replace(replace(replace(coalesce(p_search,''),'\','\\'),'%','\%'),'_','\_') || '%'
  order by u.created_at desc,u.id limit 26 offset (p_page-1)*25;
end;
$$;
revoke all on function public.list_portal_users(integer,text) from public;
grant execute on function public.list_portal_users(integer,text) to authenticated;

create or replace function public.set_feedback_photo_settings(p_enabled boolean,p_max_bytes integer) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.portal_has_access('feedbackSettings') then raise exception 'Feedback management access required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext('feedback-form-configuration'));
 if p_enabled is null or p_max_bytes is null or p_max_bytes not between 65536 and 10485760 then raise exception 'Photo size must be between 64 KiB and 10 MiB'; end if;
 update public.feedback_form_settings set photos_enabled=p_enabled,max_photo_bytes=p_max_bytes,updated_by=auth.uid(),updated_at=now() where singleton;
 update storage.buckets set file_size_limit=p_max_bytes,allowed_mime_types=array['image/jpeg','image/png','image/webp'],public=false where id='feedback-photos';
 insert into public.feedback_configuration_events(actor_id,operation) values(auth.uid(),'photo_settings');
end;
$$;
revoke all on function public.set_feedback_photo_settings(boolean,integer) from public;
grant execute on function public.set_feedback_photo_settings(boolean,integer) to authenticated;

create or replace function public.save_feedback_category(p_slug text,p_label_de text,p_label_it text,p_label_en text,p_active boolean,p_position integer,p_icon jsonb default null,p_replace_icon boolean default false) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare existed boolean; total integer; was_active boolean;
begin
 if not public.portal_has_access('feedbackSettings') then raise exception 'Feedback management access required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext('feedback-form-configuration'));
 -- Ordinary edits preserve the latest saved order; new categories append.
 if p_position is null then
   select sort_order into p_position from public.feedback_categories where slug=p_slug;
   if not found then select count(*)+1 into p_position from public.feedback_categories; end if;
 end if;
 if p_slug is null or p_slug !~ '^[a-z][a-z0-9_]{0,63}$' or p_active is null or p_position is null or p_position not between 1 and 50
   or nullif(btrim(p_label_de),'') is null or nullif(btrim(p_label_it),'') is null or nullif(btrim(p_label_en),'') is null
   or char_length(p_label_de)>160 or char_length(p_label_it)>160 or char_length(p_label_en)>160 then raise exception 'Valid slug, three labels and a position (1–50) are required'; end if;
 if p_replace_icon is null or not public.feedback_icon_is_safe(p_icon) then raise exception 'Invalid icon data'; end if;
 select is_active into was_active from public.feedback_categories where slug=p_slug;
 existed:=found;
 select count(*) into total from public.feedback_categories;
 if not existed and total>=50 then raise exception 'At most 50 category definitions are supported'; end if;
 if p_active and not coalesce(was_active,false) and (select count(*) from public.feedback_categories where is_active)>=30 then raise exception 'At most 30 categories may be active'; end if;
 if not p_active and coalesce(was_active,false) and (select count(*) from public.feedback_categories where is_active)<=1 then raise exception 'Keep at least one active category'; end if;
 set constraints feedback_categories_sort_order_key deferred;
 insert into public.feedback_categories(slug,label_de,label_it,label_en,is_active,sort_order,icon)
 values(p_slug,btrim(p_label_de),btrim(p_label_it),btrim(p_label_en),p_active,1000,case when p_replace_icon then p_icon else null end)
 on conflict(slug) do update set label_de=excluded.label_de,label_it=excluded.label_it,label_en=excluded.label_en,is_active=excluded.is_active,
 icon=case when p_replace_icon then p_icon else public.feedback_categories.icon end;
 select count(*) into total from public.feedback_categories;
 p_position:=least(p_position,total);
 with ranked as (select slug,row_number() over(order by sort_order,slug) as rn from public.feedback_categories where slug<>p_slug)
 update public.feedback_categories c set sort_order=case when r.rn>=p_position then r.rn+1 else r.rn end from ranked r where c.slug=r.slug;
 update public.feedback_categories set sort_order=p_position where slug=p_slug;
 set constraints feedback_categories_sort_order_key immediate;
 insert into public.feedback_configuration_events(actor_id,category_slug,operation) values(auth.uid(),p_slug,case when existed then 'category_updated' else 'category_created' end);
end;
$$;
revoke all on function public.save_feedback_category(text,text,text,text,boolean,integer,jsonb,boolean) from public;
grant execute on function public.save_feedback_category(text,text,text,text,boolean,integer,jsonb,boolean) to authenticated;


-- One atomic save for the whole list; no intermediate order reaches public forms.
create function public.reorder_feedback_categories(p_slugs text[],p_expected_slugs text[]) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare current_order text[]; all_slugs text[];
begin
 if not public.portal_has_access('feedbackSettings') then raise exception 'Feedback management access required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext('feedback-form-configuration'));
 select array_agg(slug order by sort_order),array_agg(slug order by slug) into current_order,all_slugs from public.feedback_categories;
 if p_expected_slugs is distinct from current_order then
   raise exception 'Categories changed. Close and reopen the order editor before saving again.' using errcode='40001';
 end if;
 if p_slugs is null or array_ndims(p_slugs)<>1 or cardinality(p_slugs) not between 1 and 50
   or (select array_agg(slug order by slug) from unnest(p_slugs) as requested(slug)) is distinct from all_slugs then
   raise exception 'Supply each category exactly once';
 end if;
 if p_slugs=current_order then return; end if;
 set constraints feedback_categories_sort_order_key deferred;
 update public.feedback_categories c set sort_order=requested.position
   from unnest(p_slugs) with ordinality as requested(slug,position) where c.slug=requested.slug;
 set constraints feedback_categories_sort_order_key immediate;
 insert into public.feedback_configuration_events(actor_id,operation) values(auth.uid(),'categories_reordered');
end;
$$;
revoke all on function public.reorder_feedback_categories(text[],text[]) from public;
grant execute on function public.reorder_feedback_categories(text[],text[]) to authenticated;
notify pgrst,'reload schema';
commit;
