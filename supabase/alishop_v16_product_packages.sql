-- =========================================================
-- AliShop V16 — Product Packages (باقات المنتجات)
-- باقات اختيارية داخل المنتج: اسم - عدد - سعر
-- شغّله مرة واحدة داخل Supabase SQL Editor
-- =========================================================

begin;

alter table public.products
  add column if not exists packages jsonb not null default '[]'::jsonb;

alter table public.orders
  add column if not exists package_id text;

-- نسخة شراء جديدة تدعم الباقات دون كسر أي منطق سابق (v5/v6 تبقى كما هي)
create or replace function public.purchase_product_v7(
  p_product_id uuid,
  p_idempotency_key uuid,
  p_coupon_code text default null,
  p_customer_data jsonb default '{}'::jsonb,
  p_package_id text default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_user uuid:=auth.uid();
  v_product public.products%rowtype;
  v_wallet public.wallets%rowtype;
  v_inventory public.digital_inventory%rowtype;
  v_coupon public.coupons%rowtype;
  v_package jsonb;
  v_price numeric(14,2);
  v_discount numeric(14,2):=0;
  v_total numeric(14,2);
  v_order_id uuid;
  v_order_number text;
  v_status public.order_status;
begin
  if v_user is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
  if exists(select 1 from public.orders where idempotency_key=p_idempotency_key) then
    return jsonb_build_object('success',true,'message','تم تنفيذ الطلب سابقاً');
  end if;

  select * into v_product from public.products where id=p_product_id and is_active=true for update;
  if not found then raise exception 'المنتج غير موجود أو غير مفعّل'; end if;

  -- تحديد السعر: من الباقة المختارة إن وُجدت
  if p_package_id is not null and p_package_id<>'' then
    select elem into v_package
    from jsonb_array_elements(coalesce(v_product.packages,'[]'::jsonb)) elem
    where elem->>'id'=p_package_id
    limit 1;
    if not found then raise exception 'الباقة المختارة غير موجودة'; end if;
    v_price:=coalesce((v_package->>'price')::numeric,0);
  else
    v_price:=v_product.price;
  end if;

  if v_product.delivery_type='automatic' then
    select * into v_inventory from public.digital_inventory
    where product_id=v_product.id and is_used=false
    order by created_at for update skip locked limit 1;
    if not found then raise exception 'نفد مخزون المنتج'; end if;
  elsif coalesce(v_product.manual_availability,'available')<>'available' then
    raise exception 'المنتج غير متوفر حالياً';
  end if;

  if p_coupon_code is not null and trim(p_coupon_code)<>'' then
    select * into v_coupon from public.coupons
    where upper(code)=upper(trim(p_coupon_code)) and is_active=true
      and starts_at<=now() and (ends_at is null or ends_at>=now())
    for update;
    if not found then raise exception 'الكوبون غير صالح أو منتهي'; end if;
    if v_price<v_coupon.minimum_order then raise exception 'قيمة الطلب أقل من الحد الأدنى للكوبون'; end if;
    if v_coupon.usage_limit is not null and v_coupon.used_count>=v_coupon.usage_limit then raise exception 'تم استنفاد الكوبون'; end if;
    v_discount:=case when v_coupon.discount_type='percent' then round(v_price*v_coupon.discount_value/100,2) else v_coupon.discount_value end;
    if v_coupon.maximum_discount is not null then v_discount:=least(v_discount,v_coupon.maximum_discount); end if;
    v_discount:=least(v_discount,v_price);
  end if;

  v_total:=greatest(v_price-v_discount,0);

  select * into v_wallet from public.wallets where user_id=v_user for update;
  if not found then insert into public.wallets(user_id,balance) values(v_user,0) returning * into v_wallet; end if;
  if v_wallet.balance<v_total then raise exception 'رصيد المحفظة غير كافٍ'; end if;

  v_order_number:='ORD-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  v_status:=case when v_product.delivery_type='automatic' then 'delivered'::public.order_status else 'processing'::public.order_status end;

  insert into public.orders(order_number,user_id,product_id,total,status,idempotency_key,delivery_data,delivered_at,package_id,customer_data)
  values(
    v_order_number,v_user,v_product.id,v_total,v_status,p_idempotency_key,
    case when v_product.delivery_type='automatic' then v_inventory.secret_value else null end,
    case when v_product.delivery_type='automatic' then now() else null end,
    p_package_id,
    coalesce(p_customer_data,'{}'::jsonb) || case when v_package is not null then jsonb_build_object('الباقة', v_package->>'name', 'عدد الباقة', v_package->>'quantity') else '{}'::jsonb end
  )
  returning id into v_order_id;

  update public.wallets set balance=balance-v_total,updated_at=now() where user_id=v_user;
  insert into public.wallet_transactions(user_id,order_id,type,amount,balance_before,balance_after,description,reference_code)
  values(v_user,v_order_id,'purchase',-v_total,v_wallet.balance,v_wallet.balance-v_total,
    'شراء '||v_product.name||case when v_package is not null then ' - '||coalesce(v_package->>'name','') else '' end,
    'BUY-'||replace(gen_random_uuid()::text,'-',''));

  if v_product.delivery_type='automatic' then
    update public.digital_inventory set is_used=true,order_id=v_order_id,used_at=now() where id=v_inventory.id;
  end if;
  if v_coupon.id is not null then
    update public.coupons set used_count=used_count+1 where id=v_coupon.id;
    insert into public.coupon_usages(coupon_id,user_id,order_id,discount_amount) values(v_coupon.id,v_user,v_order_id,v_discount);
  end if;

  insert into public.notifications(user_id,title,body,type) values(
    v_user,
    case when v_status='delivered' then 'تم شراء وتسليم المنتج' else 'تم إنشاء طلبك' end,
    case when v_status='delivered' then 'يمكنك مشاهدة بيانات المنتج في صفحة طلباتي' else 'طلبك قيد التنفيذ من الإدارة' end,
    'order');

  return jsonb_build_object('success',true,'order_id',v_order_id,'order_number',v_order_number,'total',v_total,'discount',v_discount,'package_id',p_package_id,'message','تم إنشاء الطلب بنجاح');
end$$;

grant execute on function public.purchase_product_v7(uuid,uuid,text,jsonb,text) to authenticated;

insert into public.alishop_schema_versions(version,notes)
values('v16_product_packages','باقات اختيارية للمنتجات: اسم - عدد - سعر مع شراء مدعوم بالخادم')
on conflict (version) do nothing;

commit;
