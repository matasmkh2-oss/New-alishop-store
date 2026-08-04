-- =========================================================
-- AliShop smart order cancellation
-- Run once after the previous updates
-- =========================================================

begin;

create or replace function public.cancel_order_within_grace_period(
  p_order_id uuid
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
  if auth.uid() is null then raise exception 'سجل الدخول'; end if;

  select * into v_order
  from public.orders
  where id=p_order_id and user_id=auth.uid()
  for update;

  if not found then raise exception 'الطلب غير موجود'; end if;

  if v_order.status not in('pending','paid','processing') then
    raise exception 'لا يمكن إلغاء هذا الطلب';
  end if;

  if now()>v_order.created_at+interval '10 seconds' then
    raise exception 'انتهت مهلة الإلغاء الفوري، استخدم طلب الإلغاء';
  end if;

  if v_order.refund_transaction_id is not null then
    raise exception 'تمت إعادة الرصيد مسبقاً';
  end if;

  select * into v_wallet
  from public.wallets
  where user_id=v_order.user_id
  for update;

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
    'إلغاء فوري خلال مهلة 10 ثوانٍ',
    'FASTREF-'||replace(gen_random_uuid()::text,'-','')
  )
  returning id into v_tx;

  update public.orders
  set status='cancelled',refund_transaction_id=v_tx
  where id=v_order.id;

  insert into public.notifications(user_id,title,body,type)
  values(
    v_order.user_id,
    'تم إلغاء الطلب',
    'تم إلغاء الطلب وإعادة الرصيد إلى المحفظة.',
    'order'
  );

  return jsonb_build_object(
    'success',true,
    'message','تم إلغاء الطلب وإعادة الرصيد'
  );
end
$$;

grant execute on function public.cancel_order_within_grace_period(uuid) to authenticated;

commit;
