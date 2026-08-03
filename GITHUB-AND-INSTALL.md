# دليل الرفع والتنصيب

## رفع المشروع إلى GitHub من الهاتف

1. فك ضغط الملف.
2. افتح المستودع: `https://github.com/matasmkh2-oss/New-alishop-store`.
3. اضغط **Add file** ثم **Upload files**.
4. ارفع الملفات الموجودة داخل مجلد `New-alishop-store`، وليس ملف ZIP نفسه.
5. اكتب رسالة Commit مثل: `Initial AliShop store`.
6. اضغط **Commit changes**.

## إنشاء قاعدة البيانات

1. افتح مشروعك في Supabase.
2. افتح **SQL Editor** ثم **New query**.
3. افتح ملف `schema.sql` من المشروع وانسخ محتواه كاملًا.
4. الصقه في SQL Editor واضغط **Run** مرة واحدة.

## ربط الموقع بـ Supabase

1. افتح **Project Settings → API** أو **Data API**.
2. انسخ **Project URL**.
3. انسخ **Publishable key / anon public** فقط.
4. افتح ملف `supabase.js` وعدّل:

```js
const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_PUBLIC_KEY";
```

لا تستخدم Service Role Key داخل الموقع.

## تعيين حساب المدير

1. افتح الموقع وأنشئ حسابًا.
2. في Supabase افتح **Table Editor → profiles**.
3. غيّر قيمة `role` للحساب من `user` إلى `admin`.

أو نفّذ:

```sql
update public.profiles
set role = 'admin'
where id = 'USER_UUID';
```

## التشغيل المحلي

استخدم Live Server في VS Code أو:

```bash
npx serve .
```

## النشر على GitHub Pages

1. افتح المستودع ثم **Settings → Pages**.
2. اختر **Deploy from a branch**.
3. اختر `main` و `/root`.
4. اضغط Save.

بعد ظهور رابط الموقع، أضفه داخل Supabase في:
**Authentication → URL Configuration → Site URL و Redirect URLs**.
