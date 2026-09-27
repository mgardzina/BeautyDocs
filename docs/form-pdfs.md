# Printable form copies

Owners/staff with existing document access can download a form from its detail view. Clients can download their linked documents from the document dialog. Downloads require `SIGNED` status, recorded client and practitioner signing dates, and client signature records. Pending forms show a disabled button with an explanation; direct download requests return HTTP 409. The **Pobierz PDF** button generates a private A4 attachment; users can print the downloaded file from their PDF viewer.

The renderer is schema-driven and uses the same versioned questionnaire, stored answers, consent wording and signature records as the document detail. It does not map forms to a hard-coded treatment list. The QA fixture covers all 14 current catalogue forms. These downloads are completed document copies, not blank paper templates or interactive PDF fields.

## Design

- A4 portrait, white background, 44 pt side margins, reserved header/footer space.
- Embedded Noto Sans regular/semibold (SIL Open Font License in `public/fonts/pdf/OFL.txt`), including Polish characters. No network font requests.
- Dark body text, restrained green section headings, light separators and a small status summary; usable in grayscale.
- Repeated document identification and page numbers; short answers stay together; long text flows across pages.
- Stored customer and practitioner signatures, recorded timestamps and source document hash where available. The hash identifies the source record, not the newly generated PDF bytes. No claim of a cryptographically signed PDF.
- Treatment maps reuse the same anatomy geometry as the on-screen forms.

## Access and failure behavior

Next.js routes under `.../consumer/documents/[submissionId]/pdf` and `.../admin/tenants/[tenantSlug]/clients/[clientId]/forms/[submissionId]/pdf` reuse the existing authenticated API readers. Client link ownership/revocation and tenant membership checks remain in FastAPI. Signature resources are fetched through those authenticated readers, never through user-supplied URLs. Responses use `private, no-store`. A missing/invalid recorded signature prevents generation instead of being silently omitted. Generated PDFs are not persisted on the server.

The separate legacy `/admin` PDF flow remains available through its existing generator.

## Checks and visual review

```sh
node --import tsx --test lib/beautydocs-pdf.test.ts lib/beautydocs-admin.test.ts
node scripts/api.mjs pytest tests/test_form_print.py tests/test_admin_clients_api.py -q
node scripts/api.mjs scripts.pdf_review_fixtures
node --import tsx scripts/check-form-pdfs.ts
```

The fixture script never connects to the database. Its generated PDFs use explicit test data; intermediates go to `tmp/pdfs`, and the review sample goes to `output/pdf/beautydocs-formularz-przyklad.pdf`. Render generated PDFs to inspect pagination, especially after adding long fields or changing typography.
