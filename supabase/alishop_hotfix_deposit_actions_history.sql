-- =========================================================
-- AliShop: deposit actions, proof and user history fix
-- Run once after the previous deposit/order hotfix
-- =========================================================

begin;

alter table public.deposit_requests enable row level security;

drop policy if exists deposit_requests_own_read on public.deposit_requests;
create policy deposit_requests_own_read
on public.deposit_requests
for select to authenticated
using(user_id=auth.uid() or public.is_admin());

drop policy if exists deposit_requests_own_insert on public.deposit_requests;
create policy deposit_requests_own_insert
on public.deposit_requests
for insert to authenticated
with check(user_id=auth.uid());

drop policy if exists deposit_requests_admin_update on public.deposit_requests;
create policy deposit_requests_admin_update
on public.deposit_requests
for update to authenticated
using(public.is_admin())
with check(public.is_admin());

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
      coalesce(v_deposit.transfer_reference,v_deposit.reference_code,'DEP-'||replace(gen_random_uuid()::text,'-',''))
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

grant execute on function public.admin_process_deposit_v13(uuid,boolean,text) to authenticated;

commit;
