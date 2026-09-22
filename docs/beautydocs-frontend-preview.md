# BeautyDocs frontend previews

The first BeautyDocs 2.0 public configuration flow is opt-in and does not
change the existing PowderBrows root page or host routing.

The opt-in BeautyDocs marketing homepage is available at:

```text
http://localhost:3000/beautydocs-home-preview
```

It links to the shared administration preview and remains `noindex` until the
production `beautydocs.pl` routing, BeautyDocs-only root layout, legal pages,
analytics configuration, and final commercial content are ready.

The production address model is:

```text
beautydocs.pl                         marketing and product entry
app.beautydocs.pl                     login and shared salon panel
forms.beautydocs.pl/<salon>/<form>    public client forms
```

`forms.beautydocs.pl` is a shared application surface, not one subdomain per
salon. It can use the same Next.js/FastAPI deployment while preventing the
host-only administration session cookie from being sent to public form routes.

## Internal API URL

The Next.js server reads the FastAPI base URL from:

```text
BEAUTYDOCS_API_INTERNAL_URL=http://localhost:8080
```

In Next.js development mode the value defaults to `http://localhost:8080`.
There is no default outside development: staging and production must set an
explicit internal API URL.

This is a server-only variable. Do not rename it to a `NEXT_PUBLIC_*` variable
and do not put API credentials or the BeautyDocs internal tenant-header secret
in frontend code. The public frontend sends the validated salon slug as an API
path parameter. It does not override the `Host` header and never sends trusted
internal tenant headers.

## Public form preview routes

With the FastAPI service running, open:

```text
http://localhost:3000/beautydocs-preview/powderbrows
http://localhost:3000/beautydocs-forms-preview/powderbrows
http://localhost:3000/beautydocs-forms-preview/powderbrows/botox
```

The routes request `GET /api/v1/public/tenants/powderbrows` server-side. Replace
`powderbrows` with another valid salon slug and `botox` with a lowercase,
URL-safe active form code. Missing or inactive salons and forms not present in
the active catalogue return the shared BeautyDocs 404 view. API or database
failures return the shared unavailable view.

These routes exist only for incremental development. The production form URL
is `forms.beautydocs.pl/<salon>/<form>`; there are no per-salon subdomains. The
current form route renders the shared start page and checks the selected code
against the tenant's active catalogue. When question rendering is added, form
content must be loaded from the form-specific public endpoint, which must
re-check that the tenant is active and the template is enabled and published.

## Administration preview

The opt-in shared administration panel is available at:

```text
http://localhost:3000/beautydocs-admin-preview
```

After login it links to each authorized salon at
`/beautydocs-admin-preview/<slug>`. The existing PowderBrows `/admin` pages are
unchanged.

Browser authentication calls only same-origin BFF routes under
`/api/beautydocs-preview`. Next.js validates the mutation origin and forwards
requests server-side to FastAPI. The `beautydocs_session` value is accepted only
as a host-only, HTTP-only, SameSite=Lax cookie; HTTPS also requires Secure. It is
never stored in localStorage or returned as a JSON token. Unrelated legacy
cookies are not forwarded to FastAPI.

The overview displays role capabilities returned by FastAPI. These flags are
presentation hints only; FastAPI must still authorize every protected request.

The tenant preview now uses one responsive shell for:

```text
/beautydocs-admin-preview/<slug>                         overview
/beautydocs-admin-preview/<slug>/clients                 searchable client list
/beautydocs-admin-preview/<slug>/clients/<clientId>      client profile
/beautydocs-admin-preview/<slug>/{forms,visits,team,settings}
```

The last four routes are explicit product previews and do not yet mutate data.
The client list supports `search`, `page`, and `pageSize` query parameters. The
search value is empty or 2–80 characters, `page` is 1–500, and `pageSize` is
1–100. Pagination links preserve both the current search and page size.

Browser consumers can use the same-origin read-only BFF routes:

```text
GET /api/beautydocs-preview/admin/tenants/<slug>/clients
GET /api/beautydocs-preview/admin/tenants/<slug>/clients/<clientId>
```

The BFF forwards only the validated BeautyDocs session cookie to the matching
FastAPI routes under `/api/v1/admin/tenants/...`. Responses are parsed against
strict camelCase list/profile contracts before they reach the UI. Invalid
filters fail with 422, missing or cross-tenant client IDs with 404, and upstream
or malformed-response failures with 503. Client detail collections contain at
most the 100 newest visits, notes, and form submissions and expose their full
counts plus a `truncated` flag.

The BFF uses the same server-only `BEAUTYDOCS_API_INTERNAL_URL` described above.
Do not expose this value through a `NEXT_PUBLIC_*` variable. The preview does
not enable production host routing and does not change the legacy middleware.
