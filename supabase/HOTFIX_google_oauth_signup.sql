-- ==========================================================================
-- AliShop Hotfix: Allow Google OAuth / Social Signups without Phone Constraint
-- Fixes "Database error saving new user" on Google OAuth registration
-- ==========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_full_name text := trim(coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(coalesce(new.email, ''), '@', 1),
    'عميل المتجر'
  ));
  v_phone text := regexp_replace(coalesce(new.raw_user_meta_data->>'phone', ''), '\D', '', 'g');
  v_provider text := coalesce(new.raw_app_meta_data->>'provider', 'email');
begin
  -- For email/password signup with phone in metadata, validate length
  -- For Google / OAuth, phone is optional and can be completed in account profile
  if v_provider = 'email' then
    if (new.raw_user_meta_data->>'phone') is not null and length(v_phone) < 8 then
      raise exception 'رقم واتساب صالح مطلوب';
    end if;
  end if;

  insert into public.profiles (id, full_name, phone, avatar_url, role)
  values (
    new.id,
    v_full_name,
    case when length(v_phone) >= 8 then v_phone else null end,
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', null),
    'user'
  )
  on conflict (id) do update set
    full_name = case when profiles.full_name is null or profiles.full_name = '' then excluded.full_name else profiles.full_name end,
    avatar_url = coalesce(profiles.avatar_url, excluded.avatar_url);

  insert into public.wallets (user_id, balance)
  values (new.id, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$function$;

-- Allow OAuth logins to bypass domain restrictions if verified by provider
create or replace function public.alishop_check_email_domain()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_domain text;
  v_provider text := coalesce(NEW.raw_app_meta_data->>'provider', 'email');
begin
  -- Any OAuth provider (Google, Apple, etc.) is trusted
  if v_provider != 'email' then
    return NEW;
  end if;

  if NEW.email is null or NEW.email='' then
    return NEW;
  end if;

  v_domain := lower(split_part(coalesce(NEW.email,''),'@',2));
  if v_domain not in (
    'gmail.com','googlemail.com',
    'outlook.com','hotmail.com','live.com','msn.com',
    'icloud.com','me.com','mac.com',
    'yahoo.com','ymail.com','rocketmail.com',
    'proton.me','protonmail.com',
    'aol.com','zoho.com','mail.com','gmx.com','gmx.net'
  ) then
    raise exception 'التسجيل متاح فقط ببريد من مزوّد معروف (Gmail أو Outlook أو iCloud أو Yahoo وغيرها) — البريد % غير مدعوم', NEW.email;
  end if;
  return NEW;
end$$;

-- Ensure triggers are properly attached
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop trigger if exists trg_alishop_email_domain on auth.users;
create trigger trg_alishop_email_domain
  before insert on auth.users
  for each row execute function public.alishop_check_email_domain();
