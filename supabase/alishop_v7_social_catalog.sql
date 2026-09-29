-- =========================================================
-- AliShop V7 — Social Media & Nested Digital Catalog
-- Run once after V6
-- =========================================================
create extension if not exists pgcrypto;

-- Nested digital categories
alter table public.categories add column if not exists parent_id uuid references public.categories(id) on delete set null;
alter table public.categories add column if not exists image_url text;
create index if not exists idx_categories_parent_sort on public.categories(parent_id,sort_order);

-- Social platforms managed once
create table if not exists public.social_platforms(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  icon text not null default 'circle',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.smm_services add column if not exists platform_id uuid references public.social_platforms(id) on delete restrict;
alter table public.smm_services add column if not exists service_category text not null default 'خدمات عامة';

-- Migrate previous platform strings to platform records
insert into public.social_platforms(name,slug,icon)
select distinct platform,lower(regexp_replace(platform,'[^a-zA-Z0-9]+','-','g')),'circle'
from public.smm_services
where platform is not null and trim(platform)<>''
on conflict(slug) do nothing;

update public.smm_services s
set platform_id=p.id
from public.social_platforms p
where s.platform_id is null and lower(regexp_replace(s.platform,'[^a-zA-Z0-9]+','-','g'))=p.slug;

alter table public.social_platforms enable row level security;
drop policy if exists social_platforms_read on public.social_platforms;
create policy social_platforms_read on public.social_platforms for select using(is_active or public.is_admin());
drop policy if exists social_platforms_admin_all on public.social_platforms;
create policy social_platforms_admin_all on public.social_platforms for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- Update social notifications to their own type
create or replace function public.create_smm_order(
  p_service_id uuid,
  p_target_url text,
  p_quantity integer,
  p_notes text default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid();v_service public.smm_services%rowtype;v_wallet public.wallets%rowtype;v_total numeric(14,2);v_order_id uuid;v_number text;
begin
 if v_user is null then raise exception 'يجب تسجيل الدخول'; end if;
 if p_target_url is null or trim(p_target_url)='' then raise exception 'الرابط مطلوب'; end if;
 select * into v_service from public.smm_services where id=p_service_id and is_active=true for update;
 if not found then raise exception 'الخدمة غير متاحة'; end if;
 if p_quantity<v_service.min_quantity or p_quantity>v_service.max_quantity then raise exception 'الكمية خارج الحدود المسموحة'; end if;
 v_total:=round((p_quantity::numeric/1000)*v_service.price_per_1000,2);
 select * into v_wallet from public.wallets where user_id=v_user for update;
 if not found or v_wallet.balance<v_total then raise exception 'رصيد المحفظة غير كافٍ'; end if;
 v_number:='SOC-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
 insert into public.smm_orders(order_number,user_id,service_id,target_url,quantity,total,notes) values(v_number,v_user,p_service_id,trim(p_target_url),p_quantity,v_total,p_notes) returning id into v_order_id;
 update public.wallets set balance=balance-v_total,updated_at=now() where user_id=v_user;
 insert into public.wallet_transactions(user_id,type,amount,balance_before,balance_after,description,reference_code) values(v_user,'purchase',-v_total,v_wallet.balance,v_wallet.balance-v_total,'طلب خدمة سوشل ميديا','SOC-'||replace(gen_random_uuid()::text,'-',''));
 insert into public.notifications(user_id,title,body,type) values(v_user,'تم إنشاء طلب السوشل ميديا','طلبك قيد المراجعة والتنفيذ','social_order');
 return jsonb_build_object('success',true,'order_id',v_order_id,'message','تم إنشاء الطلب');
end$$;

create or replace function public.admin_update_smm_order(
  p_order_id uuid,p_status text,p_provider_reference text default null,p_admin_note text default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_order public.smm_orders%rowtype;v_wallet public.wallets%rowtype;v_tx uuid;
begin
 if not public.is_admin() then raise exception 'غير مصرح'; end if;
 if p_status not in('pending','processing','delivered','cancelled','refunded') then raise exception 'حالة غير صالحة'; end if;
 select * into v_order from public.smm_orders where id=p_order_id for update;
 if not found then raise exception 'الطلب غير موجود'; end if;
 if p_status in('cancelled','refunded') and v_order.refund_transaction_id is null then
   select * into v_wallet from public.wallets where user_id=v_order.user_id for update;
   update public.wallets set balance=balance+v_order.total,updated_at=now() where user_id=v_order.user_id;
   insert into public.wallet_transactions(user_id,type,amount,balance_before,balance_after,description,reference_code) values(v_order.user_id,'refund',v_order.total,v_wallet.balance,v_wallet.balance+v_order.total,'استرداد طلب سوشل ميديا','SOC-REF-'||replace(gen_random_uuid()::text,'-','')) returning id into v_tx;
   update public.smm_orders set refund_transaction_id=v_tx where id=v_order.id;
 end if;
 update public.smm_orders set status=p_status,provider_reference=p_provider_reference,admin_note=p_admin_note,updated_at=now(),completed_at=case when p_status='delivered' then now() else completed_at end where id=v_order.id;
 insert into public.notifications(user_id,title,body,type) values(v_order.user_id,'تحديث طلب السوشل ميديا',coalesce(p_admin_note,'تم تحديث حالة طلبك'),'social_order');
 return jsonb_build_object('success',true);
end$$;

grant execute on function public.create_smm_order(uuid,text,integer,text) to authenticated;
grant execute on function public.admin_update_smm_order(uuid,text,text,text) to authenticated;

create index if not exists idx_social_platforms_active_sort on public.social_platforms(is_active,sort_order);
create index if not exists idx_smm_services_platform_category on public.smm_services(platform_id,service_category,is_active);
