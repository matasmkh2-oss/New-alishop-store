-- AliShop V18 — كوبونات مخصصة + بطاقات مخصصة + خصم مستخدم على المتجر
begin;

alter table public.profiles add column if not exists discount_percent numeric(5,2) not null default 0;
alter table public.coupons add column if not exists user_id uuid references public.profiles(id) on delete cascade;
alter table public.coupons add column if not exists catalog_section text;
alter table public.recharge_cards add column if not exists assigned_to uuid references public.profiles(id) on delete set null;

-- معاينة الكوبون: خصم المستخدم + قيود القسم/المستخدم
create or replace function public.preview_coupon_discount(p_code text, p_product_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_coupon public.coupons%rowtype;
  v_product public.products%rowtype;
  v_user_pct numeric(5,2):=0;
  v_discount numeric(14,2):=0;
  v_total numeric(14,2);
begin
  if p_code is null or trim(p_code)='' then
    return jsonb_build_object('valid',false,'message','أدخل رمز الكوبون');
  end if;
  select * into v_product from public.products where id=p_product_id and is_active=true;
  if not found then return jsonb_build_object('valid',false,'message','المنتج غير متوفر'); end if;
  select * into v_coupon from public.coupons
  where upper(code)=upper(trim(p_code)) and is_active=true and starts_at<=now() and (ends_at is null or ends_at>=now());
  if not found then return jsonb_build_object('valid',false,'message','الكوبون غير صالح أو غير نشط'); end if;
  if v_coupon.user_id is not null and v_coupon.user_id<>auth.uid() then
    return jsonb_build_object('valid',false,'message','هذا الكوبون مخصص لمستخدم آخر');
  end if;
  if v_coupon.catalog_section is not null and coalesce(v_product.catalog_section,'digital')<>v_coupon.catalog_section then
    return jsonb_build_object('valid',false,'message','هذا الكوبون لا يعمل على هذا القسم');
  end if;
  if v_coupon.usage_limit is not null and v_coupon.used_count>=v_coupon.usage_limit then
    return jsonb_build_object('valid',false,'message','تم استنفاد عدد استخدامات الكوبون');
  end if;
  if v_product.price<v_coupon.minimum_order then
    return jsonb_build_object('valid',false,'message','السعر أقل من الحد الأدنى للكوبون');
  end if;
  v_discount:=case when v_coupon.discount_type='percent' then round(v_product.price*v_coupon.discount_value/100,2) else v_coupon.discount_value end;
  if v_coupon.maximum_discount is not null then v_discount:=least(v_discount,v_coupon.maximum_discount); end if;
  v_discount:=least(v_discount,v_product.price);
  if auth.uid() is not null then
    select coalesce(discount_percent,0) into v_user_pct from public.profiles where id=auth.uid();
  end if;
  if v_user_pct>0 then v_discount:=v_discount+round((v_product.price-v_discount)*v_user_pct/100,2); end if;
  v_discount:=least(v_discount,v_product.price);
  v_total:=greatest(v_product.price-v_discount,0);
  return jsonb_build_object('valid',true,'discount',v_discount,'final_total',v_total,'message','الكوبون نشط');
end$$;
grant execute on function public.preview_coupon_discount(text,uuid) to authenticated,anon;

-- الشراء v8: خصم مستخدم + قيود الكوبون + سعر الباقة
create or replace function public.purchase_product_v8(
  p_product_id uuid, p_idempotency_key uuid, p_coupon_code text default null,
  p_customer_data jsonb default '{}'::jsonb, p_package_id text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_user uuid:=auth.uid();
  v_product public.products%rowtype;
  v_wallet public.wallets%rowtype;
  v_inventory public.digital_inventory%rowtype;
  v_coupon public.coupons%rowtype;
  v_package jsonb;
  v_price numeric(14,2);
  v_discount numeric(14,2):=0;
  v_user_pct numeric(5,2):=0;
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
  if p_package_id is not null and p_package_id<>'' then
    select elem into v_package from jsonb_array_elements(coalesce(v_product.packages,'[]'::jsonb)) elem
    where elem->>'id'=p_package_id limit 1;
    if not found then raise exception 'الباقة المختارة غير موجودة'; end if;
    v_price:=coalesce((v_package->>'price')::numeric,0);
  else
    v_price:=v_product.price;
  end if;
  if v_product.delivery_type='automatic' then
    select * into v_inventory from public.digital_inventory
    where product_id=v_product.id and is_used=false order by created_at for update skip locked limit 1;
    if not found then raise exception 'نفد مخزون المنتج'; end if;
  elsif coalesce(v_product.manual_availability,'available')<>'available' then
    raise exception 'المنتج غير متوفر حالياً';
  end if;
  if p_coupon_code is not null and trim(p_coupon_code)<>'' then
    select * into v_coupon from public.coupons
    where upper(code)=upper(trim(p_coupon_code)) and is_active=true and starts_at<=now() and (ends_at is null or ends_at>=now())
    for update;
    if not found then raise exception 'الكوبون غير صالح أو منتهي'; end if;
    if v_coupon.user_id is not null and v_coupon.user_id<>v_user then raise exception 'هذا الكوبون مخصص لمستخدم آخر'; end if;
    if v_coupon.catalog_section is not null and coalesce(v_product.catalog_section,'digital')<>v_coupon.catalog_section then
      raise exception 'هذا الكوبون لا يعمل على هذا القسم'; end if;
    if v_price<v_coupon.minimum_order then raise exception 'قيمة الطلب أقل من الحد الأدنى للكوبون'; end if;
    if v_coupon.usage_limit is not null and v_coupon.used_count>=v_coupon.usage_limit then raise exception 'تم استنفاد الكوبون'; end if;
    v_discount:=case when v_coupon.discount_type='percent' then round(v_price*v_coupon.discount_value/100,2) else v_coupon.discount_value end;
    if v_coupon.maximum_discount is not null then v_discount:=least(v_discount,v_coupon.maximum_discount); end if;
    v_discount:=least(v_discount,v_price);
  end if;
  select coalesce(discount_percent,0) into v_user_pct from public.profiles where id=v_user;
  if v_user_pct>0 then v_discount:=least(v_discount+round((v_price-v_discount)*v_user_pct/100,2),v_price); end if;
  v_total:=greatest(v_price-v_discount,0);
  select * into v_wallet from public.wallets where user_id=v_user for update;
  if not found then insert into public.wallets(user_id,balance) values(v_user,0) returning * into v_wallet; end if;
  if v_wallet.balance<v_total then raise exception 'رصيد المحفظة غير كافٍ'; end if;
  v_order_number:='ORD-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  v_status:=case when v_product.delivery_type='automatic' then 'delivered'::public.order_status else 'processing'::public.order_status end;
  insert into public.orders(order_number,user_id,product_id,total,status,idempotency_key,delivery_data,delivered_at,package_id,customer_data)
  values(v_order_number,v_user,v_product.id,v_total,v_status,p_idempotency_key,
    case when v_product.delivery_type='automatic' then v_inventory.secret_value else null end,
    case when v_product.delivery_type='automatic' then now() else null end,
    p_package_id,
    coalesce(p_customer_data,'{}'::jsonb) || case when v_package is not null then jsonb_build_object('الباقة', v_package->>'name', 'عدد الباقة', v_package->>'quantity') else '{}'::jsonb end)
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
  insert into public.notifications(user_id,title,body,type) values(v_user,
    case when v_status='delivered' then 'تم شراء وتسليم المنتج' else 'تم إنشاء طلبك' end,
    case when v_status='delivered' then 'يمكنك مشاهدة بيانات المنتج في صفحة طلباتي' else 'طلبك قيد التنفيذ من الإدارة' end,'order');
  return jsonb_build_object('success',true,'order_id',v_order_id,'order_number',v_order_number,'total',v_total,'discount',v_discount,'message','تم إنشاء الطلب بنجاح');
end$$;
grant execute on function public.purchase_product_v8(uuid,uuid,text,jsonb,text) to authenticated;

-- بطاقة الشحن: مخصصة لمستخدم
create or replace function public.redeem_recharge_card(p_code text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.recharge_cards%rowtype;w public.wallets%rowtype;
begin
 if auth.uid() is null then raise exception 'سجل الدخول'; end if;
 if p_code is null or trim(p_code)='' then raise exception 'أدخل رمز البطاقة'; end if;
 select * into c from public.recharge_cards where upper(code)=upper(trim(p_code)) for update;
 if not found then raise exception 'البطاقة غير موجودة'; end if;
 if c.is_used then raise exception 'تم استخدام البطاقة مسبقاً'; end if;
 if c.assigned_to is not null and c.assigned_to<>auth.uid() then raise exception 'هذه البطاقة مخصصة لمستخدم آخر'; end if;
 if c.expires_at is not null and c.expires_at<now() then raise exception 'انتهت صلاحية البطاقة'; end if;
 select * into w from public.wallets where user_id=auth.uid() for update;
 if not found then insert into public.wallets(user_id,balance) values(auth.uid(),0) returning * into w; end if;
 update public.wallets set balance=balance+c.amount,updated_at=now() where user_id=auth.uid();
 update public.recharge_cards set is_used=true,used_by=auth.uid(),used_at=now() where id=c.id;
 insert into public.wallet_transactions(user_id,type,amount,balance_before,balance_after,description,reference_code)
 values(auth.uid(),'recharge_card',c.amount,w.balance,w.balance+c.amount,'شحن بواسطة بطاقة متجر','CARD-'||replace(gen_random_uuid()::text,'-',''));
 insert into public.notifications(user_id,title,body,type)
 values(auth.uid(),'تم شحن المحفظة','تمت إضافة رصيد بطاقة الشحن إلى محفظتك','wallet');
 return jsonb_build_object('success',true,'message','تم شحن الرصيد بنجاح','amount',c.amount);
end$$;
grant execute on function public.redeem_recharge_card(text) to authenticated;

insert into public.alishop_schema_versions(version,notes)
values('v18_coupons_cards_discounts','كوبونات مخصصة بقسم/مستخدم + بطاقات شحن مخصصة + خصم مستخدم على المتجر')
on conflict (version) do nothing;
commit;
