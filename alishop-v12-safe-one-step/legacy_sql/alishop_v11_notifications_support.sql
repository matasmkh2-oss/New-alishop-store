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
