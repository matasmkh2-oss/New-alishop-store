-- AliShop V22 — تقييد التسجيل بالدومينات الموثوقة فقط (حماية خادمية لا يمكن تجاوزها)
begin;

create or replace function public.alishop_check_email_domain()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_domain text;
begin
  v_domain:=lower(split_part(coalesce(NEW.email,''),'@',2));
  if NEW.email is null or NEW.email='' then
    return NEW; -- حسابات الهاتف أو OAuth تمر
  end if;
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

drop trigger if exists trg_alishop_email_domain on auth.users;
create trigger trg_alishop_email_domain
  before insert on auth.users
  for each row execute function public.alishop_check_email_domain();

insert into public.alishop_schema_versions(version,notes)
values('v22_trusted_email_domains','تقييد التسجيل بالدومينات المعروفة فقط عبر trigger على auth.users')
on conflict (version) do nothing;
commit;
