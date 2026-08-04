-- AliShop V4 maintenance completion
-- Run once after V3 and V4 SQL files.

-- Admin policies for complete CRUD
do $$
declare t text;
begin
  foreach t in array array['products','categories','digital_inventory','payment_methods','store_settings','store_slides','announcements','recharge_cards','coupons','notifications']
  loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists %I on public.%I','admin_full_'||t,t);
    execute format('create policy %I on public.%I for all to authenticated using(public.is_admin()) with check(public.is_admin())','admin_full_'||t,t);
  end loop;
end$$;

-- Allow global notifications to be read by users.
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications
for select to authenticated
using(user_id=auth.uid() or user_id is null or public.is_admin());

-- Safe cancel request review.
create or replace function public.admin_review_cancel_request(
  p_request_id uuid,
  p_approve boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare r public.order_cancel_requests%rowtype;
begin
  if not public.is_admin() then raise exception 'غير مصرح'; end if;
  select * into r from public.order_cancel_requests where id=p_request_id for update;
  if not found then raise exception 'الطلب غير موجود'; end if;
  if r.status<>'pending' then raise exception 'تمت معالجة الطلب سابقاً'; end if;

  if p_approve then
    perform public.admin_process_order(r.order_id,'cancelled',null,coalesce(p_reason,'قبول طلب الإلغاء'));
    update public.order_cancel_requests set status='approved',reviewed_by=auth.uid(),reviewed_at=now() where id=r.id;
  else
    update public.order_cancel_requests set status='rejected',reviewed_by=auth.uid(),reviewed_at=now() where id=r.id;
    insert into public.notifications(user_id,title,body,type)
    values(r.user_id,'تم رفض طلب الإلغاء',coalesce(p_reason,'تم رفض طلب الإلغاء'),'order');
  end if;
  return jsonb_build_object('success',true);
end$$;

-- Purchase with coupon support and automatic stock locking.
create or replace function public.purchase_product_v4(
  p_product_id uuid,
  p_idempotency_key uuid,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  p public.products%rowtype;
  w public.wallets%rowtype;
  inv public.digital_inventory%rowtype;
  c public.coupons%rowtype;
  v_discount numeric:=0;
  v_total numeric;
  v_order uuid;
  v_number text;
begin
  if v_user is null then raise exception 'يجب تسجيل الدخول'; end if;
  if exists(select 1 from public.orders where idempotency_key=p_idempotency_key) then
    return jsonb_build_object('success',true,'message','تم تنفيذ الطلب سابقاً');
  end if;

  select * into p from public.products where id=p_product_id and is_active=true for update;
  if not found then raise exception 'المنتج غير متوفر'; end if;

  if p.delivery_type='automatic' then
    select * into inv from public.digital_inventory where product_id=p.id and is_used=false order by created_at for update skip locked limit 1;
    if not found then raise exception 'نفد مخزون المنتج'; end if;
  elsif p.manual_availability<>'available' then
    raise exception 'المنتج غير متوفر حالياً';
  end if;

  if p_coupon_code is not null and trim(p_coupon_code)<>'' then
    select * into c from public.coupons
    where upper(code)=upper(trim(p_coupon_code)) and is_active=true and starts_at<=now() and (ends_at is null or ends_at>=now())
    for update;
    if not found then raise exception 'الكوبون غير صالح'; end if;
    if p.price<c.minimum_order then raise exception 'قيمة المنتج أقل من الحد الأدنى للكوبون'; end if;
    if c.usage_limit is not null and c.used_count>=c.usage_limit then raise exception 'تم استنفاد الكوبون'; end if;
    v_discount:=case when c.discount_type='percent' then p.price*c.discount_value/100 else c.discount_value end;
    if c.maximum_discount is not null then v_discount:=least(v_discount,c.maximum_discount); end if;
    v_discount:=least(v_discount,p.price);
  end if;

  v_total:=p.price-v_discount;
  select * into w from public.wallets where user_id=v_user for update;
  if w.balance<v_total then raise exception 'الرصيد غير كاف'; end if;

  v_number:='ORD-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.orders(order_number,user_id,product_id,total,status,idempotency_key)
  values(v_number,v_user,p.id,v_total,case when p.delivery_type='automatic' then 'delivered' else 'processing' end,p_idempotency_key)
  returning id into v_order;

  update public.wallets set balance=balance-v_total,updated_at=now() where user_id=v_user;
  insert into public.wallet_transactions(user_id,order_id,type,amount,balance_before,balance_after,description,reference_code)
  values(v_user,v_order,'purchase',-v_total,w.balance,w.balance-v_total,'شراء '||p.name,'TX-'||replace(gen_random_uuid()::text,'-',''));

  if p.delivery_type='automatic' then
    update public.digital_inventory set is_used=true,order_id=v_order,used_at=now() where id=inv.id;
    update public.orders set delivery_data=inv.secret_value,delivered_at=now() where id=v_order;
  end if;

  if c.id is not null then
    update public.coupons set used_count=used_count+1 where id=c.id;
    insert into public.coupon_usages(coupon_id,user_id,order_id,discount_amount) values(c.id,v_user,v_order,v_discount);
  end if;

  update public.products set sales_count=sales_count+1 where id=p.id;
  insert into public.notifications(user_id,title,body,type) values(v_user,'تم إنشاء الطلب','تم إنشاء طلبك بنجاح','order');
  return jsonb_build_object('success',true,'order_id',v_order,'message','تم الشراء بنجاح','discount',v_discount);
end$$;

grant execute on function public.admin_review_cancel_request(uuid,boolean,text) to authenticated;
grant execute on function public.purchase_product_v4(uuid,uuid,text) to authenticated;

-- Helpful update policies for users reading own data already remain unchanged.
