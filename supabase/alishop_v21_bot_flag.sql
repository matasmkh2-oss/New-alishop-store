-- AliShop V21 — تمييز رسائل المساعد الذكي
begin;
alter table public.support_messages add column if not exists is_bot boolean not null default false;
create or replace function public.bot_support_reply(p_thread_id uuid,p_body text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_thread public.support_threads%rowtype;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول'; end if;
  select * into v_thread from public.support_threads where id=p_thread_id;
  if not found or v_thread.user_id<>auth.uid() then raise exception 'المحادثة غير موجودة'; end if;
  insert into public.support_messages(thread_id,sender_id,body,is_bot)
  values(p_thread_id,auth.uid(),p_body,true);
  update public.support_threads set updated_at=now(),admin_unread_count=admin_unread_count+1 where id=p_thread_id;
  return jsonb_build_object('success',true);
end$$;
grant execute on function public.bot_support_reply(uuid,text) to authenticated;
insert into public.alishop_schema_versions(version,notes)
values('v21_bot_flag','عمود is_bot لتمييز رسائل المساعد الذكي للمدير والمستخدم')
on conflict (version) do nothing;
commit;
