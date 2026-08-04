# إصلاح حفظ المنتجات

يعالج:
- توقف حفظ المنتج الرقمي بصمت عند وجود خطأ JSON أو رفع صورة.
- عدم إرسال اسم المنصة والأيقونة القديمة مع منتج السوشل.
- توافق قاعدة البيانات مع جميع ترقيات V6–V11.
- رسائل خطأ واضحة وحالة تحميل على زر الحفظ.
- العودة إلى الكتالوج الموحد بعد الحفظ.
- إظهار أخطاء تحميل الكتالوج بدل عرض قائمة فارغة.

## الرفع
```bash
cd /storage/emulated/0/Download/New-alishop-store-clean
unzip -o ../alishop-v11-hotfix-catalog-save.zip
git add .
git commit -m "Fix digital and social product saving"
git push
```

ثم شغّل في Supabase:
`supabase/alishop_v11_catalog_save_fix.sql`
