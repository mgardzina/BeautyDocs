# BeautyDocs Migration Schedule

**Goal:** Make BeautyDocs the primary app served at `/` (production `localhost:3000` → live domain), with the BeautyDocs marketing home as the root route, and retire the old PowderBrows single-salon app.

**Status:** Planning only — _nothing is deleted yet._
**Owner:** @mgardzina
**Created:** 2026-08-19

---

## 1. Current state (facts, not assumptions)

Verified by inspecting the repo on 2026-08-19.

### Two apps live in one Next.js project

| | Old app (PowderBrows) | New app (BeautyDocs) |
|---|---|---|
| Root route | `app/page.tsx` — treatment form selector | `app/beautydocs-home-preview/page.tsx` |
| Panel | `app/admin/**` (7 pages) | `app/beautydocs-admin-preview/[tenantSlug]/**` |
| Public forms | in-page forms (14 in `app/components/forms/`) | `app/beautydocs-preview/[tenantSlug]/**`, `app/beautydocs-forms-preview/**` |
| API | `app/api/**` — 12 routes, Prisma-based | `app/api/beautydocs-preview/**` BFF → FastAPI |
| Backend | Prisma / same Next process | **FastAPI in `apps/api/`**, expected on `:8080` |
| Auth | NextAuth (`lib/auth`, `app/api/auth/[...nextauth]`) | FastAPI cookie session |
| Theme | Gold + marble (`globals.css`, `tailwind.config.ts`) | Cherry + cream (per-page overrides) |
| Tenancy | Single salon | **Multi-tenant** by `[tenantSlug]` |

### Shared files (the only coupling)

BeautyDocs imports **nothing** from the old app (verified). The apps only share four files:

1. `app/layout.tsx` — Cookiebot loader, Google Analytics, NextAuth `AuthProvider`, PowderBrows metadata, Sora font.
2. `app/globals.css` — sets a **gold/marble body background** and gold color tokens on `:root`.
3. `tailwind.config.ts` — gold palette + font families (now → Sora).
4. `middleware.ts` — guards `/admin` only (NextAuth redirect).

### Why the panel is "not working" right now

Not related to the old app. The panel calls the FastAPI backend at `http://localhost:8080`
(`lib/beautydocs-internal-api.ts`). Nothing is listening there, so every request → "Panel jest
chwilowo niedostępny". **The migration does not fix this by itself — the backend must be running/deployed.**

Local start (needs Postgres): `cd apps/api && uv run uvicorn app.main:app --reload --port 8080`

---

## 2. Migration principles

- **Additive first, destructive last.** Promote BeautyDocs to real routes and verify in production _before_ deleting any PowderBrows code.
- **One reversible step per phase.** Each phase ends in a committable, deployable, working state.
- **No deletion until Phase 6**, and only after the old site has a confirmed replacement/redirect.
- Keep the branch off `main`; ship behind checks.

---

## 3. Phased schedule

Estimates are engineering effort, not calendar time. Sequence the phases; don't parallelize destructive work.

### Phase 0 — Backend is deployable (BLOCKER) · ~1–2 days
The panel cannot work in production until this is done.
- [x] **Local backend running (2026-08-19).** Root cause of "Panel niedostępny": Postgres.app was stopped and `apps/api/.env` pointed at the wrong Postgres (`:5432` EDB install). Fix: started Postgres.app cluster on `:5433` (holds the real `beautydocs` DB — 34 tables @ rev `20260818_0031`, 4 tenants, user data intact), reset the `beautydocs` role password, pointed `.env` at `localhost:5433`. `uv run uvicorn app.main:app --port 8080` → `/health/ready` ok; panel now serves the login page.
- [ ] Stand up FastAPI (`apps/api`) + Postgres in a **hosted** environment (for prod).
- [ ] Set `BEAUTYDOCS_API_INTERNAL_URL` in Next.js prod env.
- [ ] Resolve local machine config: **two Postgres installs** (EDB `/Library/PostgreSQL/18` on `:5432`, Postgres.app on `:5433`). Postgres.app is not auto-start and normally wants `:5432` — pick one canonical local Postgres to avoid this recurring.
**Exit (local):** ✅ panel reaches backend, returns login instead of "unavailable". **Exit (prod):** hosted backend reachable.

