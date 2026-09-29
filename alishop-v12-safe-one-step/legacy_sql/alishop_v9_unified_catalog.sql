-- =========================================================
-- AliShop V9 — Unified Catalog support
-- Run once after V8
-- =========================================================

-- Optional metadata for richer social media products
alter table public.smm_services
  add column if not exists estimated_time text,
  add column if not exists refill_supported boolean not null default false,
  add column if not exists cancel_supported boolean not null default false,
  add column if not exists quality_label text,
  add column if not exists sales_count integer not null default 0;

-- Digital catalog filters
alter table public.products
  add column if not exists is_featured boolean not null default false,
  add column if not exists sort_order integer not null default 0;

create index if not exists idx_products_catalog_filters
  on public.products(is_active,category_id,manual_availability,sort_order);

create index if not exists idx_social_catalog_filters
  on public.smm_services(is_active,platform_id,service_category,sort_order);

-- Ensure admin can manage unified catalog sources
drop policy if exists admin_full_products on public.products;
create policy admin_full_products
on public.products for all to authenticated
using(public.is_admin())
with check(public.is_admin());

drop policy if exists smm_services_admin_all on public.smm_services;
create policy smm_services_admin_all
on public.smm_services for all to authenticated
using(public.is_admin())
with check(public.is_admin());
