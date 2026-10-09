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
create or replace view public.products_with_stock as
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