### Phase 1 — Root layout & theme become BeautyDocs · ~0.5–1 day
- [x] Replace the marble body background and gold `:root` tokens in `globals.css` with BeautyDocs cream/cherry tokens (see `docs/beautydocs-design-tokens.md`). _Done 2026-08-19 — body → `#fcfaf8`/`#241d21`, shadcn `:root` → cherry/cream, scrollbar → cherry._
- [ ] **Deferred to Phase 2:** move NextAuth `AuthProvider` out of the root layout. It currently wraps every page and its `/api/auth/session` poll 500s on all BeautyDocs pages (local NextAuth misconfig). Can't remove globally without breaking old `/admin`, so scope it to a `/admin` route group when routes move. **Keep the Cookiebot loader** (decision §4.4) and Google Analytics.
- [ ] **Skipped intentionally:** do _not_ repoint `tailwind.config.ts` gold palette yet — only the old app uses those names (`brand`/`emerald`/`marble`); BeautyDocs uses arbitrary hex. Repoint during Phase 6 cleanup. (Sora font already done.)
**Risk (accepted):** old `/` and `/admin` restyle to plain cream — verified they still load/function.
**Exit:** ✅ BeautyDocs home renders in cherry/cream + Sora; old pages still load.

### Phase 2 — Promote BeautyDocs routes (drop `-preview`) · ~1–2 days
Rename preview routes to production URLs (scheme fixed in §4.3) and update **~74 hardcoded links across 49 files**. Done in **verified slices** (real app + data — no bulk find/replace).

**Slice 2a — root swap (DONE 2026-08-19):** ✅
- `beautydocs-home-preview/page.tsx` → `app/page.tsx` (imports fixed for new depth); old PowderBrows selector relocated `app/page.tsx` → `app/powderbrows/page.tsx` (non-destructive, imports fixed).
- 9 inbound `/beautydocs-home-preview` links → `/`; redirect added in `next.config.ts`.
- Verified: `/` = BeautyDocs home, `/powderbrows` = old selector (200), `/beautydocs-home-preview` → 307 → `/`.

**Slice 2b — simple renames (DONE 2026-08-19):** ✅ `konto-preview`→`/konto` (9 links), `zaproszenie`→`/zaproszenie`, `platform-preview`→`/platforma` (2 links), `klient-preview`→`/klient` (4 links). Same-depth, imports unaffected. All 200; redirects added.

**Slice 2c — admin → panel (DONE 2026-08-19):** ✅ `beautydocs-admin-preview/[tenantSlug]/**` → `/panel/[tenantSlug]/**` (whole sub-tree, 40 links). `/panel` correctly 307→`/konto` when unauthenticated; redirect added.

**Slice 2d — public forms → /f (DONE 2026-08-19):** ✅ `beautydocs-forms-preview/**` → `/f/**` (10 links). The orphan duplicate `beautydocs-preview/[tenantSlug]` page route (0 inbound links) was removed (backed up to scratchpad) and redirects to `/f/[tenantSlug]`. **The `/api/beautydocs-preview` BFF (86 usages) was deliberately left untouched** — renaming the internal API namespace is a separate, riskier task; the user-facing route is what moved. Verified `/f/powderbrows` renders the salon's real forms from the backend (proves BFF intact).

**Auth 500 cleanup (DONE 2026-08-19):** ✅ `components/AuthProvider.tsx` guard was stale — it skipped `SessionProvider` for `/beautydocs-*` paths, which no longer exist after the rename, so NextAuth wrapped every page again. Flipped to allow-list `/admin` only (the sole `useSession` consumer; `SessionTimeout` renders only in `app/admin/layout.tsx`). Verified via dev-server logs: **zero `/api/auth/session` requests** on BeautyDocs pages.

**noindex lift (DONE 2026-08-19):** ✅ Marketing pages now indexable (`/`, `/cennik`, `/kontakt`, `/platforma` → `index, follow`); private/app pages kept `noindex` (`/konto`, `/panel/**`, `/f/**`, `/klient`, `/zaproszenie`). Verified via rendered `<meta name="robots">`.

**Still open:**
- [ ] (Optional, separate) rename the `/api/beautydocs-preview` BFF namespace if desired — 86 call sites, must keep BFF routes + callers in sync.
- [ ] Next 16 deprecation: `middleware.ts` → rename to `proxy` convention (surfaced in dev logs; relates to Phase 3 tenant routing).
**Exit:** ✅ every BeautyDocs surface reachable at its final URL; no dead `-preview` links; no auth 500s; marketing indexable.

