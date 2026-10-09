-- AliShop V20 — دالة رد المساعد الذكي (بوت الدعم)
begin;
create or replace function public.bot_support_reply(p_thread_id uuid,p_body text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_thread public.support_threads%rowtype;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول'; end if;
  select * into v_thread from public.support_threads where id=p_thread_id;
  if not found or v_thread.user_id<>auth.uid() then raise exception 'المحادثة غير موجودة'; end if;
  insert into public.support_messages(thread_id,sender_id,body)
  values(p_thread_id,auth.uid(),p_body);
  update public.support_threads set updated_at=now(),admin_unread_count=admin_unread_count+1 where id=p_thread_id;
  return jsonb_build_object('success',true);
end$$;
grant execute on function public.bot_support_reply(uuid,text) to authenticated;
insert into public.alishop_schema_versions(version,notes)
values('v20_bot_reply','دالة رد المساعد الذكي داخل محادثات الدعم')
on conflict (version) do nothing;
commit;
