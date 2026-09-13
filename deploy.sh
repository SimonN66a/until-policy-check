#!/usr/bin/env bash
# One-command deploy. Run from this folder.
set -euo pipefail

echo "==> installing"
npm install --no-audit --no-fund

echo "==> building stylesheet"
node scripts/build-css.mjs

echo "==> deploying to Vercel"
npx --yes vercel@latest --prod

cat <<'NOTE'

Deployed. Three pages are live:
  /                  the un-branded checker
  /bakermckenzie     UNTIL x Baker McKenzie
  /meta              UNTIL x Meta

The analyser needs your Anthropic key before uploads will work:

  npx vercel env add ANTHROPIC_API_KEY production
  npx vercel --prod

Optional, for enquiries and the spend cap (see README.md):
  npx vercel env add SUPABASE_URL production
  npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
  npx vercel env add RATE_LIMIT_SALT production
NOTE
