# Formrus

Formrus is a backendless, on-chain form platform on Sui.

Website: https://formrus.netlify.app  
In-app Docs: https://formrus.netlify.app/docs

- Form definitions and control logic live in shared Move objects.
- Form schema and responses are stored as Walrus blobs.
- Private responses are encrypted with Seal and decrypted only by authorized wallets.

## Project Architecture

```text
formrus/
├── web/                       # React + Vite product app
│   ├── src/pages/BuilderPage.tsx
│   ├── src/pages/PublicViewPage.tsx
│   ├── src/pages/DashboardPage.tsx
│   └── src/pages/DashboardFormPage.tsx
└── contract/                  # Move package: formrus::registry
    └── sources/formrus.move
```

Main integrations:
- **Sui**: form lifecycle, role/auth, reward pool, eligibility, limits
- **Walrus**: schema + response blob storage
- **Seal**: private payload encryption/decryption authorization flow

## What Makes Formrus Unique

1. **DNA-Uniqueness Per Form**
- each form carries a DNA identity hash
- contract-level uniqueness is enforced in `Registry` (`registered_dnas`)
- prevents accidental identity collisions across forms

2. **Handler Model with Centralized Validation**
- built-in handlers (`submit_and_act*`) are the default execution path
- all built-ins route through shared acceptance logic (`accept_response`)
- keeps validation, limits, expiry, and reward prechecks consistent across submit paths

3. **On-Chain Eligibility + Action + Embed Coupling**
- same form object controls who can submit, what action runs on submit, and how the same runtime can be reused in embedded distribution
- supports anyone / min-SUI / coin-type / object-type gating
- public `/view/:formId` and embeddable `/embed/:formId` stay aligned against the same on-chain schema and policy

4. **Walrus + Schema Versioning**
- schema blob pointer is mutable (`update_schema_blob_id`)
- every update bumps `schema_version`
- each `ResponseAccepted` event records `schema_version` at submission time

5. **Private Response Flow with Seal Authorization**
- private payloads stored encrypted in Walrus
- decryption requires creator/admin auth through `seal_approve`
- keeps decryption rights tied to on-chain roles

6. **Reward Pool Safety Model**
- reward forms must remain funded at submission time
- reward amount becomes locked after first response
- protects submitters from mid-flight reward policy changes

7. **Operational Controls for Live Forms**
- pause/resume, max submissions, expiry extension
- immediate drain or scheduled drain with cancellation path
- creator transfer workflow for team handoff

8. **No Backend Architecture**
- static frontend + Sui + Walrus + Seal only
- no centralized API/service required for core workflow

## Feature Overview

1. **Builder**
- multi-field form creation
- eligibility config (anyone / min SUI / coin type / object type)
- reward/non-reward form modes
- optional expiry and submission limits

2. **Public Form Runtime**
- `/view/:formId` to collect submissions
- public or private response modes
- file/screenshot/video upload fields supported

3. **Embed Runtime**
- `/embed/:formId` for iframe or host-page distribution
- uses the same schema, eligibility, and submission pipeline as the public runtime
- supports host-wallet integration paths for controlled embedded flows

4. **Dashboard**
- wallet-scoped discovery of forms (creator/admin/viewer)
- response queue, private decrypt, CSV export
- form operations: role changes, pool top-up, pause/resume, schema updates, reward/limit updates
- schema blob expiry warning and schema renew flow with selectable Walrus epochs

## Contract Capabilities (Current)

From `contract/sources/formrus.move`:

- register form with DNA uniqueness
- submit via built-in handlers with eligibility enforcement
- reward payout from pool (if configured)
- role management (creator/admin/viewer)
- expiry extension, submission caps, schema version updates
- drain flows (immediate drain or scheduled drain with delay)
- creator transfer flow (propose + accept)

See full contract reference: `contract/README.md`

## Environment

Use `web/.env.example` as template.

Required variables:
- `VITE_SUI_NETWORK`
- `VITE_FORMRUS_PACKAGE_ID`
- `VITE_FORMRUS_REGISTRY_ID`
- `VITE_WALRUS_PUBLISHER_URL`
- `VITE_WALRUS_AGGREGATOR_URL`
- `VITE_WALRUS_EPOCHS`
- `VITE_SEAL_KEY_SERVER_IDS`
- `VITE_SEAL_THRESHOLD`

## Local Development

Prerequisites:
- Node.js `>=22` recommended (current Sui SDK targets modern Node)
- npm

Commands:

```bash
npm install
npm run dev
```

Build + typecheck:

```bash
npm run build
npm run typecheck
```

Build output: `web/dist`

## Deployment

Deploy `web/dist` to static hosting.

Netlify SPA routing is supported via:
- `web/public/_redirects`

## Operations Notes

- Set Walrus epochs high enough for your launch horizon.
- Schema blob can be renewed because form stores a mutable `schema_blob_id`.
- Response blob IDs are immutable per submission event in current contract.
- Keep backup of important schema JSON versions used in production.
