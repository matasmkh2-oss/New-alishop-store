# AliShop V4 Ultimate

هذه ترقية فوق V3، وتحافظ على البيانات الموجودة.

## الرفع من Termux

```bash
cd /storage/emulated/0/Download/New-alishop-store-clean
unzip -o ../alishop-v4-ultimate.zip
git add .
git commit -m "AliShop V4 ultimate update"
git push
```

## قاعدة البيانات

شغّل هذا الملف مرة واحدة داخل Supabase SQL Editor:

`supabase/alishop_v4_ultimate.sql`

ويجب أن يكون ملف `alishop_v3_complete.sql` قد تم تشغيله قبله.

## إضافات V4

- مفضلة المنتجات.
- كوبونات الخصم وقاعدة استخدامها.
- صلاحيات إضافية للمشرفين.
- حظر وفك حظر الحسابات بدالة آمنة.
- تحسين سياسات الإشعارات العامة.
- فهارس أداء للسجلات الكبيرة.
- أيقونات PNG 192 و512 لتحسين تثبيت PWA.
- Service Worker جديد لتجاوز الذاكرة القديمة.
- أدوات تصدير CSV جاهزة داخل الكود.
