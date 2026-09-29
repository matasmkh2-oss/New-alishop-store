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
