# تحسين استجابة القوائم المنسدلة للمس

تم إصلاح:
- الحاجة إلى عدة ضغطات لفتح القائمة.
- إلغاء touchstart للضغطة على بعض أجهزة Android.
- صغر مساحة الضغط الفعلية.
- دعم فتح القائمة بالضغط على أي مكان داخل الحقل.
- منع فتح القائمة الأصلية المخفية.

## الرفع
```bash
cd /storage/emulated/0/Download/New-alishop-store-clean
unzip -o ../alishop-hotfix-select-tap-area.zip
git add .
git commit -m "Improve custom select mobile tap area"
git push
```

لا يحتاج إلى SQL.
