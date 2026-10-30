#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
compose() { docker compose --env-file .production.env -f ops/compose.production.yml "$@"; }
count=$(compose exec -T postgres psql -U filspay -d filspay -Atc 'SELECT COUNT(*) FROM merchants')
if [ "$count" != "0" ]; then
  echo 'Refusing to seed: database contains merchants. Existing data was not changed.' >&2
  exit 1
fi
# API keys printed by the seed belong in a private file, not CI/public logs.
umask 077
compose stop api reporting gateway settlement
compose run --rm seed > .production-seed.log 2>&1 || {
  echo 'Seed failed. Inspect private .production-seed.log before proceeding.' >&2
  exit 1
}
compose up -d settlement api reporting gateway
echo 'Demo initialized. Keep .production-seed.log private; do not seed again.'
