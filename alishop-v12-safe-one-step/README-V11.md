# AliShop V11 Notifications & Rich Support

## التحديثات
- عدادات حمراء في لوحة الإدارة للطلبات وطلبات الشحن والإلغاء والدعم والمخزون النافد.
- عداد رسائل على زر الدعم العائم.
- نقل الأزرار العائمة إلى يمين الشاشة.
- إخفاء الأزرار تلقائيًا بعد 5 ثوانٍ مع لسان لإظهارها.
- صوت قصير عند وصول رسالة دعم.
- رفع صور داخل المحادثة.
- منتقي إيموجي.
- حظر المستخدم من إرسال رسائل الدعم وفك الحظر من الإدارة.
- عدادات رسائل غير مقروءة للعميل والمدير.

## الرفع
```bash
cd /storage/emulated/0/Download/New-alishop-store-clean
unzip -o ../alishop-v11-notifications-support.zip
git add .
git commit -m "AliShop V11 notifications and rich support"
git push
```

ثم شغّل:
`supabase/alishop_v11_notifications_support.sql`
