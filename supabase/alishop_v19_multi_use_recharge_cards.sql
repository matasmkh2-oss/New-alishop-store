-- ============================================================================
-- ALISHOP: Multi-use Recharge Cards with Active/Disabled Toggle & Pro Tracking
-- ============================================================================

begin;

-- 1. إضافة وتحديث أعمدة جدول بطاقات الشحن (max_uses, used_count, is_active)
alter table if exists public.recharge_cards
  add column if not exists max_uses integer not null default 1 check (max_uses >= 1),
  add column if not exists used_count integer not null default 0 check (used_count >= 0),
  add column if not exists is_active boolean not null default true;

-- مزامنة البطاقات القديمة
update public.recharge_cards
set used_count = case when is_used = true then greatest(max_uses, 1) else 0 end
where used_count = 0 and is_used = true;

-- 2. جدول توثيق المستخدمين لمنع تكرار الشحن لنفس الحساب
create table if not exists public.recharge_card_usages (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.recharge_cards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  constraint unique_card_user_redemption unique (card_id, user_id)
);

create index if not exists idx_recharge_cards_code on public.recharge_cards(upper(code));
create index if not exists idx_recharge_cards_active on public.recharge_cards(is_active, is_used);
create index if not exists idx_recharge_card_usages_card on public.recharge_card_usages(card_id);
create index if not exists idx_recharge_card_usages_user on public.recharge_card_usages(user_id);

-- صلاحيات الأمان (Row Level Security)
alter table public.recharge_card_usages enable row level security;

drop policy if exists recharge_card_usages_admin_all on public.recharge_card_usages;
create policy recharge_card_usages_admin_all on public.recharge_card_usages
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists recharge_card_usages_user_select on public.recharge_card_usages;
create policy recharge_card_usages_user_select on public.recharge_card_usages
  for select using (auth.uid() = user_id);

-- 3. دالة توليد كود شحن واحد متعدد الاستخدامات
create or replace function public.generate_recharge_cards(
  p_amount numeric,
  p_count int default 1,
  p_prefix text default 'ALI'
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_max_uses int;
  v_card public.recharge_cards%rowtype;
begin
  if not public.is_admin() then raise exception 'غير مصرح للوصول لهذه العملية'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'يجب تحديد مبلغ صالح للبطاقة'; end if;

  v_max_uses := greatest(1, coalesce(p_count, 1));
  v_code := upper(coalesce(nullif(trim(p_prefix), ''), 'ALI')) || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  
  insert into public.recharge_cards(code, amount, max_uses, used_count, is_used, is_active, created_by)
  values(v_code, p_amount, v_max_uses, 0, false, true, auth.uid())
  returning * into v_card;
  
  return jsonb_build_object(
    'success', true,
    'id', v_card.id,
    'code', v_code,
    'amount', p_amount,
    'max_uses', v_max_uses,
    'used_count', 0,
    'is_active', true,
    'message', 'تم توليد كود الشحن بنجاح'
  );
end$$;

grant execute on function public.generate_recharge_cards(numeric, int, text) to authenticated;

-- 4. دالة شحن الرصيد بالكود مع التحقق من التعطيل والتفعيل
create or replace function public.redeem_recharge_card(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.recharge_cards%rowtype;
  w public.wallets%rowtype;
  v_new_used_count int;
  v_is_now_used boolean;
begin
  if auth.uid() is null then 
    raise exception 'يرجى تسجيل الدخول أولاً لشحن الرصيد'; 
  end if;

  if p_code is null or trim(p_code) = '' then 
    raise exception 'يرجى إدخال رمز كود الشحن'; 
  end if;

  -- قفل السجل للتحقق والتحديث الآمن
  select * into c from public.recharge_cards
  where upper(trim(code)) = upper(trim(p_code))
  for update;

  if not found then 
    raise exception 'كود الشحن غير موجود أو غير صحيح'; 
  end if;

  -- التحقق من حالة تفعيل الكود
  if coalesce(c.is_active, true) = false then
    raise exception 'تم تعطيل كود الشحن هذا من قبل الإدارة';
  end if;

  -- التحقق من استنفاد مرات الاستخدام
  if coalesce(c.is_used, false) = true or coalesce(c.used_count, 0) >= coalesce(c.max_uses, 1) then
    raise exception 'تم استنفاد جميع مرات استخدام هذا الكود بالكامل';
  end if;

  -- التحقق من التخصيص لمستخدم معين
  if c.assigned_to is not null and c.assigned_to <> auth.uid() then
    raise exception 'هذا الكود مخصص لحساب مستخدم آخر فقط';
  end if;

  -- التحقق من تاريخ الصلاحية
  if c.expires_at is not null and c.expires_at < now() then
    raise exception 'انتهت صلاحية كود الشحن المحدد';
  end if;

  -- منع استخدام نفس الكود أكثر من مرة للمستخدم الواحد
  if exists (select 1 from public.recharge_card_usages where card_id = c.id and user_id = auth.uid()) then
    raise exception 'لقد قمت باستخدام كود الشحن هذا مسبقاً';
  end if;

  -- حساب عدد الاستخدامات الجديد
  v_new_used_count := coalesce(c.used_count, 0) + 1;
  v_is_now_used := (v_new_used_count >= coalesce(c.max_uses, 1));

  -- قفل وتحديث محفظة المستخدم
  select * into w from public.wallets where user_id = auth.uid() for update;
  if not found then
    insert into public.wallets(user_id, balance) values(auth.uid(), 0) returning * into w;
  end if;

  update public.wallets 
  set balance = balance + c.amount, 
      updated_at = now() 
  where user_id = auth.uid();

  -- تحديث بطاقة الشحن
  update public.recharge_cards
  set used_count = v_new_used_count,
      is_used = v_is_now_used,
      used_by = auth.uid(),
      used_at = now()
  where id = c.id;

  -- توثيق الاستخدام
  insert into public.recharge_card_usages(card_id, user_id, amount) 
  values(c.id, auth.uid(), c.amount);

  -- تسجيل حركة مالية
  insert into public.wallet_transactions(
    user_id, type, amount, balance_before, balance_after, description, reference_code
  )
  values(
    auth.uid(), 
    'recharge_card', 
    c.amount, 
    w.balance, 
    w.balance + c.amount, 
    'شحن بواسطة كود متجر (' || c.code || ') (' || v_new_used_count || '/' || coalesce(c.max_uses, 1) || ')', 
    'CARD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 14))
  );

  -- إرسال إشعار للمستخدم
  insert into public.notifications(user_id, title, body, type)
  values(
    auth.uid(), 
    'تم شحن المحفظة بنجاح', 
    'تمت إضافة رصيد بقيمة ' || c.amount || ' إلى محفظتك بنجاح', 
    'wallet'
  );

  return jsonb_build_object(
    'success', true,
    'message', 'تم شحن الرصيد بنجاح (' || c.amount || ')',
    'amount', c.amount,
    'used_count', v_new_used_count,
    'max_uses', coalesce(c.max_uses, 1),
    'remaining_uses', greatest(0, coalesce(c.max_uses, 1) - v_new_used_count)
  );
end$$;

grant execute on function public.redeem_recharge_card(text) to authenticated;

commit;
