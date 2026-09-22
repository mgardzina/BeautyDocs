# Nginx deployment plan: beautydocs.pl

Status: configuration implemented. See [Docker deployment instructions](docker-deployment.md).
No DNS, certificates or public services have been changed.
Nginx will run in Docker Compose alongside BeautyDocs.

## Request path

```text
Browser → https://beautydocs.pl → Nginx → Next.js app:8080
                                            ↓
                                       FastAPI api:8080
                                            ↓
                                       PostgreSQL db:5432
```

Nginx forwards the entire site to Next.js, including `/api/beautydocs-preview/*`
and the preserved `/api/clients` and `/api/consent-forms` contracts. Next.js
continues to authenticate browser requests and call Python over the Compose
network. Do not send public `/api/*` traffic directly to FastAPI: that would
bypass the existing Next.js routes and break their paths and cookie handling.

This follows [Next.js self-hosting guidance](https://nextjs.org/docs/app/guides/self-hosting).

## Compose changes

Add an opt-in production overlay, `docker-compose.production.yml`, keeping
the existing local development stack available.

- Add an Nginx service publishing ports **80 and 443 only**.
- Remove the inherited host port mappings for `app`, `api` and `db` in the
  production overlay; an override must reset these mappings, not append to them.
- Mount reviewed Nginx configuration read-only.
- Add persistent certificate and ACME webroot volumes shared with a Certbot
  service. Nginx reads the certificate volume; Certbot writes it.
- Preserve database and upload volumes and the existing database → migration
  → API → Next.js startup sequence.
- Keep `BEAUTYDOCS_API_INTERNAL_URL=http://api:8080` in Next.js.

## Nginx behavior

- Serve only `beautydocs.pl`; reject unknown hosts. No wildcard or additional
  subdomain is needed for the current `/panel/<salon>` and `/f/<salon>` routes.
- Serve `/.well-known/acme-challenge/` on HTTP for certificate issuance and
  renewal; redirect other HTTP requests to `https://beautydocs.pl`.
- Terminate TLS with a certificate for `beautydocs.pl` and forward to
  `app:8080` on the private network.
- Replace incoming `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto` and client-IP
  forwarding headers with values established by Nginx. The planned topology
  assumes Nginx is the internet-facing edge, with no upstream CDN/proxy.
- Disable proxy response buffering for Next.js streaming. Avoid proxy caching
  authenticated pages, document responses and APIs.
- Allow request bodies up to 16 MB to accommodate signatures and attachments;
  application-specific limits still apply in Next.js and Python.
- Return 404 for `/internal/` at the public edge. Python is not published on
  a host port and its admin data endpoint also requires the service credential.

See the [NGINX proxy module reference](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
for forwarding and buffering behavior.

## Production application settings

The current Compose file explicitly selects local API settings. HTTPS alone
does not change these; the production overlay must set:

```dotenv
BEAUTYDOCS_ENVIRONMENT=production
BEAUTYDOCS_DEBUG=false
BEAUTYDOCS_DOCS_ENABLED=false
BEAUTYDOCS_ALLOW_LOCALHOST_TENANTS=false
BEAUTYDOCS_PUBLIC_WEB_URL=https://beautydocs.pl
BEAUTYDOCS_AUTH_ALLOWED_ORIGINS=https://beautydocs.pl
BEAUTYDOCS_CORS_ALLOWED_ORIGINS=https://beautydocs.pl
AUTH_URL=https://beautydocs.pl
```

Supply production database credentials, `AUTH_SECRET`, the shared server-only
`BEAUTYDOCS_LEGACY_SERVICE_KEY`, and the API's required MFA encryption key.
Keep these outside tracked configuration. Configure SMTP/SMS delivery for the
existing verification flows. Do not copy local secrets into the deployment.

The current Next.js runtime derives its request protocol from
`X-Forwarded-Proto`. Overwriting that header at Nginx and preventing direct
access to Next.js is therefore necessary for HTTPS origin checks. Verify both
BeautyDocs sessions and legacy NextAuth login through the actual proxy.

## Certificate and rollout sequence

1. Point the domain's DNS to the server and make ports 80 and 443 reachable.
2. Start Nginx with an HTTP-only ACME configuration; no missing certificate
   paths should prevent first startup.
3. Run Certbot's webroot challenge for `beautydocs.pl`, with an operator email.
4. Validate and activate the HTTPS configuration, then reload Nginx.
5. Schedule Certbot renewal and reload Nginx after successful renewal; verify
   with a renewal dry run. Persist the certificate volume across deployments.
6. Check HTTPS redirects, login/logout, secure cookies, salon selection, form
   submissions, signatures, attachments and PDFs. Confirm that ports 3000,
   8080 and 5432 are not publicly reachable.

The initial certificate needs working DNS and HTTP reachability; see
[Certbot's webroot instructions](https://eff-certbot.readthedocs.io/en/stable/using.html#webroot).

Before executing the public rollout, identify the target server and certificate
contact email. These are not needed to prepare and review the configuration.
