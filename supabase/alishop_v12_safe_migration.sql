
-- =========================================================
-- AliShop V12 Safe Migration
-- يحافظ على الجداول والبيانات الحالية ويصنع نسخة احتياطية
-- =========================================================

create extension if not exists pgcrypto;

create schema if not exists alishop_backup_v12;

do $$
declare
  table_name text;
  backup_name text;
begin
  foreach table_name in array array[
    'profiles','wallets','wallet_transactions','products','categories',
    'digital_inventory','orders','deposit_requests','payment_methods',
    'notifications','store_settings','store_slides','announcements',
    'recharge_cards','order_cancel_requests','coupons','coupon_usages',
    'social_platforms','smm_services','smm_orders',
    'support_threads','support_messages','admin_activity_logs'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      backup_name := table_name || '_' || to_char(clock_timestamp(),'YYYYMMDD_HH24MISS_MS');
      execute format(
        'create table alishop_backup_v12.%I as table public.%I',
        backup_name,
        table_name
      );
    end if;
  end loop;
end
$$;

begin;

-- ===== V10 integrated features =====
-- =========================================================
-- AliShop V10 — Full Integration, Contacts & Support
-- Run once after V9
-- =========================================================

alter table public.store_settings
  add column if not exists support_telegram text;

create table if not exists public.support_threads(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null default 'محادثة دعم',
  status text not null default 'open' check(status in('open','pending','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages(
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists support_threads_read on public.support_threads;
create policy support_threads_read on public.support_threads
for select to authenticated
using(user_id=auth.uid() or public.is_admin());

drop policy if exists support_threads_insert on public.support_threads;
create policy support_threads_insert on public.support_threads
for insert to authenticated
with check(user_id=auth.uid());

drop policy if exists support_threads_admin_update on public.support_threads;
create policy support_threads_admin_update on public.support_threads
for update to authenticated
using(user_id=auth.uid() or public.is_admin())
with check(user_id=auth.uid() or public.is_admin());

drop policy if exists support_messages_read on public.support_messages;
create policy support_messages_read on public.support_messages
for select to authenticated
using(
  exists(
    select 1 from public.support_threads t
    where t.id=thread_id and (t.user_id=auth.uid() or public.is_admin())
  )
);

drop policy if exists support_messages_insert on public.support_messages;
create policy support_messages_insert on public.support_messages
for insert to authenticated
with check(
  sender_id=auth.uid()
  and exists(
    select 1 from public.support_threads t
    where t.id=thread_id and (t.user_id=auth.uid() or public.is_admin())
  )
);

create or replace function public.touch_support_thread()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.support_threads set updated_at=now(),status='open' where id=new.thread_id;
  return new;
end$$;

drop trigger if exists trg_touch_support_thread on public.support_messages;
create trigger trg_touch_support_thread
after insert on public.support_messages
for each row execute function public.touch_support_thread();

-- Preload common social platforms once
insert into public.social_platforms(name,slug,icon,sort_order,is_active)
values
('Instagram','instagram','instagram',1,true),
('Facebook','facebook','facebook',2,true),
('YouTube','youtube','youtube',3,true),
('TikTok','tiktok','music-2',4,true),
('Telegram','telegram','send',5,true),
('X / Twitter','x-twitter','twitter',6,true),
('LinkedIn','linkedin','linkedin',7,true),
('WhatsApp','whatsapp','message-circle',8,true),
('Snapchat','snapchat','ghost',9,true),
('Pinterest','pinterest','pin',10,true),
('Twitch','twitch','twitch',11,true),
('Discord','discord','messages-square',12,true),
('Reddit','reddit','message-square-more',13,true),
('Spotify','spotify','circle-play',14,true)
on conflict(slug) do update set
  name=excluded.name,
  icon=excluded.icon,
  sort_order=excluded.sort_order;

create index if not exists idx_support_threads_user_updated on public.support_threads(user_id,updated_at desc);
create index if not exists idx_support_messages_thread_created on public.support_messages(thread_id,created_at);
create index if not exists idx_wallet_transactions_user_type_created on public.wallet_transactions(user_id,type,created_at desc);


-- ===== V11 notification and support features =====
-- =========================================================
-- AliShop V11 — Notifications badges and rich support
-- Run once after V10
-- =========================================================

alter table public.support_threads
  add column if not exists admin_unread_count integer not null default 0,
  add column if not exists user_unread_count integer not null default 0,
  add column if not exists is_user_blocked boolean not null default false,
  add column if not exists blocked_at timestamptz,
  add column if not exists blocked_by uuid references public.profiles(id);

alter table public.support_messages
  alter column body drop not null;

alter table public.support_messages
  add column if not exists image_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='support_messages_content_check'
      and conrelid='public.support_messages'::regclass
  ) then
    alter table public.support_messages
      add constraint support_messages_content_check
      check (
        (body is not null and length(trim(body))>0)
        or image_url is not null
      );
  end if;
end$$;

-- Support image upload access
drop policy if exists store_media_support_upload on storage.objects;
create policy store_media_support_upload
on storage.objects for insert to authenticated
with check(
  bucket_id='store-media'
  and (storage.foldername(name))[1]='support'
);

-- Users cannot send when blocked. Admins can always reply.
drop policy if exists support_messages_insert on public.support_messages;
create policy support_messages_insert
on public.support_messages for insert to authenticated
with check(
  sender_id=auth.uid()
  and exists(
    select 1
    from public.support_threads t
    where t.id=thread_id
      and (
        public.is_admin()
        or (t.user_id=auth.uid() and t.is_user_blocked=false)
      )
  )
);

create or replace function public.update_support_counters()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_thread public.support_threads%rowtype;
  v_sender_role text;
begin
  select * into v_thread from public.support_threads where id=new.thread_id for update;
  select role into v_sender_role from public.profiles where id=new.sender_id;

  if v_sender_role='admin' then
    update public.support_threads
    set user_unread_count=user_unread_count+1,
        updated_at=now(),
        status='open'
    where id=new.thread_id;
  else
    update public.support_threads
    set admin_unread_count=admin_unread_count+1,
        updated_at=now(),
        status='open'
    where id=new.thread_id;
  end if;

  return new;
end$$;

drop trigger if exists trg_touch_support_thread on public.support_messages;
drop trigger if exists trg_update_support_counters on public.support_messages;
create trigger trg_update_support_counters
after insert on public.support_messages
for each row execute function public.update_support_counters();

create or replace function public.admin_set_support_block(
  p_thread_id uuid,
  p_blocked boolean
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_thread public.support_threads%rowtype;
begin
  if not public.is_admin() then raise exception 'غير مصرح'; end if;

  select * into v_thread
  from public.support_threads
  where id=p_thread_id
  for update;

  if not found then raise exception 'المحادثة غير موجودة'; end if;

  update public.support_threads
  set
    is_user_blocked=p_blocked,
    blocked_at=case when p_blocked then now() else null end,
    blocked_by=case when p_blocked then auth.uid() else null end,
    updated_at=now()
  where id=p_thread_id;

  insert into public.notifications(user_id,title,body,type)
  values(
    v_thread.user_id,
    case when p_blocked then 'تم إيقاف الإرسال إلى الدعم' else 'تم السماح بالإرسال إلى الدعم' end,
    case when p_blocked then 'أوقفت الإدارة إرسال الرسائل مؤقتًا.' else 'يمكنك إرسال الرسائل إلى الدعم مجددًا.' end,
    'announcement'
  );

  return jsonb_build_object('success',true,'blocked',p_blocked);
end$$;

grant execute on function public.admin_set_support_block(uuid,boolean) to authenticated;

create index if not exists idx_support_threads_admin_unread
  on public.support_threads(admin_unread_count,updated_at desc);

create index if not exists idx_support_threads_user_unread
  on public.support_threads(user_id,user_unread_count,updated_at desc);


-- ===== Catalog save and compatibility fixes =====
-- =========================================================
-- AliShop V11 — Catalog Save Compatibility Fix
-- شغّل هذا الملف مرة واحدة بعد الملفات السابقة
-- =========================================================

-- Ensure digital product columns used by the current application exist.
alter table public.products
  add column if not exists required_fields jsonb not null default '[]'::jsonb,
  add column if not exists manual_availability text not null default 'available',
  add column if not exists is_active boolean not null default true,
  add column if not exists image_url text,
  add column if not exists description text,
  add column if not exists updated_at timestamptz not null default now();

-- Ensure social product columns exist and remain compatible with the old schema.
alter table public.smm_services
  add column if not exists platform_id uuid references public.social_platforms(id) on delete restrict,
  add column if not exists service_category text not null default 'خدمات عامة',
  add column if not exists platform text,
  add column if not exists icon text not null default 'messages-square',
  add column if not exists updated_at timestamptz not null default now();

-- Older V6 installations created platform as NOT NULL.
-- The application now sends it, but dropping the constraint also makes future migrations safe.
alter table public.smm_services
  alter column platform drop not null;

update public.smm_services s
set
  platform=coalesce(nullif(s.platform,''),p.name),
  icon=coalesce(nullif(s.icon,''),p.icon,'messages-square')
from public.social_platforms p
where s.platform_id=p.id
  and (s.platform is null or s.platform='' or s.icon is null or s.icon='');

-- Validate digital product availability values.
update public.products
set manual_availability='available'
where manual_availability is null
   or manual_availability not in('available','paused','sold_out');

-- Complete admin CRUD policies.
alter table public.products enable row level security;
alter table public.smm_services enable row level security;
alter table public.social_platforms enable row level security;
alter table public.categories enable row level security;

drop policy if exists admin_full_products on public.products;
create policy admin_full_products
on public.products
for all to authenticated
using(public.is_admin())
with check(public.is_admin());

drop policy if exists smm_services_admin_all on public.smm_services;
create policy smm_services_admin_all
on public.smm_services
for all to authenticated
using(public.is_admin())
with check(public.is_admin());

drop policy if exists social_platforms_admin_all on public.social_platforms;
create policy social_platforms_admin_all
on public.social_platforms
for all to authenticated
using(public.is_admin())
with check(public.is_admin());

drop policy if exists admin_full_categories on public.categories;
create policy admin_full_categories
on public.categories
for all to authenticated
using(public.is_admin())
with check(public.is_admin());

-- Public read policies needed by the storefront.
drop policy if exists products_public_read on public.products;
create policy products_public_read
on public.products
for select
using(is_active or public.is_admin());

drop policy if exists smm_services_public_read on public.smm_services;
create policy smm_services_public_read
on public.smm_services
for select
using(is_active or public.is_admin());

drop policy if exists social_platforms_read on public.social_platforms;
create policy social_platforms_read
on public.social_platforms
for select
using(is_active or public.is_admin());

-- Automatically refresh updated_at.
create or replace function public.set_alishop_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at=now();
  return new;
end
$$;

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_alishop_updated_at();

drop trigger if exists trg_smm_services_updated_at on public.smm_services;
create trigger trg_smm_services_updated_at
before update on public.smm_services
for each row execute function public.set_alishop_updated_at();

-- Recreate the catalog view so new columns are included.
drop view if exists public.products_with_stock cascade;

create view public.products_with_stock as
select
  p.*,
  c.name as category_name,
  case
    when p.delivery_type='automatic'
      then count(di.id) filter(where di.is_used=false)
    else null
  end as stock_count,
  case
    when p.delivery_type='automatic'
      and count(di.id) filter(where di.is_used=false)=0 then 'sold_out'
    when p.delivery_type='manual'
      and p.manual_availability<>'available' then 'sold_out'
    else 'available'
  end as availability_status
from public.products p
left join public.categories c on c.id=p.category_id
left join public.digital_inventory di on di.product_id=p.id
group by p.id,c.name;

grant select on public.products_with_stock to anon,authenticated;

-- Make sure the default platforms are present.
insert into public.social_platforms(name,slug,icon,sort_order,is_active)
values
('Instagram','instagram','instagram',1,true),
('Facebook','facebook','facebook',2,true),
('YouTube','youtube','youtube',3,true),
('TikTok','tiktok','music-2',4,true),
('Telegram','telegram','send',5,true),
('X / Twitter','x-twitter','twitter',6,true),
('LinkedIn','linkedin','linkedin',7,true),
('WhatsApp','whatsapp','message-circle',8,true),
('Snapchat','snapchat','ghost',9,true),
('Pinterest','pinterest','pin',10,true),
('Twitch','twitch','twitch',11,true),
('Discord','discord','messages-square',12,true),
('Reddit','reddit','message-square-more',13,true),
('Spotify','spotify','circle-play',14,true)
on conflict(slug) do update set
  name=excluded.name,
  icon=excluded.icon,
  sort_order=excluded.sort_order,
  is_active=true;

create index if not exists idx_products_admin_catalog
  on public.products(is_active,category_id,created_at desc);

create index if not exists idx_smm_services_admin_catalog
  on public.smm_services(is_active,platform_id,service_category,created_at desc);


-- Ensure the public storefront can access the rebuilt view.
grant select on public.products_with_stock to anon, authenticated;

-- Record the installed schema version without touching store data.
create table if not exists public.alishop_schema_versions(
  version text primary key,
  installed_at timestamptz not null default now(),
  notes text
);

insert into public.alishop_schema_versions(version,notes)
values(
  '12.0.0',
  'Safe unified migration: catalog saves, support, badges, contacts, social products'
)
on conflict(version) do update set
  installed_at=now(),
  notes=excluded.notes;

commit;
