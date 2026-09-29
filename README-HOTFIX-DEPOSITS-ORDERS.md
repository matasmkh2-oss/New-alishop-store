# إصلاح طلبات الشحن والطلبات المستردة

يعالج:
- عدم ظهور طلبات الشحن في لوحة الإدارة.
- فشل الربط التلقائي مع profiles وpayment_methods.
- قبول ورفض طلب الشحن من خلال دالة آمنة.
- منع تحويل الطلب المسترد إلى مكتمل دون خصم جديد.
- إعادة خصم الرصيد عند إعادة تفعيل الطلب.
- منع إعادة التفعيل إذا كان الرصيد غير كافٍ.

## التثبيت
```bash
cd /storage/emulated/0/Download/New-alishop-store-clean
unzip -o ../alishop-hotfix-deposits-orders.zip
git add .
git commit -m "Fix deposits and refunded order reactivation"
git push
```

ثم شغّل:
`supabase/alishop_hotfix_deposits_orders.sql`
