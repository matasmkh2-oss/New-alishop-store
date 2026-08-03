# AliShop Clean Build

هذه نسخة موحدة من مشروع علي شوب باستخدام HTML وCSS وJavaScript وSupabase.

## بيانات الربط الموجودة

- Project URL: `https://jcnbbingctwuathvfqty.supabase.co`
- تم وضع المفتاح العام Anon داخل `assets/js/config.js`.
- لم يتم وضع المفتاح السري الذي يبدأ بـ `sb_secret_`.

## مهم أمنيًا

أنت شاركت مفتاحًا سريًا سابقًا يبدأ بـ `sb_secret_`.
يجب من Supabase فتح **Settings → API Keys** ثم إلغاؤه أو تدويره.

## لأنك شغلت schema.sql سابقًا

لا تشغّل ملف schema القديم من جديد.

شغّل فقط الملف التالي مرة واحدة:

`supabase/upgrade_after_old_schema.sql`

الخطوات:

1. افتح Supabase.
2. افتح SQL Editor.
3. اضغط New query.
4. انسخ محتوى `upgrade_after_old_schema.sql`.
5. اضغط Run.
6. إذا ظهرت Success، أصبحت قاعدة البيانات متوافقة مع هذه النسخة.

## جعل حسابك مديرًا

أنشئ حسابًا من الموقع، ثم افتح Supabase → Table Editor → profiles.
غيّر قيمة role إلى admin.

أو نفّذ:

```sql
update public.profiles
set role='admin'
where id='UUID_USER';
```

## رفع المشروع إلى GitHub من الهاتف

1. فك ضغط ZIP.
2. افتح مستودع GitHub.
3. اضغط رابط `uploading an existing file`.
4. ارفع:
   - index.html
   - مجلد assets
   - مجلد supabase
   - README.md
5. اضغط Commit changes.

## نشر GitHub Pages

1. افتح Settings داخل المستودع.
2. Pages.
3. Deploy from a branch.
4. اختر main و /root.
5. Save.

## إعداد رابط الموقع في Supabase

بعد صدور رابط GitHub Pages، افتح:

Authentication → URL Configuration

ضع رابط الموقع في Site URL وRedirect URLs.
