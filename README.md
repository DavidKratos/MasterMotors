# Master Motors

Car workshop workspace with Cloudflare Workers API and a shared Cloudflare D1 database.

## Deployment

Cloudflare Workers Builds deploys `main` using `npx wrangler deploy`.
`wrangler.jsonc` binds the `mastermotors-db` D1 database as `DB` and publishes only `public/`.
`worker.mjs` handles authenticated `/api/*` routes. `schema.sql` describes the tables.
The administrator is provisioned in D1; credentials are not embedded in client JavaScript.

## Persistence and access

Job cards, invoices, customer/vehicle details, rates and settings are saved in D1.
Login creates an HttpOnly, Secure cookie valid for 12 hours; passwords use salted PBKDF2.
Concurrent edits use version checks. Conflicts stop saving and offer an unsaved backup.
The interface polls for remote changes every 20 seconds when no form or save is active.
A network error stops editing and offers retry/export; there is no offline write mode.

Old browser records remain local until explicitly imported under Settings.
Importing a JSON backup replaces the shared workspace; export a backup first.
Browser import adds missing IDs and skips matching IDs. Existing browser backups are retained.
Cloud data is limited to 1.5 MB per workspace snapshot; upgrade the document storage model before larger usage.

The original requested administrator password is weak and was previously shipped in public source history.
Rotate it before storing real customer data. Server-side authentication cannot make a known password secret.
Only the administrator can currently access the shared workshop; staff roles are not implemented.

## Verification

Run `node --test worker.test.mjs`.

Prices are editable. Petromin reference package rates are starting prices excluding GST;
other rates remain labelled samples. No affiliation with Petromin or myTVS.

## Invoice and estimate layout

The reference-style A4 document includes business and customer details, HSN/SAC,
quantity, unit, rate, totals, amount in words, terms, bank details and a blank
authorized-signatory area. Configure private bank and contact details in Settings.
New invoices snapshot the current business settings and job/customer details.
Existing issued invoices retain their original data and totals; missing legacy
fields stay blank. The reference customer and signature are not copied.

Run `node --test invoice.test.mjs` for document-renderer checks.
