# إصلاح مساحة الضغط ومنشئ حقول المنتجات

## القوائم
- كامل حقل القائمة قابل للضغط، بما في ذلك المساحة المحيطة.
- تفويض لمس عام عبر document بدل مستمعات متعددة متعارضة.
- ضغطة واحدة عبر pointerup.
- دعم لوحة المفاتيح.

## معلومات العميل في المنتج الرقمي
- إضافة الحقول بزر.
- اختيار النوع من قائمة.
- تحديد إن كان مطلوبًا.
- إضافة نص مساعد.
- ترتيب الحقول للأعلى والأسفل.
- حذف الحقول.
- لا توجد كتابة JSON أو أكواد.

## الرفع
```bash
cd /storage/emulated/0/Download/New-alishop-store-clean
unzip -o ../alishop-hotfix-select-full-area-fields-builder.zip
git add .
git commit -m "Fix full select tap and add visual fields builder"
git push
```

لا يحتاج إلى SQL.
