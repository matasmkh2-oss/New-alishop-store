#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

PROJECT_DIR="${1:-/storage/emulated/0/Download/New-alishop-store-clean}"
PACKAGE_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "1/4 فحص ملفات V12..."
test -f "$PACKAGE_DIR/assets/js/app.js"
test -f "$PACKAGE_DIR/supabase/alishop_v12_safe_migration.sql"

if command -v node >/dev/null 2>&1; then
  node --check "$PACKAGE_DIR/assets/js/app.js"
else
  echo "تنبيه: Node غير مثبت، تم تجاوز فحص JavaScript المحلي."
fi

echo "2/4 نسخ النسخة النهائية إلى المشروع..."
mkdir -p "$PROJECT_DIR"
cp -R "$PACKAGE_DIR"/. "$PROJECT_DIR"/
rm -rf "$PROJECT_DIR/legacy_sql"
rm -f "$PROJECT_DIR/install-v12.sh"

echo "3/4 تجهيز Git..."
cd "$PROJECT_DIR"
git add .
if git diff --cached --quiet; then
  echo "لا توجد تغييرات جديدة للرفع."
else
  git commit -m "AliShop V12 safe unified release"
fi

echo "4/4 الرفع إلى GitHub..."
git push

echo
echo "تم رفع ملفات V12."
echo "بقي إجراء واحد فقط: شغّل ملف supabase/alishop_v12_safe_migration.sql مرة واحدة في Supabase SQL Editor."
