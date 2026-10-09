# AliShop Ultimate — تثبيت دون تغيير البنية

هذه الحزمة تُفك مباشرة فوق مجلد المشروع الحالي. لا تحذف أي ملف أو بيانات، ولا تغيّر مسارات المشروع.

## الرفع من Termux

ضع الملف المضغوط في Download ثم نفّذ:

```bash
cd /storage/emulated/0/Download
unzip -o alishop-ultimate-stable.zip -d New-alishop-store-clean
cd New-alishop-store-clean
node --check assets/js/app.js
git add .
git commit -m "AliShop Ultimate stable release"
git push
```

إذا قال Git إنه لا توجد تغييرات، انتقل للخطوة التالية.

## Supabase

شغّل ملفًا واحدًا فقط داخل SQL Editor:

`supabase/INSTALL_ONCE_ALISHOP_ULTIMATE.sql`

الملف ينشئ نسخة احتياطية داخل `alishop_backup_v12` ثم يطبّق إصلاحات V12 وV13 دون حذف المستخدمين أو الأرصدة أو المنتجات أو الطلبات.

## بعد النشر

امسح بيانات موقع GitHub Pages من Chrome أو افتح الموقع في نافذة خفية مرة واحدة، حتى لا يعمل Service Worker القديم.
