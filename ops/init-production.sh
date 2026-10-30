#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ -e .production.env ]; then
  echo '.production.env already exists; keeping all existing keys.'
  exit 0
fi
origin=${1:?Usage: sh ops/init-production.sh https://your-dilmune-site-address}
case "$origin" in https://*) ;; *) echo 'An HTTPS public origin is required.' >&2; exit 1;; esac
umask 077
{
  printf 'PUBLIC_ORIGIN=%s\n' "${origin%/}"
  printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 24)"
  printf 'WEBHOOK_SECRET_ENCRYPTION_KEY=%s\n' "$(openssl rand -base64 32)"
  printf 'SETTLEMENT_INTERNAL_TOKEN=%s\n' "$(openssl rand -hex 32)"
  printf 'ACQUIRER_CALLBACK_SIGNING_SECRET=%s\n' "$(openssl rand -hex 32)"
} > .production.env
echo 'Created private .production.env. Back it up securely; never commit it.'
