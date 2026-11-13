#!/bin/sh
# Pose le CA pump.fun sur le site de prod (~1 min). Usage : sh scripts/set-ca.sh <mint…pump>
set -e
MINT="$1"
case "$MINT" in *pump) ;; *) echo "Le mint pump.fun finit par 'pump'"; exit 1;; esac
cd "$(dirname "$0")/.."
printf '%s' "$MINT" | npx -y vercel env add NEXT_PUBLIC_OFFICIAL_TOKEN production --force
npx -y vercel deploy --prod --yes
echo "CA en ligne sur https://leonida-agents-sol.vercel.app"
