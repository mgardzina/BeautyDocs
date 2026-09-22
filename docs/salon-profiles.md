# Salon discovery and public profiles

- `/salony` searches visible, active salons by name, city, introduction and service. Results paginate in groups of 24.
- `/salony/[slug]` displays the salon's public introduction, biography, gallery, informational PLN prices, contact details and location.
- Existing client-directory cards link to the same profile and retain appointment/chat actions. This directory still lists salons with active online forms.
- Owners and administrators edit content in **Ustawienia → Strona salonu**. Staff have read-only access. Publication follows the existing **Dane salonu → widoczność w wyszukiwarce** setting. Hiding or suspending a salon makes its public profile and images return 404.
- Saved salon logos are served through `/api/beautydocs-preview/salons/[slug]/logo` with their original PNG/JPEG/WebP media type, and appear alongside salon names. Visibility checks also protect this endpoint.
- Six images maximum. The browser resizes files; the API decodes and re-encodes JPEG/PNG/WebP uploads as bounded JPEGs, stripping metadata. The first image is the cover. Images persist in the database together with the profile and are served separately from directory JSON.
- Up to 40 services, with prices stored as integer grosze, optional “od” and duration. There is no payment/checkout integration.
- Coordinates are optional and must be supplied as a pair in settings. The profile uses Leaflet with OpenStreetMap tiles, custom price/name markers, zoom controls and a selected-salon card. Attribution remains visible. Google Maps directions open from the route link; Google map rendering would require Google Cloud configuration. Without coordinates, the address and a directions link remain available. Coordinates are not guessed from an address.
- Alembic migration `20260913_0038` adds the `tenants.public_profile` JSONB column after the existing consumer MFA migration. Apply migrations before restarting the API. No existing tenant data is removed.

## Validation

`node scripts/api.mjs pytest tests/test_salon_profiles.py tests/test_admin_tenant_settings.py -q`

`node scripts/api.mjs pytest tests/test_consumer_api.py -k search -q`

`npx tsc --noEmit`

Local deployment uses the existing `beautydocs-test` Compose project. Test records should stay in rollback-only transactions; do not add fabricated listings to public discovery.
