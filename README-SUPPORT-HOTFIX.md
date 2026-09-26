# إصلاح قائمة محادثات الدعم

يعالج:
- عدم ظهور المحادثات رغم وجود عداد أحمر.
- تعارض علاقتي user_id وblocked_by مع جدول profiles.
- رفع الصورة بأيقونة فقط دون ظهور حقل اختيار الملف التقليدي.
- ظهور نقطة خضراء صغيرة على أيقونة الصورة بعد اختيار ملف.

## الرفع
```bash
cd /storage/emulated/0/Download/New-alishop-store-clean
unzip -o ../alishop-v11-hotfix-support-list.zip
git add .
git commit -m "Fix support conversations and image picker"
git push
```

لا يحتاج إلى تشغيل SQL جديد.
