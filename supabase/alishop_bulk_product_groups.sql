-- AliShop bulk product groups
create table if not exists public.bulk_product_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bulk_product_group_items (
  group_id uuid not null references public.bulk_product_groups(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (group_id, product_id)
);

alter table public.bulk_product_groups enable row level security;
alter table public.bulk_product_group_items enable row level security;

drop policy if exists bulk_groups_admin_all on public.bulk_product_groups;
create policy bulk_groups_admin_all on public.bulk_product_groups for all to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.status='active'))
with check (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.status='active'));

drop policy if exists bulk_group_items_admin_all on public.bulk_product_group_items;
create policy bulk_group_items_admin_all on public.bulk_product_group_items for all to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.status='active'))
with check (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.status='active'));

create index if not exists bulk_group_items_position_idx on public.bulk_product_group_items(group_id, position);
