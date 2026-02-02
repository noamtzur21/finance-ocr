#!/bin/sh
# Push to GitHub → Vercel ידפלס אוטומטית פעם אחת (חיבור Git)
# Usage: npm run ship -- "תיאור השינוי"
# Or:    ./scripts/ship.sh "תיאור השינוי"

set -e
MSG="${*:-Update}"

echo "→ git add -A"
git add -A

if git diff --cached --quiet 2>/dev/null; then
  echo "אין שינויים לקומיט."
  exit 0
fi

echo "→ git commit -m \"$MSG\""
git commit -m "$MSG"
echo "→ git push origin main"
git push origin main
echo "✓ נדחף. Vercel ידפלס אוטומטית (דיפלוי אחד)."
