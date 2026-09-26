# إصلاح قبول/رفض طلبات الشحن وسجل المستخدم

يعالج:
- خطأ processDeposit is not defined.
- زر معاينة إثبات الدفع في لوحة الإدارة.
- استخدام الحقل الصحيح receipt_url.
- ظهور طلبات الشحن وحالتها وملاحظة الإدارة في محفظة المستخدم.
- معاينة المستخدم لإثباته.
- سياسات RLS لقراءة المستخدم طلباته فقط.

## الرفع
```bash
cd /storage/emulated/0/Download/New-alishop-store-clean
unzip -o ../alishop-hotfix-deposit-actions-history.zip
git add .
git commit -m "Fix deposit actions proof and user history"
git push
```

ثم شغّل:
`supabase/alishop_hotfix_deposit_actions_history.sql`
