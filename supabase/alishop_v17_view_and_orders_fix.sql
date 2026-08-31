-- =========================================================
-- AliShop V17 — Fix products_with_stock view after adding packages
-- الـ view أُنشئ قبل عمود packages فلم يعد يعرضه للواجهة
-- شغّله مرة واحدة داخل Supabase SQL Editor
-- =========================================================

begin;

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

insert into public.alishop_schema_versions(version,notes)
values('v17_view_packages_fix','إعادة إنشاء products_with_stock لتعرض packages و required_fields للواجهة')
on conflict (version) do nothing;

commit;
