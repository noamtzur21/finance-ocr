#!/bin/sh
# Push to GitHub and deploy to Vercel (project: finance-ocr)
# Usage: npm run ship -- "תיאור השינוי"
# Or:    ./scripts/ship.sh "תיאור השינוי"

set -e
MSG="${*:-Update}"

echo "→ git add -A"
git add -A

if git diff --cached --quiet 2>/dev/null; then
  echo "No changes to commit. Deploying only..."
else
  echo "→ git commit -m \"$MSG\""
  git commit -m "$MSG"
  echo "→ git push origin main"
  git push origin main
fi

echo "→ vercel --prod (finance-ocr)"
exec vercel --prod --yes
