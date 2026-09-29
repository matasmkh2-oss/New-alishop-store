-- =========================================================
-- AliShop hotfix: deposits visibility + safe order reactivation
-- Run once after AliShop Ultimate
-- =========================================================

begin;

-- Ensure deposit requests have the columns used by the UI.
alter table public.deposit_requests
  add column if not exists admin_note text,
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists reviewed_at timestamptz;

-- Safe processing for deposit requests.
create or replace function public.admin_process_deposit_v13(
  p_deposit_id uuid,
  p_approve boolean,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_deposit public.deposit_requests%rowtype;
  v_wallet public.wallets%rowtype;
begin
  if not public.is_admin() then raise exception 'غير مصرح'; end if;

  select * into v_deposit
  from public.deposit_requests
  where id=p_deposit_id
  for update;

  if not found then raise exception 'طلب الشحن غير موجود'; end if;
  if v_deposit.status<>'pending' then raise exception 'تمت معالجة الطلب مسبقاً'; end if;

  if p_approve then
    select * into v_wallet
    from public.wallets
    where user_id=v_deposit.user_id
    for update;

    if not found then
      insert into public.wallets(user_id,balance)
      values(v_deposit.user_id,0)
      returning * into v_wallet;
    end if;

    update public.wallets
    set balance=balance+v_deposit.amount,updated_at=now()
    where user_id=v_deposit.user_id;

    insert into public.wallet_transactions(
      user_id,type,amount,balance_before,balance_after,description,reference_code
    )
    values(
      v_deposit.user_id,'deposit',v_deposit.amount,
      v_wallet.balance,v_wallet.balance+v_deposit.amount,
      'شحن رصيد معتمد',
      coalesce(v_deposit.reference_code,'DEP-'||replace(gen_random_uuid()::text,'-',''))
    );

    update public.deposit_requests
    set status='approved',admin_note=p_note,reviewed_by=auth.uid(),reviewed_at=now()
    where id=v_deposit.id;

    insert into public.notifications(user_id,title,body,type)
    values(v_deposit.user_id,'تم قبول طلب الشحن','تمت إضافة الرصيد إلى محفظتك','deposit');

    return jsonb_build_object('success',true,'message','تم قبول طلب الشحن وإضافة الرصيد');
  else
    update public.deposit_requests
    set status='rejected',admin_note=coalesce(p_note,'تم رفض الطلب'),reviewed_by=auth.uid(),reviewed_at=now()
    where id=v_deposit.id;

    insert into public.notifications(user_id,title,body,type)
    values(v_deposit.user_id,'تم رفض طلب الشحن',coalesce(p_note,'تم رفض الطلب'),'deposit');

    return jsonb_build_object('success',true,'message','تم رفض طلب الشحن');
  end if;
end
$$;

-- Safe order status transitions.
create or replace function public.admin_process_order_v13(
  p_order_id uuid,
  p_status public.order_status,
  p_delivery_data text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_wallet public.wallets%rowtype;
  v_tx uuid;
begin
  if not public.is_admin() then raise exception 'غير مصرح'; end if;

  select * into v_order
  from public.orders
  where id=p_order_id
  for update;

  if not found then raise exception 'الطلب غير موجود'; end if;

  -- Cancel/refund: refund once only.
  if p_status in('cancelled','refunded') then
    if v_order.refund_transaction_id is null then
      select * into v_wallet from public.wallets where user_id=v_order.user_id for update;
      if not found then raise exception 'محفظة المستخدم غير موجودة'; end if;

      update public.wallets
      set balance=balance+v_order.total,updated_at=now()
      where user_id=v_order.user_id;

      insert into public.wallet_transactions(
        user_id,order_id,type,amount,balance_before,balance_after,description,reference_code
      )
      values(
        v_order.user_id,v_order.id,'refund',v_order.total,
        v_wallet.balance,v_wallet.balance+v_order.total,
        coalesce(p_reason,'استرداد قيمة الطلب'),
        'REF-'||replace(gen_random_uuid()::text,'-','')
      )
      returning id into v_tx;

      update public.orders set refund_transaction_id=v_tx where id=v_order.id;
    end if;

  -- Reactivating a refunded/cancelled order: charge again before allowing completion.
  elsif v_order.refund_transaction_id is not null
    and v_order.status in('cancelled','refunded')
    and p_status in('paid','processing','delivered') then

    select * into v_wallet from public.wallets where user_id=v_order.user_id for update;
    if not found then raise exception 'محفظة المستخدم غير موجودة'; end if;
    if v_wallet.balance<v_order.total then
      raise exception 'رصيد المستخدم غير كافٍ لإعادة تفعيل الطلب';
    end if;

    update public.wallets
    set balance=balance-v_order.total,updated_at=now()
    where user_id=v_order.user_id;

    insert into public.wallet_transactions(
      user_id,order_id,type,amount,balance_before,balance_after,description,reference_code
    )
    values(
      v_order.user_id,v_order.id,'purchase',-v_order.total,
      v_wallet.balance,v_wallet.balance-v_order.total,
      'إعادة تفعيل طلب بعد الاسترداد',
      'REPAY-'||replace(gen_random_uuid()::text,'-','')
    );

    update public.orders
    set refund_transaction_id=null
    where id=v_order.id;
  end if;

  update public.orders
  set
    status=p_status,
    delivery_data=coalesce(p_delivery_data,delivery_data),
    delivered_at=case when p_status='delivered' then now() else delivered_at end
  where id=v_order.id;

  insert into public.notifications(user_id,title,body,type)
  values(
    v_order.user_id,
    case
      when p_status='delivered' then 'تم تسليم طلبك'
      when p_status in('cancelled','refunded') then 'تمت إعادة الرصيد'
      else 'تم تحديث الطلب'
    end,
    coalesce(p_reason,'تم تحديث حالة طلبك'),
    'order'
  );

  return jsonb_build_object('success',true);
end
$$;

grant execute on function public.admin_process_deposit_v13(uuid,boolean,text) to authenticated;
grant execute on function public.admin_process_order_v13(uuid,public.order_status,text,text) to authenticated;

commit;
