# إصلاح جميع القوائم المنسدلة

تم تطبيق طبقة ضغط حقيقية على كل select في التطبيق، وتشمل:
- نماذج المنتجات الرقمية.
- منتجات السوشل.
- الفلاتر.
- الطلبات.
- المحفظة.
- الإعدادات.
- التصنيفات.
- السلايدر والإعلانات.
- جميع القوائم التي تُنشأ ديناميكيًا.

لم يعد فتح القائمة يعتمد على النص أو السهم أو أحداث label.

## الرفع
```bash
cd /storage/emulated/0/Download/New-alishop-store-clean
unzip -o ../alishop-hotfix-all-selects-hitbox.zip
git add .
git commit -m "Fix tap area for every select control"
git push
```

لا يحتاج إلى SQL.
