create or replace function public.admin_list_users()
returns table(
  id uuid,
  full_name text,
  phone text,
  email text,
  role user_role,
  status account_status,
  created_at timestamp with time zone,
  wallet_balance numeric
)
language plpgsql
security definer
set search_path = public, auth
as $function$
begin
  if not public.is_admin() then
    raise exception 'غير مصرح';
  end if;

  return query
  select
    p.id,
    p.full_name::text,
    p.phone::text,
    coalesce(u.email, '')::text as email,
    p.role,
    p.status,
    p.created_at,
    coalesce(w.balance, 0)::numeric as wallet_balance
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join public.wallets w on w.user_id = p.id
  order by coalesce(w.balance, 0) desc, p.created_at desc;
end
$function$;

grant execute on function public.admin_list_users() to authenticated;
