begin;
create function public.record_feedback_operational_export(p_environment uuid,p_table text,p_rows integer) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.assert_feedback_environment(p_environment);
 if p_environment is null or p_table is null or p_table not in ('places','points','feedback') or p_rows is null or p_rows not between 0 and 100000 then raise exception 'Invalid export'; end if;
 if not public.portal_has_access(case when p_table='feedback' then 'feedback' else 'database' end) then raise exception 'Section access required' using errcode='42501'; end if;
 perform public.audit_feedback_management('operational_export','csv',p_table,jsonb_build_object('rows',p_rows));
end;
$$;
revoke all on function public.record_feedback_operational_export(uuid,text,integer) from public,anon;
grant execute on function public.record_feedback_operational_export(uuid,text,integer) to authenticated;
create function public.record_feedback_dataset_export(p_environment uuid,p_dataset uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.feedback_require_manager(p_environment);
 if not public.portal_has_access('database') then raise exception 'Database access required' using errcode='42501'; end if;
 if not exists(select 1 from public.feedback_stop_datasets where id=p_dataset and environment_id=p_environment) then raise exception 'Dataset not found'; end if;
 perform public.audit_feedback_management('dataset_export','stop_dataset',p_dataset::text);
end;
$$;
revoke all on function public.record_feedback_dataset_export(uuid,uuid) from public,anon;
grant execute on function public.record_feedback_dataset_export(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
