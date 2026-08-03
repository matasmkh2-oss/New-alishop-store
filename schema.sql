-- شغّل هذا الملف مرة واحدة داخل Supabase SQL Editor
create extension if not exists pgcrypto;

create type public.user_role as enum ('user', 'admin');
create type public.account_status as enum ('active', 'blocked');
create type public.order_status as enum ('paid', 'processing', 'delivered', 'cancelled', 'refunded');
create type public.deposit_status as enum ('pending', 'approved', 'rejected', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  avatar_url text,
  role public.user_role not null default 'user',
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance numeric(14,2) not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(14,2) not null check (price >= 0),
  image_url text,
  delivery_type text not null default 'manual',
  is_active boolean not null default true,
  is_featured boolean not null default false,
  sales_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.digital_inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  secret_value text not null,
  is_used boolean not null default false,
  order_id uuid,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  user_id uuid not null references public.profiles(id),
  product_id uuid not null references public.products(id),
  total numeric(14,2) not null check (total >= 0),
  status public.order_status not null default 'paid',
  delivery_data text,
  idempotency_key uuid unique not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

alter table public.digital_inventory
  add constraint digital_inventory_order_fk
  foreign key (order_id) references public.orders(id) on delete set null;

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  order_id uuid references public.orders(id),
  type text not null,
  amount numeric(14,2) not null,
  balance_before numeric(14,2) not null,
  balance_after numeric(14,2) not null check (balance_after >= 0),
  description text,
  reference_code text unique not null,
  created_at timestamptz not null default now()
);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  instructions text,
  account_name text,
  account_number text,
  currency text not null default 'USD',
  min_amount numeric(14,2) not null default 0,
  max_amount numeric(14,2),
  fee_value numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.deposit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  payment_method_id uuid not null references public.payment_methods(id),
  amount numeric(14,2) not null check (amount > 0),
  transfer_reference text,
  receipt_url text,
  note text,
  status public.deposit_status not null default 'pending',
  rejection_reason text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  insert into public.wallets (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.digital_inventory enable row level security;
alter table public.orders enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.payment_methods enable row level security;
alter table public.deposit_requests enable row level security;

create policy "profiles_select_own" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "wallet_select_own" on public.wallets for select using (user_id = auth.uid() or public.is_admin());

create policy "categories_public_read" on public.categories for select using (is_active or public.is_admin());
create policy "categories_admin_all" on public.categories for all using (public.is_admin()) with check (public.is_admin());

create policy "products_public_read" on public.products for select using (is_active or public.is_admin());
create policy "products_admin_all" on public.products for all using (public.is_admin()) with check (public.is_admin());

create policy "orders_select_own" on public.orders for select using (user_id = auth.uid() or public.is_admin());
create policy "transactions_select_own" on public.wallet_transactions for select using (user_id = auth.uid() or public.is_admin());

create policy "payment_methods_public_read" on public.payment_methods for select using (is_active or public.is_admin());
create policy "payment_methods_admin_all" on public.payment_methods for all using (public.is_admin()) with check (public.is_admin());

create policy "deposit_select_own" on public.deposit_requests for select using (user_id = auth.uid() or public.is_admin());
create policy "deposit_insert_own" on public.deposit_requests for insert with check (user_id = auth.uid());
create policy "deposit_admin_update" on public.deposit_requests for update using (public.is_admin()) with check (public.is_admin());

-- لا توجد سياسة قراءة مباشرة للمخزون الرقمي، وهذا مقصود.

create or replace function public.purchase_product(
  p_product_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_product public.products%rowtype;
  v_wallet public.wallets%rowtype;
  v_order_id uuid;
  v_order_number text;
  v_inventory public.digital_inventory%rowtype;
begin
  if v_user is null then raise exception 'يجب تسجيل الدخول'; end if;

  if exists (select 1 from public.orders where idempotency_key = p_idempotency_key) then
    return jsonb_build_object('message', 'تم تنفيذ الطلب مسبقاً');
  end if;

  select * into v_product from public.products
  where id = p_product_id and is_active = true
  for update;

  if not found then raise exception 'المنتج غير متوفر'; end if;

  select * into v_wallet from public.wallets
  where user_id = v_user
  for update;

  if v_wallet.balance < v_product.price then
    raise exception 'رصيد المحفظة غير كاف';
  end if;

  v_order_number := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));

  insert into public.orders(order_number,user_id,product_id,total,status,idempotency_key)
  values(v_order_number,v_user,v_product.id,v_product.price,'paid',p_idempotency_key)
  returning id into v_order_id;

  update public.wallets
  set balance = balance - v_product.price, updated_at = now()
  where user_id = v_user;

  insert into public.wallet_transactions(
    user_id,order_id,type,amount,balance_before,balance_after,description,reference_code
  ) values (
    v_user,v_order_id,'purchase',-v_product.price,v_wallet.balance,
    v_wallet.balance-v_product.price,'شراء '||v_product.name,'TX-'||replace(gen_random_uuid()::text,'-','')
  );

  select * into v_inventory
  from public.digital_inventory
  where product_id = v_product.id and is_used = false
  order by created_at
  for update skip locked
  limit 1;

  if found then
    update public.digital_inventory
    set is_used=true, order_id=v_order_id, used_at=now()
    where id=v_inventory.id;

    update public.orders
    set status='delivered', delivery_data=v_inventory.secret_value, delivered_at=now()
    where id=v_order_id;
  end if;

  update public.products set sales_count=sales_count+1 where id=v_product.id;

  return jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'message', 'تمت عملية الشراء بنجاح'
  );
end;
$$;

revoke all on function public.purchase_product(uuid,uuid) from public;
grant execute on function public.purchase_product(uuid,uuid) to authenticated;

-- بعد إنشاء أول حساب، اجعله مديراً يدوياً:
-- update public.profiles set role = 'admin' where id = 'USER_UUID';
