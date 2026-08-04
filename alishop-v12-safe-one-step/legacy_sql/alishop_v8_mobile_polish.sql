-- =========================================================
-- AliShop V8 — Coupon preview helper
-- Run once after V7
-- =========================================================
create or replace function public.preview_coupon_discount(
  p_code text,
  p_product_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_coupon public.coupons%rowtype;
  v_product public.products%rowtype;
  v_discount numeric(14,2):=0;
  v_total numeric(14,2);
begin
  if p_code is null or trim(p_code)='' then
    return jsonb_build_object('valid',false,'message','أدخل رمز الكوبون');
  end if;

  select * into v_product from public.products where id=p_product_id and is_active=true;
  if not found then
    return jsonb_build_object('valid',false,'message','المنتج غير متوفر');
  end if;

  select * into v_coupon
  from public.coupons
  where upper(code)=upper(trim(p_code))
    and is_active=true
    and starts_at<=now()
    and (ends_at is null or ends_at>=now());

  if not found then
    return jsonb_build_object('valid',false,'message','الكوبون غير صالح أو غير نشط');
  end if;

  if v_coupon.usage_limit is not null and v_coupon.used_count>=v_coupon.usage_limit then
    return jsonb_build_object('valid',false,'message','تم استنفاد عدد استخدامات الكوبون');
  end if;

  if v_product.price<v_coupon.minimum_order then
    return jsonb_build_object('valid',false,'message','السعر أقل من الحد الأدنى للكوبون');
  end if;

  v_discount:=case
    when v_coupon.discount_type='percent' then round(v_product.price*v_coupon.discount_value/100,2)
    else v_coupon.discount_value
  end;

  if v_coupon.maximum_discount is not null then
    v_discount:=least(v_discount,v_coupon.maximum_discount);
  end if;
  v_discount:=least(v_discount,v_product.price);
  v_total:=greatest(v_product.price-v_discount,0);

  return jsonb_build_object(
    'valid',true,
    'active',true,
    'discount',v_discount,
    'original_total',v_product.price,
    'final_total',v_total,
    'discount_type',v_coupon.discount_type,
    'discount_value',v_coupon.discount_value
  );
end
$$;

grant execute on function public.preview_coupon_discount(text,uuid) to anon,authenticated;
