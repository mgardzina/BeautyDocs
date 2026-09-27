# Product screenshots and videos (`/platforma`)

Everything on `/platforma` is a real recording of BeautyDocs, made on a demo
salon (**Atelier Aurora**) whose people, phone numbers and addresses are all
invented. Re-record after UI changes so the page never shows an outdated product.

## 1. Demo data (once)

The seed also signs forms through the real client + practitioner flows, so the
API must run in `test` mode — in `local` mode with an `SMSAPI` token configured
it would send real SMS messages to the invented numbers (the script refuses).

```bash
BEAUTYDOCS_ENVIRONMENT=test npm run api:dev
```

```bash
cd apps/api && BEAUTYDOCS_ENVIRONMENT=test .venv/bin/python scripts/seed_demo_salon.py
```

The demo owner's sign-in is defined in `apps/api/scripts/seed_demo_salon.py`
(`DEMO_OWNER_EMAIL` / `DEMO_OWNER_PASSWORD`). Signed documents and audit events
are append-only, so the salon cannot be deleted; to start over, rename the old
tenant's slug and set it to `SUSPENDED`, then seed again.

## 2. Record

Needs the Next dev server (`npm run dev`), the API in `test` mode, and Google
Chrome. `playwright-core` drives your installed Chrome and is not a project
dependency:

```bash
npm i --no-save playwright-core
```

```bash
npx playwright-core install ffmpeg
```

```bash
node scripts/platform-media/capture.mjs
```

Pass `shots`, `tour` or `phone` to record one part. Videos are Chrome
screencasts at 2x (phone) / 1.5x (panel) pixel density encoded to VP8 WebM;
the phone run prints chapter timestamps — copy them into
`CLIENT_FLOW_CHAPTERS` in `app/platforma/page.tsx`. Each phone run creates one
more signed form for the fictional client "Laura Mazur" in the demo salon.

## 3. Publish

```bash
apps/api/.venv/bin/python scripts/platform-media/publish.py
```

Screens are captured in Polish. The videos are WebM (VP8): they play in current
Chrome, Edge, Firefox and Safari; very old iOS versions show the poster image.
