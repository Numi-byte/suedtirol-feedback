-- Consistent lock order for direct table edits and older configuration RPCs.
-- Freeze evaluation annotations/exports once an approved cleanup starts, so a
-- Storage deletion cannot race a newly invalidated evaluation export.
begin;
create function public.feedback_runtime_statement_lock() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock_shared(hashtext('feedback-runtime'));
 return null;
end;
$$;
revoke all on function public.feedback_runtime_statement_lock() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['bus_stops','stop_points','feedback_categories','feedback_form_settings','feedback_replies','stop_feedback','feedback_upload_capabilities'] loop
  execute format('create trigger feedback_runtime_statement before insert or update or delete on public.%I for each statement execute function public.feedback_runtime_statement_lock()',t);
 end loop;
end; $$;

-- These existing RPCs used the configuration lock before touching a table.
-- Acquire runtime first, matching campaign activation and publication.
do $$
declare signature text; definition text;
begin
 foreach signature in array array['set_feedback_photo_settings(boolean,integer)','save_feedback_category(text,text,text,text,boolean,integer,jsonb,boolean)','reorder_feedback_categories(text[],text[])'] loop
  definition=pg_get_functiondef(('public.'||signature)::regprocedure);
  definition=regexp_replace(definition,'\mbegin\M',E'begin\n perform pg_advisory_xact_lock_shared(hashtext(''feedback-runtime''));','i');
  execute definition;
 end loop;
end;
$$;

-- Guard a metadata change before it can invalidate an in-progress cleanup.
create function public.feedback_evaluation_annotation_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare campaign uuid;
begin
 perform pg_advisory_xact_lock_shared(hashtext('feedback-runtime'));
 perform public.assert_feedback_environment();
 select campaign_id into campaign from public.feedback_test_results where feedback_id=new.feedback_id;
 if exists(select 1 from public.feedback_cleanup_jobs where campaign_id=campaign and state='running') then raise exception 'Evaluation annotations are frozen while cleanup is running'; end if;
 return new;
end;
$$;
create trigger feedback_evaluation_annotation before insert or update on public.feedback_evaluation_exclusions for each row execute function public.feedback_evaluation_annotation_guard();
revoke all on function public.feedback_evaluation_annotation_guard() from public,anon,authenticated;
do $$ declare definition text; begin
 definition=pg_get_functiondef('public.begin_feedback_evaluation_export(uuid,uuid)'::regprocedure);
 definition=regexp_replace(definition,'\mbegin\M',E'begin\n perform pg_advisory_xact_lock_shared(hashtext(''feedback-runtime''));\n if exists(select 1 from public.feedback_cleanup_jobs where campaign_id=p_campaign and state=''running'') then raise exception ''Cannot start a new export while cleanup is running''; end if;','i');
 execute definition;
end; $$;
notify pgrst,'reload schema';
commit;
