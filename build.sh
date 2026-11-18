#!/bin/bash
# Assemble the single-page app from src/ into public/index.html.
set -e
cd "$(dirname "$0")"
mkdir -p public
{
  echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  echo '<meta name="robots" content="noindex,nofollow"><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 32 32%27%3E%3Crect width=%2732%27 height=%2732%27 fill=%27%23F47C1A%27/%3E%3Cpath d=%27M6 22h20v3H6zM9 21a7 7 0 0 1 14 0z%27 fill=%27%230A0A0A%27/%3E%3C/svg%3E">'
  cat src/01-head.html
  cat src/00-cloud.css
  echo '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js"></script>'
  echo '</head><body><div id="app"></div><script>'
  cat src/02-core.js src/03-app.js src/04-sales.js src/05-quotes.js src/06-ops.js src/07-admin.js src/08-cloud.js src/09-start-cloud.js
  echo '</script></body></html>'
} > public/index.html
echo "built public/index.html ($(wc -c < public/index.html) bytes)"
