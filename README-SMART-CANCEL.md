# نظام الإلغاء الذكي

- أول 10 ثوانٍ: زر إلغاء فوري مع عداد.
- بعد 10 ثوانٍ: يتحول إلى طلب الإلغاء.
- بعد إرسال طلب الإلغاء: يظهر أنه مرسل ولا يقبل تكراره.
- بعد التسليم أو الإلغاء أو الاسترداد: يختفي الزر نهائيًا.
- الإلغاء الفوري يعيد الرصيد ذريًا من قاعدة البيانات.

## الرفع
```bash
cd /storage/emulated/0/Download/New-alishop-store-clean
unzip -o ../alishop-hotfix-smart-order-cancel.zip
git add .
git commit -m "Add smart order cancellation flow"
git push
```

ثم شغّل:
`supabase/alishop_smart_order_cancel.sql`
