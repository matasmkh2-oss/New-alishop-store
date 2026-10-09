-- AliShop V3 complete database upgrade
create extension if not exists pgcrypto;

create table if not exists public.store_settings(
 id uuid primary key default gen_random_uuid(),store_name text not null default 'علي شوب',logo_url text,currency text not null default 'USD',
 support_email text,support_whatsapp text,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
insert into public.store_settings(store_name,currency,support_email,support_whatsapp)
select 'علي شوب','USD','matasmkh2@gmail.com','963937580652'
where not exists(select 1 from public.store_settings);

create table if not exists public.store_slides(
 id uuid primary key default gen_random_uuid(),title text not null,subtitle text,image_url text,button_text text,button_url text,
 sort_order int not null default 0,is_active boolean not null default true,created_at timestamptz not null default now()
);
create table if not exists public.announcements(
 id uuid primary key default gen_random_uuid(),title text,message text not null,kind text not null default 'bar',
 is_active boolean not null default true,starts_at timestamptz not null default now(),ends_at timestamptz,created_by uuid references public.profiles(id),created_at timestamptz not null default now()
);
create table if not exists public.recharge_cards(
 id uuid primary key default gen_random_uuid(),code text unique not null,amount numeric(14,2) not null check(amount>0),is_used boolean not null default false,
 used_by uuid references public.profiles(id),used_at timestamptz,expires_at timestamptz,created_by uuid references public.profiles(id),created_at timestamptz not null default now()
);
create table if not exists public.order_cancel_requests(
 id uuid primary key default gen_random_uuid(),order_id uuid unique references public.orders(id) on delete cascade,user_id uuid references public.profiles(id),
 reason text not null,status text not null default 'pending',reviewed_by uuid references public.profiles(id),reviewed_at timestamptz,created_at timestamptz not null default now()
);
alter table if exists public.orders add column if not exists refund_transaction_id uuid unique references public.wallet_transactions(id);
alter table if exists public.products add column if not exists manual_availability text not null default 'available';
alter table if exists public.products add constraint products_manual_availability_check check(manual_availability in('available','paused','sold_out')) not valid;

create or replace view public.products_with_stock as
select p.*,c.name category_name,
case when p.delivery_type='automatic' then count(di.id) filter(where di.is_used=false) else null end stock_count,
case
 when p.delivery_type='automatic' and count(di.id) filter(where di.is_used=false)=0 then 'sold_out'
 when p.delivery_type='manual' and p.manual_availability<>'available' then 'sold_out'
 else 'available'
end availability_status
from public.products p
left join public.categories c on c.id=p.category_id
left join public.digital_inventory di on di.product_id=p.id
group by p.id,c.name;

create or replace function public.generate_recharge_cards(p_amount numeric,p_count int,p_prefix text default 'ALI')
returns jsonb language plpgsql security definer set search_path=public as $$
declare i int;v_code text;
begin
 if not public.is_admin() then raise exception 'غير مصرح'; end if;
 if p_count<1 or p_count>100 then raise exception 'العدد من 1 إلى 100'; end if;
 for i in 1..p_count loop
   v_code=upper(coalesce(p_prefix,'ALI'))||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
   insert into public.recharge_cards(code,amount,created_by) values(v_code,p_amount,auth.uid());
 end loop;
 return jsonb_build_object('success',true,'count',p_count);
end$$;

create or replace function public.redeem_recharge_card(p_code text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.recharge_cards%rowtype;w public.wallets%rowtype;
begin
 if auth.uid() is null then raise exception 'سجل الدخول'; end if;
 select * into c from public.recharge_cards where upper(code)=upper(trim(p_code)) for update;
 if not found then raise exception 'البطاقة غير موجودة'; end if;
 if c.is_used then raise exception 'تم استخدام البطاقة مسبقاً'; end if;
 if c.expires_at is not null and c.expires_at<now() then raise exception 'انتهت صلاحية البطاقة'; end if;
 select * into w from public.wallets where user_id=auth.uid() for update;
 update public.wallets set balance=balance+c.amount,updated_at=now() where user_id=auth.uid();
 update public.recharge_cards set is_used=true,used_by=auth.uid(),used_at=now() where id=c.id;
 insert into public.wallet_transactions(user_id,type,amount,balance_before,balance_after,description,reference_code)
 values(auth.uid(),'recharge_card',c.amount,w.balance,w.balance+c.amount,'شحن بواسطة بطاقة متجر','CARD-'||replace(gen_random_uuid()::text,'-',''));
 insert into public.notifications(user_id,title,body,type) values(auth.uid(),'تم شحن المحفظة','تمت إضافة رصيد بطاقة الشحن','wallet');
 return jsonb_build_object('success',true,'message','تم شحن الرصيد بنجاح','amount',c.amount);
end$$;

create or replace function public.request_order_cancel(p_order_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype;
begin
 select * into o from public.orders where id=p_order_id and user_id=auth.uid();
 if not found then raise exception 'الطلب غير موجود'; end if;
 if o.status not in('paid','processing') then raise exception 'لا يمكن إلغاء هذا الطلب'; end if;
 insert into public.order_cancel_requests(order_id,user_id,reason) values(o.id,auth.uid(),p_reason)
 on conflict(order_id) do update set reason=excluded.reason,status='pending',created_at=now();
 return jsonb_build_object('success',true);
end$$;

create or replace function public.admin_process_order(p_order_id uuid,p_status public.order_status,p_delivery_data text default null,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype;w public.wallets%rowtype;tx uuid;
begin
 if not public.is_admin() then raise exception 'غير مصرح'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'الطلب غير موجود'; end if;
 if p_status in('cancelled','refunded') and o.refund_transaction_id is null then
   select * into w from public.wallets where user_id=o.user_id for update;
   update public.wallets set balance=balance+o.total,updated_at=now() where user_id=o.user_id;
   insert into public.wallet_transactions(user_id,order_id,type,amount,balance_before,balance_after,description,reference_code)
   values(o.user_id,o.id,'refund',o.total,w.balance,w.balance+o.total,coalesce(p_reason,'استرداد قيمة الطلب'),'REF-'||replace(gen_random_uuid()::text,'-',''))
   returning id into tx;
   update public.orders set refund_transaction_id=tx where id=o.id;
 end if;
 update public.orders set status=p_status,delivery_data=coalesce(p_delivery_data,delivery_data),delivered_at=case when p_status='delivered' then now() else delivered_at end where id=o.id;
 insert into public.notifications(user_id,title,body,type) values(o.user_id,
 case when p_status='delivered' then 'تم تسليم طلبك' when p_status in('cancelled','refunded') then 'تمت إعادة الرصيد' else 'تم تحديث الطلب' end,
 coalesce(p_reason,'تم تحديث حالة طلبك'),'order');
 return jsonb_build_object('success',true);
end$$;

create or replace function public.publish_announcement(p_title text,p_message text,p_kind text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'غير مصرح'; end if;
 insert into public.announcements(title,message,kind,created_by) values(p_title,p_message,p_kind,auth.uid());
 if p_kind='notification' then insert into public.notifications(user_id,title,body,type) values(null,p_title,p_message,'announcement'); end if;
 return jsonb_build_object('success',true);
end$$;

alter table public.store_settings enable row level security;alter table public.store_slides enable row level security;alter table public.announcements enable row level security;alter table public.recharge_cards enable row level security;alter table public.order_cancel_requests enable row level security;
drop policy if exists public_read_settings on public.store_settings;create policy public_read_settings on public.store_settings for select using(true);
drop policy if exists public_read_slides on public.store_slides;create policy public_read_slides on public.store_slides for select using(is_active or public.is_admin());
drop policy if exists admin_slides_all on public.store_slides;create policy admin_slides_all on public.store_slides for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists public_read_announcements on public.announcements;create policy public_read_announcements on public.announcements for select using(is_active or public.is_admin());
drop policy if exists admin_announcements_all on public.announcements;create policy admin_announcements_all on public.announcements for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists admin_cards_all on public.recharge_cards;create policy admin_cards_all on public.recharge_cards for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists cancel_requests_own on public.order_cancel_requests;create policy cancel_requests_own on public.order_cancel_requests for select using(user_id=auth.uid() or public.is_admin());
grant select on public.products_with_stock to anon,authenticated;
grant execute on function public.generate_recharge_cards(numeric,int,text) to authenticated;
grant execute on function public.redeem_recharge_card(text) to authenticated;
grant execute on function public.request_order_cancel(uuid,text) to authenticated;
grant execute on function public.admin_process_order(uuid,public.order_status,text,text) to authenticated;
grant execute on function public.publish_announcement(text,text,text) to authenticated;
