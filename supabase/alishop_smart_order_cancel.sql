-- =========================================================
-- AliShop smart order cancellation (Direct Cancel & Refund)
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
  v_smm_order public.smm_orders%rowtype;
  v_wallet public.wallets%rowtype;
  v_tx uuid;
  v_is_smm boolean := false;
  v_total numeric(14,2);
  v_created_at timestamptz;
  v_status text;
  v_refund_tx uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'يجب تسجيل الدخول أولاً');
  end if;

  -- 1. Check regular orders
  select * into v_order
  from public.orders
  where id = p_order_id and user_id = auth.uid()
  for update;

  if found then
    v_total := v_order.total;
    v_created_at := v_order.created_at;
    v_status := v_order.status::text;
    v_refund_tx := v_order.refund_transaction_id;
  else
    -- 2. Check smm_orders if table exists
    begin
      select * into v_smm_order
      from public.smm_orders
      where id = p_order_id and user_id = auth.uid()
      for update;
      if found then
        v_is_smm := true;
        v_total := v_smm_order.total;
        v_created_at := v_smm_order.created_at;
        v_status := v_smm_order.status::text;
        v_refund_tx := v_smm_order.refund_transaction_id;
      end if;
    exception when others then
      v_is_smm := false;
    end;
  end if;

  if v_order.id is null and (not v_is_smm or v_smm_order.id is null) then
    return jsonb_build_object('success', false, 'error', 'الطلب غير موجود أو تم إلغاؤه مسبقاً');
  end if;

  if v_status not in ('pending', 'paid', 'processing') then
    return jsonb_build_object('success', false, 'error', 'لا يمكن إلغاء هذا الطلب في حالته الحالية (' || coalesce(v_status, '-') || ')');
  end if;

  if v_refund_tx is not null then
    return jsonb_build_object('success', false, 'error', 'تمت إعادة الرصيد لهذا الطلب مسبقاً');
  end if;

  -- Grace period check (allow up to 60 seconds for safety and UI latency)
  if now() > v_created_at + interval '60 seconds' then
    return jsonb_build_object('success', false, 'error', 'انتهت مهلة الإلغاء الفوري. يمكنك استخدام زر طلب الإلغاء');
  end if;

  -- Lock and update wallet
  select * into v_wallet
  from public.wallets
  where user_id = auth.uid()
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'محفظة المستخدم غير موجودة');
  end if;

  update public.wallets
  set balance = balance + v_total, updated_at = now()
  where user_id = auth.uid();

  -- Record refund transaction
  insert into public.wallet_transactions(
    user_id, order_id, type, amount, balance_before, balance_after, description, reference_code
  )
  values(
    auth.uid(),
    case when v_is_smm then null else p_order_id end,
    'refund',
    v_total,
    v_wallet.balance,
    v_wallet.balance + v_total,
    'إلغاء فوري للطلب واسترداد كامل الرصيد',
    'FASTREF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  )
  returning id into v_tx;

  -- Update order status
  if v_is_smm then
    update public.smm_orders
    set status = 'cancelled', refund_transaction_id = v_tx, updated_at = now()
    where id = p_order_id;
  else
    update public.orders
    set status = 'cancelled', refund_transaction_id = v_tx, updated_at = now()
    where id = p_order_id;
  end if;

  -- Notify user
  begin
    insert into public.notifications(user_id, title, body, type)
    values(
      auth.uid(),
      'تم إلغاء الطلب واسترداد الرصيد',
      'تم إلغاء طلبك واسترداد كامل المبلغ (' || v_total || '$) إلى محفظتك بنجاح.',
      'order'
    );
  exception when others then
    null;
  end;

  return jsonb_build_object(
    'success', true,
    'message', 'تم إلغاء الطلب واسترداد الرصيد إلى محفظتك بنجاح ✅',
    'new_balance', v_wallet.balance + v_total
  );
exception when others then
  return jsonb_build_object('success', false, 'error', SQLERRM);
end;
$$;

grant execute on function public.cancel_order_within_grace_period(uuid) to authenticated;

commit;
