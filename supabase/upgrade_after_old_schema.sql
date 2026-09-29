-- تشغيل هذا الملف مرة واحدة بعد schema.sql السابق لتوحيد الدوال والسياسات.
create extension if not exists pgcrypto;

alter table if exists public.products
  add column if not exists is_featured boolean not null default false;

alter table if exists public.payment_methods
  add column if not exists sort_order integer not null default 0;

alter table if exists public.deposit_requests
  add column if not exists credited_transaction_id uuid unique references public.wallet_transactions(id);

create table if not exists public.notifications(
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null default 'general',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_activity_logs(
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id),
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid() and role='admin' and status='active'
  )
$$;

create or replace function public.purchase_product(
  p_product_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_product public.products%rowtype;
  v_wallet public.wallets%rowtype;
  v_order uuid;
  v_number text;
  v_stock public.digital_inventory%rowtype;
begin
  if v_user is null then raise exception 'يجب تسجيل الدخول'; end if;
  if exists(select 1 from public.profiles where id=v_user and status='blocked') then
    raise exception 'الحساب محظور';
  end if;
  if exists(select 1 from public.orders where idempotency_key=p_idempotency_key) then
    return jsonb_build_object('message','تم تنفيذ الطلب مسبقاً');
  end if;

  select * into v_product
  from public.products
  where id=p_product_id and is_active=true
  for update;

  if not found then raise exception 'المنتج غير متوفر'; end if;

  select * into v_wallet
  from public.wallets
  where user_id=v_user
  for update;

  if v_wallet.balance<v_product.price then
    raise exception 'رصيد المحفظة غير كاف';
  end if;

  if v_product.delivery_type='automatic'
     and not exists(select 1 from public.digital_inventory where product_id=v_product.id and is_used=false)
  then raise exception 'نفد مخزون المنتج';
  end if;

  v_number:='ORD-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));

  insert into public.orders(order_number,user_id,product_id,total,status,idempotency_key)
  values(v_number,v_user,v_product.id,v_product.price,'paid',p_idempotency_key)
  returning id into v_order;

  update public.wallets
  set balance=balance-v_product.price,updated_at=now()
  where user_id=v_user;

  insert into public.wallet_transactions(
    user_id,order_id,type,amount,balance_before,balance_after,description,reference_code
  ) values(
    v_user,v_order,'purchase',-v_product.price,v_wallet.balance,
    v_wallet.balance-v_product.price,'شراء '||v_product.name,
    'TX-'||replace(gen_random_uuid()::text,'-','')
  );

  if v_product.delivery_type='automatic' then
    select * into v_stock
    from public.digital_inventory
    where product_id=v_product.id and is_used=false
    order by created_at
    for update skip locked
    limit 1;

    update public.digital_inventory
    set is_used=true,order_id=v_order,used_at=now()
    where id=v_stock.id;

    update public.orders
    set status='delivered',delivery_data=v_stock.secret_value,delivered_at=now()
    where id=v_order;
  else
    update public.orders set status='processing' where id=v_order;
  end if;

  update public.products set sales_count=sales_count+1 where id=v_product.id;

  return jsonb_build_object(
    'success',true,
    'order_id',v_order,
    'order_number',v_number,
    'message','تمت عملية الشراء بنجاح'
  );
end
$$;

create or replace function public.approve_deposit(p_deposit_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  d public.deposit_requests%rowtype;
  w public.wallets%rowtype;
  tx uuid;
begin
  if not public.is_admin() then raise exception 'غير مصرح'; end if;

  select * into d
  from public.deposit_requests
  where id=p_deposit_id
  for update;

  if not found then raise exception 'الطلب غير موجود'; end if;
  if d.status<>'pending' then raise exception 'تمت معالجة الطلب مسبقاً'; end if;

  select * into w from public.wallets where user_id=d.user_id for update;

  update public.wallets
  set balance=balance+d.amount,updated_at=now()
  where user_id=d.user_id;

  insert into public.wallet_transactions(
    user_id,type,amount,balance_before,balance_after,description,reference_code
  ) values(
    d.user_id,'deposit',d.amount,w.balance,w.balance+d.amount,
    'شحن رصيد مقبول','DEP-'||replace(gen_random_uuid()::text,'-','')
  ) returning id into tx;

  update public.deposit_requests
  set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),credited_transaction_id=tx
  where id=d.id;

  insert into public.notifications(user_id,title,body,type)
  values(d.user_id,'تم قبول طلب الشحن','تمت إضافة الرصيد إلى محفظتك','deposit');

  insert into public.admin_activity_logs(admin_id,action,target_type,target_id,details)
  values(auth.uid(),'approve_deposit','deposit_request',d.id,jsonb_build_object('amount',d.amount));

  return jsonb_build_object('success',true);
end
$$;

create or replace function public.reject_deposit(p_deposit_id uuid,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare d public.deposit_requests%rowtype;
begin
  if not public.is_admin() then raise exception 'غير مصرح'; end if;
  if coalesce(trim(p_reason),'')='' then raise exception 'سبب الرفض مطلوب'; end if;

  select * into d
  from public.deposit_requests
  where id=p_deposit_id
  for update;

  if not found or d.status<>'pending' then
    raise exception 'الطلب غير صالح للرفض';
  end if;

  update public.deposit_requests
  set status='rejected',rejection_reason=p_reason,reviewed_by=auth.uid(),reviewed_at=now()
  where id=d.id;

  insert into public.notifications(user_id,title,body,type)
  values(d.user_id,'تم رفض طلب الشحن',p_reason,'deposit');

  return jsonb_build_object('success',true);
end
$$;

create or replace function public.admin_adjust_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare w public.wallets%rowtype;
begin
  if not public.is_admin() then raise exception 'غير مصرح'; end if;
  if p_amount=0 or coalesce(trim(p_reason),'')='' then
    raise exception 'المبلغ والسبب مطلوبان';
  end if;

  select * into w
  from public.wallets
  where user_id=p_user_id
  for update;

  if w.balance+p_amount<0 then raise exception 'لا يمكن جعل الرصيد سالباً'; end if;

  update public.wallets
  set balance=balance+p_amount,updated_at=now()
  where user_id=p_user_id;

  insert into public.wallet_transactions(
    user_id,type,amount,balance_before,balance_after,description,reference_code
  ) values(
    p_user_id,'admin_adjustment',p_amount,w.balance,w.balance+p_amount,
    p_reason,'ADM-'||replace(gen_random_uuid()::text,'-','')
  );

  insert into public.admin_activity_logs(admin_id,action,target_type,target_id,details)
  values(auth.uid(),'adjust_wallet','profile',p_user_id,jsonb_build_object('amount',p_amount,'reason',p_reason));

  return jsonb_build_object('success',true);
end
$$;

alter table public.notifications enable row level security;
alter table public.admin_activity_logs enable row level security;

drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications
for select using(user_id=auth.uid() or user_id is null or public.is_admin());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
for update using(user_id=auth.uid()) with check(user_id=auth.uid());

drop policy if exists logs_admin on public.admin_activity_logs;
create policy logs_admin on public.admin_activity_logs
for select using(public.is_admin());

revoke all on function public.purchase_product(uuid,uuid) from public;
grant execute on function public.purchase_product(uuid,uuid) to authenticated;

revoke all on function public.approve_deposit(uuid) from public;
grant execute on function public.approve_deposit(uuid) to authenticated;

revoke all on function public.reject_deposit(uuid,text) from public;
grant execute on function public.reject_deposit(uuid,text) to authenticated;

revoke all on function public.admin_adjust_wallet(uuid,numeric,text) from public;
grant execute on function public.admin_adjust_wallet(uuid,numeric,text) to authenticated;
