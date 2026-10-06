# Despina Pharma – Website (Next.js 16)

The public website, rebuilt on **Next.js 16.3.8 / React 19**, pixel-for-pixel identical to the
current site: same markup, same CSS, same scroll animations and interactions (they are the
original stylesheets and scripts, unchanged).

## Run

Start the backend first (`../despinapharma-backend`, port 3000), then:

```bash
npm install
cp .env.example .env.local   # BACKEND_URL=http://localhost:3000
npm run dev -- -p 3001       # http://localhost:3001
npm run build && npm start -- -p 3001
```

The browser only talks to this app: `/api/*` is forwarded to `BACKEND_URL` (next.config.ts),
so the login cookie is first-party and there is no CORS. Page URLs keep their trailing slash
via `src/proxy.ts`; `/api/*` is never redirected.

## How it works

| Path | What it is |
|---|---|
| `public/assets/` | Original CSS, animation/interaction JS, fonts, images, JSON – untouched |
| `src/content/pages/<route>/body.html` | Exact `<body>` markup of each of the 1036 pages (+ 404) |
| `src/content/manifest.json` | Per page: title, description, theme colour, favicon, `<body>` id/class, ordered CSS/JS |
| `src/app/[[...slug]]/layout.tsx` | Root layout – renders each page's own `<head>` assets and `<body>` class |
| `src/app/[[...slug]]/page.tsx` | Prerenders every page at build time (SSG); unknown URLs → 404 |
| `src/app/global-not-found.tsx` | The site's own 404 page |
| `src/components/SiteDocument.tsx` | `<html>`/`<head>`/`<body>` exactly like the original |

- All pages are static HTML at build time (`●  SSG`), URLs keep their trailing slash (`/about-us/`).
- Links are normal links (full page loads), exactly like the original, so every page starts its
  scroll animations from the top the same way.

## Updating content

The content comes from the site generator in `../Despina-Pharma-IT-Package/project`:

```bash
cd ../Despina-Pharma-IT-Package/project && node generate.mjs   # regenerate dist/
cd ../../despinapharma-frontend && npm run import-site          # pull it into Next.js
npm run build && npm start
npm run verify-site                                              # check every page matches dist/ exactly
```

`npm run verify-site` compares, for all 1037 pages, the `<body>` markup (byte-for-byte),
`<body>` id/class, the ordered CSS/JS in `<head>`, and the `<title>` with the original files.

## Forms → backend

`src/components/forms/FormConnector.tsx` connects the 4 form pages (contact, new customer
profile, new product profile, sample feedback) to `POST /api/inquiries`, without changing
their markup or styles:

| Page | Form type sent | Linked to |
|---|---|---|
| `/contact/` | `contact` | – |
| `/new-customer-profile/` | `new_customer` | company + website |
| `/new-product-profile/` | `new_product` (or `service` when opened from a service page) | exact catalog item (from the product page it was opened from) and the service |
| `/sample-feedback/` | `sample_feedback` | attachment uploaded securely (`/api/uploads/*`) |

It adds the required privacy consent (+ optional news opt-in) and a hidden anti-spam field,
uses an idempotency key (no duplicates on retry), and shows the reference number
(`DP-INQ-2026-000123`) in the site's own dialog. The texts that said "nothing is sent" are
updated on these pages at runtime.

## Workspace & dashboard (React, `src/app/(app)`)

| Route | Who | What |
|---|---|---|
| `/login/`, `/forgot-password/`, `/reset-password/`, `/accept-invite/`, `/unsubscribe/` | everyone | sign-in (with 2FA code), password, invitations, email opt-out |
| `/portal/` | customers | overview, “waiting for you” (sent quotes, shipped samples) |
| `/portal/projects/[id]/` | customers | stages, add products from the catalog, briefs + versions, sample feedback/approval, accept quotes, documents (upload, download, approve), messages |
| `/portal/account/`, `/admin/account/` | all | profile, password, two-factor (QR), signed-in devices |
| `/admin/` | staff | dashboard numbers, leads per week |
| `/admin/inquiries/` (+ `[id]`) | staff | table + board, filters, CSV export; lead detail: answers, status, assign, notes, reply, tasks, files, emails, timeline, convert to project |
| `/admin/tasks/` | staff | my/all tasks, overdue, reminders |
| `/admin/projects/` (+ `[id]`) | staff | everything above + stage completion (quality gate), samples/revisions, quotes (create, revise, send), owner, tasks |
| `/admin/companies/`, `/admin/contacts/` (+ `[id]`) | staff | details, projects, inquiries, consents, invite customers |
| `/admin/catalog/`, `/admin/content/` | admin, sales | catalog items/categories/sources, services, FAQs, redirects |
| `/admin/users/`, `/admin/audit/` | admin | invite, roles, deactivate, reset 2FA, audit log |
| `/admin/stage-templates/`, `/admin/emails/` | staff | project stages, email queue |

## Still to do

- **Legal text:** the Privacy page and the Project forms page still say form entries are not
  submitted. Despina must rewrite those texts in the site generator.
- Email sending (Resend) is not connected – emails wait in the queue (`/admin/emails/`).
- There is no "Sign in" link in the public site header (kept exactly as designed); add one in
  the generator if wanted, or share `/login/`.
