-- =========================================================
-- HOTFIX: تفعيل تغيير أدوار المستخدمين + حماية المدير الأساسي
-- المدير الأساسي المحمي: 3lishops@gmail.com
-- =========================================================

create or replace function public.is_primary_admin_target(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,auth
as $$
  select exists(
    select 1
    from auth.users u
    where u.id = p_user_id
      and lower(coalesce(u.email,'')) = '3lishops@gmail.com'
  );
$$;

create or replace function public.protect_profiles_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path=public,auth
as $$
begin
  if tg_op = 'DELETE' then
    if public.is_primary_admin_target(old.id) then
      raise exception 'لا يمكن حذف المدير الأساسي';
    end if;
    return old;
  end if;

  if not public.is_admin() then
    if new.role is distinct from old.role
       or new.status is distinct from old.status
       or coalesce(new.admin_permissions,'{}'::jsonb) is distinct from coalesce(old.admin_permissions,'{}'::jsonb) then
      raise exception 'لا يمكن تعديل الصلاحيات أو حالة الحساب مباشرة';
    end if;
  end if;

  if public.is_primary_admin_target(old.id) then
    if new.role is distinct from old.role and new.role <> 'admin'::public.user_role then
      raise exception 'لا يمكن تغيير دور المدير الأساسي';
    end if;

    if new.status is distinct from old.status and new.status <> 'active'::public.account_status then
      raise exception 'لا يمكن تغيير حالة المدير الأساسي';
    end if;

    if coalesce(new.admin_permissions,'{}'::jsonb) is distinct from coalesce(old.admin_permissions,'{}'::jsonb) then
      raise exception 'لا يمكن تعديل صلاحيات المدير الأساسي';
    end if;
  end if;

  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists trg_protect_profiles_sensitive_fields on public.profiles;
create trigger trg_protect_profiles_sensitive_fields
before update or delete on public.profiles
for each row
execute function public.protect_profiles_sensitive_fields();

create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role public.user_role,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_old_role public.user_role;
begin
  if not public.is_admin() then
    raise exception 'غير مصرح';
  end if;

  select role into v_old_role
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'المستخدم غير موجود';
  end if;

  if public.is_primary_admin_target(p_user_id) and p_role <> 'admin'::public.user_role then
    raise exception 'لا يمكن تغيير دور المدير الأساسي';
  end if;

  update public.profiles
  set role = p_role,
      updated_at = now()
  where id = p_user_id;

  insert into public.notifications(user_id,title,body,type)
  values(
    p_user_id,
    'تحديث الصلاحيات',
    case when p_role = 'admin'::public.user_role then 'تم منحك صلاحية مدير' else 'تم تحويل حسابك إلى مستخدم عادي' end,
    'account'
  );

  insert into public.admin_activity_logs(admin_id,action,target_type,target_id,details)
  values(
    auth.uid(),
    'set_user_role',
    'profile',
    p_user_id,
    jsonb_build_object('old_role',v_old_role,'new_role',p_role,'reason',p_reason)
  );

  return jsonb_build_object('success',true,'role',p_role);
end
$$;

grant execute on function public.admin_set_user_role(uuid,public.user_role,text) to authenticated;

create or replace function public.admin_set_user_status(
  p_user_id uuid,
  p_status public.account_status,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_exists boolean;
begin
  if not public.is_admin() then
    raise exception 'غير مصرح';
  end if;

  select exists(select 1 from public.profiles where id = p_user_id) into v_exists;
  if not v_exists then
    raise exception 'المستخدم غير موجود';
  end if;

  if public.is_primary_admin_target(p_user_id) and p_status <> 'active'::public.account_status then
    raise exception 'لا يمكن تغيير حالة المدير الأساسي';
  end if;

  update public.profiles
  set status = p_status,
      updated_at = now()
  where id = p_user_id;

  insert into public.notifications(user_id,title,body,type)
  values(p_user_id,'تحديث حالة الحساب',coalesce(p_reason,'تم تحديث حالة حسابك'),'account');

  insert into public.admin_activity_logs(admin_id,action,target_type,target_id,details)
  values(auth.uid(),'set_user_status','profile',p_user_id,jsonb_build_object('status',p_status,'reason',p_reason));

  return jsonb_build_object('success',true,'status',p_status);
end
$$;

notify pgrst, 'reload schema';
