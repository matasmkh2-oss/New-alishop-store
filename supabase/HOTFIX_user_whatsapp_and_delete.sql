-- Require WhatsApp/phone on signup, save it to profiles, and add admin user deletion.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_full_name text := trim(coalesce(new.raw_user_meta_data->>'full_name',''));
  v_phone text := regexp_replace(coalesce(new.raw_user_meta_data->>'phone',''), '\\D', '', 'g');
begin
  if v_full_name = '' then
    raise exception 'الاسم الكامل مطلوب';
  end if;

  if length(v_phone) < 8 then
    raise exception 'رقم واتساب صالح مطلوب';
  end if;

  insert into public.profiles (id, full_name, phone)
  values (new.id, v_full_name, v_phone);

  insert into public.wallets (user_id)
  values (new.id);

  return new;
end;
$function$;

update public.profiles p
set phone = regexp_replace(coalesce(u.raw_user_meta_data->>'phone',''), '\\D', '', 'g'),
    updated_at = now()
from auth.users u
where u.id = p.id
  and coalesce(trim(p.phone),'') = ''
  and length(regexp_replace(coalesce(u.raw_user_meta_data->>'phone',''), '\\D', '', 'g')) >= 8;

create or replace function public.admin_delete_user(p_user_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_name text;
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'غير مصرح';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'لا يمكن حذف حسابك الحالي';
  end if;

  if public.is_primary_admin_target(p_user_id) then
    raise exception 'لا يمكن حذف المدير الأساسي';
  end if;

  select p.full_name, coalesce(u.email,'')
    into v_name, v_email
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.id = p_user_id
  for update;

  if not found then
    raise exception 'المستخدم غير موجود';
  end if;

  update public.announcements set created_by = null where created_by = p_user_id;
  update public.coupons set created_by = null where created_by = p_user_id;
  update public.recharge_cards set created_by = null where created_by = p_user_id;
  update public.recharge_cards set used_by = null where used_by = p_user_id;
  update public.deposit_requests set reviewed_by = null where reviewed_by = p_user_id;
  update public.order_cancel_requests set reviewed_by = null where reviewed_by = p_user_id;
  update public.support_threads set blocked_by = null where blocked_by = p_user_id;

  delete from public.admin_activity_logs where admin_id = p_user_id;
  delete from public.coupon_usages where user_id = p_user_id;
  delete from public.deposit_requests where user_id = p_user_id;
  delete from public.favorites where user_id = p_user_id;
  delete from public.notifications where user_id = p_user_id;
  delete from public.order_cancel_requests where user_id = p_user_id;
  delete from public.support_messages where sender_id = p_user_id;
  delete from public.support_threads where user_id = p_user_id;

  update public.orders set refund_transaction_id = null where user_id = p_user_id;
  update public.smm_orders set refund_transaction_id = null where user_id = p_user_id;

  delete from public.wallet_transactions where user_id = p_user_id;
  delete from public.orders where user_id = p_user_id;
  delete from public.smm_orders where user_id = p_user_id;

  delete from auth.users where id = p_user_id;

  insert into public.admin_activity_logs(admin_id, action, target_type, target_id, details)
  values (
    auth.uid(),
    'delete_user',
    'profile',
    p_user_id,
    jsonb_build_object('full_name', v_name, 'email', v_email, 'reason', p_reason)
  );

  return jsonb_build_object('success', true, 'deleted_user_id', p_user_id);
end
$function$;

grant execute on function public.admin_delete_user(uuid, text) to authenticated;
