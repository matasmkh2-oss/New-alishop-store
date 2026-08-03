# متجر منتجات رقمية — HTML/CSS/JS + Supabase

## التشغيل السريع

1. أنشئ مشروعاً جديداً في Supabase.
2. افتح SQL Editor وشغّل محتوى `schema.sql`.
3. من Project Settings > API انسخ:
   - Project URL
   - Publishable/Anon Key
4. ضعهما داخل `supabase.js`.
5. شغّل المشروع عبر خادم محلي، مثل:
   ```bash
   npx serve .
   ```
   أو باستخدام إضافة Live Server في VS Code.
6. أنشئ حساباً من الواجهة.
7. اجعل حسابك مديراً عبر SQL:
   ```sql
   update public.profiles
   set role = 'admin'
   where id = 'ضع UUID المستخدم';
   ```

## الملفات

- `index.html`: الهيكل العام.
- `styles.css`: التصميم المتجاوب والوضع الليلي.
- `app.js`: التوجيه، المصادقة، المنتجات، المحفظة، الطلبات.
- `supabase.js`: إعداد الاتصال.
- `schema.sql`: الجداول والسياسات ودالة الشراء الآمنة.

## ملاحظات أمنية

- لا تضع Secret/Service Role Key داخل الواجهة.
- استخدم فقط Publishable/Anon Key في `supabase.js`.
- تعديل الرصيد والشراء يتم من خلال دوال قاعدة البيانات المحمية.
- المخزون الرقمي لا يملك سياسة قراءة مباشرة للمستخدم.
