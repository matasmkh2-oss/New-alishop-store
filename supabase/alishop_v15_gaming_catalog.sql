-- =========================================================
-- AliShop V15 — Gaming / Apps / Software catalog section
-- يضيف قسمًا مستقلاً لشحن الألعاب والتطبيقات والبرامج
-- شغّله مرة واحدة داخل Supabase SQL Editor
-- =========================================================

begin;

alter table public.products
  add column if not exists catalog_section text not null default 'digital';

alter table public.categories
  add column if not exists catalog_section text not null default 'digital',
  add column if not exists updated_at timestamptz not null default now();

update public.products
set catalog_section='digital'
where catalog_section is null or catalog_section not in('digital','gaming');

update public.categories
set catalog_section='digital'
where catalog_section is null or catalog_section not in('digital','gaming');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='products_catalog_section_check'
      and conrelid='public.products'::regclass
  ) then
    alter table public.products
      add constraint products_catalog_section_check
      check (catalog_section in ('digital','gaming'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='categories_catalog_section_check'
      and conrelid='public.categories'::regclass
  ) then
    alter table public.categories
      add constraint categories_catalog_section_check
      check (catalog_section in ('digital','gaming'));
  end if;
end$$;

create or replace function public.set_alishop_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at=now();
  return new;
end
$$;

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at
before update on public.categories
for each row execute function public.set_alishop_updated_at();

create index if not exists idx_products_catalog_section_admin
  on public.products(catalog_section,is_active,category_id,created_at desc);

create index if not exists idx_categories_catalog_section_admin
  on public.categories(catalog_section,parent_id,sort_order,name);

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

grant select on public.products_with_stock to anon, authenticated;

insert into public.categories(name,description,catalog_section,sort_order,is_active)
select * from (
  values
    ('الألعاب','تصنيفات شحن الألعاب والرصيد والبطاقات','gaming',10,true),
    ('التطبيقات','اشتراكات وتفعيل وتعبئة التطبيقات','gaming',20,true),
    ('البرامج','رخص البرامج والتفعيلات والاشتراكات','gaming',30,true)
) as seed(name,description,catalog_section,sort_order,is_active)
where not exists (
  select 1 from public.categories c
  where c.name=seed.name and c.catalog_section=seed.catalog_section
);

create table if not exists public.alishop_schema_versions(
  version text primary key,
  installed_at timestamptz not null default now(),
  notes text
);

insert into public.alishop_schema_versions(version,notes)
values('v15_gaming_catalog','إضافة قسم شحن الألعاب والتطبيقات والبرامج للمدير والمستخدم')
on conflict (version) do nothing;

commit;
