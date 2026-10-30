#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
test -f .production.env || { echo 'Run sh ops/init-production.sh HTTPS_ORIGIN first.' >&2; exit 1; }
export COMPOSE_PARALLEL_LIMIT=1
compose() { docker compose --env-file .production.env -f ops/compose.production.yml "$@"; }
compose config --quiet
compose build api
compose build gateway
compose build settlement
compose up -d postgres
compose run --rm migrate
# Normal redeploys leave an existing settlement daemon running. Updating
# its binary is an explicit maintenance operation, after draining batches.
compose up -d --no-recreate settlement
compose up -d api reporting gateway
compose ps
echo 'Checkout: /pay/TOKEN | Merchant: /dashboard/login | Admin: /admin/login | API: /v1/'
echo 'Settlement image changes require a separate, reviewed maintenance restart.'
