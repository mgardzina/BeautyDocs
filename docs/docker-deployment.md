# Docker: local development and beautydocs.pl

Requires Docker Engine and Docker Compose 2.24.4 or later. The web image uses
Node 22 and the npm lockfile. The Python image uses Python 3.12 and `uv.lock`,
with Alembic and administration commands included in the runtime image.

## Local stack

Copy `.env.compose.example` to `.env.compose.local`, then replace the database
passwords, service key and `AUTH_SECRET` with independently generated values.
Passwords embedded in connection URLs must be URL-safe (`openssl rand -hex 24`).

```bash
docker compose --env-file .env.compose.local up --build -d
```

Local access: Next.js at `http://localhost:3000`, API at
`http://localhost:8080`, PostgreSQL at `localhost:5434`. All three published
ports bind to loopback. Stop host development processes using these ports first,
or adjust the port variables. The optional `apps/api/.env` supplies local API
provider settings; Compose overrides the database address to its own service.

## Isolated container tests

The `beautydocs-test` project uses its own database and uploads. The test
overlay disables host provider environment files. With the local settings
created for the test run, the web app is at `http://localhost:3001`, the API at
`http://localhost:8081`, and PostgreSQL at `localhost:5435`.

```bash
docker compose --env-file .env.compose.local -p beautydocs-test \
  -f docker-compose.yml -f docker-compose.test.yml up -d --wait
# Stop the test stack, including the optional Nginx smoke-test container:
docker compose --env-file .env.compose.local -p beautydocs-test \
  -f docker-compose.yml -f docker-compose.test.yml --profile edge-test down
```

The database starts empty; use `/konto` to create a BeautyDocs account. Test
volumes persist after stopping containers. Your host development servers and
production databases are separate.

The optional `edge-test` profile runs the production Nginx configuration on
loopback ports 8082/8443. `BEAUTYDOCS_TEST_EDGE_DIR` points to temporary ACME and
self-signed certificate files for this smoke check. It requires the
`beautydocs.pl` Host/SNI values; it does not change public DNS or request a real
certificate. Use the main web URL above for normal local app testing, since
the local API's allowed origins are configured for localhost.

## Production configuration

Copy `.env.production.example` to `.env.production.local` on the server and
populate every value. Generate new production credentials; use a different
random value for each secret. The MFA key must encode exactly 32 bytes as
URL-safe base64. Keep these files out of Git.

Optionally create `.env.api.production.local` for SMTP, SMS, Google client ID
and other API provider settings, using `apps/api/.env.example` as a reference.
The production overlay does not load the local API `.env` or the web `.env`.
Configure mail/SMS delivery before opening registration and OTP workflows.

The wrapper consistently selects both Compose files and the production env:

```bash
./scripts/compose-production.sh config --quiet
./scripts/compose-production.sh build app api
```

The overlay removes direct app/API/database ports and enables secure-cookie,
HTTPS-origin and production settings. Only Nginx publishes ports 80 and 443.
The private `/internal/` endpoint is blocked at Nginx; all public requests go
through Next.js, which calls FastAPI using the service credential.

## First HTTPS startup

Point `beautydocs.pl` DNS at the server. Ensure ports 80 and 443 reach this
machine and are not already occupied by another server. The configuration
covers the apex domain only, with no wildcard or `www` certificate.

```bash
./scripts/compose-production.sh up -d nginx
./scripts/compose-production.sh run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  --cert-name beautydocs.pl -d beautydocs.pl \
  --email YOUR_CERTIFICATE_EMAIL --agree-tos --non-interactive
./scripts/compose-production.sh restart nginx
./scripts/compose-production.sh up --build -d
```

Before a certificate exists, Nginx serves the HTTP ACME challenge and redirects
other HTTP requests to HTTPS. It needs no application container for certificate
bootstrap. Once the certificate exists it loads HTTPS configuration. Certbot
checks renewal every 12 hours; Nginx detects certificate changes and validates
and reloads its configuration within 60 seconds. No Docker socket is mounted
into either container.

Validate the running deployment and renewal:

```bash
./scripts/compose-production.sh ps
./scripts/compose-production.sh exec nginx nginx -t
./scripts/compose-production.sh run --rm certbot renew --dry-run
curl -I http://beautydocs.pl
curl -I https://beautydocs.pl/admin/login
```

Check login/logout, registration, forms, signatures and uploads through HTTPS.
Nginx permits 16 MB requests and disables proxy response buffering and caching
for application traffic. It replaces forwarded host/protocol/IP headers; this
configuration assumes Nginx is the public edge, without an upstream CDN.

## Updating an existing deployment

```bash
./scripts/compose-production.sh build app api
./scripts/compose-production.sh run --rm migrate
./scripts/compose-production.sh up -d
```

The initial startup also waits for PostgreSQL and applies Alembic before the
API starts. The migration and API services use the same image, with separate
database roles. Each update runs migration explicitly even when a previous
one-shot migration container has already exited successfully.

Database data, uploads and certificates persist in named volumes. `down` keeps
those volumes. Changing password variables does not rotate passwords inside an
already initialized database. Using another Compose project name selects
another set of volumes, so keep the project name consistent for this deployment.
Use a different project name for a separate development installation on the
same Docker host.

Sources: [Compose merging](https://docs.docker.com/reference/compose-file/merge/),
[uv container builds](https://docs.astral.sh/uv/guides/integration/docker/),
[NGINX proxy settings](https://nginx.org/en/docs/http/ngx_http_proxy_module.html),
[Certbot renewal](https://eff-certbot.readthedocs.io/en/stable/using.html#renewing-certificates).

### Google sign-in in the local preview

Set `BEAUTYDOCS_GOOGLE_CLIENT_ID` in `.env.compose.local` to the Google OAuth
**Web application** client ID. Compose passes this public identifier to the API;
no client secret is needed for the existing browser token flow. In Google Cloud,
add the exact frontend origin (for this test stack, `http://localhost:3001`) to
Authorized JavaScript origins. Recreate the API after changing this setting.
The login and owner-registration screens read `/api/beautydocs-preview/auth/google/config`.
Google authentication must still be checked interactively with an authorized account.
