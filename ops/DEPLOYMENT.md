# Dilmune deployment

Use the existing server named **Illuminators**, 1 vCPU, 2 GB RAM, 50 GB disk.
Install Docker Engine and Compose from Ubuntu's package repository. Clone the
public fork, then run from its root:

```sh
sh ops/init-production.sh https://YOUR-DILMUNE-SUBDOMAIN
sh ops/deploy.sh
```

Create a Dilmune **Reverse Proxy** site with a free HTTPS subdomain pointing
to `http://127.0.0.1:8080` (or port 8080, according to the form).
Use that actual HTTPS origin in the initialization command. No app or database
ports should be opened to the internet; Dilmune's TLS proxy is the entry point.

On the FIRST empty demo database only:

```sh
sh ops/initialize-demo.sh
```

This helper refuses to seed an existing merchant database. Seeding is never
part of a redeploy. The seed prints API keys; its output is kept in the private
`.production-seed.log`, excluded from Git and Docker build contexts.

## Services and links

```text
Internet -> Dilmune HTTPS proxy -> 127.0.0.1:8080 gateway
  /pay/:token, /dashboard/* -> built merchant React app
  /admin/*                -> built admin React app (basename /admin/)
  /v1/*                   -> api:3000
  /healthz, /readyz        -> api:3000
api -> settlement:8091 (bearer token, private network)
api + settlement + reporting -> postgres:5432 (private internal network)
```

Only gateway port 8080 is published, on loopback. API is capped at 0.5 CPU and
512 MB. PostgreSQL has 512 MB; settlement/reporting each 256 MB; gateway 64 MB.
These are deployment budgets, NOT measured capacity claims. TLS terminates at
Dilmune. Database connections are not TLS-encrypted inside the Docker network;
per-service database roles and database TLS remain unresolved hardening work.

## Secrets, login, and backups

`init-production.sh` generates unique database, internal API, callback and
webhook-encryption secrets with OpenSSL. `.production.env` is mode 600 and is
never committed. Preserve it across deploys and backups: rotating the webhook
encryption key without re-encrypting stored secrets breaks delivery.
Postgres and KYC uploads use persistent Docker volumes. Back up the database
and `.production.env` privately before schema or settlement changes.

Production uses secure cookies, signature-required callbacks and no OTP code
exposure. **The application currently has only a logging OTP notifier, not real
email/SMS delivery. Hosted interactive login therefore still needs an approved
OTP delivery arrangement; do not claim production login works without testing it.**
Do not expose development OTP responses on the public site as an undocumented fix.
Seed accounts are publicly known demo credentials; this is a synthetic hackathon
environment, not a real payment deployment. Rotate credentials or restrict access
before storing anything non-synthetic.

## Health, recovery, and redeployment

API container health checks query Postgres and request `/healthz`; the API's
public readiness endpoint alone is not taken as proof of current database health.
Gateway checks API health. All long-running containers restart unless stopped;
Docker does not automatically restart an unhealthy-but-running container.
Inspect `docker compose --env-file .production.env -f ops/compose.production.yml ps`
and private logs. API/reporting JSON log files are rotated. Nginx returns 429 for
excess per-client API request rate/connections; determine real capacity by load
testing, including requests from multiple IP addresses.

Normal redeploy (`sh ops/deploy.sh`) preserves the existing settlement daemon
with `--no-recreate`, so it does not interrupt a settlement run. It does NOT
activate a changed settlement binary. For a settlement upgrade, stop incoming
admin batch actions, inspect active database work, allow batches to finish,
then perform a reviewed restart. Containers have a 120-second stop allowance,
but no claim is made that forced shutdown is safe after external side effects.
Migration scripts run before node services update; review schema compatibility
with the running settlement binary before any future schema change.

## Verification still required on the deployed server

- Image builds; fresh migrations; one-time seed on empty database.
- HTTPS checkout, merchant and admin login, including OTP delivery.
- Full and partial refunds including settlement/reporting (not yet complete).
- Actual API CPU/memory constraints and overload behavior.
- Keep server reachable until judging ends.
