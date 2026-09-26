-- =========================================================
-- HOTFIX: قائمة المستخدمين للإدارة مع البريد الإلكتروني والرصيد
-- =========================================================

create or replace function public.admin_list_users()
returns table(
  id uuid,
  full_name text,
  phone text,
  email text,
  role public.user_role,
  status public.account_status,
  created_at timestamptz,
  wallet_balance numeric
)
language plpgsql
security definer
set search_path=public,auth
as $$
begin
  if not public.is_admin() then
    raise exception 'غير مصرح';
  end if;

  return query
  select
    p.id,
    p.full_name,
    p.phone,
    coalesce(u.email,'') as email,
    p.role,
    p.status,
    p.created_at,
    coalesce(w.balance,0) as wallet_balance
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join public.wallets w on w.user_id = p.id
  order by p.created_at desc;
end
$$;

grant execute on function public.admin_list_users() to authenticated;

notify pgrst, 'reload schema';
