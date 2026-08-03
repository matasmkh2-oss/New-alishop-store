-- AliShop V4 Ultimate upgrade
-- Run once after previous schema files

create extension if not exists pgcrypto;

-- Favorites
create table if not exists public.favorites(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id,product_id)
);

-- Coupons
create table if not exists public.coupons(
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  discount_type text not null check(discount_type in('fixed','percent')),
  discount_value numeric(14,2) not null check(discount_value>0),
  minimum_order numeric(14,2) not null default 0,
  maximum_discount numeric(14,2),
  usage_limit int,
  used_count int not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.coupon_usages(
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id),
  user_id uuid not null references public.profiles(id),
  order_id uuid references public.orders(id),
  discount_amount numeric(14,2) not null,
  created_at timestamptz not null default now(),
  unique(coupon_id,user_id,order_id)
);

-- Low stock alerts
create table if not exists public.stock_alerts(
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  threshold int not null default 3,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique(product_id)
);

-- Admin roles
alter table if exists public.profiles add column if not exists admin_permissions jsonb not null default '{}'::jsonb;

-- Audit improvements
alter table if exists public.admin_activity_logs add column if not exists ip_address text;
alter table if exists public.admin_activity_logs add column if not exists user_agent text;

-- Notifications global read policy
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications
for select to authenticated
using(user_id=auth.uid() or user_id is null or public.is_admin());

-- Favorites policies
alter table public.favorites enable row level security;
drop policy if exists favorites_own on public.favorites;
create policy favorites_own on public.favorites
for all to authenticated
using(user_id=auth.uid())
with check(user_id=auth.uid());

-- Coupons policies
alter table public.coupons enable row level security;
alter table public.coupon_usages enable row level security;
drop policy if exists coupons_public_read on public.coupons;
create policy coupons_public_read on public.coupons
for select using(is_active or public.is_admin());
drop policy if exists coupons_admin_all on public.coupons;
create policy coupons_admin_all on public.coupons
for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists coupon_usage_own on public.coupon_usages;
create policy coupon_usage_own on public.coupon_usages
for select to authenticated using(user_id=auth.uid() or public.is_admin());

alter table public.stock_alerts enable row level security;
drop policy if exists stock_alerts_admin on public.stock_alerts;
create policy stock_alerts_admin on public.stock_alerts
for all to authenticated using(public.is_admin()) with check(public.is_admin());

create or replace function public.validate_coupon(p_code text,p_product_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare c public.coupons%rowtype;
begin
  select * into c from public.coupons
  where upper(code)=upper(trim(p_code))
    and is_active=true
    and starts_at<=now()
    and (ends_at is null or ends_at>=now());

  if not found then raise exception 'الكوبون غير صالح أو منتهي'; end if;
  if c.usage_limit is not null and c.used_count>=c.usage_limit then
    raise exception 'تم استنفاد عدد استخدامات الكوبون';
  end if;

  return jsonb_build_object(
    'id',c.id,'code',c.code,'discount_type',c.discount_type,
    'discount_value',c.discount_value,'minimum_order',c.minimum_order,
    'maximum_discount',c.maximum_discount
  );
end
$$;

create or replace function public.admin_set_user_status(p_user_id uuid,p_status public.account_status,p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_admin() then raise exception 'غير مصرح'; end if;
  update public.profiles set status=p_status,updated_at=now() where id=p_user_id;
  insert into public.notifications(user_id,title,body,type)
  values(p_user_id,'تحديث حالة الحساب',coalesce(p_reason,'تم تحديث حالة حسابك'),'account');
  insert into public.admin_activity_logs(admin_id,action,target_type,target_id,details)
  values(auth.uid(),'set_user_status','profile',p_user_id,jsonb_build_object('status',p_status,'reason',p_reason));
  return jsonb_build_object('success',true);
end
$$;

create or replace function public.admin_create_coupon(
 p_code text,p_discount_type text,p_discount_value numeric,p_minimum_order numeric default 0,
 p_maximum_discount numeric default null,p_usage_limit int default null,p_ends_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
 if not public.is_admin() then raise exception 'غير مصرح'; end if;
 insert into public.coupons(code,discount_type,discount_value,minimum_order,maximum_discount,usage_limit,ends_at,created_by)
 values(upper(trim(p_code)),p_discount_type,p_discount_value,coalesce(p_minimum_order,0),p_maximum_discount,p_usage_limit,p_ends_at,auth.uid());
 return jsonb_build_object('success',true);
end
$$;

grant execute on function public.validate_coupon(text,uuid) to authenticated;
grant execute on function public.admin_set_user_status(uuid,public.account_status,text) to authenticated;
grant execute on function public.admin_create_coupon(text,text,numeric,numeric,numeric,int,timestamptz) to authenticated;

-- Recommended indexes
create index if not exists idx_orders_user_created on public.orders(user_id,created_at desc);
create index if not exists idx_orders_status_created on public.orders(status,created_at desc);
create index if not exists idx_notifications_user_read on public.notifications(user_id,is_read,created_at desc);
create index if not exists idx_inventory_product_used on public.digital_inventory(product_id,is_used);
create index if not exists idx_cards_code on public.recharge_cards(upper(code));
create index if not exists idx_deposits_status_created on public.deposit_requests(status,created_at desc);