### Phase 3 — Tenant resolution helper · ~0.5 day (DONE 2026-08-19) ✅
Path-based (§4.3), so no wildcard DNS/host routing is needed now.
- [x] **Already centralized.** `lib/tenant-host.ts` (used in 47 files) exposes `parseBeautyDocsHost`, `isValidTenantSlug`, `isReservedBeautyDocsSubdomain`; panel/forms read `[tenantSlug]` from the path and validate via `isValidTenantSlug` (28 sites). `parseBeautyDocsHost` already supports host-based resolution, so switching to per-salon subdomains later is an isolated change — no route restructure.
- [x] **Next 16 `middleware` → `proxy`:** renamed `middleware.ts` → `proxy.ts` and removed the now-disallowed `export const runtime` (proxy always runs on Node.js). Verified: deprecation warning gone, `proxy.ts` runs on the `/admin` matcher.
  - Note: `/admin` guard logs `[auth] MissingSecret` locally (no `AUTH_SECRET` in local env) → returns 200 instead of redirecting. **Pre-existing**, local-only, affects only the retiring `/admin`; production sets the secret. Dies in Phase 6.
**Exit:** ✅ one tenant-resolution path; subdomains remain a later, low-cost option; no middleware deprecation.

### Phase 4 — SEO, metadata, analytics · ~0.5 day
- [ ] New `app/sitemap.ts`, `app/robots.ts`, `JsonLd` for BeautyDocs.
- [ ] BeautyDocs metadata in root layout (title/OG/manifest/icons).
- [ ] Re-add cookie consent + analytics **for BeautyDocs** if required (GDPR).
**Exit:** correct sitemap/robots/OG for the new product.

### Phase 5 — Staging verification · ~0.5–1 day
- [ ] Full walkthrough on staging: marketing home, sign-up/login, panel (all sections), public form submission, tenant isolation.
- [ ] Confirm backend, auth, and tenant routing under a real domain.
**Exit:** sign-off that BeautyDocs fully replaces PowderBrows functionally.

### Phase 6 — Retire PowderBrows (DESTRUCTIVE, last) · ~0.5 day
Only after Phases 0–5 pass and a domain decision is made (see §4).
- [ ] Delete `app/page.tsx` (old), `app/admin/**`, `app/components/forms/**`, old `app/api/**` (clients, consent-forms, auth/nextauth), `app/cennik`, `app/kontakt`, PB `polityka-prywatnosci`/`regulamin` if replaced.
- [ ] Remove NextAuth: `lib/auth`, `app/api/auth/[...nextauth]`, `AuthProvider`, `/admin` middleware, related deps.
- [ ] Remove PB Prisma models/routes if unused by BeautyDocs.
- [ ] Delete unused `Melodrama-*.woff2` and any PB-only assets.
- [ ] Set up redirects from old PB URLs if the domain is reused.
**Exit:** repo contains only BeautyDocs; build green; no dead imports.

---

## 4. Decisions (resolved 2026-08-19)

1. **Domain — `beautydocs.pl` (new).** BeautyDocs gets its own domain; it does **not** reuse `powderbrowsacademy.com.pl`.
2. **PowderBrows is not a live business site.** The old app runs on GCP and is being upgraded/replaced by this migration — no live business to preserve, so Phase 6 deletion carries no external-site risk (still keep a tagged backup — see §5).
3. **Panel URL scheme — path-based `beautydocs.pl/panel/[tenantSlug]`.** Chosen because routes are already structured around `[tenantSlug]`, it needs no wildcard DNS/TLS, and local dev stays simple. Tenant resolution goes in one helper (`lib/tenant-host.ts`) so a later switch to per-salon subdomains (`salon.beautydocs.pl`) is a middleware change, not a route restructure.
   - `beautydocs.pl/` → marketing home
   - `beautydocs.pl/panel/[tenantSlug]/...` → salon panel
   - `beautydocs.pl/f/[tenantSlug]/[formSlug]` → public client forms (namespaced under `/f` to avoid collision with marketing pages like `/cennik`, `/kontakt`)
   - `beautydocs.pl/konto`, `/zaproszenie` → account/login, invitations
4. **Cookie consent — Cookiebot (external, already in use).** Keep the existing Cookiebot loader; carry it into the BeautyDocs root layout rather than removing it in Phase 1.

### Still to confirm
- **Backend hosting URL.** The GCP deployment exists — confirm the FastAPI base URL and set `BEAUTYDOCS_API_INTERNAL_URL` for prod (and locally). This is the remaining input for Phase 0.

---

## 5. Rollback

Each phase is a separate commit/deploy. Phases 0–5 are non-destructive and revert cleanly.
Phase 6 is the only irreversible step — take a tagged release + DB backup immediately before it,
and keep the pre-deletion commit reachable.

---

## 6. Immediate next action

Phase 0 is the blocker for a _working_ panel. The FastAPI backend already exists on GCP, so the
remaining input is its **base URL** → set `BEAUTYDOCS_API_INTERNAL_URL` (prod, and a local value).
Until the Next.js app can reach the backend, the panel keeps showing "Panel niedostępny" regardless
of any route/theme work. Once the URL is wired, proceed Phase 1 → 6 in order.
