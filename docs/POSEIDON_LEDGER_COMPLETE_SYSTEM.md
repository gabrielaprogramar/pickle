# Poseidon Ledger — Complete System Handbook

> **Version 1.0.0** — a full-stack, read-only architectural audit of the current source
> tree at `D:\ProjetoPLDemo` (the demo / latest version of Poseidon Ledger).
> No source files were modified during this audit. Every statement in this handbook is
> a fact verified against the working tree and the migration files on **2026-08-05/06**.
>
> Companion document: `docs/AUDIT_2026-08-04.md` (the earlier 8-section audit; its
> findings, matrix and verdict are folded into Chapters 1, 16, 17 and 18 here).

---

## Table of Contents

| # | Chapter | Source |
|---|---|---|
| 1 | Executive Summary | written for this handbook |
| 2 | High-Level Architecture | written for this handbook |
| 3 | Folder Structure | written for this handbook |
| 4 | Database & Data Layer | audit chapter |
| 5 | The Compliance Engines | audit chapter |
| 6 | OCR & Document Processing Pipeline | audit chapter |
| 7 | The AI / Assistant System | audit chapter |
| 8 | APIs | audit chapter |
| 9 | The Frontend | audit chapter |
| 10 | Demo Mode & Mock Architecture | audit chapter |
| 11 | External Providers | audit chapter |
| 12 | Settings & Configuration | audit chapter |
| 13 | Authentication & Authorization | audit chapter |
| 14 | Notifications | audit chapter |
| 15 | Testing | audit chapter |
| 16 | Product Status | written for this handbook |
| 17 | Current Limitations | written for this handbook |
| 18 | Future Roadmap | written for this handbook |
| 19 | Developer Quick Start | audit chapter |
| 20 | File Index | written for this handbook |

---

# 1. Executive Summary

Poseidon Ledger is a **maritime intelligence and ESG-compliance platform** built as a
Next.js 14 (App Router) TypeScript application. It is developed as a *demo-first
commercial product*: the entire system — database, file storage, OCR, AI extraction,
AIS data, and email — runs fully mocked by default, boots with zero credentials and
zero network access, and renders a deterministic, "finished product" experience on
first load. Every external dependency is hidden behind a single boolean env flag that
defaults to `true` (mock); flipping a flag to `false` and supplying credentials switches
that module to its live provider with no other code change.

## 1.1 What it does

The product covers the operational, regulatory and intelligence workflows of a ship
manager:

- **Fleet operations** — vessel registry, voyages, live AIS positions and tracks,
  port calls, noon reports with deterministic analysis/validation/correlation.
- **Document intelligence** — a full OCR/document pipeline (upload → OCR → extraction
  → validation → human review → approval), two families of OCR engines (a Google
  Document AI provider seam and a deterministic rule-based OCR assistant), BDN
  ingestion by email webhook, and a review queue with an audit trail.
- **Regulatory compliance engines** (deterministic, parameter-versioned):
  - **FuelEU Maritime** — GHG intensity vs. target curves (91.16 gCO₂e/MJ baseline,
    reduction targets 2%→80% from 2025→2050), surplus/deficit accounting, penalties.
  - **EU ETS** — CO₂ emissions with phase-in factors (40/70/100% for 2024/25/26),
    allowance obligation, surrender deadlines (31 Mar / 30 Sep), mock EUA price feed.
  - **MRV (THETIS-MRV)** — annual report builder with completeness gating and
    XML/CSV export.
  - **SOx ECA watch** — geometric ECA (Mediterranean SOx ECA effective 2025-05-01)
    rules SOX-ECA-01…06, sulphur-content evidence tracking, per-vessel watch state.
  - **Certificates** — status derivation, expiry/survey deadlines (8/20/40-day
    windows), IMO-mismatch guards, supersession.
  - **Verifier packages** — GENERATING → GENERATED lifecycle with sha256 manifest
    and ZIP export.
- **Assistants** — a shared assistant pipeline (deterministic tool execution +
  advisory LLM) powers **8 consoles**: Compliance, Search, Captain, Voyage,
  Maintenance, OCR, Noon, and the general Assistant. The Crew assistant is the only
  one from the architecture doc not implemented.
- **Poseidon Search** — cross-entity search over 12 entity kinds with saved queries,
  rerun, recent/audit trails.
- **Tenancy & settings** — organization profile, users and invites (RBAC, 5 roles),
  notification preferences, appearance, integrations catalog, About/version panel.
- **Authentication** — a complete mock auth flow (login/logout/session/forgot/
  reset) with deterministic password hashing, 12h session tokens, and route guards on
  auth + settings.
- **Notifications** — ~41 event types, a single dispatcher write path, per-type
  preferences, deadline/compliance alert services, and HTML email templates (mock
  email provider).

## 1.2 Status verdict

Derived from `docs/AUDIT_2026-08-04.md` and re-verified for this handbook:

| Axis | Assessment |
|---|---|
| Implementation vs. architecture docs | **~90%** complete |
| Demo readiness | **~95%** (one-click, deterministic, zero-credential) |
| Maturity class | **B** — a stable, feature-complete demo with well-defined production gaps |
| Blocking defects | none (typecheck clean in production code; 9 errors confined to 2 test files) |
| Known gaps | no org-wide immutable `audit_log`; no monitoring-plan table/UI; Crew assistant missing; real providers are stubbed |

## 1.3 Scale at a glance (verified counts)

| Dimension | Count |
|---|---|
| Database migrations | 17 (`supabase/migrations/0001…0017`) |
| Tables (CREATE TABLE in migrations) | 50 |
| Index statements | 124 |
| Migrations enabling RLS | 15 of 17 (0009, 0013 none) |
| CREATE POLICY statements | 0 (RLS is defined but never exercised at runtime) |
| Repository modules | 45 (`src/lib/supabase/repositories/`) |
| `Database` type lines | 2,043 (`src/lib/supabase/types.ts`) |
| Fake client lines | 712 (`src/lib/supabase/fake-client.ts`) |
| Demo seed lines | 1,131 (`src/lib/supabase/demo-seed.ts`) |
| API route files | 87 (`src/app/api/**/route.ts`) |
| HTTP endpoints | ~109 across 19 logical groups / 26 route directories |
| Client pages | 31 (`src/app/**/page.tsx`) |
| Hook modules | 26 (+ barrel) |
| Component files | 41 |
| Map components / geo modules | 6 / 4 |
| Lib module directories | 35 (`src/lib/*`) |
| Test files | 150 (139 lib, 7 app/api, 4 services) |
| Compliance engines | 10 modules under `src/lib` |
| Assistant consoles | 8 (7 in architecture doc + Noon) |
| Notification event types | ~41 |

## 1.4 Demo readiness

- One-click login (`/login` → "Enter demo workspace") using the single source of
  truth in `src/constants/demo.ts` (credentials can never drift between button and seed).
- Deterministic, time-relative seed (`demo-seed.ts`): 5 vessels, 12 ports, 11 voyages,
  42-point AIS tracks, 14 noon reports, 9 fuel deliveries, 17 fuel types, 22 documents,
  9 review tasks, 12 certificates, 5 SOx watch states, 10 FuelEU + 5 EU ETS records,
  3 MRV reports, 8 compliance reports, 3 verifier packages, 2 environmental zones,
  5 zone events, 7 port calls, 20 notifications, 3 conversations / 6 messages, and
  4 knowledge documents — all rendered identically per process.
- Assistant consoles run against pinned deterministic states, so every demo scenario
  is reproducible.
- Settings → Integrations already shows all 5 providers as `CONNECTED` (mock).

## 1.5 Known gaps (summary — detailed in Chapters 16–17)

1. **No org-wide immutable audit log.** There are several audit-shaped tables
   (`review_audit_log`, `email_ingestion_log`, search `AUDIT_EVENTS`), but no single
   append-only `audit_log` capturing all domain changes.
2. **No monitoring-plan table/UI** (MRV / DCS monitoring plan requirement is
   referenced in notifications but not modeled).
3. **Crew assistant** declared in the assistant architecture is not implemented.
4. **Live providers** (Postgres, Supabase Storage, Google DocAI, OpenAI,
   MarineTraffic, Resend) are real but unprovisioned; the runtime is mock by default.
5. **Two `apiError` helper signatures** with swapped argument order
   (`src/app/api/_lib/http.ts` vs `src/lib/api/helpers.ts`).
6. **9 typecheck errors** in two test files only (zero in production code).

---

# 2. High-Level Architecture

## 2.1 Layered view

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  BROWSER  (client components — every page is "use client")                     │
│                                                                            │
│  pages → hooks (useX) → fetch("/api/…") → apiFetch unwrap {data}           │
│  AuthGate + useAuth (route protection, module-level listener sync)         │
│  navigation.ts (single nav source) · map = lazy Leaflet + CARTO tiles      │
│  hand-rolled SVG charts · per-page status→BadgeVariant maps                │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │  HTTP  /api/*
┌──────────────────────────────────────▼──────────────────────────────────────┐
│  API ROUTES  (src/app/api/**/route.ts — 87 files, ~109 endpoints)           │
│                                                                            │
│  zod schemas (_lib/schemas.ts + route-local) → 400 VALIDATION_ERROR         │
│  DI via factory deps (createDefaultDeps / build…ApiDeps)                    │
│  auth guards only on auth + settings (requireAuth/requirePermission)        │
│  envelope { success, data } | { success:false, error:{code,message,details}}│
│  error mapping: central mapErrorResponse, or local try/catch (constructor.name)
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │  factory functions (repos injected)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│  DOMAIN LAYER  (src/lib/** — services & deterministic engines)              │
│                                                                            │
│  fueleu · eu-ets · eua-price · mrv · sox-eca · certificates                │
│  noon-report · fuel-delivery · verifier-package · reporting · review       │
│  assistant/* (shared pipeline) + 8 assistant modules                       │
│  settings · auth · roles · notifications (dispatcher) · search-assistant   │
│  validation · ocr-assistant · email-ingress · geo · map · integrations     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │  repositories (45 modules)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│  DATA LAYER  (src/lib/supabase)                                             │
│                                                                            │
│  repositories → getSupabaseClient()                                        │
│    SUPABASE_USE_MOCK=true  →  fake-client.ts (in-memory)                   │
│                              seeded by buildDemoSeedTables()                │
│    SUPABASE_USE_MOCK=false →  @supabase/supabase-js real client             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
    ┌───────────────┬──────────────────┴───────────────────┬─────────────────┐
    ▼               ▼                                      ▼                 ▼
Postgres 17      MarineTraffic      Google DocAI /         Supabase Storage /
17 migrations     (mock transport)  OpenAI (mock providers)  Resend (mock only)
50 tables,        jsono fixtures    deterministic fixtures   email-ingress
124 indexes, RLS                      → validation (v2.0.0)
```

## 2.2 The mock-first runtime seam (one flag per provider)

The single most important architectural decision: **every external dependency is
swappable with a single boolean flag that defaults to `true`**.

| Flag | Default | Live provider behind the flag |
|---|---|---|
| `MARINETRAFFIC_USE_MOCK` | `true` | MarineTraffic Voyage Forecast + Port Calls API |
| `SUPABASE_USE_MOCK` | `true` | Postgres via `@supabase/supabase-js` |
| `STORAGE_USE_MOCK` | `true` | Supabase Storage bucket |
| `OCR_USE_MOCK` | `true` | Google Document AI (requires `GOOGLE_OCR_ENABLED=true` too) |
| `AI_USE_MOCK` | `true` | OpenAI `gpt-4o` chat completions |
| `VALIDATION_USE_MOCK` | `true` | validation provider seam |

Contract (`.env.example` lines 1–6): *"Both modules run fully mocked by default — no
secrets required to compile, boot, or run the unit tests."*

Each config module shares the same shape: `parseBoolean(value, fallback)`; the only
hard error is `useMock === false` with missing credentials (typed config errors:
`SupabaseConfigError`, `ConfigurationError`, `StorageConfigError`, `GoogleOcrConfigError`).
Providers are cached singletons with `_reset*ForTest()` escape hatches. Repositories and
services never construct providers — they receive typed clients through factory
functions, which is exactly why DI and fakes in tests are trivial.

## 2.3 Request lifecycle (what happens when a page loads)

1. A client page mounts a hook (e.g. `useVessels`) → `fetch("/api/vessels")`.
2. The route handler validates query/body (zod or manual), then builds dependencies
   via a factory (`createDefaultDeps()` in `_lib/deps.ts`, or per-group
   `buildDefault…ApiDeps()`).
3. The handler calls a repository directly (thin routes) or a service (business
   logic routes). Services encapsulate all deterministic rules and call
   repositories + the notification dispatcher.
4. Repositories call `getSupabaseClient()` — mock mode returns the fake client
   seeded from the demo dataset; live mode returns the real Supabase client.
5. The result is returned in the `{ success, data }` envelope (or the
   `{ success:false, error }` envelope with a stable `code`).

There is **no DI container**: dependencies are constructed per request at the top of
each handler. Some routes build module-level singletons (`_service.ts` with
`get…Service()` + `reset…ServiceForTest()`).

## 2.4 Deterministic core + advisory AI

The AI system is deliberately split (detailed in Chapter 7):

- **Deterministic core** — 15 structured tools perform the real work
  (voyage gap analysis VCR-01/02/03/05, SOx rule evaluation, certificate status,
  noon-report correlations, FuelEU/EU ETS/MRV math, OCR field extraction,
  review-task scheduling). No LLM is involved; outputs are reproducible.
- **Advisory LLM** — when intent confidence allows, a provider (mock GPT-4o by
  default) drafts the natural-language answer, but every response passes a safety
  validator (`STANDARD_DISCLAIMER` injection, `checkForMathLeak` guardrail) and is
  treated as advisory. `router.ts` classifies 7 intents (REGULATORY, COMPLIANCE,
  VOYAGE, DOCUMENT, SEARCH, CAPTAIN, UNKNOWN) with keyword-confidence ≥ 0.3.
- **Handoffs** — the Compliance assistant hands off to a human at confidence > 0.5;
  the Captain and Voyage assistants escalate on blocking/CRITICAL conditions.

## 2.5 Engines & parameter versioning

Compliance modules are deterministic engines with **versioned parameters** rather
than hard-coded constants scattered through components:

- `CURRENT_PARAMETER_VERSION = "2025.1"`; `BASELINE_GHG_INTENSITY_GCO2E_PER_MJ = 91.16`;
  reduction targets 2 / 6 / 15 / 31 / 62 / 80% for 2025/30/35/40/45/50;
  `computeTargetIntensity(year) = 91.16 × (1 − reduction_pct)` → 89.3368 for 2025.
- LHV registry (40.5 MJ/kg for HFO/VLSFO/ULSFO/bio_HFO); EU ETS phase-in rates
  0.40/0.70/1.00; mock EUA price €75.50.
- Rules are labeled and traceable (e.g. SOX-ECA-01…06), so an auditor can map a
  violation to the exact rule that produced it.

## 2.6 Auth & RBAC

- **Mock auth seam** (`src/lib/auth`): full login/logout/session/forgot/reset flows
  against `auth_tokens` + `organization_users`. Passwords use a *deliberately
  non-production* deterministic hash `mock$v1$<8-hex>` (djb2-style, fixed salt
  `poseidon-ledger::phase-4.5`); `verifyPassword` rejects any value without the
  `mock$v1$` prefix so a real hash can never silently pass. Session tokens are
  SHA-256-hashed at rest; `SESSION_TTL_MS = 12h`, `PASSWORD_RESET_TTL_MS = 1h`.
- **RBAC** (`src/lib/roles/catalog.ts:40-198`): 5 roles with ranks
  (owner 50 > administrator 40 > compliance_manager 30 > fleet_manager 20 >
  viewer 10); 17 permission codes; `can(role, permission)` is the *only* enforcement
  entry point; `mayManageUser` requires strictly-greater rank.
- **Enforcement**: only auth + settings route groups read the `pl_session` cookie
  and check permissions (401/403). The rest of the API is unauthenticated by design
  and uses explicit identity parameters (e.g. `recipient_id`, `user_id`).

## 2.7 Notifications — single write path

`createNotificationDispatcher` is the only place notifications are inserted and
emails sent: preference gate → insert → optional email (failures never fail
dispatch) → `{ notificationId, emailSent }`. It is wired into the SOx, certificate
and noon API service builders with per-domain `templateFormatter`s
(`formatSox`/`formatCertificate`/`formatNoon`). ~41 event types are declared in
`src/lib/notifications/types.ts`.

## 2.8 Error handling & envelopes

- Success: `{ success: true, data: <shape> }` (or a raw shape for a few read-only
  endpoints). Lists use `Page<T> = { rows, limit, offset, total }` when paginated.
- Failure: `{ success: false, error: { code, message, details? } }`. Codes are
  stable strings (e.g. `VALIDATION_ERROR`, `NOT_FOUND`, `RATE_LIMITED`).
- Two mapping strategies coexist: a central `mapErrorResponse` →
  `httpStatusForError` (constructor-name based) used by most handlers, and local
  `try/catch` blocks used by auth/settings/noon/sox/certificates/OCR/documents.
  `RateLimitError` sets `Retry-After`. There is no shared error boundary — the
  per-route `catch` *is* the boundary.

## 2.9 Known architectural inconsistencies (documented, not fixed)

- Two envelope helpers with **swapped** `apiError` argument order
  (`src/app/api/_lib/http.ts:30 apiError(code, message, status)` vs
  `src/lib/api/helpers.ts:37 apiError(message, status, code)`).
- `apiPaginated` is defined but unused; paginated collections return `Page<T>`.
- A handful of raw (non-enveloped) responses: track, port-calls, zone-events,
  map-config, environmental-zones, search POST/rerun, downloads.
- The notifications API takes `recipient_id` as an explicit parameter instead of
  using the auth guards — a deliberate asymmetry vs auth/settings routes.
- Mixed sync vs `Promise` route params across dynamic routes.

---

# 3. Folder Structure

Annotated map of the repository (`D:\ProjetoPLDemo`). Depth is trimmed to keep the
high-signal parts readable; see Chapter 20 for the file index.

```
ProjetoPLDemo/
├─ .env.example               # all mock flags; "no secrets required" contract
├─ package.json               # scripts: dev/build/start/lint/typecheck/test/test:<mod>/verify:mt
├─ tsconfig.json / next.config.* / tailwind.config.* / vitest.config.ts
├─ node-runtime/              # vendored Node v22.16.0 win-x64 (no global install needed)
├─ public/                    # static assets, logos
├─ docs/                      # AUDIT_2026-08-04.md, AI_ASSISTANT_ARCHITECTURE.md,
│                             # PHASE-2A.1-SUMMARY.md, this handbook
├─ scripts/
│  └─ verify-marinetraffic.ts # npm run verify:mt — E2E smoke (no key/network)
├─ supabase/
│  └─ migrations/
│     ├─ 0001_init_core_schema.sql … 0008_*.sql     # core + documents + OCR
│     ├─ 0009_certificates.sql        # (no RLS)
│     ├─ 0010_*.sql                  # FuelEU / EU ETS / MRV / SOx
│     ├─ 0011_init_reporting_and_notifications.sql  # compliance_reports,
│     │                                            # verifier_packages, notifications,
│     │                                            # notification_preferences
│     ├─ 0012_*.sql … 0016_*.sql      # review, zones, ai, integration credentials
│     └─ 0017_init_organizations_auth.sql           # orgs, users, roles, auth_tokens (RLS)
└─ src/
   ├─ app/
   │  ├─ layout.tsx                  # fonts (Cormorant/DM Sans/DM Mono), dark theme, MainLayout
   │  ├─ globals.css
   │  ├─ page.tsx                    # Dashboard
   │  ├─ fleet/  fleet/[imo]/        # Fleet list + vessel detail
   │  ├─ voyages/  voyages/[id]/     # Voyages list + detail
   │  ├─ ais/                        # live AIS grid
   │  ├─ documents/  documents/[id]/ # document pipeline UI
   │  ├─ review/  review/[id]/       # Human Review Queue
   │  ├─ ocr/                        # OCR quality dashboard
   │  ├─ compliance/                 # SOx watch + reports + verifier packages
   │  ├─ compliance-assistant/  assistant/  search/  captain/
   │  ├─ voyage/  maintenance/  noon/
   │  ├─ analytics/
   │  ├─ settings/  (+ users, organization, notifications, integrations, appearance)
   │  ├─ login/  forgot-password/  reset-password/
   │  ├─ dnv/  marinetraffic/        # ComingSoon placeholders
   │  └─ api/                        # 87 route.ts — see Chapter 8
   │     ├─ _lib/                    # http.ts (apiError/Page/httpStatusForError),
   │     │                           # errors.ts, cookies.ts, schemas.ts, deps.ts
   │     ├─ auth/  settings/  notifications/  vessels/  voyages/  voyage/
   │     ├─ ais-positions/  dashboard/  analytics/  fuel-types/  fuel-deliveries/
   │     ├─ documents/  review-tasks/  ocr/  reports/  verifier-packages/
   │     ├─ certificates/  sox-watch/  environmental-zones/  map-config/
   │     ├─ assistant/  captain/  maintenance/  search/
   │     └─ ingest/  webhooks/email/resend/
   ├─ components/
   │  ├─ ui/                         # shadcn-style Radix primitives (14 files)
   │  ├─ layout/                     # sidebar.tsx, main-layout.tsx, header.tsx
   │  ├─ auth/                       # auth-gate.tsx (AUTH_PATHS), auth-shell.tsx
   │  ├─ map/                        # 6 map components (lazy Leaflet)
   │  ├─ notifications/  sox/  certificates/  ocr/  reports/  settings/  shared/
   │  └─ (root) data-table, search-bar, pagination-controls, loading-table,
   │           page-header, error-banner, empty-state
   ├─ hooks/                         # 26 hook modules + index.ts barrel (useX contract)
   ├─ services/                      # 17 service modules + index (apiFetch client)
   ├─ lib/                           # 35 module directories — see Chapter 20
   │  ├─ supabase/                   # config, client, fake-client, demo-seed, types,
   │  │  └─ repositories/            # 45 repository modules
   │  ├─ fueleu/ eu-ets/ eua-price/ mrv/ sox-eca/ certificates/ noon-report/
   │  ├─ fuel-delivery/ verifier-package/ reporting/ review/ validation/
   │  ├─ assistant/  + captain-assistant/ voyage-assistant/ noon-assistant/
   │  │   maintenance-assistant/ search-assistant/ compliance-assistant/
   │  ├─ ocr/ ocr-assistant/ ai/ storage/ marinetraffic/ email-ingress/
   │  ├─ auth/ roles/ settings/ integrations/ notifications/
   │  ├─ geo/ map/ utils/ api/
   ├─ constants/                     # navigation.ts, routes.ts, demo.ts
   └─ types/                         # shared TS types
```

## 3.1 The five-source-of-truth rule

Five single-source-of-truth files keep the app internally consistent — worth
remembering before editing anything:

| Concern | File | Why it matters |
|---|---|---|
| Navigation tree | `src/constants/navigation.ts` | sidebar + header consume it; 2 disabled items |
| Route keys | `src/constants/routes.ts` | every `href` flows through `ROUTES` |
| Demo credentials/IMO | `src/constants/demo.ts` | login button and demo seed can never drift |
| RBAC | `src/lib/roles/catalog.ts` | `can()` is the only enforcement entry point |
| Demo dataset | `src/lib/supabase/demo-seed.ts` | the fake DB is seeded from here per process |

---

# 4. Database & Data Layer


> Scope: the Postgres schema (`supabase/migrations/`, 17 files, 50 tables) and the TypeScript
> persistence layer that sits in front of it (`src/lib/supabase/`, including 45 repository
> modules, a hand-written `Database` type, an in-memory fake client, and a deterministic demo
> seed). The app runs in **mock mode by default** (`SUPABASE_USE_MOCK=true`), so in practice the
> "database" seen by every screen is the fake seeded from `demo-seed.ts`, not a real Supabase
> project. All statements below are facts read from the source on 2026-08-05; items that could
> not be verified are flagged `(not verified)`.

---

## Overview

- **Schema location:** `supabase/migrations/0001_init_ais_schema.sql` … `0017_init_organizations_auth.sql`
  (exactly 17 files, applied in numeric order). The schema evolves by new migrations only; several
  migrations `ALTER` earlier tables (`0010` redefines `documents` checks; `0008` adds
  `vessels.gross_tonnage`; `0015` adds `review_tasks.reason_code`).
- **Table count:** 50 `CREATE TABLE` statements across the 17 files (verified by scan). No views,
  no functions beyond the `updated_at` triggers, no RPCs. `Functions/Views/Enums/CompositeTypes`
  are declared empty in the type layer (`types.ts:2185-2188`).
- **Primary keys:** UUID v4 everywhere, defaulted via `gen_random_uuid()` (the `pgcrypto`
  extension is enabled in `0001`; Supabase provides it). Server-managed audit columns
  `created_at` / `updated_at` (`timestamptz`) are consistent conventions.
- **Timestamps:** ISO-8601 UTC strings (`timestamptz`); dates are stored as date/`date`-like
  strings on the registry tables. The whole system is single-tenant in mock mode (one org id
  `org-poseidon`), with an org/auth shell that is schema-only for now.
- **Access pattern:** service-to-service writes. The service role key (RLS bypass) is used
  server-side; repositories are the only persistence API; the app's domain logic reads/writes
  through the 45 repository modules.
- **Test posture:** README documents "17 unit tests" for the original Phase 1B set
  (vessels 6, voyages 5, ais_positions 6 — `src/lib/supabase/README.md:14-15`), but the suite
  has since grown to **26 repository test files** plus a shared `_fakeClient.ts`
  (`src/lib/supabase/__tests__/`), all running against the in-memory fake with no network.

---

## 1. Migration catalogue

### 0001 — `0001_init_ais_schema.sql` (AIS / voyage foundation)
- Enables `pgcrypto`. Creates `vessels`, `voyages`, `ais_positions`.
- `vessels`: `imo char(7)` with `CHECK (imo ~ '^[0-9]{7}$')` + `UNIQUE`; nullable `mmsi`,
  `ship_id`, `gross_tonnage` (the latter added later by 0008). `touch_updated_at()` function +
  `vessels_touch_updated_at` trigger keep `updated_at` honest.
- `voyages`: nullable `arrival_time`; CHECKs `voyages_has_timestamp`, `voyages_time_order`
  (departure ≤ arrival), `voyages_distance_nonneg`.
- `ais_positions`: CHECKs for lat `[-90,90]`, lon `[-180,180]`, `sog >= 0`, `cog`/`heading`
  `[0,360)`; `ais_positions(vessel_id, ts DESC)` index ("latest fix for a vessel" is an
  index-only lookup) and `voyages(vessel_id, departure_time DESC)` composite index
  (per README + scan of 124 index statements).
- RLS enabled here (3 RLS statements in this file).

### 0002 — `0002_init_document_domain.sql` (document processing pipeline)
- Creates `documents`, `document_versions`, `processing_jobs`, `ocr_results`,
  `document_entities`, `processing_logs`, `review_tasks`, `document_relationships`.
- 18 CHECK constraints: `documents_type_check` (later redefined in 0010 to add `'bdn'`),
  `documents_status_check`, `documents_file_size_nonneg`, `processing_jobs_type_check`
  (`ocr|entity_extraction|validation|classification`), `processing_jobs_status_check`,
  `processing_jobs_time_order`, `ocr_results_confidence_range`, `document_entities_type_check`,
  `document_entities_confidence_range`, `document_entities_offset_check` (+`_order`),
  `processing_logs_level_check`, `review_tasks_status_check`, `review_tasks_priority_check`,
  `document_relationships_type_check`, `document_relationships_no_self_ref`.
- Reuses `touch_updated_at()` for `documents` and `review_tasks`. 8 RLS statements.

### 0003 — `0003_init_ai_extractions.sql`
- `ai_extractions`: `status` CHECK `pending|completed|failed|unknown_document`; `confidence`
  `DOUBLE PRECISION` `[0,1]`; token counters + `provider`/`model` metadata. Own
  `update_ai_extractions_updated_at()` function + trigger. 1 RLS statement.

### 0004 — `0004_init_validation_reports.sql`
- `validation_reports`: `status` CHECK `pending|passed|warning|failed|error`; `score` `[0,100]`;
  `rule_results` JSONB; pass/fail/error/warning counters; `ready_for_review` boolean; own
  updated_at trigger. 1 RLS statement.

### 0005 — `0005_init_review_audit_log.sql`
- `review_audit_log`: append-only reviewer audit trail; `action` CHECK with 10 values
  (`approved|rejected|needs_changes|escalated|field_approved|field_rejected|field_edited|field_uncertain|comment_added|assigned`);
  `previous_value`/`new_value` JSONB. 1 RLS statement.

### 0006 — `0006_init_fuel_deliveries.sql` (fuel domain)
- `fuel_types`: reference table; `category` CHECK
  `residual|distillate|alternative|biofuel|lng|lpg|methanol|hydrogen|ammonia|other`;
  `co2_factor`, `sox_factor`, `pm_factor`, `density_default`, `is_drop_in`.
- `fuel_deliveries`: `quantity_mt NUMERIC(12,3) CHECK (> 0)`; `density_kgm3 NUMERIC(6,1) CHECK (> 0)`;
  `sulphur_content_pct NUMERIC(5,3) CHECK [0,10]`; `status` CHECK
  `pending|verified|reconciled|disputed|rejected`; nullable `ocr_result_id`,
  `ai_extraction_id`, `bdn_reference`, `reconciled_voyage_id`.
- `reconciliation_log`: `match_type` CHECK `auto|manual|override|break`;
  `match_confidence NUMERIC(5,2)` `[0,100]`. 2 RLS statements.

### 0007 — `0007_init_fueleu.sql`
- `fuel_eu_records`: `reporting_year CHECK (>= 2025)`; `status` CHECK `draft|final|superseded`;
  `surplus_or_deficit` CHECK `surplus|zero|deficit`; energy/emissions aggregates `NUMERIC`;
  biofuel/fossil split; `iscc_missing_flag` + `iscc_missing_details`; `ops_energy_mj` +
  `ops_data_available`; `penalty_exposure_estimate` + `penalty_formula_version`. 1 RLS statement.

### 0008 — `0008_init_eu_ets_and_mrv.sql`
- `ALTER TABLE vessels ADD COLUMN gross_tonnage` (populated in the demo seed).
- `eu_ets_records`: `reporting_year CHECK (>= 2024)`; `ets_scope`/`mrv_scope` CHECK
  `IN_SCOPE|OUT_OF_SCOPE|UNKNOWN_DATA`; `gt`; coverage rate + version; `eua_obligation_tonnes`;
  `eua_price_eur` + `eua_price_available`; `estimated_cost_eur`; `surrender_deadline` +
  `surrender_status` CHECK `OK|WARNING|URGENT|OVERDUE`; `mrv_deadline` + `mrv_deadline_status`
  same enum; `calculation_details` JSONB.
- `mrv_reports`: `reporting_year CHECK (>= 2024)`; `status` CHECK
  `draft|validated|blocked|exported|superseded`; `completeness_status` CHECK
  `VALID|WARNING|BLOCKED`; `checklist_status` CHECK `PASS|WARNING|BLOCKED`; `export_format` CHECK
  `xml|csv`; `methodology` CHECK `default|alternative`; total voyages/fuel/CO₂ aggregates;
  `ets_record_id` FK. 2 RLS statements.

### 0009 — `0009_init_map_and_zones.sql`
- `environmental_zones`: `category` CHECK `ECA_SOX|ECA_NOX|SECA|PSSA|MED_BALLAST|PORT_CONTROL`;
  geometry split into `geometry_type` + `geometry_coordinates` JSONB; `regulation_reference`,
  `jurisdiction`, `effective_from/until`, `is_active`, `geometry_version`.
- `port_calls`: `port_name`, `port_id`, `port_country`, lat/lon, `arr_ts`/`dep_ts`, `is_mock`,
  `source`, `source_fetched_at`.
- `zone_events`: `event_type` CHECK `ENTRY|EXIT|WITHIN|ALERT`; `entry_ts`/`exit_ts`,
  `duration_minutes`, `coordinates`/`details` JSONB, `calculation_version`.
- `vessel_tracks`: denormalized track polyline (`track` JSONB), `point_count`, `distance_nm`,
  `start_ts`/`end_ts`, `calculation_version`; UNIQUE `(vessel_id, voyage_id)` (upsert target).
- `map_config`: single-row map provider config (provider, tile URL/attribution, center/zoom,
  `is_mock`).
- **Note:** this migration contains **no** ROW LEVEL SECURITY statements (the other migration
  files do) — see §7.

### 0010 — `0010_init_email_ingestion.sql`
- `ALTER TABLE documents ADD COLUMN source_channel TEXT NOT NULL DEFAULT 'MANUAL'` + CHECK
  `MANUAL|EMAIL`; **drops** `documents_type_check` and re-adds it **including `'bdn'`** (the
  Bunker Delivery Note type) alongside the original types.
- `email_ingestion_log`: append-only (comment states no UPDATE trigger); `event` CHECK 8 values
  `EMAIL_RECEIVED|ATTACHMENT_ACCEPTED|ATTACHMENT_REJECTED|DUPLICATE_DETECTED|DOCUMENT_CREATED|PROCESSING_QUEUED|PROCESSING_STARTED|PROCESSING_FAILED`;
  `message_id`, sender/recipient/subject, `imo`/`vessel_id`/`document_id`. 1 RLS statement.

### 0011 — `0011_init_reporting_and_notifications.sql`
- `compliance_reports`: `report_type` CHECK `thetis_mrv|fueleu|green_zone|fleet_summary|esg_package`;
  `status` CHECK `DRAFT|READY|GENERATED|SUBMITTED|VERIFIED|REJECTED|FAILED`; `vessel_ids` JSONB
  for fleet-level reports; storage/checksum/content JSONB.
- `verifier_packages`: `status` CHECK `DRAFT|GENERATING|GENERATED|FAILED`; `manifest`,
  `validation_result` JSONB; `package_version`.
- `notifications`: `severity` CHECK `INFO|MEDIUM|HIGH|CRITICAL`; `recipient_id`,
  `organization_id`, `payload` JSONB, `is_read`/`read_at`, `source_event`/`source_id`.
- `notification_preferences`: `recipient_id` + nullable `notification_type` (a `NULL` type =
  global default), UNIQUE `(recipient_id, notification_type)` (upsert target). 4 RLS statements.

### 0012 — `0012_init_ai_assistant.sql`
- `knowledge_documents`: `source` CHECK 6 values
  `eu_ets_directive|fueleu_regulation|thetis_mrv_guidance|marpol_annex_vi|fueleu_guidance|poseidon_policy`;
  `regulation` CHECK 5 values `EU_ETS|FuelEU|THETIS_MRV|MARPOL|POSEIDON`; `article_section`,
  `effective_date`, `version`, full `content` text.
- `knowledge_chunks`: **`embedding vector(384)`** (pgvector — the only vector column in the
  schema; no extension `CREATE` was found in the migration, `(not verified)` whether the
  extension is enabled elsewhere).
- `assistant_conversations`: `status` CHECK `ACTIVE|ARCHIVED|DELETED`; `model_id`,
  `prompt_version`.
- `assistant_messages`: `role` CHECK `system|user|assistant|tool`; `tool_status` CHECK
  `pending|running|success|error`; `citations` JSONB array.
- `assistant_tool_calls`: append-only tool-call audit (`tool_input`/`tool_output` JSONB,
  `success`, `permission_granted`, `latency_ms`).
- `assistant_evaluation_log`: eval harness table (`test_name`, `assistant_type`,
  `citation_accuracy`, `retrieval_precision`, `hallucination_flag`,
  `tool_selection_accuracy`, `no_math_leak_violation`). 6 RLS statements.

### 0013 — `0013_init_sox_compliance.sql`
- `sox_compliance_events` (append-only): `event_type` CHECK
  `ENTRY|EXIT|WITHIN|WATCH_CHANGE|EVALUATION`; `zone_state` CHECK `OUTSIDE|ENTRY|WITHIN|EXIT`;
  `watch_status` CHECK `CLEAR|WARNING|NON_CONFORMING|NO_EVIDENCE|UNKNOWN`; `severity` CHECK
  `INFO|WARNING|HIGH|CRITICAL`; `evidence_status` CHECK
  `CONFORMING|NON_CONFORMING|INSUFFICIENT_EVIDENCE|UNKNOWN`; `rule_id` + `rule_result`,
  `applicable_limit_pct`, `sulphur_content_pct`, `selected_delivery_id`, version stamps,
  `dedup_key`.
- `sox_watch_state` (snapshot per vessel, UNIQUE `vessel_id`): same status/severity/zone_state/
  evidence_status enums; `last_entry_ts`/`last_exit_ts`, `latest_event_id`, `review_required`,
  `last_evaluated_at`.
- **Note:** this migration contains **no** ROW LEVEL SECURITY statements either (see §7).

### 0014 — `0014_init_certificate_registry.sql`
- `certificate_registry` (versioned): `status` CHECK
  `VALID|EXPIRING_SOON|EXPIRED|MISSING|PENDING_REVIEW|INVALID|UNKNOWN`; `source` CHECK
  `document_ocr|manual|api|import|unknown`; `validation_status` CHECK `pending|valid|invalid`;
  `review_status` CHECK `PENDING|APPROVED|REJECTED|NOT_REQUIRED`; `version > 0`,
  `confidence [0,1]`, `dates_order` (expiry ≥ issue), `no_self_supersede`; `supersedes_id` +
  `is_current` implement the version chain. `touch_updated_at` trigger.
- `certificate_registry_events` (append-only): `event_type` CHECK
  `CREATED|UPDATED|CERTIFICATE_EXPIRING|CERTIFICATE_EXPIRED|REPLACED|MISSING|REVIEW_REQUIRED`;
  `severity` CHECK `INFO|MEDIUM|HIGH|CRITICAL`; `dedup_key`. 2 RLS statements.

### 0015 — `0015_init_ocr_quality_review.sql`
- `ocr_quality_scores`: `level` CHECK `HIGH|MEDIUM|LOW|VERY_LOW`; sub-scores
  `page_quality|text_coverage|field_coverage|confidence_score` with a composite range CHECK
  (all `NUMERIC(5,4)`); `confidence_distribution` JSONB; `issues` JSONB;
  `missing_mandatory_fields` JSONB.
- `ocr_review_suggestions`: `kind` CHECK 6 values
  `IMO_CHECKSUM|DATE_FORMAT|FUEL_SPELLING|PORT_SPELLING|CERTIFICATE_NUMBER_SPACING|MERGED_CHARACTERS`;
  `confidence NUMERIC(5,4)`; `priority` CHECK `CRITICAL|HIGH|MEDIUM|LOW`; `status` CHECK
  `open|accepted|rejected|resolved` default `'open'`; `touch_updated_at` trigger.
- `ALTER TABLE review_tasks ADD COLUMN reason_code` (e.g. `OCR_REVIEW_REQUIRED`,
  `BDN_RECONCILIATION_PENDING`). 2 RLS statements.

### 0016 — `0016_init_noon_reports.sql`
- `noon_reports`: raw operational fields all nullable; `confidence NUMERIC(5,4) NOT NULL DEFAULT 0`
  `[0,1]`; CHECKs for position range, speed `[0,?]`, course `[0,360)`, rpm, consumption ≥ 0,
  ROB ≥ 0; evaluation output stored **on the same row** as JSONB: `analysis`, `findings`,
  `fuel_correlation`, `voyage_correlation`, `fueleu_operational`, `ets_operational`,
  plus `evaluated_at`, `evaluation_version`, `dedup_key` (deterministic-engine snapshot).
  `touch_updated_at` trigger. 1 RLS statement.

### 0017 — `0017_init_organizations_auth.sql` (org shell / mock auth)
- `organizations`: `name` nonempty CHECK; `imo_company_number` format CHECK.
- `user_roles`: role catalog (`code`, `label`, `description`, `permissions` JSONB, `rank >= 0`);
  seeded in demo from `@/lib/roles/catalog` (`demo-seed.ts:1048-1054`).
- `organization_users`: email-format CHECK; `full_name` nonempty; `status` CHECK
  `active|inactive`; `password_hash` (seeded via `hashPassword()` from `@/lib/auth/passwords`);
  **per-org unique email** (organization, email).
- `organization_settings`: timezone nonempty; `default_reporting_year` range CHECK;
  `appearance` + `notification_preferences` JSONB.
- `organization_invites`: email-format CHECK; `status` CHECK `pending|accepted|cancelled`;
  `token`; `expiry_future` CHECK (`expires_at > created_at`); `resend_count`.
- `integration_credentials`: `provider` CHECK; `status` CHECK `NOT_CONFIGURED|CONFIGURED`;
  `encrypted_config` JSONB (see §7 — stored, never used).
- `auth_tokens`: `kind` CHECK `session|password_reset`; email-format CHECK; `revoked_at`
  soft-revoke. 7 RLS statements; `touch_updated_at` triggers on 5 of the tables.

---

## 2. Table catalogue (grouped by domain)

Counts verified against the migration scan (50 tables total).

### 2.1 AIS / voyage domain (migration 0001) — 3 tables
| Table | Purpose | Notable columns / constraints |
|---|---|---|
| `vessels` | Canonical vessel identity | `imo char(7)` UNIQUE + format CHECK; `mmsi`, `ship_id`, `gross_tonnage` nullable |
| `voyages` | Port-to-port legs | `vessel_id` FK; port name/id fields; `arrival_time` nullable; time-order CHECK |
| `ais_positions` | High-volume position fixes | `vessel_id` FK; `ts`; lat/lon + sog/cog/heading CHECKs; `(vessel_id, ts DESC)` index |

### 2.2 Document processing pipeline (0002) — 8 tables
`documents`, `document_versions`, `processing_jobs`, `ocr_results`, `document_entities`,
`processing_logs`, `review_tasks`, `document_relationships`. The `documents.status` lifecycle
CHECK is `uploaded|processing|ocr_complete|extracted|under_review|approved|rejected|archived`
(types.ts:121-129). `document_relationships.type` CHECK:
`supersedes|amends|references|requires|attached_to`, plus a `no_self_ref` constraint.

### 2.3 AI extraction + validation + review audit (0003–0005) — 3 tables
`ai_extractions` (provider/model/tokens/latency audit), `validation_reports` (score,
rule_results, ready_for_review), `review_audit_log` (append-only reviewer actions).

### 2.4 Fuel domain (0006) — 3 tables
`fuel_types` (reference factors), `fuel_deliveries` (BDN-derived deliveries with reconcile
state), `reconciliation_log` (append-only match history).

### 2.5 FuelEU / EU ETS / MRV (0007–0008) — 3 tables
`fuel_eu_records`, `eu_ets_records`, `mrv_reports` — see migration catalogue for the extensive
CHECK enums and deadline/surrender tracking fields. `0008` also added `vessels.gross_tonnage`.

### 2.6 Email ingestion (0010) — 1 table
`email_ingestion_log` (append-only, 8 event types; `documents.source_channel` is `MANUAL|EMAIL`).

### 2.7 Reporting & notifications (0011) — 4 tables
`compliance_reports`, `verifier_packages`, `notifications`, `notification_preferences`.

### 2.8 Map & environmental zones (0009) — 5 tables
`environmental_zones`, `port_calls`, `zone_events`, `vessel_tracks`, `map_config`.

### 2.9 SOx ECA compliance (0013) — 2 tables
`sox_compliance_events` (append-only), `sox_watch_state` (per-vessel snapshot).

### 2.10 Certificate registry (0014) — 2 tables
`certificate_registry` (versioned, `is_current` chain), `certificate_registry_events`.

### 2.11 OCR quality & review (0015) — 2 tables
`ocr_quality_scores`, `ocr_review_suggestions` (+ `review_tasks.reason_code` added).

### 2.12 Noon reports (0016) — 1 table
`noon_reports` (raw + deterministic evaluation on one row).

### 2.13 AI assistant / knowledge (0012) — 6 tables
`knowledge_documents`, `knowledge_chunks` (with `embedding vector(384)`),
`assistant_conversations`, `assistant_messages`, `assistant_tool_calls`,
`assistant_evaluation_log`.

### 2.14 Organizations & auth shell (0017) — 7 tables
`organizations`, `user_roles`, `organization_users`, `organization_settings`,
`organization_invites`, `integration_credentials`, `auth_tokens`.

### 2.15 Cross-cutting conventions
- UUID v4 PKs via `gen_random_uuid()`; `id` + `created_at` are always server-defaulted
  (insert payloads omit them — see the `*Insert` types).
- `updated_at` maintained by triggers on: vessels, documents, review_tasks, ai_extractions,
  validation_reports, certificate_registry, ocr_review_suggestions, noon_reports,
  organizations, organization_users, organization_settings, organization_invites,
  integration_credentials. Append-only tables (review_audit_log, reconciliation_log,
  email_ingestion_log, sox_compliance_events, certificate_registry_events,
  assistant_tool_calls) deliberately have no UPDATE trigger.
- 124 index statements across the migrations (incl. the composite lookups called out above).
- No `CREATE POLICY` statements anywhere in the schema — see §7.

---

## 3. Repository layer

45 repository modules live in `src/lib/supabase/repositories/`. Conventions:
- Each module exports an interface (e.g. `VesselRepository`), a `createXRepository(opts)` factory
  that accepts `{ client?: TypedSupabaseClient }` and falls back to the
  `getSupabaseClient()` singleton, and (for most) the row/insert types.
- Every method wraps its body in `try/catch` and rethrows through
  `mapError("human-readable operation", e)` → typed `RepositoryError` subclasses.
- Reads use `eq`/`order`/`limit`/`range`/`maybeSingle`/`single`; writes use
  `insert`/`upsert`/`update`/`delete`; upserts carry explicit `onConflict` columns that must
  match the DB constraints (e.g. `fuel_eu_records` on `vessel_id, reporting_year`).
- The `index.ts` barrel re-exports **every** repository factory and interface plus all row/insert
  types, the client singleton/factory, config loader, error classes, `mapError`, the two
  mappers (`toVesselInsert`, `toVoyageInsert`), and ~40 Zod insert schemas from `schemas.ts`.

### 3.1 AIS / voyage (the Phase 1B trio)
- `vessels.ts` — `upsertByImo`, `findByImo`, `findById`, `findAll(pagination?)` → `Page<VesselRow>`.
- `voyages.ts` — `insertFromDomain(voyage)` (resolves the vessel FK via upsert-by-IMO then
  inserts the voyage), `findById`, `findLatestByImo`, `findByImo(imo, limit?)`,
  `findByVesselAndYear(vesselId, year)`.
- `ais_positions.ts` — `insert`, `insertBatch`, `findLatestByVesselId`,
  `findByVesselImo(imo, limit?)`.

### 3.2 Document pipeline
- `documents.ts` — `insert`, `findById`, `updateStatus`, `listByVesselId`, `listByType`, `listAll`.
- `document_versions.ts` — `insert`, `listByDocumentId`, `findLatestByDocumentId`.
- `processing_jobs.ts` — `insert`, `findById`, `listByDocumentId`,
  `findLatestByDocumentAndType`, `updateStatus`.
- `ocr_results.ts` — `insert`, `findById`, `findByJobId`, `listByDocumentId`.
- `document_entities.ts` — `insert`, `insertBatch`, `findById`, `listByDocumentId`,
  `listByDocumentAndType`.
- `processing_logs.ts` — `insert`, `listByJobId`, `listByJobAndLevel`.
- `review_tasks.ts` — `insert`, `findById`, `listByDocumentId`, `listByAssignee`, `listByStatus`,
  `updateStatus`, `assign`, `complete(id, note)`.
- `document_relationships.ts` — `insert`, `findById`, `listBySourceDocumentId`,
  `listByTargetDocumentId`, `listBySourceAndType`.
- `ai_extractions.ts` — `insert` (normalises defaults: status `pending`, provider/model `mock`,
  empty `fields`/`warnings`/`missing_fields`), `findById`, `listByDocumentId`,
  `findLatestByDocumentId`, `findLatestCompletedByDocumentId`, `updateStatus`, `update`.
- `validation_reports.ts` — `insert`, `findById`, `listByDocumentId`, `findLatestByDocumentId`.
- `review_audit_log.ts` — `insert`, `listByReviewTaskId`.

### 3.3 OCR quality / review
- `ocr_quality_scores.ts` — `insert`, `findById`, `listByDocumentId`, `findLatestByDocumentId`,
  `listByLevel`.
- `ocr_review_suggestions.ts` — `insert` (defaults status `open`), `insertMany`,
  `findById`, `listByDocumentId`, `listByStatus`, `updateStatus`.
- `noon_reports.ts` — `insert`, `findById`, `listByVesselId(limit=50)`, `findLatestByVesselId`,
  `update` (partial patch for evaluation output).

### 3.4 Fuel / FuelEU / ETS / MRV
- `fuel_deliveries.ts` — exports **two** factories: `createFuelDeliveryRepository`
  (`insert`, `findById`, `findByDocumentId`, `findByVesselId`, `findByVesselAndYear`,
  `findByVoyageId`, `listAll`, `updateStatus`, `reconcile`, `unreconcile`, `insertLogEntry`,
  `getLogEntries`) and `createFuelTypeRepository` (`findById`, `listAll`).
- `fuel_eu_records.ts` — `findByVesselAndYear`, `upsert`, `listByVessel`, `delete`.
- `eu_ets_records.ts` — `findByVesselAndYear`, `upsert`, `listByVessel`, `delete`.
- `mrv_reports.ts` — `findByVesselAndYear`, `upsert`, `listByVessel`, `delete`.

### 3.5 Reporting & notifications
- `compliance_reports.ts` — `findById`, `findByVesselAndYear`, `listByType`, `listByVessel`,
  `insert`, `update`, `list(limit, offset)` (uses `.range`), `delete`.
- `verifier_packages.ts` — same shape over `verifier_packages`.
- `notifications.ts` — `findById`, `insert`, `markRead`, `markAllRead` (returns affected count),
  `listByRecipient`, `unreadCount` (uses `select(..., { count: "exact", head: true })`),
  `listByType`, `listUnread`, `delete`.
- `notification_preferences.ts` — `findByRecipient`, `findByRecipientAndType` (handles the
  `type === null` global default via `.is("notification_type", null)`), `upsert`, `delete`.

### 3.6 Map / zones / tracks / port calls
- `environmental_zones.ts` — `findAllActive`, `findByCode`, `findByCategory` (self-contained:
  defines its own local `EnvironmentalZoneRow`).
- `zone_events.ts` — `findByVesselId`, `findByZoneId`, `findRecentByVesselId(limit=20)`,
  `insert`, `insertBatch` (self-contained row types).
- `vessel_tracks.ts` — `findByVesselId`, `findByVesselAndVoyage`, `upsert` on
  `vessel_id, voyage_id`.
- `port_calls.ts` — `findByVesselId`, `findByVoyageId`, `findLatestByVesselId`, `insert`,
  `insertBatch`.

### 3.7 SOx compliance
- `sox_compliance.ts` — `findLatestEvent`, `findEventsByVesselId(limit=50)`, `insertEvent`,
  `findWatchState`, `upsertWatchState` (on `vessel_id`). Aliases the shared row types from
  `types.ts` as `SoxEventRow`/`SoxWatchStateRow`.

### 3.8 Certificates
- `certificates.ts` — `findById`, `findByVesselId` (filterable by `onlyCurrent`/`status`/
  `certificateType`), `findByVesselAndType` (requires `is_current`), `findExpiringWithinDays`
  (date-string `gte`/`lte` on `expiry_date`), `findExpired`, `insert`, `update`,
  `findEventsByVesselId`, `findEventsByCertificateId`, `insertEvent`.

### 3.9 AI assistant / knowledge
- `knowledge_documents.ts` — `findById`, `listByRegulation`, `listBySource`, `list`,
  `insert`, `update`, `delete`.
- `knowledge_chunks.ts` — `findById`, `findByDocumentId`, `searchByKeyword` (splits the query
  into terms and issues parallel `ilike("%term%")` calls, de-duplicating by row id — keyword
  search, **not** vector similarity), `insert`, `insertBatch`, `delete`.
- `assistant_conversations.ts` — `findById`, `listByUser`, `listActiveByUser` (filters
  `status = "ACTIVE"`), `insert`, `update`, `archive` (sets `ARCHIVED`), `delete`.
- `assistant_messages.ts` — `findById`, `listByConversation`, `insert`, `insertBatch`,
  `delete`, `deleteByConversation`.
- `assistant_tool_calls.ts` — `findById`, `listByConversation`, `listByToolName`, `insert`.
- `assistant_evaluation_log.ts` — `findById`, `listByTestName`, `list`, `insert`.

### 3.10 Organizations & auth shell
- `organizations.ts` — `insert`, `findById`, `listAll` (ordered by name), `update`. Header notes:
  "CRUD only — no business rules" (settings service in `src/lib/settings/` owns profile logic).
- `user_roles.ts` — `insert`, `findByCode`, `listAll` (ordered by `rank`). "Read-mostly; callers
  never insert roles in normal operation."
- `organization_users.ts` — `insert`, `findById`, `findByEmail`, `findByOrgAndEmail`,
  `listByOrganizationId`, `update`.
- `organization_settings.ts` — `insert`, `findByOrganizationId`,
  `upsertByOrganizationId` (on `organization_id`), `update`.
- `organization_invites.ts` — `insert`, `findById`, `findByToken`, `listByOrganizationId`,
  `listPendingByOrganizationId` (`status = "pending"`), `update`.
- `integration_credentials.ts` — `insert`, `findByOrganizationAndProvider`,
  `listByOrganizationId`, `upsertByOrganizationAndProvider` (on `organization_id, provider`),
  `update`. "Phase 4.5 stores the values but never uses them to reach providers (mock-only seam)."
- `auth_tokens.ts` — `insert`, `findByToken`, `findValidByToken` (adds `is("revoked_at", null)`
  + `gt("expires_at", now)`), `listValidByKind`, `revoke`. Mock auth seam until real
  Supabase Auth lands.

---

## 4. Fake client semantics (`fake-client.ts`, 712 lines)

The in-memory double implements the exact `TypedSupabaseClient` shape so repositories run
unmodified. Key behaviours (all verified in source):

- **Results:** `success`/`successWithCount`/`failure` produce
  `{ data, error, count, status, statusText }`; errors are `FakePostgrestError`
  (name `"PostgrestError"`, `details`/`hint`/`code` fields). `failure` always returns
  HTTP 400 / "Bad Request".
- **Query state machine:** `QueryKind` = `select | insert | upsert | update | delete`;
  builders are immutable — each chained call constructs a new `FakeQueryBuilder`
  (`insert`/`upsert`/`update`/`select` do this; `eq`/`is`/`gte`/`lte`/`gt`/`lt`/`order`/`limit`/`range`
  mutate and return `this`).
- **Filters:** `FilterOp` = `eq | gte | lte | gt | lt`. `is()` maps to `eq`. **Column names
  with a dot** (`vessels.imo`) are resolved by stripping everything up to the first dot — the
  fake implements no joins. `eq` uses strict `===`; `gte/lte/gt/lt` only ever return true for
  **string** row values vs string filter values (date-string comparisons — hence certificate
  expiry queries compare date slices like `now.slice(0, 10)`).
- **Sorting:** `order` sorts with `String(aVal).localeCompare(String(bVal))`; `null`/`undefined`
  sort last; ascending is the default.
- **Pagination:** `range(from, to)` slices inclusively; `limit(n)` slices the head; when both
  are present, `range` wins.
- **Counts:** `select("*", { head: true })` returns `successWithCount([], totalBeforeRange)`
  (empty data, correct count). `count: "exact"` returns the filtered rows plus
  `totalBeforeRange` as count.
- **single/maybeSingle:** `single()` requires **exactly one** row else error `PGRST116`;
  `maybeSingle()` returns `success(null)` for zero rows, `PGRST116` for more than one. This is
  the PostgREST-compatible behaviour repositories rely on.
- **Upsert:** matches the existing row by the single `onConflict` column value; merges new
  values over the existing row (preserving `id`/`created_at`); otherwise appends.
- **Update:** applies filters, then `{ ...row, ...values }` in place; returns matched rows.
- **buildRow defaults (33 tables):** every inserted/upserted row gets `id`
  (`crypto.randomUUID()`) and `created_at` (now ISO) when absent; then table-specific defaults
  are filled for ~33 tables so inserts match the DB column shape — e.g. `vessels`
  (`mmsi/ship_id/gross_tonnage` null, `updated_at = created_at`), `documents`
  (`status: "uploaded"`, `vessel_id` null), `processing_jobs` (`status: "pending"`),
  `review_tasks` (`status: "pending"`, `priority: "normal"`), `ai_extractions`
  (`status: "pending"`, `provider/model: "mock"`), `validation_reports`
  (`status: "pending"`, `score: 0`, `validator_version: "1.0.0"`), `fuel_deliveries`
  (`status: "pending"`), `fuel_eu_records` (`status: "draft"`), `eu_ets_records`
  (`calculation_details: {}`), `mrv_reports` (`status: "draft"`,
  `completeness_status: "BLOCKED"`), `organizations`, `user_roles` (`rank: 0`),
  `organization_users` (`status: "active"`), `organization_settings` (full dark-theme defaults),
  `organization_invites` (`status: "pending"`, `resend_count: 0`),
  `integration_credentials` (`status: "NOT_CONFIGURED"`, `encrypted_config: {}`),
  `auth_tokens` (`revoked_at: null`), `certificate_registry` (full set incl.
  `is_current: true`, `version: 1`), `noon_reports` (full set incl. `source: "ai_extraction"`,
  `confidence: 0`), etc.
- **globalError:** `createFakeSupabaseClient({ tables, globalError })` makes every query fail
  with the configured SQLSTATE-style error — this drives the error-mapping tests.
- **Limits (documented in README):** the fake is a *test double*, not a DB simulator — it does
  not enforce CHECK constraints or uniqueness beyond what a fixture sets up.

---

## 5. Seeded data (`demo-seed.ts`, 1089 lines)

`buildDemoSeedTables()` returns a `Record<table, rows[]>` consumed by
`getSupabaseClient()` in mock mode (`client.ts:78-83`). All timestamps are computed relative
to `Date.now()` at seed time so the demo looks "live" on every load. The header documents that
rows carry every field explicitly (including `id`/`created_at`) because the fake only applies
`buildRow` defaults on insert.

- **Org:** `DEMO_ORG` = `{ id: "org-poseidon", name: "Poseidon Shipping Ltd." }`.
- **Vessels (5):** Aurelia (IMO 9074729, MMSI 310625000, ship 371663, GT 31,240), Atlas
  (9432891 / 538005432 / 411552 / 55,460), Horizon (9587420 / 636012345 / 623451 / 29,870),
  Neptune (9338490 / 215008765 / 884532 / 18,650), Odyssey (9712215 / 374712000 / 915611 / 38,980).
- **Ports (12 reference points):** Piraeus, Valencia, Genoa, Rotterdam, Marseille, Hamburg,
  Algeciras, Barcelona, Singapore, Fujairah, Le Havre, Cadiz — each with id, country, lat/lng.
- **Voyages (11):** 2–3 per vessel; times relative (`-9d`…`+6d`); includes in-flight legs
  (arrival in the future, e.g. `voy-ody-1` Singapore→Fujairah arrives +6d).
- **AIS positions:** 42 evenly-spaced points per vessel (linear interpolation
  `depPort → current position`, sinusoidal jitter on sog/cog/heading), final point = "live"
  position; each vessel has a `CURRENT_POSITIONS` entry (e.g. Aurelia 41.95°N 7.95°E, sog 15.2).
- **Noon reports (14):** 2 per vessel for in-port Horizon, 3 per vessel elsewhere; latest row
  per vessel is fully evaluated (`review_state: "EVALUATED"`, `analysis` JSONB with engine
  version `1.0.0`, consumption/fuelBreakdown/ROB/engine/weather/voyage/distance/slip/speed/
  prediction blocks, `findings` from rules like `slip_band_check`, plus `fuel_correlation`,
  `voyage_correlation`, `fueleu_operational`, `ets_operational`).
- **Fuel deliveries (9):** each traced to a BDN document (`doc-bdn-*`), with supplier, port,
  date, fuel type (vlsfo/lsmgo/mgo/hfo), quantity, density, sulphur, BDN ref, and status —
  4 `reconciled`, 3 `verified`, 2 `pending`.
- **Fuel types (17):** hfo_380/hfo_180/hfo/rmg_380/rmk_380 (co2 3.114), vlsfo/ulfso (3.151),
  lsmgo/mgo/mdo (3.206), lng (2.75), lpg (3.0), methanol (1.375), biodiesel (2.85), b30 (3.061),
  hydrogen/ammonia (0.0); each with sox/pm factor, default density, `is_drop_in`.
- **Documents (22):** 9 `OCR_MIRROR_DOCS` rows mirroring the OCR assistant's mock registry
  (titles like "BDN — Aurora (rotated 90°)", levels HIGH→VERY_LOW, confidences 0.2–0.95) + 13
  hand-built docs (BDNs per delivery, an IAPP certificate, an MRV report, harbourmaster
  correspondence). `source_channel` is `EMAIL` except manual uploads.
- **Review tasks (9):** priorities normal/high/urgent; `reason_code`s
  `OCR_REVIEW_REQUIRED`, `DOCUMENT_TYPE_MISMATCH`, `BDN_RECONCILIATION_PENDING`,
  `BDN_VESSEL_ASSIGNMENT`; one completed with note "Verified MRV 2025 figures; submitted to
  THETIS."
- **Certificates (12):** IAPP/IOPP/SSE/SMC/IEM/SoPA across the 5 vessels; expiry offsets range
  `-5d` (Horizon IAPP — **expired**, `blocking: true`) through `+305d`; authorities DNV,
  ClassNK, LR (Lloyds Register), Bureau Veritas, RINA; all `status: "VALID"`, `is_current: true`,
  `confidence: 0.98`.
- **SOx watch state (5) + events (3):** Aurelia/Atlas CLEAR-INFO WITHIN; Horizon/Odyssey
  CLEAR-INFO OUTSIDE; Neptune WARNING-WARNING WITHIN with
  `evidence_status: "INSUFFICIENT_EVIDENCE"`, `review_required: true`. Events use rule
  `sox.inside_eca` with rule_result `{passed: true/false}` and a `dedup_key` like
  `sox:9074729:ENTRY:<ts>`.
- **FuelEU records (10):** 5× 2025 `FINAL` + 5× 2026 `PROVISIONAL`; 2025 target fixed at
  `91.16` gCO2e/MJ, 2026 target `91.16 × 0.986`; GHGs ~87–93 gCO2e/MJ; ISCC flags on even
  indices (2025) and Atlas (2026).
- **EU ETS records (5):** 2025, `ets_scope: "50%:2025"` (2025 coverage), `mrv_scope: "MRV:2025"`,
  EUA price €78.50, surrender deadline 2026-09-30, status `ON_TRACK`/`REVIEW`, MRV deadline
  2026-04-30, `SUBMITTED`/`APPROACHING`.
- **MRV reports (3):** Atlas `SUBMITTED`/COMPLETE (28 voyages, 9,842 t fuel, 30,200 t CO₂),
  Aurelia `VERIFIED`/COMPLETE, Neptune `DRAFT`/INCOMPLETE with blocking issue
  `voyage_coverage` and warning about ETA fields.
- **Compliance reports (8):** 2× fuelEu, 3× thetis_mrv (incl. Neptune `FAILED`), 1× fleet_summary,
  1× green_zone, 1× esg_package — generated/failed/draft statuses, `storage_path` under
  `demo/reports/`.
- **Verifier packages (3):** Atlas/Aurelia `GENERATED`, Neptune `FAILED` (validation
  `{ passed: false, score: 62, blockingIssues: ["voyage_coverage"] }`).
- **Zones (2):** `zone-med-sox-eca` (code `MED_SOX_ECA`, category `ECA_SOX`, POLYGON geometry,
  effective 2025-05-01, "MARPOL Annex VI Reg. 14") and `zone-eu-port-control` (code
  `EU_PORT_CONTROL`, category `PORT_CONTROL`, MULTIPOLYGON, effective 2024-01-01,
  "EU ETS Directive (EU) 2023/959").
- **Zone events (5):** Aurelia ENTRY+WITHIN, Atlas ENTRY, Neptune ENTRY + an `ALERT` on
  `zone-eu-port-control` ("Insufficient SOx evidence on entry").
- **Port calls (7):** arrivals/departures aligned to voyages, all `is_mock: true`, `source: "mock"`.
- **Notifications (20):** types `sox_alert`, `certificate_expiring`, `review_task`, `fueleu`,
  `ets`, `fuel_delivery`, `noon_report`, `zone_event`, `system`; severities INFO→CRITICAL;
  `is_read` every 3rd row.
- **Assistant data:** 3 conversations (user `user-001`, model `gpt-4o-mini`,
  promptVersion `1.0.0`) and 6 messages (user/assistant pairs with `citations` pointing at
  `fuel_eu_records`/`eu_ets_records`/`sox_watch_state`); 4 `knowledge_documents`
  (FuelEU 2023/1805, EU ETS 2023/959, THETIS-MRV, MARPOL Annex VI).
- **Auth shell:** 1 organization, `user_roles` seeded from the `ROLES` catalog, 2
  `organization_users` (owner via `DEMO_OWNER` from `@/constants/demo` with
  `hashPassword(DEMO_OWNER.password)`; member "Nikos Papadakis" `nikos@poseidonledger.com`
  `hashPassword("member1234")`), 1 `organization_settings` row (UTC / 2026 / dark theme),
  5 `integration_credentials` (marinetraffic, google_docai, openai, resend, ais — all
  `CONNECTED`, `encrypted_config: { mock: true }`), 1 `notification_preferences` global default.
- **Empty at seed:** `vessel_tracks: []` (tracks are built on demand by the track engine).

---

## 6. Type layer & validation (`types.ts`, `schemas.ts`, `mapper.ts`)

- `types.ts` (2043 lines) is explicitly **the only file that knows the physical column shape**
  (`types.ts:8-12`): every `*Row` type is a 1:1 mirror of the migration columns; every
  `*Insert` type omits server-managed columns (`id`, `created_at`, `updated_at`).
- Union types replicate DB CHECK enums: `DocumentType`, `DocumentStatus`, `ProcessingJobType`,
  `ProcessingJobStatus`, `ProcessingLogLevel`, `ReviewTaskStatus`, `ReviewTaskPriority`,
  `DocumentRelationshipType`, `DocumentEntityType`, `DocumentSourceChannel` (`MANUAL|EMAIL`),
  `OcrQualityLevel`, `OcrReviewSuggestionKind/Priority/Status`, `EmailIngestionEvent`,
  `ReportType`, `ReportStatus`, `VerifierPackageStatus`, `NotificationSeverity`,
  `ConversationStatus`, `MessageRole`, `ToolStatus`, `KnowledgeSource`, `KnowledgeRegulation`.
- `Page<T>` / `PaginationOptions` with `MAX_LIMIT = 100`, `DEFAULT_LIMIT = 50`, and
  `normalizePagination()` clamping (`types.ts:1487-1501`).
- `Database` interface (`types.ts:1881-2043`): a hand-written, `supabase gen types`-compatible
  shape — `public.Tables` for all 50 tables, empty `Views/Functions/Enums/CompositeTypes`, and
  the required `__InternalSupabase { PostgrestVersion: "12" }` sentinel. The comment states a
  real generated file can replace this verbatim later. Every table declares
  `Relationships: []` (FKs exist in SQL with `ON DELETE CASCADE` but are not surfaced in the
  type layer).
- `schemas.ts` (499 lines): Zod insert schemas re-exported from the barrel (~40, e.g.
  `DocumentInsertSchema`, `NoonReportInsertSchema`, `AiExtractionInsertSchema`,
  `AssistantMessageInsertSchema`). Exact schema bodies `(not verified)` in this pass.
- `mapper.ts`: `toVesselInsert(voyage)` and `toVoyageInsert(voyage, vesselId)` flatten the
  Phase 1A domain `Voyage` into DB payloads (port name/port id/flag of mock source) —
  "if the DB schema changes, only this file (and types.ts) change".
- `errors.ts`: `SupabaseError` → `SupabaseConfigError` (fatal startup config), and
  `RepositoryError` (carries `pgCode` = SQLSTATE) → `RepositoryIntegrityError`
  (`23502` not_null, `23503` FK, `23505` unique, `23514` check, `23P01` exclusion) vs
  `RepositoryUpstreamError` (network / 5xx / everything non-PostgREST). `mapError(operation, e)`
  selects the subclass; README documents the branch table.

---

## 7. RLS & security model

- **Deny-by-default, zero policies:** RLS is enabled via `ALTER TABLE ... ENABLE ROW LEVEL
  SECURITY` on the majority of tables (42 RLS statements across 15 of the 17 migrations), and
  **there are no `CREATE POLICY` statements anywhere** in the schema. Every unauthenticated or
  anon-keyed access is therefore denied by Postgres itself.
- **Gaps to note:** migrations `0009` (map/zones/tracks/port_calls) and `0013`
  (sox_compliance_events, sox_watch_state) contain **no RLS statements** — those 7 tables have
  no RLS line in their creating migration `(not verified)` whether they are enabled elsewhere.
- **Service-role access:** the client uses `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS
  entirely. README is explicit this is intentional for the server-side write path and that the
  key "must never ship to the browser" (`README.md:72-77`).
- **Mock mode:** with `SUPABASE_USE_MOCK=true` (the default, per `config.ts`), no credentials
  are required and `getSupabaseClient()` returns the in-memory fake seeded from `demo-seed.ts`.
  `loadConfig()` only throws `SupabaseConfigError` when `useMock=false` and URL or
  service-role key is missing.
- **Secrets handling in schema/data:** `organization_users.password_hash` holds
  `hashPassword(...)` output (bcrypt-style via `@/lib/auth/passwords`, exact algorithm
  `(not verified)`); `auth_tokens` implements a soft-revoke mock session/reset-token seam;
  `integration_credentials.encrypted_config` is stored as JSONB but is never used to reach a
  provider (mock-only per the repository header and the seed's `{ mock: true }` values).

---

## Quick reference — file map

| Concern | Location |
|---|---|
| Schema (single source of truth) | `supabase/migrations/0001…0017*.sql` |
| Row/Insert types + `Database` | `src/lib/supabase/types.ts` |
| Client factory + singleton | `src/lib/supabase/client.ts` |
| Env config (mock/live gate) | `src/lib/supabase/config.ts` |
| In-memory client double | `src/lib/supabase/fake-client.ts` |
| Demo dataset | `src/lib/supabase/demo-seed.ts` |
| Zod insert schemas | `src/lib/supabase/schemas.ts` |
| Error hierarchy + `mapError` | `src/lib/supabase/errors.ts` |
| Domain→DB mapping | `src/lib/supabase/mapper.ts` |
| Public API surface | `src/lib/supabase/index.ts` |
| Repositories (45) | `src/lib/supabase/repositories/*.ts` |
| Repository tests (26 files) | `src/lib/supabase/__tests__/` |

---

# 5. The Compliance Engines


The system implements **ten engine modules** under `src/lib/`. Every engine follows
the same architectural discipline:

1. **Deterministic pure functions** (parameters, calculations, rule evaluation) never touch I/O.
2. **Versioned parameter registries** so past calculations remain reproducible when regulatory values change.
3. **Thin service/orchestration layers** do I/O (persistence, notification dispatch) via injected repositories.
4. **Stable rule IDs and dedup keys** make repeated evaluation idempotent (re-running a calculation on unchanged inputs neither duplicates events nor re-dispatches notifications).

Modules covered: `fueleu`, `eu-ets`, `mrv`, `verifier-package`, `sox-eca`,
`certificates`, `eua-price`, `reporting`, `fuel-delivery`, `noon-report`.

---

## 5.1 FuelEU Maritime (`src/lib/fueleu/`)

### 5.1.1 Versioned parameter registry — `parameters.ts`

- `CURRENT_PARAMETER_VERSION = "2025.1"` (`parameters.ts:19`).
- `BASELINE_GHG_INTENSITY_GCO2E_PER_MJ = 91.16` (`:24`) — the FuelEU baseline gCO₂e/MJ.
- Reduction targets per calendar year (`:35-42`):

  | Year | reduction_pct | Label |
  |------|--------------|-------|
  | 2025 | 0.02 | 2025–2029 (2%) |
  | 2030 | 0.06 | 2030–2034 (6%) |
  | 2035 | 0.15 | 2035–2039 (15%) |
  | 2040 | 0.31 | 2040–2044 (31%) |
  | 2045 | 0.62 | 2045–2049 (62%) |
  | 2050 | 0.80 | 2050+ (80%) |

- `getReductionTarget(year)` clamps: pre-2025 → 2025 target; beyond schedule → last known target (`:50-60`).
- `computeTargetIntensity(year) = 91.16 × (1 − reduction_pct)` (`:63-66`). E.g. 2025 → 89.3368, 2030 → 85.6904.

**LHV registry** (`:81-108`, `getLhv` at `:114`):
- HFO/VLSFO/ULSFO/bio_HFO → **40.5** MJ/kg; MGO/MDO/LSMGO/ULSFO(→42.7)/bio_MGO → **42.7** MJ/kg; LNG 50.0; LPG 46.0; methanol 19.9 (IPCC); ammonia 18.6 (IPCC); hydrogen 120.0 (IPCC).

**Well-to-Wake GHG registry** (`:128-159`, `getWtwFactor` at `:161`) in gCO₂e/MJ:
- HFO/VLSFO/ULSFO 87.5; MGO/MDO/LSMGO 85.7; LNG 76.0; LPG 81.5; bio_HFO 20.5 (ISCC default); bio_MGO 19.8; methanol 81.0; ammonia 82.0; hydrogen 85.0 (methanol/ammonia/hydrogen sourced from IPCC).

**Penalty formula registry** (`:181-190`, `getPenaltyFormula` at `:192`):
- Version 2025.1: `penalty_eur_per_tonne = 2400`, `vlsfo_emission_factor_gco2e_per_mj = 87.5`, `vlsfo_energy_mj_per_tonne = 40500`, `is_estimate = true`.

### 5.1.2 Calculation pipeline — `service.ts` `calculate()` (`:20-99`)

Seven deterministic steps:

1. **Energy** — `computeEnergyContributions` (`energy.ts:16-62`): `quantity_kg = quantity_mt × 1000`, `energy_mj = quantity_kg × lhv`. Unresolved fuel types (no LHV entry) are recorded in `unresolved_fuel_types` and contribute **0 energy** (they are skipped, not zero-rated). Energy is split into `biofuel_energy_mj` / `fossil_energy_mj` by registry category.
2. **WtW emissions** — `computeWtwEmissions`: `energy_mj × wtw_factor` per contribution.
3. **Intensity** — `computeGhgIntensity(totalEnergyMj, totalWtwEmissions)` → gCO₂e/MJ; returns 0 when energy is 0 (`intensity.ts`, guarded by tests).
4. **Compliance** — `computeCompliance(actualIntensity, year)` (`compliance.ts:23-42`):
   - `target = computeTargetIntensity(year)`
   - `compliance_balance = target − actual` (rounded to 6 dp)
   - positive → **surplus**, negative → **deficit**, zero → **zero**.
5. **Biofuels/ISCC** — `analyseBiofuels` flags deliveries listed in `iscc_missing_delivery_ids` (missing ISCC certificate evidence); fossil deliveries are never flagged.
6. **Penalty exposure** — `estimatePenalty(balance, energy)` (`penalty.ts:21-46`):
   - Only when `balance < 0` (deficit); surplus/zero → `null`.
   - `excess_gco2e = |balance| × total_energy_mj`
   - `deficit_mj = excess_gco2e / 87.5`
   - `tonnes_vlsfoe = deficit_mj / 40500`
   - `penalty_eur = tonnes_vlsfoe × 2400`
   - Unknown formula version → `null` penalty. Result is always marked `is_estimate: true`.
7. **OPS** — `processOpsData` (`ops.ts:20-27`): clamps negative shore energy to 0, records `ops_data_available`. OPS does **not** directly affect the v1 penalty.

`calculateAndSave` (`:104-145`) maps the result to `FuelEuRecordInsert` and `upsert`s;
`getRecord` (`:150-182`) reconstructs a result from the row (recomputed `reduction_pct` from stored target, `penalty_is_estimate: true`).

### 5.1.3 Worked examples (from `__tests__/fueleu.test.ts`)

- 100 t VLSFO: energy = 100 × 1000 × 40.5 = **4,050,000 MJ**; WtW = 4,050,000 × 87.5 = **354,375,000 gCO₂e**; intensity = **87.5** gCO₂e/MJ → 2025 surplus (target 89.3368, balance +1.8368).
- Mixed HFO + MGO: 300 t HFO + 100 t MGO → energy = 300×1000×40.5 + 100×1000×42.7 = **16,420,000 MJ**; WtW = 300×1000×40.5×87.5 + 100×1000×42.7×85.7.
- 50/50 bio_HFO + fossil HFO (equal LHV 40.5): intensity = (20.5 + 87.5)/2 = **54.0** gCO₂e/MJ.
- Pure bio_HFO → intensity **20.5**; pure fossil HFO → **87.5**.
- Penalty example: balance −5 on 10,000,000 MJ → excess 50,000,000 gCO₂e → 571,428.57 MJ → 14.11 t VLSFOe → ≈ **€33,862** (formula constants `penalty.ts:35-39`).

### 5.1.4 Pooling (building block only) — `pooling.ts`

`computePoolableBalance(balance, sign)` returns the balance only for **surplus** vessels;
deficit and zero → 0 (`:20-27`). Full pooling is explicitly out of scope — this is the
Phase 2C.2 building block that surfaces "poolable surplus" but does not execute pooling.

---

## 5.2 EU ETS (`src/lib/eu-ets/`)

### 5.2.1 Parameters — `parameters.ts`

- `ETS_CURRENT_PARAMETER_VERSION = "2025.1"` (`:1`).
- **Coverage phase-in** (`:13-17`, `getEtsCoverageRate` at `:19`): 2024 → 0.40, 2025 → 0.70, 2026+ → 1.00 (EU ETS Directive 2023/959). Clamps like FuelEU.
- **Voyage coverage factors** (`:35-42`): INTRA_EU 1.0; EU_TO_THIRD 0.5; THIRD_TO_EU 0.5; NON_EU 0.0.
- **Deadlines** (`:64-67`): MRV Annual Report **31 March**, EUA Surrender **30 September** of the following year (constructed as `new Date(year, month−1, day)`).

### 5.2.2 Emissions — `emissions.ts`

Tank-to-Wake CO₂ from deliveries using `fuel-delivery/emission-factors`:
`kg = quantity_mt × 1000 × co2_factor`; `tonnes = kg / 1000` (`:20-48`). Unknown fuel types are
recorded as `unresolved_fuel_types` and skipped.

### 5.2.3 Calculation — `service.ts` `calculate()` (`:18-106`)

1. Scope: `etsScopeForGt(gt)` / `mrvScopeForGt(gt)` (types.ts) → IN_SCOPE / OUT_OF_SCOPE by gross tonnage.
2. Total TtW CO₂ from deliveries.
3. **Voyage coverage** (v1 simplified model): `classifyVoyageCoverage(departure, arrival)` (port-classifier) assigns each voyage a type + factor; total CO₂ is distributed **equally across voyages** (`perVoyageCo2 = total / nVoyages`, `:40-41`), then `coveredCo2 = Σ perVoyageCo2 × factor` (`:42-45`). Deliberate simplification documented in code (`:36-39`).
4. **EUA obligation** = `coveredCo2 × coverage_rate` when in scope, else 0 (`:51`).
5. **EUA price** via `EuaPriceProvider` (default: mock €75.50, `eua-price/provider.ts:22-24`). `eua_price_available = price !== null`.
6. **Estimated cost** = obligation × price when price available and in scope, else null.
7. **Deadlines** via `computeDeadlines` (`deadlines.ts`): days remaining ceiling, status — `<0` OVERDUE, `≤7` URGENT, `≤30` WARNING, else OK.
8. Numeric outputs rounded to 4 dp (CO₂) / 2 dp (EUR).

`calculateAndSave` (`:108-147`) persists via `EuEtsRecordRepository.upsert` including `surrender_status` / `mrv_deadline_status` and a compact `calculation_details` (voyage contributions + parameter version). `getRecord` (`:149-177`) reconstructs the result; rehydrated records return `voyage_contributions: []`, `surrender_deadline: null`, `mrv_deadline: null` (deadlines are not persisted in the row — they are recomputed by `calculateAndSave` only for the insert).

### 5.2.4 Port classification — `port-classifier.ts`

EU/EEA country set includes Iceland, Norway, Liechtenstein (MRV scope); UK is treated
**non-EU** post-Brexit. Rotterdam → `netherlands` → INTRA_EU for EU calls.

---

## 5.3 MRV Annual Report (`src/lib/mrv/`)

`MrvReportService` (`service.ts`):

- **`checkCompleteness`** (`:24-30`) → `runMrvCompletenessCheck(dataset)` (completeness.ts), returns `MrvCompletenessResult`.
- **`generateReport`** (`:35-171`):
  - Runs completeness first; **BLOCKED** dataset → returns a `status: "blocked"` report with `blocking_issues`, zero totals, empty voyages (`:58-81`). Nothing persisted in that branch.
  - Otherwise builds voyage entries with a **simplified equal distribution**: `perVoyageFuel = totalDeliveryMt / voyages`, `perVoyageCo2 = totalDeliveryCo2 / voyages` (`:89-96`); first delivery's fuel type is used as the representative fuel (`:100`). `totalDeliveryCo2` uses `getFuelEmissionInfo` (`:217-228`): `quantity_mt × 1000 × co2_factor / 1000`.
  - Result status `"draft"`, `calculation_version = MRV_CALCULATION_VERSION`, `parameter_version = ETS_CURRENT_PARAMETER_VERSION` (`:127-128`). Persists via `repo.upsert` (`:149-168`).
- **`runChecklist`** (`:176-190`) → `runPreSubmissionChecklist` (checklist.ts).
- **`generateExport`** (`:195-201`): XML via `generateXmlExport` or CSV via `generateCsvExport`. Per `mrv/export.ts`, THETIS-MRV XML is a **structured upload file** — there is no public REST API; submission is a manual portal upload.
- **`buildVerifierPackage`** (`:206-208`) → delegates to the verifier-package module (below).

---

## 5.4 Verifier Package (`src/lib/verifier-package/`)

Builds a zip "verifier package" (Evidence Pack) that **references** source data rather than embedding raw files.

- `PACKAGE_VERSION = "1.0.0"` (`types.ts:1`).
- Manifest entry per file: `filename, content_type, size, sha256, storage_path` (`types.ts:3-9`); manifest carries `package_version, generated_at, vessel_id, reporting_year, files[], total_size, file_count` (`types.ts:11-19`).

`buildPackage` flow (`builder.ts:253-335`):
1. `validateBeforeBuild` (`:197-251`): error if no GENERATED `thetis_mrv` report for vessel×year; error if `include_bdn_documents` and zero BDN docs; warnings for BDN coverage and validation reports. `valid = missingRequired.length === 0`.
2. Insert `GENERATING` draft row with `package_version`, `validation_result: { input }`, `generated_by` (`:265-275`).
3. `collectFiles` (`:77-184`):
   - `annual_report.json` — serialized `thetis_mrv` GENERATED report content (required).
   - `bdns/{doc.id}_{doc.filename}` — JSON refs to BDN documents (`document_id, title, filename, storage_path`) when `include_bdn_documents`.
   - `ais_voyage_data.json`, `validation_reports.json`, `discrepancy_notes.json` — placeholder JSON refs when requested.
   - `compliance_records.json` — refs to GENERATED `fueleu` reports (`report_id, report_type, generated_at`).
   - `manifest.json` appended last (checksummed).
4. `buildZip(files)` → `computeHash(zipBuffer)` = checksum → `storeFile` at `verifier-packages/{vessel_id}/{year}/{id}.zip` → update row to `GENERATED` with manifest, `storage_path`, `file_size`, `checksum` (`:317-330`).
5. Any failure → update draft to `FAILED` and rethrow (`:331-334`).

Errors: `PackageGenerationError`, `PackageNotFoundError`, `PackageValidationError` (`:6-33`).
A separate `validator.ts` (`createPackageValidator`, `:12-78`) offers a lighter-weight pre-flight
(report count, BDN count, AIS warning) used by callers that don't want the full build.

---

## 5.5 SOx ECA (`src/lib/sox-eca/`)

### 5.5.1 Parameters — `parameters.ts`

- `GLOBAL_SULPHUR_LIMIT_PCT = 0.5`, `ECA_SULPHUR_LIMIT_PCT = 0.1` (`:15-16`).
- Med SOx ECA: `MED_SOX_ECA_CODE = "MED_SOX_ECA"`, effective **2025-05-01** (IMO MEPC.361(79)) (`:17-19`).
- `isMedSoxEcaEffective(now)` — deterministic time gate (`:40-44`).
- `getApplicableSulphurLimit(insideEca, now)`: inside + in force → 0.10%, else 0.50% (`:50-53`).
- `isSulphurConforming(value, limit)` = `value <= limit` (`:56-58`).

### 5.5.2 Zone resolution — `zone.ts`

Reuses the **geo engine** (`@/lib/geo`) — the same `pointInZone` / `detectZoneTransition`
used by the Green Zone module; no second point-in-polygon implementation (`:6-11`).

- `hasUsableGeometry` (`:56-66`): POLYGON/MULTIPOLYGON with a coordinates array whose first ring has ≥3 points.
- `computeZoneState` (`:72-99`): with a previous position uses `detectZoneTransition` → ENTRY/EXIT/WITHIN/OUTSIDE; without one, falls back to `pointInZone` + `previousZoneState` (OUTSIDE/null + inside → ENTRY; ENTRY/WITHIN + outside → EXIT).

### 5.5.3 Bunker evidence — `evidence.ts`

Deterministic selection, no LLM (`:9-16`):
1. Exclude `rejected`/`disputed` deliveries.
2. Any delivery whose document is `under_review`/`rejected` → REVIEW_REQUIRED.
3. Two+ usable deliveries with **conflicting conformity** (disagree at both the 0.5 and 0.1 limits) → AMBIGUOUS → REVIEW_REQUIRED — never blindly pick one.
4. Otherwise pick the most recent usable delivery by `delivery_date`.

States: `NO_EVIDENCE`, `REVIEW_REQUIRED` (none usable / no sulphur / sensitive / ambiguous), `NO_SULPHUR`, `READY`.

### 5.5.4 Rules — `engine.ts` `evaluateSox` (`:107-268`)

Stable rule IDs: **SOX-ECA-01..06** (`:5-11`).

| Rule | Trigger | Kind / Severity |
|------|---------|-----------------|
| SOX-ECA-06 | no usable geometry | NOT_APPLICABLE, INFO; watch UNKNOWN |
| SOX-ECA-02 (not applicable) | ECA not in force (before 2025-05-01) | NOT_APPLICABLE, INFO |
| SOX-ECA-01 | ENTRY/EXIT transition | NOTICE; **WARNING** when entering with CONFORMING-watch-out, else INFO |
| SOX-ECA-02 | evidence CONFORMING | CONFORMING, INFO; watch CLEAR |
| SOX-ECA-03 | evidence NON_CONFORMING | **CRITICAL** when from trusted fuel-in-use while inside, else HIGH |
| SOX-ECA-04 | inside ECA, no usable sulphur evidence | NO_EVIDENCE, WARNING |
| SOX-ECA-05 | UNKNOWN (ambiguous / under review) | REVIEW_REQUIRED, WARNING |

Key mechanics:
- `trustedFuelInUse` (fuel-in-use evidence) **short-circuits** the delivery selection when inside the ECA (`:56-67`).
- All phrasing says "available bunker evidence indicates…" — a BDN documents delivered fuel, never what the engine burns (`evidence.ts:1-7`, engine explanations).
- `dedupKey = zoneState|watchStatus|severity|evidenceStatus|selectedDeliveryId|sulphurContentPct` (`:270-286`).
- `ecaInForce = isMedSoxEcaEffective(now) && isMedSoxZone(zone) && geometryAvailable` (`:110`).

### 5.5.5 Handoff vocabulary — `handoff.ts`

Fixed natural-language surfaces for the Captain/Compliance/Search assistants: `captainSoxReadiness` ("Am I okay for the Med?"), `complianceSoxExplanation` ("Explain the SOx alert"), `soxSearchPhrases` (`:22-100`). The assistants reuse sox-eca state through this vocabulary; no sulphur math lives in the assistants.

### 5.5.6 Notifications — `notifications.ts`

EXIT transitions and INFO severity never notify. NON_CONFORMING / NO_EVIDENCE / WARNING / REVIEW_REQUIRED map to `sox_eca_non_conforming`, `sox_eca_no_evidence`, `sox_eca_warning`, `sox_eca_review_required` respectively.

---

## 5.6 Certificates & Statutory Documents (`src/lib/certificates/`)

### 5.6.1 Status derivation — `service.ts`

`viewFor` (`:107-144`) derives a `CertificateView` from the record via `deriveStatus` (status-engine.ts) and computes `daysUntilExpiry` to midnight floor.

### 5.6.2 Register from document — `registerFromDocument` (`:194-291`)

Deterministic guards:
- document IMO ≠ vessel IMO → **PENDING_REVIEW, blocking, REVIEW_REQUIRED** (reason `IMO_MISMATCH`).
- missing expiry date → **PENDING_REVIEW** (never invents a date; reason `MISSING_EXPIRY`).
- existing current record → **superseded** (`is_current: false`), new record `version + 1`, `supersedes_id` set, event **REPLACED**; otherwise **CREATED**.
- Notifications are dispatched only for non-CREATED/UPDATED events (`:283-290`).

### 5.6.3 Periodic re-evaluation — `evaluate` (`:298-354`)

Refreshes stored status/reason snapshots; when the derived status changed, emits a
transition event: `EXPIRING_SOON` → **CERTIFICATE_EXPIRING**, `EXPIRED` → **CERTIFICATE_EXPIRED**,
`PENDING_REVIEW` → **REVIEW_REQUIRED** (`eventTypeForTransition`, `:475-483`).
Deduplicated via `buildExpiryDedupKey(vessel, certType, status)`.

### 5.6.4 Requirements reconciliation — `reconcileRequirements` (`:361-422`)

Materializes MISSING/UNKNOWN **placeholder records** for known requirements with no current
evidence (source-driven from requirements.ts `evaluateRequirements(profile)`); skips
`NOT_REQUIRED` and already-present types; events **MISSING** / **REVIEW_REQUIRED**.

### 5.6.5 Review routing — `applyReviewDecision` (`:425-473`)

Approved → `review_status APPROVED`, `review_required` cleared; rejected → review stays
required. Emits an **UPDATED** event. `emit` (`:486-507`) suppresses a duplicate event when
the latest event for the certificate already has the same `dedup_key`.

### 5.6.6 Notifications — `notifications.ts`

CREATED/UPDATED never notify; EXPIRING/EXPIRED/MISSING/REVIEW_REQUIRED/REPLACED map to
`certificate_expiring` / `certificate_expired` / `certificate_missing` / `certificate_review_required` / `certificate_replaced`.

---

## 5.7 EUA Price (`src/lib/eua-price/provider.ts`)

- `EuaPriceProvider` seam (`:8-11`): `name` + `getPrice(): Promise<number | null>`.
- **Mock provider** returns fixed €75.50 (indicative, deterministic) (`:15-25`).
- **Real provider** placeholder returns `null` (not implemented) (`:33-40`).
- Default provider is the mock; `setDefaultEuaPriceProvider` swaps it (`:44-52`). `getEuaPrice()` convenience (`:57-59`).

---

## 5.8 Reporting Service (`src/lib/reporting/service.ts`)

`reporting/service.ts` reads the compliance engines' outputs **lazily via injected
repository callables** — `getMrvReport`, `getFuelEuRecord`, `getEtsRecord`, `getZoneEvents`.
Report generation is a pure composition over those reads; the engines stay side-effect free.
(This is the orchestration surface that wires chapters 1–4 to the engines above.)

---

## 5.9 Fuel Delivery (`src/lib/fuel-delivery/`)

### 5.9.1 BDN → delivery mapping — `bdn-mapping.ts`

- `mapBdnToFuelDelivery` (`:14-37`): bridges OCR extraction (`BdnExtractedData`) to a `BdnToFuelDeliveryInput`, normalizing the fuel type via `normalizeFuelType`. Every delivery carries full provenance: `document_id`, `ocr_result_id`, `ai_extraction_id`.
- `toFuelDeliveryInsert` (`:43-75`): adds DB defaults — null-coalesced optional fields and `status: "pending"`.

### 5.9.2 Emission factors

`emission-factors.ts` provides `getFuelEmissionInfo(fuelType)` returning `co2_factor`
(kg CO₂ per kg fuel). This single registry feeds both **EU ETS** (`eu-ets/emissions.ts:32`)
and **MRV** (`mrv/service.ts:222`), and the noon-report ETS correlation.

### 5.9.3 Validation — `validation.ts`

- sulphur content missing → **warning** "cannot verify ECA compliance" (`:37-49`).
- sulphur content > 0.5% → **error**.

---

## 5.10 Noon Report Engine (`src/lib/noon-report/`)

The operational cross-checking engine: turns each noon report into
analysis + validation + fuel/voyage/FuelEU/ETS correlations, persists the evaluation and
dispatches deduplicated notifications.

- Versions: `NOON_REPORT_VERSION = "1.0.0"`, `NOON_REPORT_ENGINE_VERSION = "1.0.0"` (`types.ts:22-24`). Report statuses EXTRACTED / EVALUATED / REVIEWED / BLOCKED.

### 5.10.1 Analysis — `engine.ts`

`analyzeNoonReport(report, prev, engineRef, voyagePlan, now)` produces:
- **Consumption**: `round3` on per-fuel breakdown and totals; `hoursBetween(reportDate, prevDate)`; average rates.
- **Remaining on board**: ROB end + daily consumption.
- **Engine performance** (`rpmAnalysis`): deviation vs designRpm, thresholds within ±25% → NORMAL (`engine.ts:41` region); `slipAnalysis`: apparent slip % = `(1 − (speedKnots × 1852) / (rpm × pitchMeters × 60)) × 100`; `speedAnalysis` vs designSpeed.
- **Weather / waiting / port state**: `resolveOperationalState` → AT_SEA / ANCHORED / PORT / UNKNOWN; weather severity SIGNIFICANT when `windSpeedKnots >= 28` (`WIND_SIGNIFICANT_KNOTS = 28`, `engine.ts:41`).
- **Voyage progress** (`voyage-correlation.ts`): `progressPct = distanceMadeGoodNm / plannedDistanceNm × 100` (`:38-41`); `speedDeviationPct` (`:43-46`); ETA deviation hours (`:48-52`).
- **Prediction**: `arrivalDate = reportDate + hoursToGo`, `hoursToGo = distanceToGoNm / speedKnots`; `remainingFuelAtArrival = fuelRobsTonnes − (consumptionRateTonnesPerHour × hoursToGo)`; `willFinishBeforeArrival = remainingFuel < 0`.

Helpers: `round3`, `haversineNm`, `hoursBetween` (`engine.ts:39-45`).

### 5.10.2 Validation — `validator.ts`

`validateNoonReport({ report, analysis })` → score / status / blocked / readyForReview / findings.
- Shares the shared `RULE_REGISTRY` / `toValidationContext` (`@/lib/validation`, documentType `noon_report`) and augments with data-quality + engine cross-checks.
- Severity mapping (`:25-36`): blocking→BLOCKING, error→ERROR, warning→WARNING, default INFO.
- Category mapping (`:38-61`): structural→structural; confidence→data_quality; CONSUMPTION/ROB→fuel; SPEED/ARRIVAL→voyage; RPM/SLIP→engine.
- `LOW_CONFIDENCE_THRESHOLD = 0.6` (`:23`): analysis confidence below it → finding `noon_low_confidence`.

### 5.10.3 Correlations

- **Fuel** (`fuel-correlation.ts`): `pct(actual, expected)` returns null when either input is non-finite or expected = 0 (`:34-39`); results via `round3`. Impossible-fuel check (consumption > (opening ROB + delivered) × 1.05) → `noon_impossible_fuel`; ROB inconsistency (>5% mismatch) → `noon_rob_inconsistency`; consumption attributed across delivered fuel types by quantity share → feeds FuelEU/ETS operational inputs.
- **Voyage** (`voyage-correlation.ts`): findings `noon_unexpected_delay` (predicted arrival > planned + threshold), `noon_heavy_weather` (wind ≥ 28 kt).
- **FuelEU operational input** (`fueleu-correlation.ts`): per fuelBreakdown item, `energyMj = tonnes × 1000 × lhv` via `getLhv`; unknown type → `resolved: false` with `energyMj: null`; output carries `reportingYear`, `energyMeters[]`, `resolvedCount`, `totalEnergyMj`.
- **ETS operational input** (`ets-correlation.ts`): same pattern via `getFuelEmissionInfo`; `co2Tonnes = tonnes × 1000 × co2_factor / 1000`; explicit `resolved: false` for UNKNOWN.

### 5.10.4 Notifications — `notifications.ts`

`noonNotificationTypeForFinding` maps (partial): `noon_report_received`, `noon_impossible_fuel`,
`noon_unexpected_consumption`, `noon_heavy_weather`, `noon_unexpected_delay`,
`noon_fuel_discrepancy`, `noon_voyage_anomaly`, `noon_rob_inconsistency`, `noon_low_confidence`.
Severity mapping (`:24-34`): BLOCKING/ERROR→HIGH, WARNING→MEDIUM, INFO→INFO; **INFO findings
are suppressed** (never notify), matching the SOx ECA convention.

### 5.10.5 Service orchestration — `service.ts`

`NoonReportService.evaluate(row)` pipeline: parse → `analyzeNoonReport` (with previous report,
`EngineReference`, `VoyagePlanInput`, `now`) → `validateNoonReport` → run all four correlations
(fuel with deliveries from repo by vessel + window) → persist evaluation → dispatch notifications
for non-duplicate results. Re-evaluating unchanged report content returns
`wasDuplicated: true` and skips persistence + notifications (`service.ts:10-12, 55-58`).

### 5.10.6 Fixtures & dedup — `mock-data.ts`, tests

- Mock vessel `POSEIDON PIONEER` (IMO `9488754`), destination ROTTERDAM; engine ref designRpm 84, designSpeed 14.5 kt, pitch 5.6 m, MCR 12000 kW; voyage plan 1200 nm @14.5 kt → arrival `2026-08-06T12:00:00.000Z`; default report `2026-08-01T12:00:00.000Z`, pos (10.5, 106.8), 14.2 kt, course 295, 1100 nm to go, consumption 32.4 t, ROB 860 t, rpm 82, wind 18 kt NE, confidence 0.94, source `ai_extraction`.
- Clean dedup key: `"2026-08-01T12:00:00.000Z|10.5|106.8|32.4|860|14.2|82"` (`service.test.ts`).
- Test suites: `engine.test.ts` (NOW `2026-08-01T13:00:00.000Z`), `validator.test.ts`, `correlations.test.ts`, `service.test.ts` (in-memory fakes; create/latest/history/evaluate/dedup/notification dispatch), `parser.test.ts`, `notifications.test.ts`.

---

## 5.11 Cross-cutting: notifications & dedup

- Shared contract: `src/lib/notifications/types.ts` (`NotificationEvent`, `NotificationEventType`) imported by noon-report, sox-eca, and certificates mapping modules.
- **Dedup keys** make every engine idempotent:
  - sox-eca: `zoneState|watchStatus|severity|evidenceStatus|selectedDeliveryId|sulphurContentPct`.
  - certificates: `buildExpiryDedupKey(vessel, certType, status)`; register/review events use `dedup_key: null` (always emitted).
  - noon-report: content hash of report fields (`CLEAN_DEDUP_KEY`).
- Deterministic **time injection**: every engine takes an explicit `now` parameter (sox-eca `evaluateSox(input.now)`, certificates `viewFor(record, now, thresholds)`, noon `analyzeNoonReport(..., now)`) so evaluations are reproducible for a fixed instant.

---

## 5.12 Open items (constants not re-read this pass)

- `certificates/status-engine.ts` threshold values (only `DEFAULT_CERTIFICATE_THRESHOLDS` referenced; exact expiringSoonDays value lives in `types.ts`).
- `mrv/completeness.ts` and `mrv/checklist.ts` full rule tables (BLOCKED/WARNING derivation summary known, exact check list not re-read).
- `reporting/service.ts` full report-template composition (callables verified; template body not re-read).

If any constant is needed exactly, read the file directly rather than inferring it.

---

# 6. OCR & Document Processing Pipeline


This chapter documents the Poseidon Ledger OCR / document processing pipeline:
how documents are ingested, classified, extracted, validated, and routed into a
human review queue, plus the two families of OCR engines that power it.

Source of truth for the persistence layer: `docs/PHASE-2A.1-SUMMARY.md`
(Phase 2A.1, status COMPLETE). Implementation lives under `src/lib/ocr`,
`src/lib/ocr-assistant`, `src/lib/ai`, `src/lib/validation`,
`src/lib/review`, `src/lib/certificates`, `src/lib/supabase`, and the API
routes under `src/app/api/documents/**` and `src/app/api/ocr/**`.

---

## 6.1 Overview — two OCR families

Poseidon Ledger has **two complementary OCR engines**, deliberately split so
that the fast, deterministic, offline logic never depends on a remote model:

1. **OCR provider layer** (`src/lib/ocr`) — produces raw OCR output (text +
   confidence + per-entity extraction) from an uploaded file. Two providers
   implement the same `OcrProvider` interface:
   - **Mock OCR provider** (`mock-provider.ts`) — deterministic, in-memory,
     fixture-driven. Default active.
   - **Google Document AI provider** (`google-docai.ts`) — real cloud OCR using
     the Document AI API, with JWT-based service-account auth and retry logic.
2. **OCR assistant layer** (`src/lib/ocr-assistant`) — a **deterministic,
   non-LLM engine** (version **4.3.0**, `src/lib/ocr-assistant/types.ts`) that
   classifies a document's family, scores its quality, computes review
   priority, and generates repair suggestions from the OCR text. It performs
   **no free-form generation**: everything is rule-based.

The assistant is exposed as an `OcrService` (`src/lib/ocr-assistant/service.ts`)
with methods `answer`, `classify`, `quality`, `suggestions`, `similar`,
`dictionary`, `explain`, `summarize`, `recall`, and `review`. It draws on a
domain dictionary (`dictionary.ts`), a content-signal classifier
(`classification.ts`), a quality scorer (`quality.ts`), a priority model
(`priority.ts`), a suggestion generator (`suggestions.ts`), a PII / injection
safety filter (`safety.ts`), and a recall memory (`memory.ts`). Its tool
catalogue (`ocr-tools.ts`) exposes the assistant's capabilities as typed tools.

**Division of labour.** The provider turns bytes into text; the assistant
turns text into decisions (family, quality level, priority, suggestions). The
AI extraction layer (`src/lib/ai`, next step in the pipeline) turns text into
structured, document-type-specific fields. Validation (`src/lib/validation`)
checks those fields against deterministic rules. Corrections made at any stage
are **advisory only** — a human must approve in the review queue.

---

## 6.2 Document lifecycle state machine

Documents are the core entity (`documents` table, migration
`0002_init_document_domain.sql`). Lifecycle is tracked by the `status` column
(`DocumentStatus`, `src/lib/supabase/types.ts:121`):

| Status | Meaning |
|---|---|
| `uploaded` | File received, no processing started |
| `processing` | Pipeline jobs running (OCR, extraction, validation, classification) |
| `ocr_complete` | OCR step finished (raw text + entities available) |
| `extracted` | AI extraction completed |
| `under_review` | A review task is active / pending human decision |
| `approved` | Human approved the extracted/corrected data |
| `rejected` | Human rejected the document or extraction |
| `archived` | Terminal state, removed from active workflows |

Transitions:

- **Upload** → `uploaded`. Sources: `DocumentSourceChannel = "MANUAL" | "EMAIL"`
  (`types.ts:118`). Uploaded via `POST /api/documents` (multipart) or via the
  document upload service.
- **`uploaded` → `processing`**: a processing job of type `ocr` starts
  (`ProcessingJobType = "ocr" | "entity_extraction" | "validation" |
  "classification"`, `types.ts:132`). Jobs carry
  `ProcessingJobStatus = "pending" | "running" | "completed" | "failed" |
  "cancelled"` (`types.ts:139`).
- **`processing` → `ocr_complete`**: OCR job completes. Raw text is stored in
  `ocr_results` (`OcrResultRow`, `types.ts:262`), named entities in
  `document_entities` (`DocumentEntityType = "imo_number" | "vessel_name" |
  "port" | "date" | "certificate_number" | "flag_state" | "measure" | "other"`,
  `types.ts:168`).
- **`ocr_complete` → `extracted`**: AI extraction job completes; result in
  `ai_extractions` (`AiExtractionRow`, `types.ts:703`).
- **`extracted` → `under_review`**: a review task is created
  (`review_tasks`, `ReviewTaskRow`, `types.ts:326`).
- **`under_review` → `approved` / `rejected`**: human decision.
- **`archived`** is a terminal state.

All async processing is recorded via `processing_jobs` and the append-only
`processing_logs` audit trail
(`ProcessingLogLevel = "debug" | "info" | "warning" | "error"`,
`types.ts:147`). A lightweight polling endpoint
(`GET /api/documents/:id/status`) exposes the current status, the latest job
(`{id, jobType, status, startedAt, completedAt, errorMessage}`) and the count
of OCR results, letting clients poll for pipeline progress without full
records.

Persistence layer facts (from `docs/PHASE-2A.1-SUMMARY.md`):

- Eight tables in migration 0002: `documents`, `document_versions`,
  `processing_jobs`, `ocr_results`, `document_entities`, `processing_logs`,
  `review_tasks`, `document_relationships`.
- CHECK constraints on every enum column, non-negative file size, confidence in
  `[0,1]`, time-ordering checks on `processing_jobs` and `review_tasks`,
  self-reference prevention + UNIQUE composite `(source, target, type)` on
  `document_relationships`, UNIQUE `(document_id, version_number)` on
  `document_versions`, UUIDv4 PKs, TIMESTAMPTZ everywhere, FK indexes, RLS
  deny-by-default (service-role only), `touch_updated_at` trigger on
  `documents` and `review_tasks`.
- Later migrations add pipeline tables: validation reports (migration 0004),
  SOX ECA compliance events (0013), and OCR quality scores + review suggestions
  (0015).
- Repositories are factories with lazy singleton resolution, `RepositoryError`
  subclasses, and **no business logic** (8 files in
  `src/lib/supabase/repositories/`).

---

## 6.3 OCR providers

### 6.3.1 Provider selection

`getOcrProvider()` (`src/lib/ocr/provider.ts:12`) is a memoized factory:

```
if OCR_USE_MOCK (default true)      → createMockOcrProvider()
else if GOOGLE_OCR_ENABLED (def. false) → createGoogleDocAiOcrProvider(config)
else                                → createMockOcrProvider()
```

- `OCR_USE_MOCK` / `GOOGLE_OCR_ENABLED` parse as `1`/`true` truthy, anything
  else falsy (`parseBoolean`, `provider.ts:5`).
- `createOcrProvider()` (used for tests / explicit construction) **always**
  returns the mock provider.
- `_resetOcrProviderForTest()` clears the memoized singleton.

### 6.3.2 Mock OCR provider

`createMockOcrProvider()` (`src/lib/ocr/mock-provider.ts`) is the default and
the only provider returned when mock mode is active. It is deterministic and
fixture-driven: `MOCK_FIXTURES` contains fully-parsed fixture documents
(`src/lib/fixtures/ocr/*.json`) for the four regulated document families:
`bdn` (Bunker Delivery Note), `cii` (CII), `eu-ets`, and `fuel-eu`.

Each fixture mirrors a realistic vessel document, e.g. the FuelEU fixture
mixes VLSFO 65 / MGO 25 / LNG 10 consumption with GHG intensities 91.2 / 89.0 /
67.0. Mock behaviour is detailed in §6.9.

### 6.3.3 Google Document AI provider

`createGoogleDocAiOcrProvider(config)` (`src/lib/ocr/google-docai.ts`) is the
real provider, enabled only when `GOOGLE_OCR_ENABLED=true` and `OCR_USE_MOCK`
is falsy. Config is loaded by `loadGoogleDocAiConfig()` from a
`GoogleServiceAccountCredentials` object (projectId, clientEmail, privateKey).

- **Auth**: the provider fetches an access token through an injected async
  `getToken()` callable and sends it as a bearer token on Document AI requests.
- **Errors** (`src/lib/ocr/errors.ts`): a typed hierarchy rooted at
  `GoogleOcrError` (sets `name` and carries an optional `cause`):
  - `GoogleOcrConfigError` — bad config.
  - `GoogleOcrAuthError` — token acquisition failed.
  - `GoogleOcrApiError` — HTTP failure, carries `status` and response `body`.
  - `GoogleOcrTimeoutError` — request timed out.
  - `GoogleOcrRateLimitError` — provider rate-limited the request.
  - `GoogleOcrInvalidResponseError` — response shape could not be parsed.
- **Retry policy**: exponential backoff (configurable `maxRetries`,
  `baseDelayMs`, `maxDelayMs`). Only `GoogleOcrRateLimitError`,
  `GoogleOcrTimeoutError`, and `GoogleOcrApiError` with 5xx status are
  retried; all other errors (including 4xx) are thrown immediately.
- All Google error classes are re-exported from `src/lib/ocr/index.ts` along
  with `OcrProvider`, `OcrResult`, the four extracted-data types, and the
  mock provider / fixtures.

The `OcrProvider` interface (`src/lib/ocr/types.ts`) produces an `OcrResult`
with the extracted text, a confidence value, and typed extracted data per
family (`BdnExtractedData`, `CiiExtractedData`, `EuEtsExtractedData`,
`FuelEuExtractedData`).

---

## 6.4 Document types

`DocumentType` (`src/lib/supabase/types.ts:107`), controlled by the DB CHECK
`documents_type_check`:

| Value | Meaning |
|---|---|
| `bdn` | Bunker Delivery Note |
| `imo_dcs` | IMO DCS submission / statement of fuel oil consumption |
| `eu_mrv` | EU MRV monitoring report data |
| `certificate` | Vessel certificates (class, statutory, etc.) |
| `report` | General reports |
| `correspondence` | Emails / letters |
| `logbook` | Deck / engine logbooks |
| `other` | Anything else |

Two notes on type handling:

- **Upload route whitelist** (`src/app/api/documents/route.ts:69`) accepts
  `imo_dcs, eu_mrv, certificate, report, correspondence, logbook, other` —
  notably **`bdn` is not user-selectable at upload**; it is only reachable via
  OCR classification, the API type system, or the mock fixtures.
- The **OCR assistant classifies the family independently** of the declared
  type; family and declared type can therefore disagree, which is exactly the
  signal that drives review priority (see §6.7).

The OCR quality layer also keys behaviour on document *family* (BDN, CII,
EU-ETS, FuelEU, logbook, etc.) via `FAMILY_FIELDS` (`quality.ts`), which maps
each family to the mandatory fields used to compute field coverage.

---

## 6.5 AI Extraction

After OCR produces raw text, the AI extraction layer
(`src/lib/ai`, `ai-extraction.service.ts`) converts it into a structured,
document-type-specific field set.

- **Result record** (`AiExtractionRow`, `types.ts:703`): `document_id`,
  `ocr_result_id`, `status`, `confidence`, `summary`, `document_type`,
  `fields` (Record), `warnings[]`, `missing_fields[]`, `provider`, `model`,
  `prompt_tokens`/`completion_tokens`/`total_tokens`, `latency_ms`,
  `error_message`, timestamps.
- **Status** (`AiExtractionStatus`, `src/lib/ai/types.ts:78`):
  `"pending" | "completed" | "failed" | "unknown_document"`. A document whose
  OCR text cannot be mapped to a known family yields `unknown_document`, which
  is a distinct, non-failure terminal state.
- The extraction service is built by `buildAiExtractionService()` (wired in
  `src/app/api/documents/helpers.ts`) and invoked from
  `POST /api/documents/:id/extract`.
- `POST /api/documents/:id/validate` requires a **completed** extraction; if
  none exists it returns 409 `NO_EXTRACTION` with the message
  "No completed AI extraction" — i.e. `unknown_document`/`failed`/`pending`
  states do not validate.

### 6.5.1 BDN certificate registration (deterministic guards)

Certificates produced from a BDN (`POST /api/documents/:id/certificate`) are
registered through `CertificateService` (`src/lib/certificates`) with a
validation payload:

- `imo` (required), `documentImo?`, `certificateType`, `certificateNumber?`,
  `issuingAuthority?`, `classSociety?`, `issueDate?` / `expiryDate?` (YYYY-MM-DD),
  `source` in `["document_ocr","manual","api","import","unknown"]`,
  `confidence?` in `[0,1]`, `notes?`.
- **Deterministic guards**:
  - IMO mismatch between the document and the certificate → BLOCKING /
    REVIEW_REQUIRED.
  - Missing `expiryDate` → REVIEW_REQUIRED (certificates without expiry always
    need a human).
- The certificate API route has its own DI (`DocumentCertificateApiDeps` in
  `certificate/_lib.ts`) with `buildDefaultDocumentCertificateApiDeps()`
  (real Supabase repos) and `buildMockDocumentCertificateApiDeps()`
  (fixture vessel `CERT_MOCK_VESSEL`, in-memory cert repo, no-op notifier).

---

## 6.6 Validation rules engine

The validation layer (`src/lib/validation`) is a deterministic rule engine
that scores an AI extraction against per-family rules. It is versioned:
`VALIDATOR_VERSION = "2.0.0"` (`validator.ts`).

### 6.6.1 Engine and pipeline

- **`createRule` / `RuleRegistry`** (`rule-engine.ts`): rules register by ID
  into a Map-based registry; a **duplicate rule id throws**.
- **`validate()`** (`validator.ts`) runs the applicable rule set over the
  extracted `fields`, aggregates results per field, and calls:
  - `computeWeightedConfidence()` — **OCR 20% / AI 50% / validation 30%**,
    rounded to 3 decimals.
  - `assembleReport()` — score = `passed/total × 100` (rounded); blocking
    issues = rules with severity **blocking** plus those with severity
    **error**. Rule severities: `blocking | error | warning | info`.
- Report schema: `{score, status, severity counts, rule results, latencyMs}`,
  persisted to `validation_reports` (migration 0004).
- **Provider selection** (`provider.ts`): `VALIDATION_USE_MOCK` defaults
  **true**; `getValidationProvider()` is cached and always returns the mock
  provider via `createValidationProvider()`. `mock-validator.ts` supplies the
  mock rule data.

### 6.6.2 Rule catalogue

**Shared regexes** (`rules.ts`): `IMO_REGEX /^\d{7}$/`, `MMSI_REGEX /^\d{9}$/`,
ISO date regex, plus latitude/longitude regexes.

**Maritime rules** (BDN / fuel delivery):

| Rule id | Check | Severity |
|---|---|---|
| `maritime.quantity_positive` | `quantityTonnes > 0` | error |
| `maritime.delivery_date_valid` | not more than 1 year in the future | warning |
| `maritime.port_not_empty` | port field non-empty | error |
| `maritime.vessel_name_exists` | vessel name longer than 2 chars | error |
| weather rule | `windSpeedKnots > 150` → remediation on `windSpeedKnots` | error |

**Logbook rules**:

| Rule id | Check | Severity |
|---|---|---|
| `logbook.required_fields` | `imoNumber`, `vesselName`, `entryDate`, `entryType` present | blocking |
| `logbook.position_continuity` | lat in [−90, 90], lng in [−180, 180] | warning |

**Structural rules** (from `mock-validator.ts`): required-field rules per
family keyed on IMO number, vessel name, dates, quantities — e.g.
`structural.required.imoNumber`, `structural.required.*`, whose failures
block. Cross-document rules (`cross-document.ts`) compare values across
documents of the same vessel (e.g. consistent IMO / vessel name / port).

---

## 6.7 Review queue

Human-in-the-loop review (`src/lib/review`) turns machine decisions into
approved/rejected records. Review tasks are persisted in `review_tasks`
(`ReviewTaskRow`, `types.ts:326`) and every decision is audited.

### 6.7.1 Domain model (`review/types.ts`)

- `ReviewTaskStatus = "pending" | "in_progress" | "completed" | "cancelled"`
  (`types.ts:150`); `ReviewTaskPriority = "low" | "normal" | "high" | "urgent"`
  (`types.ts:157`).
- `FieldReview` — one field's review state; `ReviewDecision` —
  approve/reject/correct.
- `AuditAction` — `field_approved | field_rejected | field_edited |
  field_uncertain | comment_added | assigned`.
- `AuditEntry` — reviewer, action, previous/new value, notes, timestamp;
  persisted to `review_audit_logs`
  (`ReviewAuditLogRow`, `types.ts:1261`).
- `ReviewTaskDetail` bundles the task with its document, `validationScore`,
  `aiConfidence`, and extracted fields — this is what the review UI/API returns.

### 6.7.2 Creation and routing

- Review tasks are created:
  - explicitly: `POST /api/documents/:id/review` with optional
    `{assignee, priority, reasonCode}`;
  - automatically: `POST /api/ocr/review` runs the full pipeline
    (OCR → quality → priority → suggestions → extraction) and creates a review
    task flagged `OCR_REVIEW_REQUIRED` **only when the OCR priority is above
    LOW**.
- Priority mapping (OCR assistant → review task): the assistant's
  `priority.ts` yields `LOW | MEDIUM | HIGH | CRITICAL`; the API layer maps
  this to `review_tasks.priority` via `toReviewTaskPriority()`.

### 6.7.3 Decision flow (`POST /api/review-tasks/:id`)

Body: `{action, reviewer, fieldName, newValue, comment, reason, assignee}`.

- `approve` — either field-level (`approveField`) or whole-task
  (`submitDecision(id, "approved", reviewer, comment)`).
- `reject` — mirrors approve with `"rejected"`.
- `assign` — allowed **without** a `reviewer`; any other action with no
  reviewer → 400 `MISSING_REVIEWER`.
- 404 `TASK_NOT_FOUND` for unknown task ids.

### 6.7.4 OCR review suggestions

`ocr_review_suggestions` (`types.ts:407`) stores repair proposals generated by
the assistant:

- `kind` (`OcrReviewSuggestionKind`, `types.ts:358`): `IMO_CHECKSUM |
  DATE_FORMAT | FUEL_SPELLING | PORT_SPELLING | CERTIFICATE_NUMBER_SPACING |
  MERGED_CHARACTERS`.
- `priority`: `CRITICAL | HIGH | MEDIUM | LOW` (`types.ts:367`).
- `status`: `open | accepted | rejected | resolved` (`types.ts:370`), mutated
  via `PATCH /api/ocr/suggestions/:id`.

---

## 6.8 API surface

All routes return `{error:{code,message}}` on failure via `apiError` /
`apiSuccess` (`src/lib/api/helpers.ts`). Error codes are declared in
`src/app/api/_lib/errors.ts` (40+ constants including `INVALID_JSON`,
`VALIDATION_ERROR`, `IMO_MISMATCH`, `INVALID_IMO`, `VESSEL_NOT_FOUND`,
`NOT_FOUND`, `INTEGRITY_ERROR`, `RATE_LIMITED`, `UPSTREAM_ERROR`,
`MALFORMED_RESPONSE`, `CONFIGURATION_ERROR`, `REPOSITORY_UNAVAILABLE`,
`INTERNAL_ERROR`, `DOCUMENT_NOT_FOUND`, `MISSING_FILE`, `MISSING_TITLE`,
`MISSING_DOCUMENT_TYPE`, `INVALID_DOCUMENT_TYPE`, `FILE_TOO_LARGE`, ...).

### 6.8.1 Documents

| Route | Method | Purpose |
|---|---|---|
| `/api/documents` | GET | List `?vesselId=&documentType=&limit=&offset=`. `limit` default 50, capped at 100; paginated by slice. Errors `LIST_DOCUMENTS_FAILED`. |
| `/api/documents` | POST | Upload (multipart `file, title, documentType, vesselId?`). Validates file present (400 `MISSING_FILE`), title (400 `MISSING_TITLE`), type (400 `MISSING_DOCUMENT_TYPE` / `INVALID_DOCUMENT_TYPE`), size ≤ 50 MB (413 `FILE_TOO_LARGE`). Returns 201 with the created record. Errors `UPLOAD_FAILED`. |
| `/api/documents/:id` | GET | Document status + detail (versions, jobs, OCR results). 404 `DOCUMENT_NOT_FOUND`; `GET_DOCUMENT_FAILED`. |
| `/api/documents/:id/status` | GET | Lightweight polling payload `{documentId, status, latestJob{id,jobType,status,startedAt,completedAt,errorMessage}, ocrResultCount}`. |
| `/api/documents/:id/extract` | GET | Latest AI extraction. |
| `/api/documents/:id/extract` | POST | Run AI extraction; body `{ocrResultId?}` (defaults to latest OCR result). 404 `DOCUMENT_NOT_FOUND`, 409 `NO_OCR_RESULT`, 500 `EXTRACTION_FAILED`. |
| `/api/documents/:id/validate` | GET | Latest validation report, or `null`. |
| `/api/documents/:id/validate` | POST | Run validation; returns `{report, persisted, latencyMs}`. 404 `DOCUMENT_NOT_FOUND`, 409 `NO_EXTRACTION` ("No completed AI extraction"), 500 `VALIDATION_FAILED`. |
| `/api/documents/:id/review` | GET | List review tasks for the document. `LIST_REVIEW_TASKS_FAILED`. |
| `/api/documents/:id/review` | POST | Create review task `{assignee?, priority?, reasonCode?}`. `CREATE_REVIEW_TASK_FAILED`. |
| `/api/documents/:id/download` | GET | Signed download URL. 404 `DOCUMENT_NOT_FOUND`. |
| `/api/documents/:id/certificate` | POST | Register certificate from BDN data (see §6.5.1). |

### 6.8.2 Review tasks

| Route | Method | Purpose |
|---|---|---|
| `/api/review-tasks` | GET | List `?status=&assignee=&vesselId=&documentType=` → `listReviewTasks`. |
| `/api/review-tasks/:id` | GET | Detail (`ReviewTaskDetail`). 404 `TASK_NOT_FOUND`. |
| `/api/review-tasks/:id` | POST | Decision `{action, reviewer, fieldName, newValue, comment, reason, assignee}`. Actions: `approve`, `reject`, `assign` (see §6.7.3). 400 `MISSING_REVIEWER`; 404 `TASK_NOT_FOUND`. |

### 6.8.3 OCR assistant API

| Route | Method | Purpose |
|---|---|---|
| `/api/ocr/queue` | GET | Joined view of `documents` + `vessels` enriched with OCR metadata: `{id, title, family, declaredType, status, vesselId, vesselName, ocrConfidence, level, overallQualityScore, priority, priorityReasons, issues, missingMandatoryFields, reviewTask}`. Totals `{total, byLevel, needsReview}`. |
| `/api/ocr/quality` | GET | `?documentId=` (required, else 400 `VALIDATION_ERROR`), `?mock=true`. Returns computed quality `{detectedFamily, level, overallQualityScore, pageQuality, textCoverage, fieldCoverage, confidenceScore}` + persisted `ocr_quality_scores` record. |
| `/api/ocr/review` | POST | Full pipeline `{documentId, ocrResultId?, assignee?}`; creates review task only if priority > LOW. |
| `/api/ocr/suggestions` | POST | Persist repair suggestions `{documentId, ocrResultId?}`. |
| `/api/ocr/suggestions/:id` | PATCH | `{status: "accepted" \| "rejected" \| "resolved"}` via `suggestionRepo.updateStatus`. |

### 6.8.4 Shared API wiring

- `src/app/api/documents/helpers.ts` wires `buildDocumentService`,
  `buildDocumentUploadService`, `buildAiExtractionService`,
  `buildValidationService`, `buildReviewService` from real Supabase client +
  storage + OCR/AI/validation/review providers.
- `src/app/api/ocr/_lib.ts` provides the OCR API DI (`OcrApiDeps`: service +
  quality repo + suggestion repo + review task repo), `buildDefaultOcrApiDeps`
  / `buildMockOcrApiDeps`, and the mapping helpers `isOcrQualityRecord`,
  `isOcrSuggestionRecord`, `toQualityScoreInsert`, `toReviewTaskPriority`,
  `toSuggestionInserts`. Mock mode uses a fake Supabase client
  (`createFakeSupabaseClient`).
- Client side, `src/lib/services/ocr.service.ts` calls the queue endpoint via
  `apiFetch("ocr/queue")`.

### 6.8.5 Data shapes (row types)

- `OcrResultRow` (`types.ts:262`): `processing_job_id, document_id, raw_text,
  extracted_data, confidence, created_at`.
- `OcrQualityScoreRow` (`types.ts:373`): `ocr_result_id, document_id,
  detected_family, overall_quality_score, level (HIGH|MEDIUM|LOW|VERY_LOW),
  page_quality, text_coverage, field_coverage, confidence_score,
  confidence_distribution, issues[], missing_mandatory_fields[], created_at`.
- `DocumentEntityRow` (`types.ts:282`): typed entities with offsets and
  per-entity confidence.
- `ValidationReportRow` (`types.ts:748`): `document_id, extraction_id, status`,
  plus score fields.
- `ReviewAuditLogRow` (`types.ts:1261`): `review_task_id, field_name, action,
  previous_value, new_value, reviewer, notes, created_at`.

---

## 6.9 Mock behaviour

The system ships deterministic mock implementations everywhere so the full
pipeline runs with zero external services and zero network calls. The following
switches are **all defaulted to mock on**:

| Env var | Default | Effect |
|---|---|---|
| `OCR_USE_MOCK` | `true` | Use `createMockOcrProvider()` instead of Google Document AI |
| `GOOGLE_OCR_ENABLED` | `false` | Only consulted when `OCR_USE_MOCK` is falsy |
| `VALIDATION_USE_MOCK` | `true` | Always return mock validation provider |

**Mock OCR provider.** Deterministic fixture-driven text+entities. Fixture
documents in `src/lib/fixtures/ocr/*.json` for `bdn`, `cii`, `eu-ets`,
`fuel-eu`. Example: the "perfect" BDN fixture is a bunker delivery note with
IMO `9321483`, vessel M/T Aurora, port Singapore, supplier Oceania Marine Fuels
Pte Ltd, BDN no. `BDN-2026-0718`, fuels VLSFO + RMG 380, sulphur 0.49%,
density 985.2 kg/m³. The FuelEU fixture mixes VLSFO 65 / MGO 25 / LNG 10 with
GHG intensities 91.2 / 89.0 / 67.0.

**OCR assistant mock data** (`src/lib/ocr-assistant/mock-data.ts`):
`OCR_MOCK_NOW = "2026-08-01T12:00:00.000Z"` (a fixed "now" so quality/priority
scores and expiry checks are reproducible), plus the perfect-BDN text above.

**Mock review module** (`src/lib/review/mock-review.ts`):
`NOW = "2026-07-29T10:00:00.000Z"`, `REVIEWER = "alice@poseidon-ledger.io"`.
Exports `MOCK_REVIEW_FIXTURES` (re-exported as `MOCK_REVIEW_FIXTURES_DATA`)
and `REVIEW_MOCK_REVIEWERS`. The BDN fixture task is `review-bdn-001` for
document `doc-bdn-001`: status `in_progress`, priority `high`, due
`2026-08-05`, document type `imo_dcs`, document status `under_review`, vessel
`vessel-001`, `validationScore 100`, `validationStatus passed`,
`aiConfidence 0.97`, extracted fields IMO `9876543`, 1500 MT VLSFO at
Rotterdam on 2026-06-15, supplier "Maritime Fuels B.V."

**Mock certificate API** (`certificate/_lib.ts`):
`buildMockDocumentCertificateApiDeps()` serves a single fixture vessel
(`CERT_MOCK_VESSEL`) and an in-memory certificate repository, with a no-op
notifier.

**Mock OCR API mode.** `?mock=true` on OCR routes (and `buildMockOcrApiDeps`)
route through `createFakeSupabaseClient` so the queue/quality/suggestions
endpoints behave identically without a live database.

**Deterministic engines.** Classification uses content signals with explicit
weights — a 3-weight signal is decisive; BDN signals include
`\bbunker\s+delivery\s+note\b` and BDR (weight 3), and fuel-grade mentions
(IFO380/VLSFO/ULSFO/LSFO/HFO/MGO/MDO/LNG/LPG) weigh 2. Quality is a weighted
composite of page quality, text coverage, field coverage, and confidence,
mapped to `HIGH | MEDIUM | LOW | VERY_LOW`. Suggestions validate IMO numbers
via the 7-i checksum (`imoChecksumValid`: `/^\d{7}$/` + check digit), fuel
spellings against a canonical dictionary (e.g. **VLSFO** is canonical with
aliases VLSPO, VLSF0, VL5FO, "very low sulphur fuel oil"; also ULSFO, LSFO),
and ports / dates / certificate-number spacing. The safety filter blocks
prompt injection and PII patterns and flags out-of-scope content
(payroll, salary, crew contract/list, seafarer, employment, hire, vacation,
health insurance, wage, collective bargaining, medical record).

**Deterministic guarantees.** All pipeline decisions — classification,
quality, priority, suggestions, validation scores, and certificate guards —
are computed from fixed rules with fixed thresholds and a frozen mock clock, so
test outputs are reproducible run-to-run. Human approval in the review queue
remains the only state-changing step that is not deterministic by design.

---

# 7. The AI / Assistant System


Status: derived from the current source tree at `D:\ProjetoPLDemo` (read-only audit, no changes made).
Authoritative design reference: `docs/AI_ASSISTANT_ARCHITECTURE.md`. This chapter describes what is actually implemented in code and where the implementation differs from, or goes beyond, the architecture document.

---

## 1. Overview

The Poseidon Ledger AI system is built on a single governing principle stated at the top of `docs/AI_ASSISTANT_ARCHITECTURE.md`: **a deterministic core with an advisory AI on top**. Every compliance figure — CO2 mass, EU ETS allowances, FuelEU surplus/deficit, GHG intensity, voyage classification, distance/coverage percentages — must be produced by the deterministic engine, never by the language model.

Division of labour (architecture doc §0, mirrored in every system prompt):

| Layer | Produces |
|---|---|
| Deterministic core (repositories, calculators, validators, status engines) | All numeric compliance outputs, deadlines, survey statuses, certificate validity, voyage classification, gap tiers |
| AI / assistants | Intent classification, handoff routing, tool selection, retrieval, extraction, normalisation, anomaly explanation, drafting, checklist composition, plain-language guidance |
| AI explicitly forbidden from | Computing any figure that flows to THETIS-MRV or an authority; mutating records without explicit user confirmation; asserting compliance from unreadable or fabricated evidence |

Cross-cutting invariants enforced in code:

- Every response is **advisory**; a fixed disclaimer (`STANDARD_DISCLAIMER` in `src/lib/assistant/safety.ts`) is injected into every answer.
- **No DB writes without explicit user confirmation**; write-type tools require confirmation and are recorded in `assistant_tool_calls`.
- **All actions are logged** to `audit_log` with before/after diffs (architecture doc §5; search auditing exposed at `/api/search/audit`).
- **Multi-tenancy** via an organization-scoped tool gateway (architecture doc §1; deterministic tools resolve data through an organization/vessel context).
- **Citation requirement**: compliance-flavoured answers must cite the deterministic tool that produced a figure (enforced by `SafetyLayerOptions.requireCitations`, citation accuracy scoring in the evaluation harness, and regression tests).

### 1.1 Design vs implementation

The architecture document names **seven agents**: Voyage (2.1), Compliance (2.2), Captain (2.3), Maintenance (2.4), Crew (2.5), OCR (2.6), Search (2.7). The current codebase implements assistant modules for six of them plus one extra:

- `src/lib/compliance-assistant/` — implemented
- `src/lib/search-assistant/` — implemented
- `src/lib/captain-assistant/` — implemented
- `src/lib/voyage-assistant/` — implemented
- `src/lib/maintenance-assistant/` — implemented
- `src/lib/ocr-assistant/` — implemented
- `src/lib/noon-assistant/` — implemented **in addition to the architecture doc** (noon-report console; not one of the seven documented agents)
- Crew assistant — **not** implemented as a dedicated module

The Compliance assistant does not have its own API route; it is exercised through the generic `/api/assistant/*` conversation pipeline (`src/app/api/assistant/`), which wires the compliance assistant into the shared `AssistantService`. OCR and Noon assistants likewise ship as library modules with tool registries and mock states but **no HTTP route**.

### 1.2 Shared pipeline

All assistants that answer free text share the same shape (core implemented once in `src/lib/assistant/assistant-service.ts` and specialised in each assistant's `*Service`):

```
classify intent  ->  detect handoff target  ->  build context  ->  persist user message
   ->  deterministic tool execution (inline or via gateway)  ->  LLM generate
   ->  safety validation (content, math-leak, citation)  ->  inject disclaimer
   ->  persist assistant message + tool calls  ->  optional evaluation hook
```

### 1.3 Mock "now" timestamps

Each assistant's mock data pins its own clock so scenario behaviour is reproducible (relevant because status engines compare against `now`):

| Assistant | Mock clock |
|---|---|
| Captain | `CAPTAIN_MOCK_NOW = 2026-08-01T12:00:00.000Z` |
| Maintenance | `MAINTENANCE_MOCK_NOW = 2026-08-01T12:00:00.000Z` |
| Noon | `NOON_MOCK_NOW = 2026-08-01T13:00:00.000Z` |
| Voyage | `VOYAGE_MOCK_NOW = 2026-07-10T12:00:00.000Z` |
| OCR | `OCR_MOCK_NOW` (see `src/lib/ocr-assistant/mock-data.ts`) |

---

## 2. Core assistant infrastructure

All core infrastructure lives under `src/lib/assistant/` and is exported through the barrel `src/lib/assistant/index.ts`.

### 2.1 Types (`src/lib/assistant/types.ts`)

- `ToolDefinition` — name, description, category (`ToolCategory`), `permission` (`read` | `write`), `inputSchema`, `outputSchema`, `requiresConfirmation`.
- `IntentType` — `REGULATORY`, `COMPLIANCE`, `VOYAGE`, `DOCUMENT`, `SEARCH`, `CAPTAIN`, `UNKNOWN`.
- `RegulatoryCitation` — document title, regulation, article_section, version, chunk reference, relevance score.
- `AssistantResponse` — content, citations, tool calls, disclaimer, safety check result.
- `AssistantConversation`, `AssistantMessage`, `AssistantToolCall` — persisted entities.
- `AssistantConversationStatus` — `ACTIVE` / `ARCHIVED`.

### 2.2 Router (`src/lib/assistant/router.ts`)

- `createRouter({ useMock = true })`; when mocked, `classifyByKeywords` computes confidence as `matches / totalWords` with a minimum threshold of `0.3`.
- Keyword tables in `INTENT_KEYWORDS` map phrasing to the seven `IntentType` values above.
- `detectHandoff` (see §4) — detects voyage/maintenance/OCR/captain phrasing when the primary intent is `COMPLIANCE`, `UNKNOWN`, or `DOCUMENT`.
- Non-mocked (LLM) routing uses temperature `0.1`, `maxTokens 50`; `specialistRequired` when confidence `< 0.5`.

### 2.3 Tool gateway (`src/lib/assistant/tool-gateway.ts`)

- `ToolGateway` exposes `getAvailableTools`, `getTool`, `execute`, `getHistory`.
- Unknown tool name → error `Unknown tool: <name>`.
- A `write`-permission tool invoked without prior confirmation → error `Tool requires confirmation before execution`.
- Successful executions are recorded through `toolCallRepo` (persisted in `assistant_tool_calls`).

### 2.4 Deterministic structured tools (`src/lib/assistant/structured-tools.ts`)

15 read-only tools, all `permission: READ`, all `requiresConfirmation: false`. They are the *only* source of compliance figures for the generic assistant:

`get_vessel_compliance_score`, `get_fleet_ets_summary`, `get_open_violations`, `get_fuel_deliveries`, `get_voyage_log`, `get_monitoring_plan_gaps`, `lookup_emission_factor`, `get_deadlines`, `get_compliance_reports`, `get_vessel_info`, `get_fueleu_record`, `get_eu_ets_record`, `get_validation_results`, `get_document_status`, `get_verifier_package_status`.

The tool context (`StructuredToolContext`) requires deterministic repositories: `fuelEuRepo`, `etsRepo`, `mrvRepo`, `vesselRepo`, `fuelDeliveryRepo` — each with `findByVesselAndYear` / `findById` / `findByImo` / `findByVessel` style accessors. The mock factory `createMockStructuredToolService` backs these with in-memory records (fleet including "MV Poseidon Voyager", 2025 fuelEU/ETS data) so the deterministic engine can answer the same queries the production repos would.

### 2.5 LLM providers (`src/lib/assistant/llm-provider.ts`)

- `createMockLlmProvider` — default `simulatedDelayMs: 100`; keyword-matched canned responses. Compliance/regulation/EU-ETS/FuelEU-flavoured questions produce a response that *defers the figure to the deterministic engine*; greetings get a hello; everything else a fallback. This is the enforcement point for "LLM never computes compliance numbers" in mock mode.
- `createRealLlmProvider` — requires an API key (throws without one); OpenAI/Anthropic/custom model registry, 60s timeout, default models (`gpt-4`, `claude-3-opus`) configurable.
- `getProvider()` registry in `src/lib/assistant` defaults to mock.

### 2.6 Conversation service (`src/lib/assistant/conversation-service.ts`)

`createConversationService({ conversationRepo, messageRepo, toolCallRepo })` — `addMessage`, `recordToolCall`, `getConversationContext`; persistence backed by `getSupabaseClient` in the API layer.

### 2.7 Assistant service (`src/lib/assistant/assistant-service.ts`)

`processQuery({ query, context })` implements the shared pipeline:

1. `classifyIntent`.
2. Build conversation context (messages so far).
3. Persist the user message with `metadata.intent`.
4. `REGULATORY` intent → deterministic regulatory search + citations + LLM response.
5. Otherwise → execute the available deterministic tools inline (empty vessel + current year), recording only successful calls, and feed results to the LLM.
6. `validateContent` on the draft; `buildFinalResponse` injects `STANDARD_DISCLAIMER`; persist the assistant message with `safetyCheck` metadata.

### 2.8 Safety layer (`src/lib/assistant/safety.ts`)

- `STANDARD_DISCLAIMER` — fixed advisory text appended to every response (advisory only; figures must be verified against the deterministic engine before any authority submission).
- `DEFAULT_DISALLOWED_PATTERNS` — prompt-injection phrases ("ignore previous instructions", "you are now a different AI", "system override") plus email/phone PII regexes; violations block content, warnings are surfaced.
- `checkForMathLeak(response, toolResults)` — returns `true` when the draft contains a compliance-style figure (number + unit such as tonnes, tCO2, %, EUR, gCO2e) that does **not** appear in the deterministic tool JSON output. The canonical regression is `src/lib/assistant/__tests__/no-math-leak-regression.test.ts`: the harness must flag the LLM, never the tools.

### 2.9 Evaluation harness (`src/lib/assistant/evaluation.ts`)

`createEvaluationHarness` scores assistant runs:

- `checkCitationAccuracy` — per-citation credit `min(found, 2)` against `citations × 2`.
- `checkNoMathLeak` — links to `checkForMathLeak`.
- `checkToolSelectionAccuracy` — F1 over chosen vs expected tools.
- `logResult`/`getResults` — in-memory `resultsStore`, persisted via `evalLogRepo`.

### 2.10 Citations (`src/lib/assistant/citations.ts`)

`buildCitation` produces `{ source: document.title, article_section, version, chunk_id, document_id, relevance_score, excerpt (≈120 chars of chunk content) }`; `formatCitationsAsText` renders a `Sources:` block; a markdown variant is also provided. The mock knowledge base (`mock-knowledge.ts`) and regulatory search (`regulatory-search.ts`) supply the documents/chunks.

### 2.11 AI providers & prompts (`src/lib/ai/`)

- `src/lib/ai/provider.ts` — `getAiProvider()`; `AI_USE_MOCK` defaults `true`; falls back to the mock provider when `OPENAI_API_KEY` is absent; process-wide cache.
- `src/lib/ai/mock-provider.ts` — deterministic fixtures: BDN extraction confidence `0.96`, CII `0.93`.
- `src/lib/ai/openai-provider.ts` — typed config and error classes (`OpenAiError`, `Config`, `Auth`, `Api`, `Timeout`, `RateLimit`, `InvalidResponse`).
- `src/lib/ai/prompts/index.ts` — `ExtractionPrompt { systemPrompt, expectedFields, description, jsonSchema }` per document type, with JSON schemas: `BDN_SCHEMA` (12 required fields: supplier, port, vessel, imoNumber, fuelType, quantity, deliveryDate, …), `CII_SCHEMA` (incl. `ciiRating`, `operationalCii`, `requiredCii`, `attainedEexi`), plus FuelEU/EU-ETS/noon/logbook schemas and a `summary`/`warnings` output contract. Note: the correct path is `prompts/index.ts`; there is no `src/lib/ai/prompts.ts`.

### 2.12 Test coverage (core)

`src/lib/assistant/__tests__/` (11 files): `router.test.ts`, `tool-gateway.test.ts`, `llm-provider.test.ts`, `conversation-service.test.ts`, `assistant-service.test.ts`, `safety.test.ts`, `citations.test.ts`, `structured-tools.test.ts`, `regulatory-search.test.ts`, `evaluation.test.ts`, and the math-leak regression above.

---

## 3. The specialised assistants

### 3.1 Compliance assistant (`src/lib/compliance-assistant/`)

- **Version**: `COMPLIANCE_ASSISTANT_VERSION` / `COMPLIANCE_SYSTEM_PROMPT_VERSION` `"1.0.0"`.
- **Role** (`system-prompt.ts`): advisory analytic on EU ETS / FuelEU / MRV. Mandatory rules: use deterministic tools for every figure, cite every figure, refuse legal advice, include the disclaimer, and never recompute.
- **Response builder** (`response-templates.ts`): `ComplianceAnswer` with fields **Answer / Evidence / Why / Recommended action / Sources**; built via `ComplianceResponseBuilder`. Dedicated constant messages for *insufficient evidence* (`INSUFFICIENT_EVIDENCE_MESSAGE`) and *legal refusal* (`LEGAL_REFUSAL_MESSAGE` — "I can't provide legal advice" style) so the model never improvises a hedge.
- **Handoff** (`handoff.ts`): targets `voyage`, `maintenance`, `ocr`, `captain`, `none`. Keyword sets per target; **certificate-status queries stay local** (`CERTIFICATE_STATUS_KEYWORDS`, `isCertificateStatusQuery`), while survey/inspection/maintenance action queries route to Maintenance. Keyword-ratio confidence; hard-mapped intents (VOYAGE→voyage, CAPTAIN→captain) get confidence `1.0`.
- **Service** (`compliance-service.ts`): wraps the base `AssistantService`. If handoff target ≠ `none` with confidence `> 0.5`, returns a routing message instead of answering. Otherwise appends a compliance analysis section, the tool summary, and parameter versions; `safetyCheck.passed` additionally requires `citations > 0`.
- **Mock service**: `createMockComplianceAssistantService` answers greetings, and certificate-registry questions deterministically via `buildMockCertificateRegistry` + `complianceCertificateExplanation` from `@/lib/certificates` (`CERT_MOCK_NOW`, `CERT_MOCK_VESSEL`), cited to the registry.
- **Exports** (`index.ts`): `buildComplianceSystemPrompt`, `createComplianceResponseBuilder`, `createHandoffDetector`, `HandoffDecision/HandoffTarget`, `createComplianceAssistantService`, `createMockComplianceAssistantService`.

### 3.2 Search assistant (`src/lib/search-assistant/`)

- **Bounds** (`types.ts`): `SEARCH_HARD_LIMIT = 50`, `DEFAULT_PAGE_SIZE = 10`, `MIN_CONFIDENCE_THRESHOLD = 0.8`; 13 `SearchEntity` values (vessels, voyages, ais positions, fuel deliveries, documents, ocr runs, validation results, reviews, reports, verifier packages, audit log, regulatory docs, certificates).
- **Query parser** (`query-parser.ts`): entity-keyword table → typed search expression.
- **Query validator** (`query-validator.ts`): `FORBIDDEN_STATEMENTS` (SQL mutations, `select * from`, `union`/`join`, `grant`/`revoke`, `outfile`/`dumpfile`, comment tricks, `sleep`/`waitfor`), `FORBIDDEN_TERMS` (password, credit-card, SSN, passport, api key, secrets), `MAX_QUERY_LENGTH = 500`, `assertReadOnly()`.
- **Search memory** (`search-memory.ts`): `MAX_RECENT_PER_USER = 20` recent queries per user.
- **Saved searches** (`saved-searches.ts`): named, per user+org, listable/renameable/deletable/rerunnable.
- **Handoff** (`handoff.ts`): `SEARCH_FIRST_PATTERNS` ("find", "look up", "which document", "list", …) keep the query local; `HIGH_CONFIDENCE_PATTERNS` ("how much", "calculate", "EUA obligation", "penalty", "compliance score", "surplus/deficit", "GHG intensity", "emission factor") escalate to the **compliance** assistant.
- **Service** (`search-service.ts`): `search`, `suggest`, `listSaved`, `saveSearch`, `renameSavedSearch`, `deleteSavedSearch`, `rerunSavedSearch`.

### 3.3 Captain assistant (`src/lib/captain-assistant/`)

- **Version**: `CAPTAIN_ASSISTANT_VERSION` `"1.0.0"`.
- **Tools** (`captain-tools.ts`): `get_port_requirements`, `get_vessel_doc_status`, `get_upcoming_port_calls`, `get_iscc_status`, `get_ingest_confirmations`. Vessel-scoped: queries outside the assigned vessel raise `CaptainVesselScopeError`.
- **Readiness engine** (`readiness.ts`): deterministic `[status]` checklist from evidence doc types `IAPP_CERTIFICATE`, `MONITORING_PLAN`, `ISCC_CERTIFICATE`, `NOON_REPORT`; `bdnEvidenceStatus` GREEN/RED.
- **Ingest** (`ingest.ts`): confirmation labels `received/processing/extracted/needs_review/completed/failed`.
- **Forwarding** (`forwarding.ts`): per-IMO email inbox `imo<digits>@docs.poseidonledger.com`; whitelisted extensions and size (mirroring the `email-ingress` webhook under `src/app/api/webhooks/email/resend/`).
- **Safety** (`safety.ts`): injection/PII pattern lists; IMO regex `9\d{6}|7\d{6}|6\d{6}`; `detectOtherVessel` refuses to answer about other vessels.
- **Handoff** (`handoff.ts`): compliance-pattern questions → compliance; search-pattern → search.
- **Service** (`captain-service.ts`): `answer`, `readiness`, `ingestStatus`, `forwardingInfo`, `portCalls`; checklist formatting uses `[status]` tags + `Evidence`/`Missing`/`Deadline`/`Action`/`Source` lines; refuses to fabricate a checklist for a port not in the schedule; composes the standard disclaimer.
- **Mock** (`mock-data.ts`): `CAPTAIN_MOCK_NOW`; vessels `Aurelia`, `Serenity`, `Marguerite`; 10 scenarios: `green`, `amber`, `red`, `bdn-received`, `bdn-processing`, `bdn-review`, `bdn-complete`, `upcoming-port`, `no-port`, `unknown`.

### 3.4 Voyage assistant (`src/lib/voyage-assistant/`)

- **Version**: `VOYAGE_ASSISTANT_VERSION` `"1.0.0"`.
- **Types** (`types.ts`): `AisGapTier` (`NONE`, `INTERPOLATION_OK`, `FLAGGED`, `MANUAL_REQUIRED`, `CRITICAL_ESCALATION`); `VoyageClassification` (`INTRA_EU`, `EU_TO_THIRD_COUNTRY`, `THIRD_COUNTRY_TO_EU`, `THIRD_COUNTRY`, `UNCLASSIFIED`); `VoyageVesselScopeError`.
- **Gap ladder** (`gap-ladder.ts`): `GAP_FLAGGED_FROM_MINUTES = 30`, `GAP_MANUAL_FROM_MINUTES = 360`, `GAP_CRITICAL_FROM_MINUTES = 2880`. Manual drafts are only needed from `MANUAL_REQUIRED` (6h+); confirmation phrases are `/confirm`, "go ahead", "yes…proceed", "approve", "submit".
- **Tools** (`voyage-tools.ts`, 8): `get_voyage_log`, `get_ais_positions`, `get_data_gaps`, `get_port_info`, `explain_violation`, `get_voyage_compliance_context`, `draft_manual_voyage`, `queue_ais_sync`.
- **Safety** (`safety.ts`): no-fabrication patterns — must not invent AIS positions, distances, or ETS coverage.
- **Memory** (`memory.ts`): `MAX_ENTRIES_PER_VESSEL = 25`.
- **System prompt** (`system-prompt.ts`): "fleet voyage-data analyst console, NOT a voyage planner"; distances and ETS coverage are **stored** values read back from the log, never recomputed.
- **Service** (`voyage-service.ts`): `answer`, `voyageLog`, `aisPositions`, `dataGaps`, `portInfo`, `violations`, `greenZones`, `complianceContext`, `explain`, `draftManualVoyage`, `queueAisSync`, `recall`. Violations surface as `VCR-01` (unsubstantiated gap), `VCR-02` (missing green-zone declaration), `VCR-03` (coverage < 100%), `VCR-05` (cross-source arrival-port mismatch).
- **Mock** (`mock-data.ts`): `VOYAGE_MOCK_NOW`; `VOYAGE_PORT_REGISTRY` (e.g. `ITGOA` Genoa — EU, non-green; `FRANT` Antibes — EU green zone; `ESPMI` Palma, `ESVLC` Valencia, `ESBCN` Barcelona — green); 10 scenarios: `clean-voyage`, `gap-under-30m`, `gap-30m-to-6h`, `gap-6h-to-48h`, `gap-over-48h`, `intra-eu`, `eu-to-third-country`, `third-country-to-eu`, `consistency-violation`, `green-zone-encounter`.

### 3.5 Maintenance assistant (`src/lib/maintenance-assistant/`)

- **Version**: `MAINTENANCE_ASSISTANT_VERSION` / `MAINTENANCE_SYSTEM_PROMPT_VERSION` `"1.0.0"`.
- **Types** (`types.ts`): `SurveyStatus` (`CURRENT/UPCOMING/DUE_SOON/OVERDUE/BLOCKING/UNKNOWN`), `SurveyType` (`ANNUAL/INTERMEDIATE/SPECIAL/RENEWAL/ISM/ISPS/OTHER`), `ClassSociety` (`DNV/LR/RINA/Bureau Veritas/ABS/ClassNK/OTHER`), `ComplianceImpact` (`FACT/DETERMINISTIC_IMPACT/ADVISORY_RECOMMENDATION`), `CertificateStatus` (`VALID/EXPIRING/EXPIRED/MISSING/PENDING_REVIEW`).
- **Status engine** (`status-engine.ts`): `DUE_SOON_DAYS = 30`, `UPCOMING_DAYS = 90`, `BLOCKING_SURVEY_TYPES = [RENEWAL, SPECIAL, ISM, ISPS]`.
- **Tools** (`maintenance-tools.ts`, 6): `get_certificates`, `get_plan_status`, `get_survey_schedule`, `get_class_society`, `get_charter_calendar`, `get_deadlines`.
- **System prompt** (`system-prompt.ts`): explicitly **NOT a CMMS**; work orders, spares, and invoicing are out of scope. Impact taxonomy FACT / DETERMINISTIC_IMPACT / ADVISORY_RECOMMENDATION tells the model what it may assert.
- **Memory** (`memory.ts`): `MAX_ENTRIES_PER_VESSEL = 25`; `remember` updates an existing key or appends and slices the tail.
- **Service** (`maintenance-service.ts`): `answer`, `schedule`, `certificates`, `deadlines`, `charterCalendar`, `classSociety`, `planStatus`, `alerts`, `explain`, `recall`. Monitoring-plan provenance is cited as "Regulation (EU) 2018/2066, Art. 12".
- **Mock** (`mock-data.ts`): `MAINTENANCE_MOCK_NOW`; vessels `Aurelia`, `Serenity`, `Marguerite`; `MaintenanceMockState { vessel, schedule, certificates, classSociety, plan, charterCalendar, notifications }`; 8 scenarios: `all-current`, `due-soon`, `overdue-annual`, `expired-iscc`, `mp-review-due`, `multiple-deadlines`, `no-schedule`, `unknown-class`.

### 3.6 OCR assistant (`src/lib/ocr-assistant/`)

- **Version**: `OCR_ASSISTANT_VERSION` / `OCR_SYSTEM_PROMPT_VERSION` `"4.3.0"` (the most-iterated assistant).
- **Role**: document-quality intelligence. System prompt positions it as "an OCR QUALITY assistant, not a compliance engine and not a search index": it classifies and scores extracted documents and produces **human-reviewed suggestions** — it never asserts compliance from unreadable evidence. Reason code `OCR_REVIEW_REQUIRED`.
- **Document families** (`types.ts`): 12 `OcrDocumentFamily` values — `BDN`, `NOON_REPORT`, `LOGBOOK`, `MRV`, `FUEL_EU`, `EU_ETS`, `CERTIFICATE`, `INVOICE`, `BUNKER_ANALYSIS`, `STATEMENT`, `OTHER`, `UNKNOWN`.
- **Quality levels** (`types.ts` / `quality.ts`): `HIGH`, `MEDIUM`, `LOW`, `VERY_LOW`; composite score = `0.25·pageQuality + 0.35·textCoverage + 0.25·fieldCoverage + 0.15·confidence`; bands `≥0.8 / ≥0.6 / ≥0.4 / else`. Per-family mandatory fields drive coverage (BDN: supplier, port, vessel, imoNumber, fuelType, quantity, deliveryDate; NOON_REPORT: vessel, position, distance, speed, rpm, consumption).
- **Classification** (`classification.ts`): weighted content signals (`FAMILY_SIGNALS`); weight 3 = decisive; classification runs on content only; `UNKNOWN` below threshold.
- **Review priority** (`priority.ts`): ranks `CRITICAL 0 / HIGH 1 / MEDIUM 2 / LOW 3`; base level maps quality (`HIGH→LOW`, `MEDIUM→MEDIUM`, `LOW→HIGH`, `VERY_LOW→CRITICAL`); bumps only ever raise urgency.
- **Tools** (`ocr-tools.ts`, 7, all read): `classify_document`, `detect_quality`, `suggest_corrections`, `lookup_dictionary`, `find_similar_documents`, `explain_review_reason`, `summarize_quality`. `OcrNoDocumentError` when no document is selected.
- **Suggestions** (`suggestions.ts`): repair kinds `IMO_CHECKSUM`, `DATE_FORMAT`, `FUEL_SPELLING`, `PORT_SPELLING`, `CERTIFICATE_NUMBER_SPACING`, `MERGED_CHARACTERS`.
- **Dictionary** (`dictionary.ts`): lookup domains fuel / port / certificate / class_society / terminology / regulation.
- **Safety** (`safety.ts`): injection/PII lists; out-of-scope crew-HR matters (payroll, salary, crew contract, seafarer, employment, wage, collective bargaining, medical record).
- **Handoff** (`handoff.ts`): captain patterns ("port readiness", "am i ready", "bdn received", "ingest") → captain; compliance patterns ("non-compliant", "compliance status", "penalty", "obligation", "GHG intensity", "eu ets", "fueleu") → compliance; search patterns → search. Cross-assistant vocabulary `OcrReadinessItem` and a compliance explanation ("compliance is not asserted from unreadable evidence") are shared.
- **Service** (`service.ts`): `answer`, `classify`, `quality`, `suggestions`, `similar`, `dictionary`, `explain`, `summarize`, `recall`, `review`; scoped by `req.context?.vesselImo`.
- **Mock** (`mock-data.ts`): `OCR_MOCK_DOCUMENTS`, `OCR_MOCK_NOW`, `pageSignal`, `toOcrDocumentInput`.

### 3.7 Noon assistant (`src/lib/noon-assistant/`)

- **Version**: `NOON_ASSISTANT_VERSION` / `NOON_SYSTEM_PROMPT_VERSION` `"1.0.0"`.
- **Role**: a **deterministic console over the noon-report snapshot** — it reads back a computed `NoonReportSnapshot { report, analysis, validator, fuel, voyage, fueleu, ets, findings }` (types imported from `@/lib/noon-report`); it never recomputes consumption or compliance.
- **Tools** (`tools.ts`, 10, all read): `get_noon_latest`, `get_noon_history`, `get_noon_analysis`, `get_noon_findings`, `get_noon_fuel`, `get_noon_voyage`, `get_noon_fueleu`, `get_noon_ets`, `get_noon_operational_state`, `get_noon_deviations`. `NoonVesselScopeError` on cross-vessel queries.
- **Safety** (`safety.ts`): injection/PII lists identical to the other assistants; out-of-scope commercial/HR topics (cargo booking, freight rate, charter hire, insurance claim, tonnage tax); `NO_FABRICATION_PATTERNS` ("make up", "fabricate", "invent consumption", "fake a report", "simulate"); `check(query, assignedVessel)` plus `detectOtherVessel`.
- **Handoff** (`handoff.ts`): voyage patterns (ais gap, data gap, ETS coverage, voyage classification, green zone) → voyage; captain patterns (weather routing, navigate, should we sail) → captain; compliance patterns + `COMPLIANCE_REGEXES` → compliance; search → search.
- **Service** (`service.ts`): `answer`, `latestReport`, `analysis`, `findings`, `fuel`, `voyage`, `fueleu`, `ets`, `operationalState`, `deviations`, `history`, `explain`, `recall`; default clock `NOON_MOCK_NOW`. FuelEU/ETS handlers end with the same disclaimer: operational inputs for the engine, compliance position not interpreted.
- **Mock** (`mock-data.ts`): `NOON_MOCK_NOW = 2026-08-01T13:00:00.000Z`; `createMockNoonState(scenario)`; vessel `POSEIDON`; `scenarioLabel`/`noonDestinationLabel` helpers; scenario `clean-at-sea` used by the tests (`__tests__/tools.test.ts`, `service.test.ts`, `mock-data.test.ts`, `_factory.ts`).

---

## 4. Handoff protocol

Handoff is the mechanism by which an assistant detects that a question belongs to another specialist and routes instead of answering. It is implemented twice: a lightweight keyword-level `detectHandoff` in the core router, and richer, confidence-scored detectors in each assistant's `handoff.ts`.

### 4.1 Core router handoff (`src/lib/assistant/router.ts`)

Triggered when the classified intent is `COMPLIANCE`, `UNKNOWN`, or `DOCUMENT`; keyword groups per target (voyage / maintenance / OCR / captain) decide the target; `none` means the current assistant answers.

### 4.2 Compliance assistant

- Targets: `voyage`, `maintenance`, `ocr`, `captain`, `none`.
- `INTENT_TARGET_MAP` hard-maps classifier intents (`VOYAGE → voyage`, `CAPTAIN → captain`, confidence `1.0`).
- Otherwise keyword-ratio confidence; effective handoff threshold `confidence > 0.5` (enforced in `compliance-service.ts`).
- **Certificate-status queries stay local**: `CERTIFICATE_STATUS_KEYWORDS` ("certificate status", "certificate registry", "expiring", "missing certificate", "certificate pending review", …) and `isCertificateStatusQuery` keep the question with the compliance assistant, which answers from the deterministic certificate registry. Survey/inspection/maintenance action queries route to Maintenance.

### 4.3 Other assistants

- Captain → compliance (via `COMPLIANCE_PATTERNS`) and search (`SEARCH_PATTERNS`); confidence `min(0.6 + matches·0.15, 1.0)`.
- Voyage → captain / compliance / search.
- Maintenance → captain / compliance / search.
- OCR → captain / compliance / search.
- Noon → voyage / captain / compliance / search.
- Search → compliance on high-confidence compute patterns (§3.2).

### 4.4 Design note

The architecture doc (§3, "orchestration and collaboration") describes single-specialist, handoff, and multi-assistant fan-out. Current code implements the first two; the **global invariant is preserved everywhere**: the receiving assistant's compliance figures still come from deterministic tools, never from the model.

---

## 5. Tool calling

### 5.1 Contract

`ToolDefinition` (see §2.1). All deterministic tools carry JSON schemas for `inputSchema`/`outputSchema`; `permission` is `read` or `write`; `requiresConfirmation` gates writes.

### 5.2 Tool counts per assistant

| Assistant | Tools | Notes |
|---|---|---|
| Core structured tools (`structured-tools.ts`) | 15 | all `read`, no confirmation |
| Voyage (`voyage-tools.ts`) | 8 | incl. write-style `draft_manual_voyage`, `queue_ais_sync` (confirmation-gated) |
| Maintenance (`maintenance-tools.ts`) | 6 | all read |
| OCR (`ocr-tools.ts`) | 7 | all read; `OcrNoDocumentError` |
| Noon (`tools.ts`) | 10 | all read; `NoonVesselScopeError` |
| Captain (`captain-tools.ts`) | 5 | all read; `CaptainVesselScopeError` |
| Search | registry-based | mock records across 13 entity families |

### 5.3 Execution and recording

- **Gateway path** (`tool-gateway.ts`): `execute` validates name + confirmation requirement, delegates to the tool service, persists to `assistant_tool_calls` via `toolCallRepo`, and supports `getHistory` for the model.
- **Inline path** (`assistant-service.ts`): the generic assistant executes all available structured tools inline with current-year context, records successful calls, and hands the JSON to the LLM.
- **Vessel scoping**: every specialist registry raises a vessel-scope error (`*VesselScopeError` / `detectOtherVessel`) before executing on a foreign IMO — the multi-tenant org-scope rule from the architecture doc.

### 5.4 The math-leak guardrail

The figure-producing tools are the only legitimate source of numbers. `safety.checkForMathLeak` compares every figure-bearing phrase in the draft against the concatenated tool results; a figure present in neither tool output nor an allowed disclaimer context fails the check, blocks the response, and records a `noMathLeakViolation` in the evaluation harness. `structured-tools.test.ts` and `no-math-leak-regression.test.ts` pin this behaviour.

---

## 6. API surface

All routes are Next.js App Router handlers under `src/app/api/`, using the shared helpers in `src/app/api/_lib/` (`http.ts` `apiSuccess`/`apiError`/`parseJsonBody`; `errors.ts` `VALIDATION_ERROR` etc.; `schemas.ts`; `deps.ts`; `cookies.ts`) and `getSupabaseClient` for persistence.

### 6.1 Generic assistant — `/api/assistant`

| Route | Method(s) | Behaviour |
|---|---|---|
| `conversations` | GET | `listActiveByUser(user_id)` |
| `conversations` | POST | create conversation (`AssistantConversationInsertSchema`) |
| `conversations/[id]` | GET | conversation + messages |
| `conversations/[id]` | PATCH | update (title/status) |
| `conversations/[id]` | DELETE | archive |
| `conversations/[id]/messages` | GET | list messages |
| `conversations/[id]/messages` | POST | `{ content }` → full pipeline (mock LLM + knowledge base + regulatory search + citations + structured tools + gateway + safety + router + assistant service + conversation service), persists user + assistant messages and tool calls |
| `conversations/[id]/tools` | GET | `{ toolCalls }` for the conversation |
| `evaluate` | POST | `{ test_name, assistant_type?, query }` → same pipeline + `createEvaluationHarness` |
| `search` | POST | `{ question, regulation?, effective_date?, max_results? }` → deterministic regulatory search |
| `knowledge` | GET | `?regulation=` → `{ documents, chunks }` |

### 6.2 Specialist routes

| Route | Method | Body | Defaults |
|---|---|---|---|
| `/api/captain` | POST | `{ query, captain_id?, organization_id?, scenario? }` | `captain-001` / `org-001`, vessel `AURELIA` |
| `/api/maintenance` | POST | `{ query, operator_id?, organization_id?, scenario? }` | `ops-001` / `org-001`, vessel `AURELIA` |
| `/api/voyage` | POST | `{ query, operator_id?, organization_id?, scenario? }` | `ops-001` / `org-001`, vessel `AURELIA` |
| `/api/search` | POST | `{ query, organization_id?, user_id?, vessel_id?, page?, page_size? }` | `org-001` / `user-001` |
| `/api/search/audit` | GET | `organization_id` filter | — |
| `/api/search/recent` | GET | `user_id`, `organization_id`, `limit` | — |
| `/api/search/saved` | GET/POST | list / save `{ name, query, ... }` | — |
| `/api/search/saved/[id]` | PATCH/DELETE | rename / delete | — |
| `/api/search/saved/[id]/rerun` | POST | rerun saved query | — |

Each specialist route validates the optional `scenario` against its `isXScenarioKey` guard before constructing a per-scenario service; otherwise it calls the shared singleton (`_service.ts` per route: `getCaptainService` default `amber`, `getMaintenanceService` default `all-current`, `getVoyageService` default `clean-voyage`, `getSearchService`), each with a `reset*ServiceForTest()` companion.

### 6.3 Gaps vs the architecture doc

- **No `/api/compliance-assistant` route** — compliance is exercised through `/api/assistant/*`.
- **No `/api/ocr-assistant` or `/api/noon-assistant` routes** — both are library modules only.
- The **email-ingress webhook** (`/api/webhooks/email/resend/*`) is the real-world entry point for document intake referenced by the Captain assistant's `imo<digits>@docs.poseidonledger.com` forwarding inbox.

---

## 7. Safety & compliance boundary

### 7.1 Deterministic core, advisory AI

- AI never computes CO2, EUA obligations, GHG intensity, voyage classification, or any figure flowing to THETIS-MRV (§1). Enforcement is structural (figures only exist inside tool services) plus runtime (`checkForMathLeak`).
- The mock LLM itself refuses to produce compliance figures — it defers to the engine (canned deferral responses for compliance/regulation/EU-ETS/FuelEU prompts in `llm-provider.ts`).

### 7.2 Disclaimer and refusal strings

- `STANDARD_DISCLAIMER` is appended by `buildFinalResponse` on every assistant answer.
- Compliance builder uses fixed `INSUFFICIENT_EVIDENCE_MESSAGE` and `LEGAL_REFUSAL_MESSAGE` strings so refusals are consistent and non-negotiable.

### 7.3 No-fabrication guards

- Voyage: must not invent AIS positions, distances, or ETS coverage (`safety.ts` no-fabrication patterns).
- Noon: must not invent consumption or fake reports (`NO_FABRICATION_PATTERNS`).
- OCR: quality scoring only; `OCR_REVIEW_REQUIRED` reason code; suggestions are human-reviewed; compliance is never asserted from unreadable evidence.
- Captain: refuses checklists for ports not in the schedule; scoped to the assigned vessel.
- Maintenance: never invents survey requirements; not a CMMS; impact taxonomy bounds what it may claim.
- Search: read-only enforcement (`assertReadOnly`, forbidden SQL/secret terms, `MAX_QUERY_LENGTH`).

### 7.4 Injection & PII

Every assistant ships an identical injection/PII pattern set (`ignore previous …`, "system prompt", jailbreak, "developer mode", SQL/credential terms; email/phone/passport/SSN patterns), with per-assistant out-of-scope lists (crew HR, commercial chartering, tonnage tax, medical records).

### 7.5 Scope enforcement

- Vessel-scope errors in captain/voyage/noon tool registries; `detectOtherVessel` in captain/noon safety guards.
- Org-scoped tool gateway per the architecture doc; audit trail via `audit_log` and `assistant_tool_calls`.

### 7.6 Certification & status determinism

Certificate statuses (`VALID/EXPIRING/EXPIRED/MISSING/PENDING_REVIEW`), survey statuses (`CURRENT/UPCOMING/DUE_SOON/OVERDUE/BLOCKING/UNKNOWN`), and readiness checklists are produced by deterministic engines (maintenance status-engine, compliance certificate registry, captain readiness) — the model only explains them.

---

## 8. Mock vs production

### 8.1 Default behaviour is fully mocked

Every HTTP entry point constructs the pipeline with mock factories, so the whole assistant surface runs without any API key or database:

- `createMockLlmProvider` in every `/api/assistant` handler and `createRouter({ useMock: true })`.
- `createMockStructuredToolService` for the 15 deterministic tools.
- `getAiProvider()` in `src/lib/ai` defaults `AI_USE_MOCK = true` and falls back to mock when `OPENAI_API_KEY` is missing.
- Assistant-specific mock states (`createMockCaptainState`, `createMockMaintenanceState`, `createMockVoyageState`, `createMockNoonState`, `OCR_MOCK_DOCUMENTS`, `createMockComplianceAssistantService`).
- Deterministic, frozen clocks per assistant (§1.3) and frozen fixture confidence (BDN 0.96, CII 0.93).

### 8.2 Mock scenarios as test fixtures

Scenario keys are shared between the mock data and the API layer guards:

- Captain (10): `green amber red bdn-received bdn-processing bdn-review bdn-complete upcoming-port no-port unknown`
- Maintenance (8): `all-current due-soon overdue-annual expired-iscc mp-review-due multiple-deadlines no-schedule unknown-class`
- Voyage (10): `clean-voyage gap-under-30m gap-30m-to-6h gap-6h-to-48h gap-over-48h intra-eu eu-to-third-country third-country-to-eu consistency-violation green-zone-encounter`
- Noon: `clean-at-sea` and friends via `createMockNoonState`

### 8.3 Switching to production

| Component | Mock | Production |
|---|---|---|
| LLM | `createMockLlmProvider` | `createRealLlmProvider` (throws without API key; openai/anthropic/custom registry) |
| AI extraction | `mock-provider` fixtures | `openai-provider` (typed errors, retries, timeout) |
| Structured tools | in-memory mock state | `StructuredToolContext` with real `fuelEuRepo/etsRepo/mrvRepo/vesselRepo/fuelDeliveryRepo` |
| Regulatory search | mock knowledge base | real `knowledge_documents` / `knowledge_chunks` |
| Persistence | in-memory | Supabase (`getSupabaseClient`) conversations/messages/tool_calls, `audit_log` |
| Class society | mock registry (`createMockClassSocietyService`, `isLive() === false`) | live lookup |

### 8.4 Testability

`reset*ServiceForTest()` on every singleton, frozen mock clocks, and the evaluation harness (`evaluate/route.ts`, `evaluation.ts`) together make assistant behaviour reproducible in tests and CI — the same reason the math-leak regression can assert that the *model*, not the deterministic engine, is the one being guarded.

---

# 8. APIs


> Scope: the Poseidon Ledger HTTP API, implemented as Next.js App Router route
> handlers. Every `route.ts` under `src/app/api/` (87 files) was read for this
> chapter. Supporting sources: `src/lib/api/` (response helpers),
> `src/services/api-client.ts` (client wrapper), `src/app/api/_lib/*` (shared
> error mapping, deps factory, cookie helpers, zod schemas), and
> `src/constants/routes.ts` / `src/constants/navigation.ts` (page mapping).

---

## 1. Overview

### 1.1 Route handler conventions

The API is implemented with **Next.js App Router Route Handlers**: each URL
segment is a directory containing a `route.ts` module that exports one or more
HTTP-method functions (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`). Path segments in
square brackets are dynamic params (`[imo]`, `[id]`, `[year]`). With the
exception of the top-level `vessels`, `ais-positions`, `reports`, and
`verifier-packages` handlers, **params are declared as `Promise`** in the newer
route files (App Router 15 style), e.g. `{ params }: { params: Promise<{ imo: string }> }`
in `src/app/api/vessels/[imo]/route.ts`, while a few older routes use the
synchronous form (`{ params }: { params: { imo: string } }`, e.g. `track`,
`port-calls`, `voyages/[id]`).

Three implementation styles coexist, all visible in the tree:

1. **Thin delegate + handler module.** `route.ts` only builds dependencies and
   forwards to a `handler.ts` in the same folder. Used by vessels, AIS, ingest,
   and the webhook (`src/app/api/vessels/route.ts`, `vessels/[imo]/voyages/handler.ts`,
   `ais-positions/handler.ts`, `ingest/marinetraffic/handler.ts`,
   `webhooks/email/resend/handler.ts`).
2. **Dependency-injected handler with `_lib.ts` factory.** The route accepts an
   optional `deps` parameter defaulting to `buildDefault…ApiDeps()` so tests can
   inject fakes. Used by auth, settings, noon, sox-watch, certificates, and OCR
   (`src/app/api/auth/login/route.ts`, `vessels/[imo]/noon/_lib.ts`,
   `vessels/[imo]/sox-watch/_lib.ts`, `vessels/[imo]/certificates/_lib.ts`,
   `ocr/_lib.ts`).
3. **Inline logic.** Handlers that query repositories/client directly in the
   route file (documents, review-tasks, reports, verifier-packages, notifications,
   dashboard, analytics, map-config, environmental-zones, assistant/search, etc.).

There is no global middleware, no OpenAPI spec, and no centralized router: each
route is self-contained and validates/responds independently.

### 1.2 Response envelope

**Two distinct envelope helpers exist and are both in active use.**

**A. `src/app/api/_lib/http.ts`** (the "route-library" envelope, used by the
majority of endpoints: auth, settings, vessels, noon, sox, certificates, OCR,
AIS, ingest, webhook, reports, verifier-packages, notifications, fuel):

- Success — `apiSuccess<T>(data, status = 200)` → `{ success: true, data: T }`.
- Created — `apiCreated<T>(data)` → `{ success: true, data: T }` with status `201`.
- Error — `apiError(code, message, status, details?)` →
  `{ success: false, error: { code, message, details? } }` where `details` is an
  array of `{ path: string; message: string }` (from zod flattening). `details`
  is only included when non-empty (`Object.defineProperty` sets it
  non-enumerable otherwise).

**B. `src/lib/api/helpers.ts`** (the "client-helper" envelope, used only by the
documents and review-tasks routes, plus re-exported through
`src/lib/api/index.ts`):

- `apiSuccess<T>(data, status: 200|201 = 200)` → `{ success: true, data: T }`.
- `apiError(message, status = 500, code = "INTERNAL_ERROR", details?)` →
  `{ success: false, error: { code, message, details? } }`.
  **Note the argument-order difference**: helper B is `(message, status, code)`,
  helper A is `(code, message, status)`.
- `apiPaginated<T>(data, total, limit, offset)` →
  `{ success: true, data: T[], pagination: { total, limit, offset } }`. This is
  defined and exported but **never called by any route** — paginated reads
  instead return the repository `Page<T>` shape (below).

**Collection/pagination shape.** Collection reads (vessels, voyages, AIS) do
*not* use `apiPaginated`; the repository returns a `Page<T>` and the handler
wraps it in `data`:

```
{ success: true, data: { rows: T[], limit, offset, total } }
```

`Page<T>` is defined at `src/lib/supabase/types.ts:1480` with fields
`rows`, `limit`, `offset`, `total`. `normalizePagination()` caps `limit` at
`MAX_LIMIT = 100` and defaults to `DEFAULT_LIMIT = 50`
(`src/lib/supabase/types.ts:1487–1501`).

**Envelope deviations.** A handful of routes escape the envelope convention:

- `GET /api/vessels/[imo]/track` returns `{ vesselId, imo, track }` and errors as
  `{ error: string }` with status 404/500 (`src/app/api/vessels/[imo]/track/route.ts`).
- `GET /api/vessels/[imo]/port-calls` returns `{ portCalls, vesselId }` and a raw
  `{ error }` on failure (`…/port-calls/route.ts`).
- `GET /api/vessels/[imo]/zone-events` returns `{ vesselId, alerts, zoneCount }`
  with a raw `{ error }` failure shape (`…/zone-events/route.ts`).
- `GET /api/map-config` returns the config object bare (no envelope), with a
  `Cache-Control: public, max-age=3600, stale-while-revalidate=60` header
  (`src/app/api/map-config/route.ts`).
- `GET /api/environmental-zones` returns the zone rows bare
  (`src/app/api/environmental-zones/route.ts`).
- `POST /api/search` and `POST /api/search/saved/[id]/rerun` return the service
  response object bare (`Response.json(response)`).
- Download endpoints return JSON *attachments*: `Content-Disposition: attachment`
  (reports `…/[id]/download`, verifier-packages `…/[id]/download`).

### 1.3 HTTP status codes and error codes

Centralized error codes are declared in `src/app/api/_lib/errors.ts`
(`ErrorCode` union). Notable codes: `INVALID_JSON`, `VALIDATION_ERROR`,
`IMO_MISMATCH`, `INVALID_IMO`, `VESSEL_NOT_FOUND`, `NOT_FOUND`,
`DOCUMENT_NOT_FOUND`, `MISSING_FILE`, `MISSING_TITLE`,
`MISSING_DOCUMENT_TYPE`, `INVALID_DOCUMENT_TYPE`, `FILE_TOO_LARGE`,
`FUEL_DELIVERY_NOT_FOUND`, `INVALID_EMAIL_PAYLOAD`, `UNSUPPORTED_ATTACHMENT`,
`DUPLICATE_ATTACHMENT`, `WEBHOOK_AUTH_FAILED`, `REPORT_NOT_FOUND`,
`REPORT_GENERATION_FAILED`, `PACKAGE_NOT_FOUND`, `PACKAGE_GENERATION_FAILED`,
`NOTIFICATION_NOT_FOUND`, `PACKAGE_VALIDATION_FAILED`, `INTEGRITY_ERROR`,
`RATE_LIMITED`, `UPSTREAM_ERROR`, `MALFORMED_RESPONSE`, `CONFIGURATION_ERROR`,
`REPOSITORY_UNAVAILABLE`, `INTERNAL_ERROR`, plus the Phase 4.5 auth codes
`INVALID_CREDENTIALS`, `UNAUTHORIZED`, `INVALID_SESSION`, `INVALID_RESET_TOKEN`,
`EMAIL_ALREADY_IN_USE`, `INVITE_CONFLICT`, `INVITE_NOT_FOUND`, `USER_NOT_FOUND`,
`ORGANIZATION_NOT_FOUND`, `LAST_OWNER`, `FORBIDDEN`, `INVALID_INTEGRATION`.

Status codes used (see `HttpStatusCode` in `src/lib/api/helpers.ts` and the
mappings in `src/app/api/_lib/http.ts`): **200** success, **201** created,
**400** validation/parse errors, **401** unauthenticated / bad credentials,
**403** missing permission / inactive user / self-demotion,
**404** unknown resource, **409** conflict (duplicate invite, last-owner guard,
invalid transition), **413** file too large, **415** (declared but unused),
**429** rate-limited, **500** internal, **502** upstream timeout/malformed,
**503** repository/unavailable.

The **error-mapping** layer `mapErrorResponse(err)` +
`httpStatusForError(err)` (`src/app/api/_lib/http.ts:41–155`) inspects the thrown
error's `constructor.name` and maps domain exception types to `(code, status)`:
`InvalidIMOError`→400, `VesselNotFoundError`→404, `RateLimitError`→429 (with a
`Retry-After` header), `TimeoutError`/`UpstreamError`→502, `MalformedResponseError`→502,
`ConfigurationError`→500, `RepositoryIntegrityError`→409, `RepositoryError`/`RepositoryUpstreamError`→503,
`ReportNotFoundError`/`PackageNotFoundError`/`NotificationNotFoundError`→404,
`ReportGenerationError`/`PackageGenerationError`→500, `PackageValidationError`→400,
`InvalidCredentialsError`→401, `UserNotActiveError`→403, `InvalidSessionError`→401,
`InvalidResetTokenError`→400, `OrganizationNotFoundError`→404, `UserNotFoundError`→404,
`InviteNotFoundError`→404, `InviteConflictError`→409,
`CannotDeactivateLastOwnerError`→409, `CannotDemoteSelfError`→403,
`InvalidIntegrationError`→400. Unknown errors fall through to
`INTERNAL_ERROR` / 500. Routes that use the simpler inline `try/catch`
(e.g. auth, noon, sox) instead switch on error names manually and emit
`INTERNAL_ERROR` 500 by default.

### 1.4 Authentication and authorization enforcement per route

The API has **no global auth middleware**; enforcement is per-route.

- **Auth + Settings routes** enforce a session cookie. The mock session token is
  carried in the `pl_session` cookie (`AUTH_COOKIE_NAME`, `src/app/api/_lib/cookies.ts`)
  as `HttpOnly; Path=/; SameSite=Lax; Max-Age=43200`. `readCookie()` parses the
  raw Cookie header; `sessionCookieValue()`/`clearSessionCookieValue()` build the
  Set-Cookie values.
  - `GET/POST /api/auth/*` read the cookie themselves; `session` returns
    `{ user: null, organization: null }` when unauthenticated rather than a 401
    (`src/app/api/auth/session/route.ts`).
  - Settings routes call the `requireAuth(deps, req)` guard which returns a 401
    `{ code: "UNAUTHORIZED" }` response when no valid session exists, and
    `requirePermission(session, permission)` which returns 403
    `{ code: "FORBIDDEN" }` when `can(session.user.role, permission)` fails
    (`src/app/api/settings/_lib.ts:68–88`). Permission checks per section:
    `org_manage` (organization), `settings_general` (general/appearance/notifications),
    `settings_integrations` (integrations), `users_invite` (invites),
    `users_manage` (user role/status changes).
- **All other route groups (vessels, AIS, noon, sox, certificates, documents,
  OCR, review, reports, verifier-packages, notifications, fuel, assistants,
  search, webhooks, ingest, map/zones) do NOT authenticate.** They are
  effectively public/demo endpoints in the current build. Notable user
  identifiers are passed explicitly by callers: `recipient_id` for
  notifications, `user_id`/`organization_id` for assistant conversations and
  search, `vesselId` for AIS latest, etc.

### 1.5 The mock seam

Two mock mechanisms are exposed through the API:

1. **`?mock=true` query flag.** Routes that host a deterministic demo dataset
   re-resolve dependencies to an in-memory engine when `mock=true`:
   - `GET /api/vessels/[imo]/certificates` and
     `POST /api/vessels/[imo]/certificates/evaluate` swap to the deterministic
     "Aurelia" registry (IMO 9074729) via `resolveCertificateApiDeps(true)`
     (`vessels/[imo]/certificates/_lib.ts`, `buildMockCertificateApiDeps`).
   - `POST /api/documents/[id]/certificate` swaps to
     `buildMockDocumentCertificateApiDeps()` (same Aurelia vessel,
     `documents/[id]/certificate/_lib.ts`).
   - `GET /api/ocr/quality`, `POST /api/ocr/review`, `POST /api/ocr/suggestions`,
     `PATCH /api/ocr/suggestions/[id]` swap the persistence repos to the in-memory
     `createFakeSupabaseClient()` (`src/lib/supabase/fake-client`)
     (`ocr/_lib.ts:74–80`).
   - `GET /api/ocr/queue` always builds mock deps (`ocr/queue/route.ts:44`).
   - `POST /api/vessels/[imo]/sox-watch/evaluate` accepts a `scenario` key
     (e.g. `green`/`amber`/`red`) that feeds deterministic mock inputs into the
     evaluation engine (`sox-watch/evaluate/route.ts:50–66`).
   - The response payloads include a `mock` boolean flag so clients can tell
     which engine served the data (certificates, OCR, noon evaluate).
2. **`scenario` body field on assistant endpoints.** `POST /api/captain`,
   `POST /api/maintenance`, and `POST /api/voyage` accept a `scenario` key
   (`amber`, `bdn-received`, `clean-voyage`, `gap-over-48h`, …) and rebuild the
   assistant service from the corresponding mock state factory, instead of using
   the module-level singleton service
   (`captain/_service.ts`, `maintenance/_service.ts`, `voyage/_service.ts`).

### 1.6 Client-side wrapper

`src/services/api-client.ts` defines the single client wrapper used by the
service layer:

- `ApiResponse<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope` (mirror of the
  server envelope; error `details` is typed as
  `ReadonlyArray<{ path, message }>`).
- `apiFetch<T>(path, options)`: prefixes `/api/` when the path does not already
  start with `/`, sets `Content-Type: application/json`, parses the JSON body,
  and **throws `ApiError(code, message, status, details)`** whenever
  `success === false`; otherwise returns `body.data`.
- Constants/helpers: `DEFAULT_PAGE_SIZE = 20`, `PaginationParams { limit?, offset? }`,
  `pageOffset(page, pageSize)`.

Typical consumer chain: page → hook (`src/hooks/*`) → service
(`src/services/*.service.ts`) → `apiFetch`. Some hooks call `fetch("/api/...")`
directly (documents, OCR, review-tasks, sox, vessels/certificates, track,
port-calls, zone-events, notifications) and unwrap the envelope by hand.

---

## 2. API groups

> **Totals: 87 `route.ts` files exposing 109 HTTP endpoints.** Groups below list
> method + path, purpose, request body/params, response data fields (as
> actually named in the handlers), and the page(s) that consume the endpoint.
> Page routes come from `src/constants/routes.ts` (e.g. `/fleet/[imo]` from
> `ROUTES.vesselDetail(imo)`), `src/constants/navigation.ts`, and the page files
> themselves.

### 2.1 Auth (`src/app/api/auth/*`)

All auth routes accept injected `AuthApiDeps` (`auth/_lib.ts`), built by
`buildDefaultAuthApiDeps()` from the Supabase client, `createOrganizationUserRepository`,
`createOrganizationRepository`, `createAuthTokenRepository`, and a mock
`createMockNotificationEmailProvider` wired into `createAuthService`
(`src/lib/auth`).

| Endpoint | Purpose |
|---|---|
| **POST `/api/auth/login`** | Authenticate and set the session cookie. |
| **POST `/api/auth/logout`** | Revoke session token and clear cookie. |
| **GET `/api/auth/session`** | Resolve cookie to user + organization. |
| **POST `/api/auth/forgot-password`** | Start password reset (always `sent:true`). |
| **POST `/api/auth/reset-password`** | Complete reset with one-time token. |

- **POST `/api/auth/login`** (`auth/login/route.ts`). Body `{ email, password }`
  (email lower-cased/trimmed). Missing fields → 400 `VALIDATION_ERROR`. Calls
  `deps.service.login`, then returns `{ success, data: { user, organization } }`
  and sets `Set-Cookie: pl_session=…`. Errors: `INVALID_CREDENTIALS` 401
  (`InvalidCredentialsError`), `FORBIDDEN` 403 (`UserNotActiveError`).
  Consumed by `src/hooks/use-auth.ts` → login page (`src/app/login/page.tsx`);
  demo creds flow from `src/constants/demo.ts`.
- **POST `/api/auth/logout`** (`auth/logout/route.ts`). Reads the `pl_session`
  cookie, calls `deps.service.logout(token)` if present, clears the cookie, and
  returns `{ loggedOut: true }`. Consumed by `use-auth.ts`.
- **GET `/api/auth/session`** (`auth/session/route.ts`). No cookie → 200
  `{ user: null, organization: null }`; invalid session → same; otherwise
  `{ user, organization }` where `user` carries `id`, `email`, `full_name`,
  `role`, `status` and `organization` carries `id`, `name` (from `AuthSessionInfo`
  in `src/lib/auth`). Consumed by `use-auth.ts` on mount (route guard for
  protected pages).
- **POST `/api/auth/forgot-password`** (`auth/forgot-password/route.ts`). Body
  `{ email }`. Always returns `{ sent: true }` to avoid account enumeration;
  a mock reset email is dispatched only when the address matches a user.
  Consumed by `/forgot-password` page via `requestPasswordReset` (`auth.service.ts`).
- **POST `/api/auth/reset-password`** (`auth/reset-password/route.ts`). Body
  `{ token, password }`. Missing → 400 `VALIDATION_ERROR`. Returns
  `{ reset: true }`; invalid token → 400 `INVALID_RESET_TOKEN`.
  Consumed by `/reset-password` page via `resetPassword` (`auth.service.ts`).

### 2.2 Settings (`src/app/api/settings/*`)

Wired in `settings/_lib.ts` (SettingsService + auth session guard; see §1.4).

| Endpoint | Purpose |
|---|---|
| **GET `/api/settings`** | Full settings bundle for the current org. |
| **PATCH `/api/settings`** | Section-scoped update (organization/general/appearance/notifications/integrations). |
| **POST `/api/settings/invites`** | Create pending invitation + mock invite email. |
| **PATCH `/api/settings/invites/[id]`** | Cancel or resend an invite. |
| **PATCH `/api/settings/users/[id]`** | Change member role or active status. |

- **GET `/api/settings`** (`settings/route.ts`). Auth required. Returns
  `data = SettingsService.getBundle(orgId)` — the `SettingsBundle` shape from
  `src/lib/settings`: `{ organization, general, appearance, notifications,
  integrations, users, invites }`. Consumed by `use-settings.ts` →
  `getSettingsBundle()` (`auth.service.ts`) on `/settings`, `/settings/organization`,
  `/settings/appearance`, `/settings/notifications`, `/settings/integrations`,
  `/settings/users`.
- **PATCH `/api/settings`** (`settings/route.ts`). Body `{ section, … }`.
  `section: "organization"` (perm `org_manage`) → `{ section, organization }`;
  `"general"` → `{ section, general }` (fields `organizationName`,
  `defaultTimezone`, `defaultReportingYear`, `language`); `"appearance"` →
  `{ section, appearance }`; `"notifications"` → `{ section, notifications }`;
  `"integrations"` with `{ provider, action: "configure"|"disconnect", config }`
  (perm `settings_integrations`) → `{ section, integration }`. Missing section →
  400 `VALIDATION_ERROR`; unknown provider → 400; unknown action → 400.
  Consumed by the four settings pages via `settings.service.ts`
  (`updateOrganization`, `updateGeneral`, `updateAppearance`,
  `updateNotificationPreferences`, `configureIntegration`,
  `disconnectIntegration`).
- **POST `/api/settings/invites`** (`settings/invites/route.ts`). Perm
  `users_invite`. Body `{ email, fullName?, role }`; role must be a known
  `isRoleCode`. Returns 201 `{ invite }`; `InviteConflictError` → 409
  `INVITE_CONFLICT`. Consumed by `/settings/users` page (`inviteUser`).
- **PATCH `/api/settings/invites/[id]`** (`settings/invites/[id]/route.ts`).
  Body `{ action: "cancel" | "resend" }`. Returns `{ invite }`;
  `InviteNotFoundError` → 404 `INVITE_NOT_FOUND`; `InviteConflictError` → 409.
  Consumed by `/settings/users` (`cancelInvite`, `resendInvite`).
- **PATCH `/api/settings/users/[id]`** (`settings/users/[id]/route.ts`). Perm
  `users_manage`. Body `{ role?, status?: "active"|"inactive" }` (at least one).
  Returns `{ user }`. Errors: `UserNotFoundError`→404 `USER_NOT_FOUND`,
  `CannotDemoteSelfError`→403 `FORBIDDEN`, `CannotDeactivateLastOwnerError`→409
  `LAST_OWNER`. Consumed by `/settings/users` (`changeUser`).

### 2.3 Vessels & fleet intelligence (`src/app/api/vessels/*`)

Dependencies come from `createDefaultDeps()` / `createApiDeps()` in
`src/app/api/_lib/deps.ts` (see §3.1). Handlers live in sibling `handler.ts`
files; several endpoints build a `VesselRepository` inline.

| Endpoint | Purpose |
|---|---|
| **GET `/api/vessels`** | Paginated fleet list. |
| **GET `/api/vessels/[imo]`** | Single vessel by IMO. |
| **PUT `/api/vessels/[imo]`** | Upsert vessel by IMO (zod validated). |
| **GET `/api/vessels/[imo]/voyages`** | Paginated voyage list. |
| **POST `/api/vessels/[imo]/voyages`** | Insert voyage from domain payload. |
| **GET `/api/vessels/[imo]/voyages/latest`** | Latest voyage or 404. |
| **GET `/api/vessels/[imo]/track`** | AIS-derived track polyline. |
| **GET `/api/vessels/[imo]/ais-positions`** | Paginated AIS positions. |
| **GET `/api/vessels/[imo]/port-calls`** | Port-call history for the vessel. |
| **GET `/api/vessels/[imo]/noon`** | Latest + recent history + count. |
| **POST `/api/vessels/[imo]/noon`** | Ingest a noon report extraction. |
| **GET `/api/vessels/[imo]/noon/latest`** | Latest noon report (`report` may be null). |
| **GET `/api/vessels/[imo]/noon/history`** | Noon history (report_date desc). |
| **POST `/api/vessels/[imo]/noon/evaluate`** | Run deterministic noon analysis/validation. |
| **GET `/api/vessels/[imo]/sox-watch`** | Med SOx ECA watch state + events. |
| **POST `/api/vessels/[imo]/sox-watch/evaluate`** | Evaluate SOx ECA compliance (optional scenario). |
| **GET `/api/vessels/[imo]/sox-events`** | Append-only SOx compliance events. |
| **GET `/api/vessels/[imo]/zone-events`** | Zone crossing alerts computed from track. |
| **GET `/api/vessels/[imo]/certificates`** | Certificate registry with derived statuses. |
| **POST `/api/vessels/[imo]/certificates/evaluate`** | Re-evaluate/status-snapshot certificates (optional reconcile). |
| **GET `/api/vessels/[imo]/mrv/[year]`** | MRV reporting snapshot + EU ETS record. |
| **POST `/api/vessels/[imo]/mrv/[year]`** | `?action=validate` generate MRV report; `?action=export` build XML/CSV export. |
| **GET `/api/vessels/[imo]/fueleu/[year]`** | FuelEU compliance record. |
| **POST `/api/vessels/[imo]/fueleu/[year]`** | Compute & persist FuelEU record. |
| **GET `/api/vessels/[imo]/eu-ets/[year]`** | EU ETS record. |
| **POST `/api/vessels/[imo]/eu-ets/[year]`** | Compute & persist EU ETS record. |

Details:

- **GET `/api/vessels`** (`vessels/handler.ts`). Query `limit`, `offset`.
  Returns `data = Page<VesselRow>` (`{ rows, limit, offset, total }`). Consumed by
  `use-vessels.ts` → fleet page (`/fleet`), compliance page
  (`getVessels({ limit: 50 })`), and `use-certificate-registry-link.ts`
  (`/api/vessels?limit=200`).
- **GET `/api/vessels/[imo]`** (`vessels/[imo]/handler.ts`). `data = VesselRow`
  (`id`, `imo`, `name`, `mmsi`, `ship_id`, `gross_tonnage`, … per
  `src/lib/supabase/types.ts`). 404 `NOT_FOUND` when missing. Consumed by
  `use-vessel.ts` → `/fleet/[imo]`.
- **PUT `/api/vessels/[imo]`** (`vessels/[imo]/handler.ts`). Body validated by
  `vesselUpsertSchema` (`src/app/api/_lib/schemas.ts`): `{ name, mmsi?, ship_id? }`
  `.strict()`. Returns `data = VesselRow` from `upsertByImo`.
- **GET `/api/vessels/[imo]/voyages`** (`vessels/[imo]/voyages/handler.ts`).
  Query `limit`, `offset`. `data = Page<VoyageRow>`. Consumed by `use-voyages.ts`
  → `/voyages` page.
- **POST `/api/vessels/[imo]/voyages`** (same handler). Body validated by
  `voyageInsertSchema` (`vessels/[imo]/voyages/…`): `{ vessel: { name, imo },
  departure: { port: { name, id }, timestamp }, arrival: {…}, distanceNm,
  source: { fetchedAt, mock } }`, with a refine requiring at least one timestamp
  and arrival ≥ departure. Path/body IMO mismatch → 400 `IMO_MISMATCH`. Returns
  201 `data = VoyageRow` from `insertFromDomain`.
- **GET `/api/vessels/[imo]/voyages/latest`** (`voyages/latest/handler.ts`).
  `data = VoyageRow`; 404 `NOT_FOUND` when none. Consumed by `use-latest-voyage.ts`
  → `/fleet/[imo]`.
- **GET `/api/vessels/[imo]/track`** (`track/route.ts`). Fetches up to 1000 AIS
  positions, runs `processAisTrack` (`src/lib/geo`), returns
  `{ vesselId, imo, track }` (track exposes `points`, etc.). Raw error shape.
  Consumed by `use-vessel-track.ts` → `/fleet/[imo]`, `/voyages/[id]`.
- **GET `/api/vessels/[imo]/ais-positions`** (`ais-positions/handler.ts`).
  Query `limit`, `offset`. `data = Page<AisPositionRow>`. Consumed by
  `use-ais-positions.ts` → `/ais` page.
- **GET `/api/vessels/[imo]/port-calls`** (`port-calls/route.ts`). Returns
  `{ portCalls, vesselId }`. Raw error shape. Consumed by `use-port-calls.ts`
  → vessel/voyage pages.
- **GET `/api/vessels/[imo]/noon`** (`noon/route.ts`, deps `NoonApiDeps` from
  `noon/_lib.ts`). Query `limit` (default 20). Returns
  `{ vesselId, imo, latest, history, historyCount }`. `latest` is the most
  recent `NoonReportRow` or null. Consumed by `/noon` page.
- **POST `/api/vessels/[imo]/noon`** (`noon/route.ts`). Body
  `{ report: NoonReportExtractionInput, notifyReportReceived?: boolean }`.
  `parseNoonReportExtraction` (`src/lib/noon-report`) derives the domain report;
  a report IMO that is non-empty and ≠ path IMO → 400 `VALIDATION_ERROR`. Returns
  201 `{ vesselId, imo, report, missingFields, warnings, dataConfidence }`.
  Consumed by `createNoonReport` (`noon.service.ts`).
- **GET `/api/vessels/[imo]/noon/latest`** (`noon/latest/route.ts`). Returns
  `{ vesselId, imo, latest }`. 404 `VESSEL_NOT_FOUND` for unknown vessel; 200
  with `latest: null` when no reports. Consumed by `getNoonLatest`
  (`noon.service.ts`) → `/noon` page.
- **GET `/api/vessels/[imo]/noon/history`** (`noon/history/route.ts`). Query
  `limit` (default 50). Returns `{ vesselId, imo, history, count }`.
  Consumed by `getNoonHistory` → `/noon`.
- **POST `/api/vessels/[imo]/noon/evaluate`** (`noon/evaluate/route.ts`). Body
  `{ reportId?, now?, persist? (default true), voyagePlan?, deliveries? }`.
  Returns `{ imo, vesselId, wasDuplicated, dispatchedNotifications, report,
  domain, analysis, validator, fuel, voyage, fueleu, ets, findings }`.
  Duplicate evaluations of unchanged content are de-duplicated
  (`wasDuplicated: true`). Consumed by `evaluateNoonReport` → `/noon` page.
- **GET `/api/vessels/[imo]/sox-watch`** (`sox-watch/route.ts`, deps
  `SoxApiDeps` from `sox-watch/_lib.ts`). Query `limit` (default 20). Returns
  `{ vesselId, imo, watch, events, eventCount }`. Consumed by `use-sox-watch.ts`
  → `/fleet/[imo]`.
- **POST `/api/vessels/[imo]/sox-watch/evaluate`** (`sox-watch/evaluate/route.ts`).
  Body `{ scenario?, now?, persist? }`. With a scenario key (validated by
  `isSoxMockScenarioKey`, mock inputs via `createMockSoxScenario`, default
  `persist: false`); without, live repo inputs (default `persist: true`). Returns
  `{ imo, vesselId, evaluation: { evaluatedAt, insideEca, ecaEffective,
  geometryAvailable, zoneState, evidenceStatus, applicableLimitPct,
  sulphurContentPct, selectedDeliveryId, watchStatus, severity, ruleResults,
  reviewRequired, ambiguous }, event, watchState, wasDuplicated,
  dispatchedNotifications, captain }` where `captain` is
  `captainReadinessText(outcome.evaluation)`. Unknown scenario → 400
  `VALIDATION_ERROR`. Consumed by `use-sox-watch.ts` evaluate action.
- **GET `/api/vessels/[imo]/sox-events`** (`sox-events/route.ts`). Query `limit`
  (default 20). Returns `{ vesselId, imo, events, eventCount }` (newest first).
- **GET `/api/vessels/[imo]/zone-events`** (`zone-events/route.ts`). Loads active
  zones, last 100 AIS points, runs `checkZoneAlerts` (`src/lib/geo`), returns
  `{ vesselId, alerts, zoneCount }`. Raw error shape. Consumed by
  `use-zone-events.ts` → `/fleet/[imo]`.
- **GET `/api/vessels/[imo]/certificates`** (`certificates/route.ts`, deps
  `CertificateApiDeps` from `certificates/_lib.ts`). Query `status`
  (`all|expiring|expired`, default `all`), `mock=true`, `now=ISO`. Computes a
  `summary` record over all seven `CertificateStatus` values (`VALID`,
  `EXPIRING_SOON`, `EXPIRED`, `MISSING`, `PENDING_REVIEW`, `INVALID`, `UNKNOWN`).
  Returns `{ vesselId, imo, mock, certificates, count, summary }`. Consumed by
  `use-certificates.ts` → `/fleet/[imo]`.
- **POST `/api/vessels/[imo]/certificates/evaluate`**
  (`certificates/evaluate/route.ts`). Body (zod `bodySchema`)
  `{ now?, reconcile?: { imo, name, vesselType, gt, lengthM, ballastTanks } }`.
  With `reconcile` runs `reconcileRequirements` (materializes MISSING/UNKNOWN
  placeholders); otherwise `evaluate` refreshes status snapshots + emits events.
  Returns `{ imo, vesselId, mock, certificates: views, emittedEvents,
  emittedEventCount, dispatchedNotifications }`.
- **GET `/api/vessels/[imo]/mrv/[year]`** (`mrv/[year]/handler.ts`). Year must be
  integer ≥ 2024. Returns `{ vessel: { id, imo, name }, eu_ets_record }`.
- **POST `/api/vessels/[imo]/mrv/[year]`** (same). Dispatched by `?action=export`
  vs default validate (`mrv/[year]/route.ts`). Validate body
  `{ methodology?, monitoring_plan_version?, parameter_version? }` →
  `MrvReportService.generateReport` → 201 `result`. Export body `{ format:
  "xml"|"csv" }` → `generateExport` → 201 `exportResult`.
- **GET/POST `/api/vessels/[imo]/fueleu/[year]`** (`fueleu/[year]/handler.ts`).
  Year ≥ 2025. GET returns the `FuelEUComplianceService.getRecord` record
  (404 when none). POST body `{ ops_energy_mj?, parameter_version? }` →
  `calculateAndSave` with the vessel's year deliveries → 201 result.
- **GET/POST `/api/vessels/[imo]/eu-ets/[year]`** (`eu-ets/[year]/handler.ts`).
  Year ≥ 2024. GET returns `EtsComplianceService.getRecord` (404 when none). POST
  body `{ parameter_version?, eua_price_eur? }` → `calculateAndSave` using year
  deliveries + voyages and vessel GT → 201 result.

### 2.4 Voyages (`/api/voyages/[id]`, `/api/voyage`)

- **GET `/api/voyages/[id]`** (`voyages/[id]/route.ts`). Loads the voyage row
  then the vessel, returns `{ ...voyage, vessel_imo, vessel_name }` (raw
  envelope-free shape; 404 `{ error: "Voyage not found" }`). Consumed by
  `use-voyage-detail.ts` → `/voyages/[id]`.
- **POST `/api/voyage`** (`voyage/route.ts`). Voyage-assistant chat endpoint.
  Body `{ query, operator_id?, organization_id?, scenario? }`; `query` required
  (400 otherwise). Builds a `VoyageService` around the mock vessel `AURELIA`
  (`src/lib/voyage-assistant`), with `scenario` selecting a mock state from
  `createMockVoyageState` (keys: `clean-voyage`, `gap-under-30m`,
  `gap-30m-to-6h`, `gap-6h-to-48h`, `gap-over-48h`, `intra-eu`,
  `eu-to-third-country`, `third-country-to-eu`, `consistency-violation`,
  `green-zone-encounter`). Returns `data = answer` (service `.answer()` result).
  Consumed by `/voyage` page.

### 2.5 AIS (`/api/ais-positions/*`)

| Endpoint | Purpose |
|---|---|
| **POST `/api/ais-positions`** | Insert a single AIS position (zod validated). |
| **GET `/api/ais-positions/latest`** | Latest position by `vesselId` query param. |
| **POST `/api/ais-positions/batch`** | Bulk insert up to 1000 positions. |

- **POST `/api/ais-positions`** (`ais-positions/handler.ts`). Body validated by
  `aisPositionSchema` (`_lib/schemas.ts`): `{ vessel_id, ts, latitude (-90..90),
  longitude (-180..180), sog?, cog?, heading?, nav_status? }` `.strict()`. Returns
  201 `data = AisPositionRow`.
- **GET `/api/ais-positions/latest`** (`ais-positions/latest/handler.ts`).
  Requires `?vesselId=` (400 `VALIDATION_ERROR` otherwise); returns
  `data = AisPositionRow` or 404. Consumed by `getLatestAisPosition`
  (`ais.service.ts`) → `use-latest-ais-position` → `/fleet/[imo]`.
- **POST `/api/ais-positions/batch`** (`ais-positions/batch/handler.ts`). Body
  validated by `aisPositionBatchSchema`: `{ positions: AisPosition[] }`,
  `1..1000` items. Returns 201 `data = AisPositionRow[]` via `insertBatch`.

### 2.6 Dashboard & Analytics

- **GET `/api/dashboard/summary`** (`dashboard/summary/route.ts`). Runs several
  Supabase counts/filters and returns
  `data = DashboardSummary`: `{ totalVessels, activeVoyages, latestAisUpdate,
  documents, reviewQueue, ocrQueue, complianceAlerts, fuelDeliveriesPending,
  unreadNotifications }`. `reviewQueue` counts review tasks with status
  `pending|in_progress`; `ocrQueue` counts documents in
  `processing|extracted|under_review`; `complianceAlerts =
  soxAlerts + failedReports + expiredCerts` (sox states with status ≠ `CLEAR`,
  reports `FAILED|REJECTED`, certificates with `expiry_date < today`);
  `unreadNotifications` counts unread HIGH/CRITICAL notifications. Consumed by
  `getDashboardSummary` → `/` page.
- **GET `/api/analytics/summary`** (`analytics/summary/route.ts`). Returns
  `data = AnalyticsSummary`: `{ fleet: { totalVessels, fuelDeliveries,
  fuelDeliveriesPending }, ghg: [{ vesselId, vesselName, y2025, y2026 }] (each a
  `GhgPoint { ghgIntensity, target, balance, surplusOrDeficit }`),
  balance: [{ vesselId, vesselName, year, balance, surplusOrDeficit }],
  byFuelType: [{ fuelType, quantityMt }],
  byMonth: [{ month, quantityMt }] }`. Consumed by `getAnalyticsSummary` →
  `/analytics` page.

### 2.7 Documents (`/api/documents/*`)

Uses the **client-helper envelope** (`src/lib/api/helpers.ts`) and services built
by `documents/helpers.ts` (`buildDocumentService`, `buildDocumentUploadService`,
`buildAiExtractionService`, `buildValidationService`, `buildReviewService`) from
Supabase repositories + storage + OCR/AI/validation/review providers.

| Endpoint | Purpose |
|---|---|
| **GET `/api/documents`** | List documents (filters + pagination). |
| **POST `/api/documents`** | Upload document (multipart) + trigger OCR. |
| **GET `/api/documents/[id]`** | Full document detail (versions/jobs/OCR). |
| **GET `/api/documents/[id]/status`** | Lightweight polling status. |
| **GET `/api/documents/[id]/extract`** | List AI extractions. |
| **POST `/api/documents/[id]/extract`** | Run AI extraction. |
| **GET `/api/documents/[id]/validate`** | Latest validation report (or `null`). |
| **POST `/api/documents/[id]/validate`** | Run validation. |
| **GET `/api/documents/[id]/review`** | List review tasks for document. |
| **POST `/api/documents/[id]/review`** | Create a review task. |
| **POST `/api/documents/[id]/certificate`** | Register certificate from document. |
| **GET `/api/documents/[id]/download`** | Signed download URL. |

- **GET `/api/documents`** (`documents/route.ts`). Query `vesselId`, `documentType`,
  `limit` (default 50, max 100), `offset`. Returns `data = DocumentRow[]`
  (sliced in memory). Errors use codes like `LIST_DOCUMENTS_FAILED`. Consumed by
  `use-documents.ts` → `/documents`.
- **POST `/api/documents`** (`documents/route.ts`). Multipart form:
  `file`, `title`, `documentType`, `vesselId?`. `documentType` must be one of
  `imo_dcs|eu_mrv|certificate|report|correspondence|logbook|other`; max size 50MB.
  Errors: `MISSING_FILE` 400, `MISSING_TITLE` 400, `MISSING_DOCUMENT_TYPE` 400,
  `INVALID_DOCUMENT_TYPE` 400, `FILE_TOO_LARGE` 413, `UPLOAD_FAILED` 500. Returns
  201 `data = upload result`. Consumed by `use-document-upload.ts` → `/documents`.
- **GET `/api/documents/[id]`** (`documents/[id]/route.ts`). `service.getDocumentStatus(id)`.
  404 `DOCUMENT_NOT_FOUND`; else `data = status`. Consumed by `use-document.ts`
  → `/documents/[id]`.
- **GET `/api/documents/[id]/status`** (`documents/[id]/status/route.ts`).
  Returns `data = { documentId, status, latestJob: { id, jobType, status,
  startedAt, completedAt, errorMessage } | null, ocrResultCount }`. Polled every
  5s by `use-document-status.ts`.
- **GET `/api/documents/[id]/extract`** (`documents/[id]/extract/route.ts`).
  `data = extractions[]` from `service.listExtractions(id)`.
- **POST `/api/documents/[id]/extract`** (same). Body `{ ocrResultId? }` (defaults
  to latest OCR result). Returns `data = extraction result` (fields, summary,
  confidence, warnings). Errors: 404 `DOCUMENT_NOT_FOUND`, 409 `NO_OCR_RESULT`.
  Consumed by `use-document.ts`.
- **GET `/api/documents/[id]/validate`** (`documents/[id]/validate/route.ts`).
  Latest validation or `data = null`. Errors `GET_VALIDATION_FAILED`.
- **POST `/api/documents/[id]/validate`** (same). Returns
  `data = { report, persisted, latencyMs }`. Errors: 404 `DOCUMENT_NOT_FOUND`,
  409 `NO_EXTRACTION`. Consumed by `use-document-validation.ts`.
- **GET `/api/documents/[id]/review`** (`documents/[id]/review/route.ts`).
  `data = tasks[]` (`getDocumentReviewTasks`).
- **POST `/api/documents/[id]/review`** (same). Body
  `{ assignee, priority, reasonCode }` → `createReviewTask`. 404
  `DOCUMENT_NOT_FOUND` when the message mentions "not found". Consumed by
  `use-document-review.ts` → `/documents/[id]`.
- **POST `/api/documents/[id]/certificate`** (`documents/[id]/certificate/route.ts`).
  Body (zod `bodySchema`) `{ imo, documentImo?, certificateType,
  certificateNumber?, issuingAuthority?, classSociety?, issueDate? (YYYY-MM-DD),
  expiryDate? (YYYY-MM-DD), source (enum), confidence? (0..1), notes? }`.
  Supports `?mock=true` (Aurelia mock deps). 404 `DOCUMENT_NOT_FOUND` /
  `VESSEL_NOT_FOUND`. Returns 201 `{ documentId, imo, certificate, wasSuperseded,
  supersededId, event, dispatchedNotifications, blocking, reviewRequired }`.
  Consumed by `use-certificate-registry-link.ts` on `/documents/[id]`.
- **GET `/api/documents/[id]/download`** (`documents/[id]/download/route.ts`).
  Returns `data = getDownloadUrl(id)` (signed URL). 404 `DOCUMENT_NOT_FOUND`.
  Used by `/documents/[id]` page links.

### 2.8 OCR Intelligence (`/api/ocr/*`)

Deps from `ocr/_lib.ts`: the deterministic `OcrService` engine
(`createOcrService` with mock state, tool registry, handoff detector, safety
guard, memory) plus three persistence repositories. `?mock=true` routes
persistence to the in-memory fake Supabase client.

| Endpoint | Purpose |
|---|---|
| **GET `/api/ocr/queue`** | OCR work queue (mock docs × live DB enrichment). |
| **GET `/api/ocr/quality`** | Deterministic quality snapshot for a document. |
| **POST `/api/ocr/review`** | Full review pipeline (quality + suggestions + review task). |
| **POST `/api/ocr/suggestions`** | Generate + persist repair suggestions. |
| **PATCH `/api/ocr/suggestions/[id]`** | Accept/reject/resolve a suggestion. |

- **GET `/api/ocr/queue`** (`ocr/queue/route.ts`). Maps `OCR_MOCK_DOCUMENTS`
  through `deps.service.quality(...)` and enriches with live `documents`,
  `vessels`, `review_tasks` rows. Returns
  `data = { documents: OcrQueueItem[], totals: { total, byLevel, needsReview } }`.
  `OcrQueueItem` fields: `id, title, family, declaredType, status, vesselId,
  vesselName, ocrConfidence, level, overallQualityScore, priority,
  priorityReasons, issues[], missingMandatoryFields[], reviewTask { id, status,
  priority, assignedTo } | null`. `needsReview` counts priorities ≠ `LOW`.
  Consumed by `getOcrQueue` (`ocr.service.ts`) → `/ocr` page.
- **GET `/api/ocr/quality`** (`ocr/quality/route.ts`). Query `documentId`
  (required, 400 otherwise), `mock=true`. Unknown id → 404 `DOCUMENT_NOT_FOUND`
  (`OcrDocumentNotFoundError`). Returns
  `data = { documentId, computed: { detectedFamily, level, overallQualityScore,
  pageQuality, textCoverage, fieldCoverage, confidenceScore, issues[],
  missingMandatoryFields[], priority, priorityReasons[] }, record, mock }`.
  Consumed by `use-ocr-quality.ts` → `/ocr`.
- **POST `/api/ocr/review`** (`ocr/review/route.ts`). Body (zod)
  `{ documentId, ocrResultId?, assignee? }`. Runs `service.review(...)`, persists
  the quality score (via `toQualityScoreInsert`) and suggestions (via
  `toSuggestionInserts`), and — when priority ≠ `LOW` — inserts a review task
  with `reason_code: OCR_REVIEW_REQUIRED` and mapped priority
  (`CRITICAL→urgent`, `HIGH→high`, `MEDIUM→normal`, else `low`). Returns 201
  `data = { documentId, outcome: { priority, reviewRequired, level,
  overallQualityScore, reasons[] }, qualityRecord, suggestions, reviewTask, mock }`.
  Consumed by `use-ocr-quality.ts` → `/ocr`.
- **POST `/api/ocr/suggestions`** (`ocr/suggestions/route.ts`). Body (zod)
  `{ documentId, ocrResultId? }`. Runs `service.suggestions(...)`, persists all
  records. Returns 201 `data = { documentId, priority, suggestions[],
  records, mock }`.
- **PATCH `/api/ocr/suggestions/[id]`** (`ocr/suggestions/[id]/route.ts`). Body
  (zod) `{ status: "accepted"|"rejected"|"resolved" }`. 404 `NOT_FOUND` when the
  suggestion is unknown. Returns `data = { suggestion }`. Consumed by
  `use-ocr-quality.ts` resolve action.

### 2.9 Review tasks (`/api/review-tasks/*`)

Uses the client-helper envelope and `buildReviewService()`
(`documents/helpers.ts`).

- **GET `/api/review-tasks`** (`review-tasks/route.ts`). Query `status`,
  `assignee`, `vesselId`, `documentType`. Returns `data = tasks[]` from
  `service.listReviewTasks(...)`. Consumed by `use-review-tasks.ts` → `/review`.
- **GET `/api/review-tasks/[id]`** (`review-tasks/[id]/route.ts`).
  `service.getReviewTask(id)`; 404 `TASK_NOT_FOUND`. Consumed by
  `/review/[id]`.
- **POST `/api/review-tasks/[id]`** (same file). Body
  `{ action, reviewer, fieldName, newValue, comment, reason, assignee }`.
  Actions: `approve` (whole task or single field),
  `reject` (task or field), `needs_changes`, `escalate`, `edit_field`,
  `field_uncertain`, `comment`, `assign` (assignee required, reviewer optional).
  Field-level actions require `fieldName`; `edit_field` requires `newValue`;
  `comment` requires `comment`; `assign` requires `assignee`. Reviewer required
  for non-assign actions (`MISSING_REVIEWER` 400). Errors: `INVALID_TRANSITION`
  409, `NOT_FOUND` 404, `REVIEW_ACTION_FAILED` 500. Consumed by
  `use-review-tasks.ts` → `/review/[id]`.

### 2.10 Reports (`/api/reports/*`)

Built on `createReportService` (`src/lib/reporting`) with
`createComplianceReportRepository` and inline repo accessor closures.

- **GET `/api/reports`** (`reports/route.ts`). Query `limit` (default 50),
  `offset`, `vessel_id`. Returns `data = { reports }`. Consumed by
  `getComplianceReports` (`compliance.service.ts`) and
  `reports-list.tsx` → `/compliance`.
- **POST `/api/reports/generate`** (`reports/generate/route.ts`). Body
  `{ report_type, vessel_id, year, season?, vessel_ids?, generated_by? }`.
  `report_type` ∈ `thetis_mrv|fueleu|green_zone|fleet_summary`.
  `vessel_id` required except `fleet_summary`; `year` required except
  `green_zone`. Dispatches to `generateThetisMrrReport` / `generateFuelEuReport`
  / `generateGreenZoneReport` / `generateFleetSummaryReport`. Returns 201
  `data = { report, traces }`. `getZoneEvents` is stubbed to `[]`.
- **GET `/api/reports/[id]`** (`reports/[id]/route.ts`). `service.getReport(id)`
  → `data = { report }`.
- **GET `/api/reports/[id]/download`** (`reports/[id]/download/route.ts`).
  404 `REPORT_NOT_FOUND` for unknown/missing content. Returns the report JSON
  pretty-printed as an attachment with
  `Content-Disposition: attachment; filename="<title>_<space→underscore>.json"`.

### 2.11 Verifier packages (`/api/verifier-packages/*`)

- **GET `/api/verifier-packages`** (`verifier-packages/route.ts`). Query `limit`
  (default 50), `offset`. `data = { packages }`. Consumed by
  `getVerifierPackages` → `/compliance`.
- **POST `/api/verifier-packages/generate`** (`verifier-packages/generate/route.ts`).
  Body `{ vessel_id, reporting_year, include_ais_data?, include_bdn_documents?,
  include_validation_reports?, include_discrepancy_notes?, generated_by? }`
  (`vessel_id` and `reporting_year` required). Uses `createVerifierPackageBuilder`
  (`src/lib/verifier-package`) with a SHA-256 `computeHash` and a stub
  `buildZip`/`storeFile`/`generateSignedUrl` (`/api/storage/signed?path=…`).
  Returns 201 `data = { package, manifest, checksum, download_url }`.
- **GET `/api/verifier-packages/[id]`** (`verifier-packages/[id]/route.ts`).
  `data = { package }`; unknown → bare 404 `{ error: "Verifier package not found" }`.
- **GET `/api/verifier-packages/[id]/download`**
  (`verifier-packages/[id]/download/route.ts`). 404 `PACKAGE_NOT_FOUND` for
  unknown id or missing `storage_path`. Returns a JSON attachment
  `{ id, title, status, checksum, file_size, file_count, storage_path,
  generated_at }` with `Content-Disposition: attachment; filename=
  "verifier-package-<id>.json"`. Linked from `/compliance` page.

### 2.12 Notifications (`/api/notifications/*`)

- **GET `/api/notifications`** (`notifications/route.ts`). Query `recipient_id`
  (required — raw `{ error }` 400 when missing), `limit` (default 50), `offset`,
  `unread_only=true`, `type`. Returns `data = { notifications,
  unread_count }`. Consumed by `notification-panel.tsx`.
- **GET `/api/notifications/unread-count`** (`unread-count/route.ts`). Query
  `recipient_id` (required). Returns `data = { unread_count }`. Polled by
  `notification-bell.tsx`.
- **POST `/api/notifications/mark-all-read`** (`mark-all-read/route.ts`). Body
  `{ recipient_id }`. Returns `data = { marked_read }` (count). Consumed by
  `notification-panel.tsx`.
- **PATCH `/api/notifications/[id]/read`** (`[id]/read/route.ts`). 404
  `NOTIFICATION_NOT_FOUND` for unknown id; returns `data = { notification }`.
  Consumed by `notification-panel.tsx`.

### 2.13 Certificates (`/api/certificates/[id]`)

- **GET `/api/certificates/[id]`** (`certificates/[id]/route.ts`, deps
  `CertificateByIdApiDeps` from `certificates/[id]/_lib.ts`). Query `now=ISO`.
  Returns `data = { id, certificate }` where `certificate` is the service view
  (record + freshly derived status). 404 `NOT_FOUND` when unknown; invalid `now`
  → 400.

### 2.14 Fuel (`/api/fuel-types`, `/api/fuel-deliveries/*`)

- **GET `/api/fuel-types`** (`fuel-types/route.ts`). `data = listAll()` fuel type
  rows.
- **GET `/api/fuel-deliveries`** (`fuel-deliveries/route.ts`). Query `vesselId`,
  `documentId`, `voyageId` (mutually exclusive filters) plus `limit` (default 50)
  / `offset` (applied in memory). Returns `data = FuelDeliveryRow[]`.
- **POST `/api/fuel-deliveries`** (same file). Body validated by
  `FuelDeliveryInsertSchema` (`src/lib/supabase/schemas`). Returns 201
  `data = delivery`.
- **GET `/api/fuel-deliveries/[id]`** (`fuel-deliveries/[id]/route.ts`).
  Returns `data = { delivery, logEntries }`. 404 `FUEL_DELIVERY_NOT_FOUND`.
- **PATCH `/api/fuel-deliveries/[id]`** (same file). Body
  `{ action, voyage_id?, reason?, status? }`. Actions: `reconcile` (requires
  `voyage_id`, status → `reconciled`), `unreconcile` (status → `verified`),
  `update_status` (requires `status`). Each inserts a manual log entry
  (`match_type: manual`, `matched_by: api`). Unknown action → 400
  `VALIDATION_ERROR`. Returns `data = updated delivery`.

### 2.15 Assistants (Captain, Maintenance, Voyage, Regulatory)

**Captain** — **POST `/api/captain`** (`captain/route.ts`). Body
`{ query, captain_id?, organization_id?, scenario? }`. `query` required. Uses
`getCaptainService()` singleton (`captain/_service.ts`) or rebuilds with
`createMockCaptainState(scenario)` when a valid scenario is given (keys:
`green`, `amber`, `red`, `bdn-received`, `bdn-processing`, `bdn-review`,
`bdn-complete`, `upcoming-port`, `no-port`, `unknown`). Vessel fixed to
`AURELIA`. Returns `data = answer`. Consumed by `/captain` page.

**Maintenance** — **POST `/api/maintenance`** (`maintenance/route.ts`). Body
`{ query, operator_id?, organization_id?, scenario? }`. Scenarios (`maintenance/_service.ts`):
`all-current`, `due-soon`, `overdue-annual`, `expired-iscc`, `mp-review-due`,
`multiple-deadlines`, `no-schedule`, `unknown-class`. Returns `data = answer`.
Consumed by `/maintenance` page.

**Voyage** — **POST `/api/voyage`** (see §2.4). Consumed by `/voyage` page.

**Regulatory Assistant (assistant group)**:

| Endpoint | Purpose |
|---|---|
| **POST `/api/assistant/search`** | Regulatory question search over mock KB. |
| **GET `/api/assistant/knowledge`** | Dump mock knowledge base documents/chunks. |
| **GET `/api/assistant/conversations`** | List active conversations by user. |
| **POST `/api/assistant/conversations`** | Create a conversation. |
| **GET `/api/assistant/conversations/[id]`** | Conversation + messages. |
| **PATCH `/api/assistant/conversations/[id]`** | Update title/status. |
| **DELETE `/api/assistant/conversations/[id]`** | Archive conversation. |
| **GET `/api/assistant/conversations/[id]/messages`** | List messages. |
| **POST `/api/assistant/conversations/[id]/messages`** | Send a message (mock LLM pipeline). |
| **GET `/api/assistant/conversations/[id]/tools`** | Tool calls for the conversation. |
| **POST `/api/assistant/evaluate`** | Run a headless evaluation harness. |

- **POST `/api/assistant/search`** (`assistant/search/route.ts`). Body (zod
  `SearchSchema`) `{ question, regulation?, effective_date?, max_results? }`.
  Uses `createRegulatorySearchService` over `createMockKnowledgeBase()`. Returns
  `data = { result }`. (Compliance-search surface; the `/compliance-assistant`
  page drives conversations instead.)
- **GET `/api/assistant/knowledge`** (`assistant/knowledge/route.ts`). Query
  `regulation` (optional filter). Returns `data = { documents, chunks }`.
- **GET `/api/assistant/conversations`** (`assistant/conversations/route.ts`).
  Query `user_id` (required, 400 otherwise). `data = { conversations }` from
  `listActiveByUser`.
- **POST `/api/assistant/conversations`** (same). Body validated by
  `AssistantConversationInsertSchema`. Returns 201 `data = { conversation }`.
  Consumed by `/assistant` and `/compliance-assistant` pages.
- **GET `/api/assistant/conversations/[id]`**
  (`assistant/conversations/[id]/route.ts`). `data = { conversation, messages }`;
  404 `NOT_FOUND` when unknown.
- **PATCH `/api/assistant/conversations/[id]`** (same). Body `{ title?, status? }`.
  Returns `data = { conversation }`.
- **DELETE `/api/assistant/conversations/[id]`** (same). Archives;
  `data = { conversation }`.
- **GET `/api/assistant/conversations/[id]/messages`**
  (`conversations/[id]/messages/route.ts`). `data = { messages }`.
- **POST `/api/assistant/conversations/[id]/messages`** (same). Body
  `{ content }` (zod, required). Builds the full mock assistant pipeline
  (mock LLM provider, mock knowledge base, regulatory search, citations, mock
  structured tools + tool gateway, safety layer, mock router, conversation
  service) and runs `assistantService.processQuery(id, userId, content)`. Returns
  201 `data = { response, userMessage, assistantMessage }` (last two persisted
  messages, oldest→newest). Consumed by `/assistant` and `/compliance-assistant`.
- **GET `/api/assistant/conversations/[id]/tools`**
  (`conversations/[id]/tools/route.ts`). `data = { toolCalls }`.
- **POST `/api/assistant/evaluate`** (`assistant/evaluate/route.ts`). Body (zod)
  `{ test_name, assistant_type?, query }`. Creates a temp conversation
  (`user_id: "eval-user"`), runs `processQuery`, runs
  `evaluationHarness.runEvaluation(...)`, archives the temp conversation, returns
  201 `data = { evaluation }`.

### 2.16 Poseidon Search (`/api/search/*`)

Wired to a **module-level singleton** `getSearchService()` (`search/_service.ts`)
built from `createSearchService` over `src/lib/search-assistant` (tool registry,
query parser/validator, compliance handoff detector, memory, saved-search store).

| Endpoint | Purpose |
|---|---|
| **POST `/api/search`** | Execute a search. |
| **GET `/api/search/audit`** | Audit log filtered by org. |
| **GET `/api/search/recent`** | Recent searches for a user. |
| **GET `/api/search/saved`** | Saved searches. |
| **POST `/api/search/saved`** | Save a search. |
| **PATCH `/api/search/saved/[id]`** | Rename a saved search. |
| **DELETE `/api/search/saved/[id]`** | Delete a saved search. |
| **POST `/api/search/saved/[id]/rerun`** | Re-execute a saved search. |

- **POST `/api/search`** (`search/route.ts`). Body `{ query, organization_id?,
  user_id?, vessel_id?, page?, page_size? }`; `query` required. Returns the raw
  service response (not enveloped). Consumed by `/search` page.
- **GET `/api/search/audit`** (`search/audit/route.ts`). Query `organization_id`
  (default `org-001`). `data = { audit }`.
- **GET `/api/search/recent`** (`search/recent/route.ts`). Query `user_id`
  (default `user-001`), `organization_id`, `limit` (default 10). `data = { recent }`.
- **GET `/api/search/saved`** (`search/saved/route.ts`). Query `user_id`,
  `organization_id`. `data = { saved }`.
- **POST `/api/search/saved`** (same). Body `{ name, query, user_id?,
  organization_id? }`. `{ saved: false }` → 400 `VALIDATION_ERROR`; else 201
  `data = { savedSearch }`.
- **PATCH `/api/search/saved/[id]`** (`search/saved/[id]/route.ts`). Body
  `{ name }` (required); query `user_id`, `organization_id`. Renames;
  404 `NOT_FOUND` when missing. `data = { savedSearch }`.
- **DELETE `/api/search/saved/[id]`** (same). 404 when missing;
  `data = { removed: true }`.
- **POST `/api/search/saved/[id]/rerun`** (`search/saved/[id]/rerun/route.ts`).
  Returns the raw rerun service response. All search endpoints are consumed by
  `/search` page.

### 2.17 Webhooks

- **POST `/api/webhooks/email/resend`** (`webhooks/email/resend/route.ts` →
  `handler.ts`). Resend inbound-email webhook. Body validated by
  `resendWebhookSchema` (`webhooks/email/resend/schemas.ts`):
  `{ subject?, from (email), to (email[] ≥1), text?, html?, attachments?
  [{ filename, content (base64), content_type }], message_id, created_at }`.
  Parses the recipient address (`parseRecipient`, `src/lib/email-ingress`) to
  extract an IMO; unknown vessel → 404 `VESSEL_NOT_FOUND`. Ingests via
  `emailIngress.ingest(...)`, writes `email_ingestion_log` audit events
  (`EMAIL_RECEIVED`, `DUPLICATE_DETECTED`, `ATTACHMENT_REJECTED`,
  `ATTACHMENT_ACCEPTED`, `DOCUMENT_CREATED`, `PROCESSING_QUEUED`). For each
  accepted attachment: uploads to storage (`documents/email-ingest/<vesselId>/…`),
  inserts a `bdn` document (`source_channel: EMAIL`, metadata carrying message id,
  sender, recipient, subject, SHA-256, body snippet), a version, a pending OCR
  processing job, and a processing log. Returns 202 when rejected
  (`{ messageId, accepted: false, rejectionReason, attachments[] }`) or 201 when
  accepted (`{ messageId, accepted: true, imo, vesselId, totalAttachments,
  acceptedCount, rejectedCount, duplicateCount, attachments[] }`).

### 2.18 Ingest

- **POST `/api/ingest/marinetraffic`** (`ingest/marinetraffic/route.ts` →
  `handler.ts`). Body (zod `ingestSchema`) `{ imo }` (7 digits). Calls
  `deps.marineTraffic.getVoyageByIMO(imo)` and persists via
  `deps.voyages.insertFromDomain(voyage)`. Returns 201 `data = voyageRow`.
  Error mapping through `mapErrorResponse` (rate limit → 429 `RATE_LIMITED`,
  upstream → 502, etc.).

### 2.19 Map & environmental zones

- **GET `/api/map-config`** (`map-config/route.ts`). Returns
  `createDefaultMapConfig()` (`src/lib/map`) bare with
  `Cache-Control: public, max-age=3600, stale-while-revalidate=60`. Consumed by
  `src/lib/map/provider.ts` (fetches `${base}/api/map-config`).
- **GET `/api/environmental-zones`** (`environmental-zones/route.ts`). Returns
  `findAllActive()` zone rows bare. Consumed by `use-environmental-zones.ts` →
  `/fleet/[imo]`, `/ais`, `/voyages/[id]`.
- **GET `/api/sox-watch`** (`sox-watch/route.ts`). Fleet-wide SOx watch. Joins
  `vessels`, `sox_watch_state`, `sox_compliance_events` in memory (latest event
  per vessel) and returns `data = { watch: [{ vesselId, imo, name, status,
  severity, insideEca, ecaEffective, zoneState, evidenceStatus,
  applicableLimitPct, sulphurContentPct, selectedDeliveryId, lastEvaluatedAt,
  latestEvent: { id, eventType, eventTs, severity, watchStatus, evidenceStatus,
  ruleId } | null }] }`. Consumed by `getSoxWatch` → `/compliance` page.

---

## 3. Cross-cutting concerns

### 3.1 Dependency construction

There is no DI container; dependencies are constructed per-request at the top of
each handler call.

- **`src/app/api/_lib/deps.ts`** — `ApiDependencies` bundles the Supabase-backed
  repositories (`vessels`, `voyages`, `aisPositions`, `fuelDeliveries`,
  `fuelTypes`, `fuelEuRecords`, `euEtsRecords`, `mrvReports`) and the
  `MarineTrafficClient`. `createDefaultDeps()` builds them all from
  `create…Repository()` factories; `createApiDeps(overrides)` builds with
  per-repo overrides (used by tests). Handlers consume the interface, never
  concrete repositories.
- **`_lib.ts` factories per group** — auth, settings, noon, sox-watch,
  certificates (vessel-scoped), certificates/[id], documents/[id]/certificate,
  and OCR each expose an `…ApiDeps` interface and a
  `buildDefault…ApiDeps()`. They import concrete repository factories and the
  shared notification dispatcher (`createNotificationDispatcher`,
  `createPreferenceService`, `createNotificationEmailProvider`, template
  formatters `formatNoon`/`formatSox`/`formatCertificate`) — see
  `src/lib/notifications`.
- **`_service.ts` singletons** — Captain, Maintenance, Voyage, and Search build a
  module-level singleton service on first call (`let service = null;
  get…Service()`), with a `reset…ServiceForTest()` hook for tests.
- **`documents/helpers.ts`** — builds the five document services
  (`DocumentService`, `DocumentUploadService`, `AiExtractionService`,
  `ValidationService`, `ReviewService`) from repositories + `getStorageClient()`
  + provider singletons (`getOcrProvider`, `getAiProvider`,
  `getValidationProvider`, `getReviewProvider`).
- **Adapters** — where the repository stores loose column types but the domain
  uses checked unions, `_lib` modules expose narrowing adapters:
  `adaptSoxComplianceRepository` (`sox-watch/_lib.ts:55–80`),
  `adaptCertificateRepository` (`certificates/_lib.ts:56–101`),
  `adaptNoonReportRepository` (`noon/_lib.ts:47–51`, identity adapter). Tests
  replace the whole `deps` object with fakes, which is the single test seam.

### 3.2 Repositories vs services in handlers

- **Repository-only routes** (thin data plumbing): vessels list/get/upsert,
  voyages list/post/latest, AIS positions, fuel-types, fuel-deliveries,
  notifications, environmental-zones, reports/verifier-packages reads.
- **Service-backed routes** (business logic): auth/settings (AuthService /
  SettingsService), noon (NoonReportService — extraction parsing, deterministic
  analysis/validation/correlation, notifications), sox (SoxComplianceService —
  ECA geometry, fuel sulphur evidence, watch state, notifications), certificates
  (CertificateService — status derivation, expiry events, requirement
  reconciliation, notifications), OCR (OcrService — deterministic quality /
  priority engines), documents (DocumentService + upload/extraction/validation/
  review services), reporting (ReportService), verifier package
  (VerifierPackageBuilder), assistants (per-domain service), search
  (SearchService).
- **Inline client queries** (neither): `dashboard/summary`, `analytics/summary`,
  `sox-watch`, `ocr/queue`, `zone-events`, `track` — these call the Supabase
  client or geo helpers directly inside the route.

### 3.3 Validation

- **Zod** is used across the codebase:
  - `src/app/api/_lib/schemas.ts` — `vesselUpsertSchema` (`.strict()`),
    `voyageInsertSchema` (with cross-field refines: ≥1 timestamp; arrival ≥
    departure), `aisPositionSchema` (range-bounded lat/lng/COG), `aisPositionBatchSchema`
    (1..1000), `ingestSchema` (7-digit IMO), `paginationSchema`, and
    `zodIssuesToDetails()` which flattens issues to `{ path, message }[]` (the
    `details` array in the error envelope).
  - Route-local schemas: certificates evaluate (`certificates/evaluate/route.ts`),
    document certificate (`documents/[id]/certificate/route.ts`), OCR
    (`ocr/review`, `ocr/suggestions`, `ocr/suggestions/[id]`), webhook
    (`webhooks/email/resend/schemas.ts`), assistant search / messages /
    evaluate, fuel deliveries (`FuelDeliveryInsertSchema` from
    `src/lib/supabase/schemas`), conversations (`AssistantConversationInsertSchema`
    from `src/lib/supabase`).
  - Failed `safeParse` → 400 `VALIDATION_ERROR` with `details` from
    `zodIssuesToDetails(parsed.error.issues)` (or the flattened message).
- **Manual validation** elsewhere: settings routes validate sections/actions/
  providers/roles; auth validates presence of email/password/token; noon validates
  field types by hand; fuel-deliveries `[id]` validates `action`.
- **Query parsing**: `parseQueryNumber()` (returns `undefined` for non-numeric),
  `requireQueryParam()` (`src/app/api/_lib/http.ts:169–186`).

### 3.4 Error mapping

Two strategies:

1. **Central mapping** (`mapErrorResponse` → `httpStatusForError`) used by the
   repository-backed and service-backed handlers (vessels, AIS, ingest, webhook,
   reports, verifier-packages, notifications, fuel, assistant, dashboard,
   analytics). Thrown domain error types are converted by `constructor.name`
   into stable `(code, status)` pairs (full table in §1.3). `RateLimitError`
   additionally sets a `Retry-After` header.
2. **Local try/catch** used by auth, settings, noon, sox, certificates, OCR,
   documents, review-tasks. These switch on `err.constructor.name` or inspect
   `err.message` substrings (`"not found"`, `"No OCR result"`,
   `"No completed AI extraction"`, `"Invalid status transition"`) to pick a
   specific code/status, defaulting to `INTERNAL_ERROR` 500.

Every route wraps its body in `try { … } catch (err)` — there is no shared
error boundary; the catch blocks *are* the boundary.

### 3.5 Session & cookies

- `pl_session` cookie (`src/app/api/_lib/cookies.ts`): mock httpOnly session
  token, 12h `Max-Age`, `SameSite=Lax`, `Path=/`. Server reads the raw Cookie
  header via `readCookie`; the client never sees the token in JS.
- Only auth + settings routes enforce it (§1.4). The rest of the API is
  unauthenticated and uses explicit identity parameters.

### 3.6 Known inconsistencies (documented, not fixed)

- Two envelope helpers with swapped `apiError` argument order (§1.2).
- `apiPaginated` is defined but unused; collections return `Page<T>` instead.
- Raw, non-enveloped shapes for track, port-calls, zone-events, map-config,
  environmental-zones, search POST/rerun, and both download endpoints.
- Mixed sync vs `Promise` route params.
- Documents/review-tasks use codes as *strings* passed to
  `apiError(message, status, code)` while the `_lib/http` routes use typed
  `ErrorCode` constants; both are surfaced identically in the JSON envelope.
- `GET /api/verifier-packages/[id]` returns a bare `{ error }` 404 while its
  download sibling uses the `PACKAGE_NOT_FOUND` envelope.

---

## 4. Endpoint inventory (quick reference)

| Method + Path | Source file | Group |
|---|---|---|
| POST `/api/auth/login` | `auth/login/route.ts` | Auth |
| POST `/api/auth/logout` | `auth/logout/route.ts` | Auth |
| GET `/api/auth/session` | `auth/session/route.ts` | Auth |
| POST `/api/auth/forgot-password` | `auth/forgot-password/route.ts` | Auth |
| POST `/api/auth/reset-password` | `auth/reset-password/route.ts` | Auth |
| GET/PATCH `/api/settings` | `settings/route.ts` | Settings |
| POST `/api/settings/invites` | `settings/invites/route.ts` | Settings |
| PATCH `/api/settings/invites/[id]` | `settings/invites/[id]/route.ts` | Settings |
| PATCH `/api/settings/users/[id]` | `settings/users/[id]/route.ts` | Settings |
| GET `/api/vessels` | `vessels/route.ts` (+`handler.ts`) | Vessels |
| GET/PUT `/api/vessels/[imo]` | `vessels/[imo]/route.ts` (+`handler.ts`) | Vessels |
| GET/POST `/api/vessels/[imo]/voyages` | `vessels/[imo]/voyages/route.ts` (+`handler.ts`) | Vessels |
| GET `/api/vessels/[imo]/voyages/latest` | `vessels/[imo]/voyages/latest/route.ts` (+`handler.ts`) | Vessels |
| GET `/api/vessels/[imo]/track` | `vessels/[imo]/track/route.ts` | Vessels |
| GET `/api/vessels/[imo]/ais-positions` | `vessels/[imo]/ais-positions/route.ts` (+`handler.ts`) | Vessels |
| GET `/api/vessels/[imo]/port-calls` | `vessels/[imo]/port-calls/route.ts` | Vessels |
| GET/POST `/api/vessels/[imo]/noon` | `vessels/[imo]/noon/route.ts` | Vessels |
| GET `/api/vessels/[imo]/noon/latest` | `vessels/[imo]/noon/latest/route.ts` | Vessels |
| GET `/api/vessels/[imo]/noon/history` | `vessels/[imo]/noon/history/route.ts` | Vessels |
| POST `/api/vessels/[imo]/noon/evaluate` | `vessels/[imo]/noon/evaluate/route.ts` | Vessels |
| GET `/api/vessels/[imo]/sox-watch` | `vessels/[imo]/sox-watch/route.ts` | Vessels |
| POST `/api/vessels/[imo]/sox-watch/evaluate` | `vessels/[imo]/sox-watch/evaluate/route.ts` | Vessels |
| GET `/api/vessels/[imo]/sox-events` | `vessels/[imo]/sox-events/route.ts` | Vessels |
| GET `/api/vessels/[imo]/zone-events` | `vessels/[imo]/zone-events/route.ts` | Vessels |
| GET `/api/vessels/[imo]/certificates` | `vessels/[imo]/certificates/route.ts` | Vessels |
| POST `/api/vessels/[imo]/certificates/evaluate` | `vessels/[imo]/certificates/evaluate/route.ts` | Vessels |
| GET/POST `/api/vessels/[imo]/mrv/[year]` | `vessels/[imo]/mrv/[year]/route.ts` (+`handler.ts`) | Vessels |
| GET/POST `/api/vessels/[imo]/fueleu/[year]` | `vessels/[imo]/fueleu/[year]/route.ts` (+`handler.ts`) | Vessels |
| GET/POST `/api/vessels/[imo]/eu-ets/[year]` | `vessels/[imo]/eu-ets/[year]/route.ts` (+`handler.ts`) | Vessels |
| GET `/api/voyages/[id]` | `voyages/[id]/route.ts` | Voyages |
| POST `/api/voyage` | `voyage/route.ts` | Voyages |
| POST `/api/ais-positions` | `ais-positions/route.ts` (+`handler.ts`) | AIS |
| GET `/api/ais-positions/latest` | `ais-positions/latest/route.ts` (+`handler.ts`) | AIS |
| POST `/api/ais-positions/batch` | `ais-positions/batch/route.ts` (+`handler.ts`) | AIS |
| GET `/api/dashboard/summary` | `dashboard/summary/route.ts` | Dashboard |
| GET `/api/analytics/summary` | `analytics/summary/route.ts` | Analytics |
| GET/POST `/api/documents` | `documents/route.ts` | Documents |
| GET `/api/documents/[id]` | `documents/[id]/route.ts` | Documents |
| GET `/api/documents/[id]/status` | `documents/[id]/status/route.ts` | Documents |
| GET/POST `/api/documents/[id]/extract` | `documents/[id]/extract/route.ts` | Documents |
| GET/POST `/api/documents/[id]/validate` | `documents/[id]/validate/route.ts` | Documents |
| GET/POST `/api/documents/[id]/review` | `documents/[id]/review/route.ts` | Documents |
| POST `/api/documents/[id]/certificate` | `documents/[id]/certificate/route.ts` | Documents |
| GET `/api/documents/[id]/download` | `documents/[id]/download/route.ts` | Documents |
| GET `/api/ocr/queue` | `ocr/queue/route.ts` | OCR |
| GET `/api/ocr/quality` | `ocr/quality/route.ts` | OCR |
| POST `/api/ocr/review` | `ocr/review/route.ts` | OCR |
| POST `/api/ocr/suggestions` | `ocr/suggestions/route.ts` | OCR |
| PATCH `/api/ocr/suggestions/[id]` | `ocr/suggestions/[id]/route.ts` | OCR |
| GET `/api/review-tasks` | `review-tasks/route.ts` | Review |
| GET/POST `/api/review-tasks/[id]` | `review-tasks/[id]/route.ts` | Review |
| GET `/api/reports` | `reports/route.ts` | Reports |
| POST `/api/reports/generate` | `reports/generate/route.ts` | Reports |
| GET `/api/reports/[id]` | `reports/[id]/route.ts` | Reports |
| GET `/api/reports/[id]/download` | `reports/[id]/download/route.ts` | Reports |
| GET `/api/verifier-packages` | `verifier-packages/route.ts` | Verifier packages |
| POST `/api/verifier-packages/generate` | `verifier-packages/generate/route.ts` | Verifier packages |
| GET `/api/verifier-packages/[id]` | `verifier-packages/[id]/route.ts` | Verifier packages |
| GET `/api/verifier-packages/[id]/download` | `verifier-packages/[id]/download/route.ts` | Verifier packages |
| GET `/api/notifications` | `notifications/route.ts` | Notifications |
| GET `/api/notifications/unread-count` | `notifications/unread-count/route.ts` | Notifications |
| POST `/api/notifications/mark-all-read` | `notifications/mark-all-read/route.ts` | Notifications |
| PATCH `/api/notifications/[id]/read` | `notifications/[id]/read/route.ts` | Notifications |
| GET `/api/certificates/[id]` | `certificates/[id]/route.ts` | Certificates |
| GET `/api/fuel-types` | `fuel-types/route.ts` | Fuel |
| GET/POST `/api/fuel-deliveries` | `fuel-deliveries/route.ts` | Fuel |
| GET/PATCH `/api/fuel-deliveries/[id]` | `fuel-deliveries/[id]/route.ts` | Fuel |
| POST `/api/captain` | `captain/route.ts` | Assistants |
| POST `/api/maintenance` | `maintenance/route.ts` | Assistants |
| POST `/api/assistant/search` | `assistant/search/route.ts` | Assistants |
| GET `/api/assistant/knowledge` | `assistant/knowledge/route.ts` | Assistants |
| GET/POST `/api/assistant/conversations` | `assistant/conversations/route.ts` | Assistants |
| GET/PATCH/DELETE `/api/assistant/conversations/[id]` | `assistant/conversations/[id]/route.ts` | Assistants |
| GET/POST `/api/assistant/conversations/[id]/messages` | `assistant/conversations/[id]/messages/route.ts` | Assistants |
| GET `/api/assistant/conversations/[id]/tools` | `assistant/conversations/[id]/tools/route.ts` | Assistants |
| POST `/api/assistant/evaluate` | `assistant/evaluate/route.ts` | Assistants |
| POST `/api/search` | `search/route.ts` | Search |
| GET `/api/search/audit` | `search/audit/route.ts` | Search |
| GET `/api/search/recent` | `search/recent/route.ts` | Search |
| GET/POST `/api/search/saved` | `search/saved/route.ts` | Search |
| PATCH/DELETE `/api/search/saved/[id]` | `search/saved/[id]/route.ts` | Search |
| POST `/api/search/saved/[id]/rerun` | `search/saved/[id]/rerun/route.ts` | Search |
| POST `/api/webhooks/email/resend` | `webhooks/email/resend/route.ts` (+`handler.ts`) | Webhooks |
| POST `/api/ingest/marinetraffic` | `ingest/marinetraffic/route.ts` (+`handler.ts`) | Ingest |
| GET `/api/map-config` | `map-config/route.ts` | Map & zones |
| GET `/api/environmental-zones` | `environmental-zones/route.ts` | Map & zones |
| GET `/api/sox-watch` | `sox-watch/route.ts` | Map & zones |

---

# 9. The Frontend


Status: derived from the current source tree at `D:\ProjetoPLDemo` (read-only audit, no changes made).
The frontend has no dedicated architecture document; this chapter is an inventory of what is actually implemented, read from the `src/app`, `src/components`, `src/hooks`, and `src/constants` trees on 2026-08-05. All statements are facts; line numbers refer to the working tree.

---

## 1. Overview

The frontend is a **Next.js 14 App Router** application written in TypeScript. Every page and interactive component is a client component (`"use client"`); there is no server-rendered data path — all data reaches the UI through `fetch()` calls to the app's own `/api/*` routes, which in mock mode (the default, `SUPABASE_USE_MOCK=true`) are served by the in-memory fake from the deterministic demo seed (see Chapter 4).

Scale (verified by file scan):

| Layer | Count | Location |
|---|---|---|
| Routes (static + dynamic) | 31 `page.tsx` | `src/app/**/page.tsx` |
| Route keys | 26 (`ROUTES` object) | `src/constants/routes.ts` |
| Hooks | 26 hook modules + barrel | `src/hooks/*.ts` |
| Components | 41 `.tsx` files | `src/components/**/*.tsx` |
| Map components | 6 + barrel | `src/components/map/` |
| Geo engine | 4 modules | `src/lib/geo/` |

Recurring conventions:

- **Styling** is Tailwind utility classes over CSS variables; the `<html>` element is hard-coded `dark` (see §2.1).
- **Typography** uses three brand fonts wired as CSS variables: Cormorant Garamond (serif, headlines), DM Sans (sans, body/UI), DM Mono (mono, technical/navigation/data labels).
- **Route protection** is centralised in a single `AuthGate` component wrapping the app shell (§2.2).
- **The navigation model** is a single typed constant tree in `src/constants/navigation.ts`, consumed by the sidebar and header (§2.5).
- **Status rendering** is done through local `Record<string, BadgeVariant>` maps declared at the top of each page (e.g. `STATUS_VARIANTS`, `PRIORITY_VARIANTS`, `LEVEL_VARIANT`) — a consistent per-page pattern catalogued in §7.
- **List screens** reuse four generic data components: `SearchBar`, `DataTable`, `LoadingTable`, `PaginationControls`.
- **Mock demo UX** is first-class: a one-click demo login, a default vessel IMO, and "coming soon" pages for unimplemented modules (§8).

---

## 2. Layout & shell

### 2.1 Root layout and fonts — `src/app/layout.tsx`

- Three Google fonts loaded with `next/font/google` and exposed as variables: `Cormorant_Garamond` → `--font-serif` (`layout.tsx:7-13`), `DM_Sans` → `--font-sans` (`:16-21`), `DM_Mono` → `--font-mono` (`:24-29`).
- Metadata: title **"Poseidon Ledger — Maritime Intelligence"**, description "Maritime intelligence & ESG compliance platform…" (`:31-35`).
- `<html lang="en" className="… dark">` forces dark theme globally; `<body className="font-sans antialiased">` wraps all children in `<MainLayout>` (`:43-48`).

### 2.2 Auth gate — `src/components/auth/auth-gate.tsx`

- `AUTH_PATHS = ["/login", "/forgot-password", "/reset-password"]` (`auth-gate.tsx:7`); `isAuthPath(pathname)` matches `/reset-password` by prefix so query strings survive (`:9-13`).
- `AuthGate` (`:23`): reads auth via `useAuth()`. If still resolving → full-screen "Loading workspace" spinner (`:47`). Unauthenticated on a protected route → redirects to `/login`; authenticated while on an auth page → redirects to `/`.
- Every component that needs auth mounts its **own** `useAuth()`; the hook broadcasts changes through a module-level listener set so the gate, header, and login page stay in sync without a reload (see §4.3).

### 2.3 App shell — `src/components/layout/main-layout.tsx`

- `MainLayout` (`main-layout.tsx:12`): renders `AuthGate`; for auth paths it returns children **bare** (no chrome); otherwise it renders the full shell.
- Shell structure: `flex h-screen overflow-hidden bg-background` → `AppSidebar` (left) + a column containing `AppHeader` and `main flex-1 overflow-y-auto scrollbar-thin p-4 lg:p-6`.

### 2.4 Header — `src/components/layout/header.tsx`

- `ROUTE_LABELS: Record<string, string>` (`header.tsx:21`) maps the first path segment to a human label — 21 entries including "Compliance Assistant", "Poseidon Search", "Captain Assistant", "Maintenance Assistant", "Voyage Assistant", "Noon Reports". Unknown segments fall back to the raw segment (`:61`).
- `AppHeader` (`:52`) shows the current label, the `NotificationBell` (`recipientId="default"`, `:107`), and a user chip with `initials(fullName)` (`:45`, rendered at `:118`).

### 2.5 Sidebar and navigation model

- `src/components/layout/sidebar.tsx`:
  - `AppSidebar` (`sidebar.tsx:183`) owns a local `collapsed` toggle (`:185`); width animates `w-14` ⇄ `w-48` (`:213`).
  - On mobile the nav renders inside a `Sheet` (`:190-207`) with `SheetTitle className="sr-only"` = "Navigation".
  - Nav items: active state from `isNavActive(item.href, pathname)` (`:41`); collapsed rows become icon-only with `justify-center px-0` (`:54`); disabled items show a lock badge and fall back to a plain element with `href="#"` + `preventDefault` + `tabIndex -1` (`:62`, `:70`).
  - Brand lockup renders a mono wordmark; logo `width`/`height` shrink `22 ⇄ 150 / 22 ⇄ 26` when collapsed (`:139-140`).
- `src/constants/navigation.ts` is the **single source of truth** for the nav tree (`NavItem` `:24`, `NavSection` `:32`, `NAVIGATION` `:37`). Four sections:
  - **Operations** (`:39`): Dashboard, Fleet, Voyages, AIS.
  - **Intelligence** (`:48`): Documents, Review, Assistant, Compliance Assistant, Poseidon Search, Captain, Maintenance, Voyage, Noon Reports, MarineTraffic (**disabled**, `:96-100`).
  - **Modules** (`:104`): OCR, Compliance, DNV (**disabled**, `:108`), Analytics.
  - **System** (`:113`): Settings.
  - `isNavActive(href, pathname)` (`:118`): `/` matches exactly; everything else by `startsWith` (which makes dynamic children light up their parent).

### 2.6 Route registry — `src/constants/routes.ts`

- `ROUTES` (`routes.ts:1-33`) defines **26 route keys**, including parameterised factories `vesselDetail(imo)` (`:4`) and `voyageDetail(id)` (`:6`). Every `href` in the app flows through this object, so `NAVIGATION` and `ROUTE_LABELS` never drift.

---

## 3. Every page (31 pages)

### 3.1 Route inventory

All 31 pages are client components under `src/app/`, each exporting `export default function <X>Page()`. Verified line numbers of the default export:

| Route | File | Export at |
|---|---|---|
| `/` (Dashboard) | `src/app/page.tsx` | `:93` |
| `/fleet` | `src/app/fleet/page.tsx` | `:58` |
| `/fleet/[imo]` | `src/app/fleet/[imo]/page.tsx` | `:66` |
| `/voyages` | `src/app/voyages/page.tsx` | `:97` |
| `/voyages/[id]` | `src/app/voyages/[id]/page.tsx` | `:58` |
| `/ais` | `src/app/ais/page.tsx` | `:99` |
| `/documents` | `src/app/documents/page.tsx` | `:45` |
| `/documents/[id]` | `src/app/documents/[id]/page.tsx` | `:78` |
| `/review` | `src/app/review/page.tsx` | `:36` |
| `/review/[id]` | `src/app/review/[id]/page.tsx` | `:44` |
| `/ocr` | `src/app/ocr/page.tsx` | `:92` |
| `/compliance` | `src/app/compliance/page.tsx` | `:97` |
| `/compliance-assistant` | `src/app/compliance-assistant/page.tsx` | `:303` |
| `/assistant` | `src/app/assistant/page.tsx` | `:58` |
| `/search` | `src/app/search/page.tsx` | `:336` |
| `/captain` | `src/app/captain/page.tsx` | `:162` |
| `/voyage` (Voyage assistant) | `src/app/voyage/page.tsx` | `:209` |
| `/maintenance` | `src/app/maintenance/page.tsx` | `:141` |
| `/noon` | `src/app/noon/page.tsx` | `:224` |
| `/analytics` | `src/app/analytics/page.tsx` | `:190` |
| `/settings` | `src/app/settings/page.tsx` | `:32` |
| `/settings/users` | `src/app/settings/users/page.tsx` | `:45` |
| `/settings/organization` | `src/app/settings/organization/page.tsx` | `:8` |
| `/settings/notifications` | `src/app/settings/notifications/page.tsx` | `:9` |
| `/settings/integrations` | `src/app/settings/integrations/page.tsx` | `:25` |
| `/settings/appearance` | `src/app/settings/appearance/page.tsx` | `:40` |
| `/login` | `src/app/login/page.tsx` | `:14` |
| `/forgot-password` | `src/app/forgot-password/page.tsx` | `:11` |
| `/reset-password` | `src/app/reset-password/page.tsx` | `:120` |
| `/dnv` | `src/app/dnv/page.tsx` | `:3` |
| `/marinetraffic` | `src/app/marinetraffic/page.tsx` | `:3` |

### 3.2 Operational screens

- **Dashboard (`/`)** — `page.tsx:93`. `getDashboardSummary()` feeds a grid of interactive `StatCard`s; each stat tile is a `Card className="interactive"` whose label uses the house mono/uppercase treatment (`font-mono text-[10px] uppercase tracking-[0.12em]`) and links through `ROUTES`. Tiles cover fleet count, active voyages, open reviews, pending documents, AIS signal quality, compliance posture.
- **Fleet (`/fleet`)** — `page.tsx:58`. Column model `COLUMNS` = `imo / name / mmsi / ship_id / updated_at`; dates formatted with `Intl.DateTimeFormat("en-GB", …)`. Data via `useVessels()` + `useDebounce()` for the name filter; rendered with `SearchBar` → `DataTable` → `LoadingTable` → `PaginationControls`. IMO cells link into `vesselDetail(imo)`.
- **Vessel detail (`/fleet/[imo]`)** — `page.tsx:66`. Composes `InfoRow` (mono uppercase label + value), a `VesselMapView` of the live position + last track, `SoxWatchCard`, and `CertificatesCard`. Data hooks: `useVessel`, `useLatestVoyage`, `useLatestAisPosition`, `useVesselTrack`, `useEnvironmentalZones`. Timestamps via local `formatTs` (en-GB).
- **Voyages (`/voyages`)** — `page.tsx:97`. Search input constrained by `IMO_PATTERN = /^\d{7}$/`; table columns include Departure/Arrival with a 10px date sub-line under the time. `useVoyages` supports a status filter (`upcoming/active/completed/…`).
- **Voyage detail (`/voyages/[id]`)** — `page.tsx:58`. `InfoRow` summary + `VesselMapView` for the voyage track and zone crossings; hooks `useVoyageDetail`, `useVesselTrack`, `useEnvironmentalZones`.
- **AIS (`/ais`)** — `page.tsx:99`. Live positions grid backed by `useAisPositions`; a `navStatusBadge()` map turns AIS navigation statuses into badge variants: `under way`/"0" → success, `moored`/`at anchor`/`anchor` → warning, `not defined`/"15" → muted, `aground`/`sos` → destructive. Rows expand to a `VesselMapView`.

### 3.3 Document intelligence

- **Documents (`/documents`)** — `page.tsx:45`. `DOCUMENT_TYPES` (`:24`) lists 7 types: `imo_dcs / eu_mrv / certificate / report / correspondence / logbook / other`. `STATUS_VARIANTS` (`:34`) maps `uploaded`→warning, `processing`→secondary, `ocr_complete`/`extracted`/`approved`→success, `under_review`→outline, `rejected`→destructive, `archived`→muted. Upload via `useDocumentUpload`.
- **Document detail (`/documents/[id]`)** — `page.tsx:78`. Extended `STATUS_VARIANTS` (`:22`) adds pipeline states `pending / running / completed / failed / cancelled / unknown_document`. A `ConfidenceBar` colours OCR confidence: ≥90% success, ≥70% warning, ≥50% orange-500, else destructive. Hooks: `useDocument`, `useCertificateRegistryLink` (resolves the doc's `vessel_id` to an IMO so the page can deep-link to the fleet certificate registry), `useDocumentValidation`, `useDocumentReview`.
- **Review queue (`/review`)** — `page.tsx:36`. `PRIORITY_VARIANTS` (`:22`): `low`→muted, `normal`→secondary, `high`→warning, `urgent`→destructive. `STATUS_VARIANTS` (`:29`): `pending`→warning, `in_progress`→secondary, `completed`→success, `cancelled`→muted. Page heading **"Human Review Queue"** set in `font-serif` (the Cormorant variable).
- **Review detail (`/review/[id]`)** — `page.tsx:44`. `STATUS_VARIANTS` (`:15`) and `PRIORITY_VARIANTS` (`:22`); `ACTION_LABELS` (`:29`) localises **10** review actions (`field_approved`, `field_rejected`, `field_edited`, `field_uncertain`, `comment_added`, …). `DEFAULT_REVIEWER = "reviewer@poseidon-ledger.io"` (`:42`) is the fallback reviewer when the user is not an agent. Includes the `OcrQualityPanel`.
- **OCR (`/ocr`)** — `page.tsx:92`. `LEVEL_VARIANT` (`:31`): HIGH→success, MEDIUM→warning, LOW→outline, VERY_LOW→destructive. `PRIORITY_VARIANT` (`:38`): LOW→muted, MEDIUM→warning, HIGH/CRITICAL→destructive. `qualityColor()` thresholds 0.9 / 0.7. Header `StatTile`s summarise issues/suggestions; feed from `useOcrQuality`.

### 3.4 Assistants

All five assistant consoles plus the shared pipeline follow the deterministic-core/advisory-AI contract detailed in Chapter 7.

- **Assistant (`/assistant`)** — `page.tsx:58`. General conversation console; local `formatTimestamp` renders relative time: `<1h` → "Xm ago", `<24h` → "Xh ago", `<168h` → "Xd ago", else `toLocaleDateString()`.
- **Compliance assistant (`/compliance-assistant`)** — `page.tsx:303`. Local `Citation`, `ToolCallInfo`, `ChatMessage`, `Conversation`, `Vessel` types; `ComplianceStatus` with fuelEu/euEts/verifier legs; `ParsedSection` normalises `answer / evidence / why / recommendedAction / sources / text`; `HandoffInfo` carries `target/reason/label`. Injects `STANDARD_DISCLAIMER` from `src/lib/assistant/safety.ts`.
- **Captain (`/captain`)** — `page.tsx:162`. `CAPTAIN_ID = "captain-001"` (`:66`). Readiness model: `ChecklistItem` status `GREEN / AMBER / RED`, `ReadinessResult { level, checklist, missingBlocking }`, `CaptainAnswerJson` with a `handoff { target, confidence, reason }`; renders `IngestEvent`/`PortCall` timeline rows.
- **Voyage assistant (`/voyage`)** — `page.tsx:209`. `AisGapTier` = `NONE / INTERPOLATION_OK / FLAGGED / MANUAL_REQUIRED / CRITICAL_ESCALATION`; gap analysis types `GapJson`, `GapSummaryJson`, `PortCallJson`, `VoyageRecordJson`. Rendered inside `AssistantPageContainer`.
- **Maintenance (`/maintenance`)** — `page.tsx:141`. Status set `CURRENT / UPCOMING / DUE_SOON / OVERDUE / BLOCKING / UNKNOWN`, colour-mapped per state.
- **Noon (`/noon`)** — `page.tsx:224`. Noon-report console with `AT_SEA / IN_PORT / WAITING / UNKNOWN` statuses; feeds `useNoon`.

### 3.5 Compliance & analytics

- **Compliance (`/compliance`)** — `page.tsx:97`. `SOX_STATUS_VARIANT` (`:50`): CLEAR→success, WARNING, NON_CONFORMING, NO_EVIDENCE, UNKNOWN. `REPORT_TYPE_LABEL` (`:58`) humanises the engine report types (`thetis_mrv`, `fueleu`, `green_zone`, `fleet_summary`, `esg_package`, …). Consumption via `getComplianceReports` / `getSoxWatch` / `getVerifierPackages`.
- **Analytics (`/analytics`)** — `page.tsx:190`. Hand-rolled SVG `GroupedBarChart` (§7); `getAnalyticsSummary()` drives metric tiles.

### 3.6 Search

- **Poseidon Search (`/search`)** — `page.tsx:336`. Hard-coded `ORG_ID = "org-001"`, `USER_ID = "user-001"`, `PAGE_SIZE = 10` (`:48`), `EXAMPLE_QUERIES` (5, `:50`). `ENTITY_ICONS` (`:58`) maps **12** entity kinds (`vessels`, `voyages`, `ais_positions`, `fuel_deliveries`, `documents`, `ocr_results`, `validation_reports`, `review_tasks`, `reports`, `verifier_packages`, `audit_log`, `regulatory`) to Lucide icons; `FIELD_DEFS` drives result rendering.

### 3.7 Settings (6 pages)

- **Home (`/settings`)** — `page.tsx:32`. `TIMEZONES` (9 entries, `:14`) and `LANGUAGES` (`en / el / no`, `:26`); a local `dirty` flag gates the `SaveBar`.
- **Users (`/settings/users`)** — `page.tsx:45`: member table + invite form.
- **Organization (`/settings/organization`)** — `page.tsx:8`: company profile + vessel registry.
- **Notifications (`/settings/notifications`)** — `page.tsx:9`: toggles for channel/event categories.
- **Integrations (`/settings/integrations`)** — `page.tsx:25`: partner tiles; marked as Phase 4.5 mock integration.
- **Appearance (`/settings/appearance`)** — `page.tsx:40`: theme/compactness preferences.

### 3.8 Auth pages

- **Login (`/login`)** — `page.tsx:14` (see §8.4 for the demo flow). `AuthShell` wrapper ("Secure Access / Sign in"), error banner, "Forgot password?" link.
- **Forgot password (`/forgot-password`)** — `page.tsx:11`: email → confirmation screen.
- **Reset password (`/reset-password`)** — `page.tsx:120`: validates the token from the URL, then swaps the password.

### 3.9 Coming soon

- **DNV (`/dnv`)** and **MarineTraffic (`/marinetraffic`)** are single-file `ComingSoon` placeholders (both `:3`) and are the two `disabled: true` nav items (§2.5).

---

## 4. Hooks catalogue

### 4.1 Barrel and the common contract — `src/hooks/index.ts`

`index.ts` (`:6-15`) re-exports the public surface: `useDocuments`, `useDocument`, `useDocumentUpload`, `useDocumentStatus`, `useDocumentValidation`, `useReviewTasks`/`useReviewTaskDetail`/`useReviewActions` (+ types `ReviewTaskRow`, `ReviewTaskDetail`, `AuditEntry`), `useDocumentReview`, `useAuth`, `useSettings`.

Nearly every data hook shares the same contract: `"use client"`, local `data | isLoading | error | refetch`, `fetch("/api/…")` inside a `useCallback`, response unwrap `body.data`, and a throw-on-`!res.ok` with the API's `error.message` (canonical example: `use-certificates.ts:26-60`).

### 4.2 Data hooks (all 26 modules)

| Hook | Export at | Purpose |
|---|---|---|
| `useVessels(pageSize = 10)` | `use-vessels.ts:21` | Paged fleet list (`/api/vessels?limit=&offset=`) |
| `useVessel(imo)` | `use-vessel.ts:15` | Single vessel by IMO |
| `useLatestVoyage(imo)` | `use-latest-voyage.ts:15` | Most recent voyage for a vessel |
| `useLatestAisPosition(imo)` | `use-latest-ais-position.ts:15` | Live AIS fix |
| `useVesselTrack(imo)` | `use-vessel-track.ts:13` | Full AIS track through `processAisTrack` |
| `useVoyages(filters)` | `use-voyages.ts:20` | Voyage list with status filter |
| `useVoyageDetail(id)` | `use-voyage-detail.ts:13` | Single voyage |
| `useAisPositions(...)` | `use-ais-positions.ts:20` | Position feed with time window |
| `usePortCalls(imo)` | `use-port-calls.ts:13` | Port-call history |
| `useEnvironmentalZones()` | `use-environmental-zones.ts:13` | Zone catalogue (list, not IMO-scoped) |
| `useZoneEvents(imo)` | `use-zone-events.ts:13` | ENTRY/EXIT/ALERT events for a vessel |
| `useDocuments(opts)` | `use-documents.ts:38` | Document list (type/status filters) |
| `useDocument(id)` | `use-document.ts:87` | Single document incl. OCR payload |
| `useDocumentUpload()` | `use-document-upload.ts:29` | Multipart upload + progress |
| `useDocumentStatus(id)` | `use-document-status.ts:45` | Processing pipeline state poll |
| `useDocumentValidation(id)` | `use-document-validation.ts:60` | Validation report |
| `useDocumentReview(id)` | `use-document-review.ts:26` | Review thread + actions for a doc |
| `useCertificateRegistryLink(vesselId)` | `use-certificate-registry-link.ts:14` | Resolves doc `vessel_id` → IMO for the fleet deep-link |
| `useReviewTasks(filter)` | `use-review-tasks.ts:58` | Review queue (priority/status filters) |
| `useReviewTaskDetail(id)` | `use-review-tasks.ts:103` | Task + actions/audit trail |
| `useReviewActions(id)` | `use-review-tasks.ts:144` | Post review actions |
| `useCertificates(imo, { mock })` | `use-certificates.ts:26` | Certificate registry (`?mock=true` by default) |
| `useOcrQuality(documentId)` | `use-ocr-quality.ts:79` | Quality snapshot + suggestion rows |
| `useSoxWatch(imo)` | `use-sox-watch.ts:48` | SOx ECA watch; `evaluate(scenario)` triggers the engine |
| `useNoon(imo)` | `use-noon.ts:25` | Noon-report state |

### 4.3 Auth, settings, utilities

- **`useAuth`** (`use-auth.ts:44`): holds the session in memory + `localStorage` token; exposes `login`, `logout`, `isLoading`, `user`. Module-level `authChangeListeners` Set + `notifyAuthChanged()` (fired with `Promise.allSettled` on login/logout) keep every mounted consumer — `AuthGate`, `AppHeader`, login page — in sync without a page reload. `isAuthPath` lives in `auth-gate.tsx:9`.
- **`useSettings`** (`use-settings.ts:45`): reads `/api/settings`, exposes `updateGeneral`/`updateAppearance` plus a `dirty` flag for the `SaveBar`.
- **`useDebounce`** (`use-debounce.ts:5`): `value` + `delayMs = 300`, returns debounced value (used for the fleet/voyage search inputs).

---

## 5. Component catalogue

All components live in `src/components/` (41 `.tsx` files).

### 5.1 UI primitives (`src/components/ui/`) — shadcn-style

Radix-backed primitives, each exporting a `cn()`-joined `*Variants` map and bare components:

| Component | Export at | Notes |
|---|---|---|
| `Button` / `buttonVariants` | `button.tsx:55` | variants: default/secondary/ghost/destructive/outline/link, sizes sm/default/lg/icon |
| `Badge` / `badgeVariants` | `badge.tsx:35` | default/secondary/success/warning/destructive/outline/muted |
| `Card*` | `card.tsx:69` | Card, CardHeader/Footer/Title/Description/Content |
| `Input` | `input.tsx:21` | |
| `Label` | `label.tsx:25` | |
| `Select` | `select.tsx:22` | |
| `Table*` | `table.tsx:102` | Table, TableHeader/Body/Row/Head/Cell/Caption |
| `Skeleton` | `skeleton.tsx:15` | |
| `Tooltip*` | `tooltip.tsx:27` | Tooltip, TooltipTrigger/Content/Provider |
| `Avatar*` | `avatar.tsx:49` | Avatar, AvatarImage/Fallback |
| `Separator` | `separator.tsx:25` | |
| `Sheet*` | `sheet.tsx:100` | mobile nav shell |
| `ScrollArea*` | `scroll-area.tsx:47` | |
| `DropdownMenu*` | `dropdown-menu.tsx:77` | |

### 5.2 Layout & auth

- `layout/sidebar.tsx` — `AppSidebar` (`:183`); internal `NavItemButton`/`NavSectionTitle`/`Brand` presentational parts (`:34-181`).
- `layout/main-layout.tsx` — `MainLayout` (`:12`).
- `layout/header.tsx` — `AppHeader` (`:52`).
- `auth/auth-shell.tsx` — `AuthShell` (`:13`): centered branded card + label/subtitle.
- `auth/auth-gate.tsx` — `AuthGate` (`:23`), `isAuthPath` (`:9`).

### 5.3 Generic data components (root of `src/components/`)

- `data-table.tsx` — generic `DataTable<T>` (`:50`) driven by a typed `ColumnDef<T>` (`:13`); `SortIndicator` (`:33`) renders ▲/▼ for the active sort column; empty-state slot when no rows.
- `search-bar.tsx:16`, `pagination-controls.tsx:17`, `loading-table.tsx:8` (skeleton rows, `columns=5 rows=8` default), `page-header.tsx:11`, `error-banner.tsx:13`, `empty-state.tsx:11`.
- `shared/assistant-page-container.tsx:7` — chrome for the assistant consoles (two-column layout, disclaimer footer).
- `shared/coming-soon.tsx:9` — `ComingSoon({ module, description })` used by `/dnv` and `/marinetraffic`.

### 5.4 Domain components

- `notifications/notification-bell.tsx:10` + `notification-panel.tsx:21` — bell + dropdown/sheet panel (`recipientId="default"`).
- `sox/sox-watch-card.tsx:62` — SOx ECA status card bound to a vessel IMO.
- `certificates/certificates-card.tsx:58` — certificate registry card with validity colouring.
- `ocr/ocr-quality-panel.tsx:56` — per-document OCR quality issues/suggestions.
- `reports/reports-list.tsx:15` — compliance report list.
- `settings/settings-ui.tsx` — form kit: `SettingsCard` (`:16`), `Field` (`:45`), `TextField` (`:60`), `ChoiceField` (`:88`), `SaveBar` (`:118`), `Toggle` (`:146`).

---

## 6. Map system

### 6.1 Design — lazy Leaflet

The map is **client-only Leaflet loaded lazily**, so the server bundle never touches the DOM or the Leaflet CSS:

- `map-container.tsx` (`MapContainer` at `:15`) uses a lazy `import("leaflet")` (resolved in an effect) and injects the Leaflet CSS only on the client.
- Tile layer: CARTO light basemap `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`, `maxZoom: 18`, attribution "© OpenStreetMap contributors © CARTO". View state syncs through a `setView` effect; cleanup calls `map.remove()`.
- `vessel-map-view.tsx` (`VesselMapView` at `:52`) is the public entry point and wraps **all five** other layers with `next/dynamic(..., { ssr: false })` (`:8-28`). Props: `trackPoints`, `vesselPosition`, `vesselLabel`, `departurePort`, `arrivalPort`, `zones`, `height="h-96"`, `className`. It keeps the `L.Map` instance in React state so sibling layers can register on it.

### 6.2 Layers

| Layer | Export at | Behaviour |
|---|---|---|
| `MapContainer` | `map-container.tsx:15` | Leaflet init, CARTO tiles, view sync, teardown |
| `TrackLayer` | `track-layer.tsx:16` | `L.polyline` styled from `VESSEL_DEFAULTS` (see geo), `smoothFactor: 1`, then `map.fitBounds(polyline.getBounds(), { padding: [30, 30] })` |
| `VesselMarker` | `vessel-marker.tsx:14` | `L.divIcon` — 18px circle, default `#00B89F`, 2px white border; popup with `label` + 4-decimal lat/lng |
| `PortMarker` | `port-marker.tsx:14` | 24px divIcon; **departure** = `#00B89F` anchor glyph `&#x2693;`, **arrival** = `#D94F4F` pin `&#x1F4CD;` |
| `ZoneLayer` | `zone-layer.tsx:18` | For each zone, `ring = geometryCoordinates[0]`, maps `[lng, lat]` → `[lat, lng]`, `fillOpacity: 0.1`, `weight: 1.5`, `opacity: 0.6`, colour from `getZoneColor`, popup with name/description |

### 6.3 Geo engine (`src/lib/geo/`)

Pure, deterministic geometry shared by maps, zone alerts, and track processing:

- `constants.ts`: `MEDITERRANEAN_BOUNDS` (`:3`) = minLat 30.0 / maxLat 47.0 / minLng −6.0 / maxLng 37.0; `MAJOR_MED_PORTS` (`:15`) — 31+ named ports (Palma, Antibes, Barcelona, Valencia, Marseille, Genoa, Naples, Piraeus, Algeciras, Gibraltar, Tunis, Malta, Livorno, Civitavecchia, Trieste, Venice, Salerno, Palermo, Cagliari, Larnaca, Limassol, Haifa, Ashrafi, Souda, Igoumenitsa, Patras, Thessaloniki, Izmir, Mersin, Alexandria, Port Said, …); `MED_DEFAULTS` (`:52`) = map centre/zoom; `VESSEL_DEFAULTS` (`:59`) = track/marker styling.
- `types.ts`: `GeoPoint` (`:1`), `GeoPolygon`/`GeoMultiPolygon` (`:6`/`:11`), `ZoneCategory` (`:18`) = ECA_SOX / ECA_NOX / SECA / PSSA / MED_BALLAST / PORT_CONTROL, `ZoneEventType` (`:26`) = ENTRY / EXIT / WITHIN / ALERT, `EnvironmentalZone` (`:28`), `PortCall` (`:44`), `ZoneEvent` (`:59`), `ZoneAlert` (`:74`), `ProcessedTrack*` (`:81-89`), `TrackGap` (`:98`).
- `zone-engine.ts`: `pointInZone` (`:54`) via ray-casting `pointInPolygon`; `detectZoneTransition` (`:60`) computes ENTRY/EXIT vs WITHIN; `checkZoneAlerts` (`:76`); `getZoneColor` (`:112`).
- `track.ts`: `validateCoordinate` (`:23`); `processAisTrack` (`:27`) sorts by ts, drops invalid coords, marks gaps > `GAP_THRESHOLD_MINUTES = 120` and emits `AisGap` records; `haversineDistanceNm` with `R = 3440.065` NM; `interpolateTrackPoint` (`:82`); `simplifyTrack` (`:110`).

---

## 7. Charts & visualisation

The app has **no charting dependency** — every visual is hand-rolled SVG or a Tailwind primitive.

### 7.1 Analytics chart — `src/app/analytics/page.tsx`

- Constants: `W = 560`, `H = 220`, `PAD = { top: 18, right: 12, bottom: 26, left: 46 }` (`analytics/page.tsx:21-23`).
- `GroupedBarChart` (SVG): fixed plot area `W − PAD.left − PAD.right` × `H − PAD.top − PAD.bottom`; 5 horizontal gridlines at `t = 0 / 0.25 / 0.5 / 0.75 / 1`; per-vessel grouped bars with a legend; `barW = Math.min(18, …)` auto-shrinks bars to fit many groups.
- Metric tiles fed by `getAnalyticsSummary()` (distance, at-sea days, fuel, emissions, port calls).

### 7.2 Status → badge-variant mapping (recurring pattern)

Each page owns a local `Record<string, BadgeVariant>` map, so a single `Badge` primitive renders ~20 distinct statuses across the app:

| Map | Location | Notable mappings |
|---|---|---|
| `STATUS_VARIANTS` (documents) | `documents/page.tsx:34` | `uploaded`→warning, `processing`→secondary, `ocr_complete`→success, `rejected`→destructive, `archived`→muted |
| `STATUS_VARIANTS` (document detail) | `documents/[id]/page.tsx:22` | adds `pending/running/completed/failed/cancelled/unknown_document` pipeline states |
| `STATUS_VARIANTS` + `PRIORITY_VARIANTS` (review) | `review/page.tsx:22,29` | `urgent`→destructive, `pending`→warning |
| `LEVEL_VARIANT` / `PRIORITY_VARIANT` (OCR) | `ocr/page.tsx:31,38` | HIGH→success, VERY_LOW→destructive |
| `SOX_STATUS_VARIANT` | `compliance/page.tsx:50` | CLEAR→success, NON_CONFORMING/NO_EVIDENCE→destructive |
| `navStatusBadge()` | `ais/page.tsx` | aground/sos→destructive, moored→warning |

### 7.3 Confidence bar and stat tiles

- `ConfidenceBar` (`documents/[id]/page.tsx`) — width = pct, colour tiering ≥90 success / ≥70 warning / ≥50 orange-500 / else destructive.
- `StatTile` (`ocr/page.tsx`) — mono-uppercase label + large value, used for the OCR summary and mirrored by `StatCard` on the dashboard and analytics tiles.

---

## 8. Demo UX specifics

The whole product is runnable in a single click with no credentials and no backend.

### 8.1 Demo constants — `src/constants/demo.ts`

- Single source of truth shared by the login page **and** the demo seed so credentials can never drift (header comment `:1-7`; file is deliberately dependency-free for client import).
- `DEMO_EMAIL = "operator@poseidonledger.com"` (`:9`), `DEMO_PASSWORD = "demo1234"` (`:10`), `DEMO_DEFAULT_IMO = "9074729"` (`:13`) — the vessel preselected in vessel-scoped consoles, `DEMO_OWNER = { id: "user-marina", …fullName: "Marina Alexiou" }` (`:15-20`).

### 8.2 One-click demo access — `src/app/login/page.tsx`

- `onDemoAccess()` (`login/page.tsx:33-41`): `login(DEMO_OWNER.email, DEMO_OWNER.password)` then `router.replace("/")`. Rendered as a `secondary` button with a Sparkles icon under a "Demo" divider: **"Enter demo workspace — one click, no credentials needed"** (`:94-115`). `useAuth` (mock mode) accepts the demo credentials without any server call.

### 8.3 Mock mode plumbing

- Default runtime is `SUPABASE_USE_MOCK=true` (Chapter 4); pages and hooks consistently signal the mock path — e.g. `useCertificates(imo, { mock = true })` appends `?mock=true` (`use-certificates.ts:30,40`) and surfaces a `mock: boolean` flag in its data so UI can render a "demo/mock" badge.
- Assistant consoles run against deterministic mock states with pinned clocks (Chapter 7, §1.3), so every demo scenario is reproducible.

### 8.4 Coming-soon & disabled modules

- `/dnv` and `/marinetraffic` render `ComingSoon` and are the two `disabled: true` nav items (`navigation.ts:96-100`, `:108`), which the sidebar shows greyed out with a lock badge and non-focusable.
- `Settings → Integrations` describes the partner integrations as Phase 4.5 mock tiles rather than live connectors.

---

**Key-fact summary**

- 31 client pages, 26 hooks (+ barrel), 41 components, 6 map components, 4 geo modules — all under `src/`.
- Single nav source `src/constants/navigation.ts` (4 sections, 2 disabled items) feeding both sidebar and header; 26 route keys in `ROUTES`.
- `AuthGate` + `AUTH_PATHS` centralise auth; `useAuth` syncs consumers via a module-level listener set (no reload).
- Brand fonts (serif/sans/mono) wired as CSS variables in `src/app/layout.tsx`; global dark theme; mono-uppercase micro-labels are a signature treatment.
- Every page uses a local `Record<string, BadgeVariant>` for statuses — ~20 distinct statuses, one `Badge` primitive.
- Map = lazy Leaflet + CARTO light tiles; zone alerts and gap detection come from the pure `src/lib/geo` engine (ECA categories, 120-minute gap threshold, 3440.065 NM earth radius).
- Charts are hand-rolled SVG (`W=560, H=220, PAD` in `analytics/page.tsx:21-23`) — no charting dependency.
- Demo UX: `DEMO_OWNER` one-click login, `DEMO_DEFAULT_IMO=9074729`, mock badges, `ComingSoon` for DNV/MarineTraffic.

---

# 10. Demo Mode & Mock Architecture



## 10.1.1 One-flag mock/real seam, everywhere

Poseidon Ledger is a **"demo-first" product**: every external dependency ships behind a single boolean env flag that defaults to `true` (mock). The application boots, runs, and passes its entire test suite with **zero credentials and zero network access**. Going live for any module is a one-flag flip plus credentials — nothing else changes. This pattern was established in Phase 1A (MarineTraffic) and then repeated verbatim for Supabase, Storage, OCR, and AI. `.env.example` (lines 1–6) states the contract explicitly: *"Both modules run fully mocked by default — no secrets required to compile, boot, or run the unit tests."*

The flags, each documented in `.env.example`:

| Flag | Default | Module | Purpose |
|---|---|---|---|
| `MARINETRAFFIC_USE_MOCK` | `true` | MarineTraffic (Phase 1A) | AIS voyage data via MockTransport |
| `SUPABASE_USE_MOCK` | `true` | Supabase (Phase 1B) | In-memory fake client seeded with demo tables |
| `STORAGE_USE_MOCK` | `true` | Storage (Phase 2A.2) | In-memory file store |
| `OCR_USE_MOCK` | `true` | OCR (Phase 2A.2) | Deterministic mock OCR provider |
| `AI_USE_MOCK` | `true` | AI extraction (Phase 2A.3) | Deterministic mock GPT-4o provider |
| `VALIDATION_USE_MOCK` | `true` | Validation (Phase 2A.4) | Deterministic mock validation provider |
| `GOOGLE_OCR_ENABLED` | `false` | Google Document AI | Second gate before real OCR is used |

Each config module shares the same shape (see `src/lib/supabase/config.ts:46-49`, `src/lib/marinetraffic/config.ts:50-53`, `src/lib/storage/config.ts:24-27`, `src/lib/ocr/provider.ts:5-8`, `src/lib/ai/provider.ts:18-21`):

```
function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "1" || value.toLowerCase() === "true";
}
```

The **only hard error** is trying to run live without credentials. Every config loader throws its typed error only when `useMock === false` and required secrets are missing:
- Supabase: `SupabaseConfigError` if `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` missing (`src/lib/supabase/config.ts:61-66`).
- MarineTraffic: `ConfigurationError` if `MARINETRAFFIC_API_KEY` missing (`src/lib/marinetraffic/config.ts:72-77`); a malformed key only logs a warning (non-fatal, lines 81-88).
- Storage: `StorageConfigError` if `STORAGE_BUCKET` missing in live mode (`src/lib/storage/config.ts:39-43`).
- OCR: `GoogleOcrConfigError` when `GOOGLE_OCR_ENABLED=true` and project/processor/credentials missing (`src/lib/ocr/google-docai.ts:62-102`).

The providers are **cached singletons** with a `_reset*ForTest()` escape hatch (`src/lib/ai/provider.ts:23-76`, `src/lib/ocr/provider.ts:10-36`, `src/lib/storage/client.ts:21-64`). Repositories and services never construct providers — they receive typed clients through factory functions, which is what makes DI and fakes in tests trivial.

## 10.1.2 The demo dataset (buildDemoSeedTables)

The heart of the demo experience is `src/lib/supabase/demo-seed.ts` (1,131 lines). When `SUPABASE_USE_MOCK=true`, `getSupabaseClient()` builds an in-memory fake client seeded from `buildDemoSeedTables()` (`src/lib/supabase/client.ts:74-83`). The header comment states the goal: *"the app looks like a finished commercial product on first run. Every value below is hard-coded and stable for the life of the process so dashboards, lists and charts render identically."* (lines 1–20).

**Timestamp strategy (lines 195–199):** all timestamps are computed relative to `Date.now()` at seed time:
```
const NOW = Date.now();
const iso  = (ms) => new Date(ms).toISOString();
const ago  = (ms) => iso(NOW - ms);    // ms in the past
const ahead= (ms) => iso(NOW + ms);    // ms in the future
```
This makes the demo look "live" on first load while remaining deterministic within a single process run.

**The tenant and its members (lines 1033–1082):**
- Org: `org-poseidon` — "Poseidon Shipping Ltd.", country GR, IMO company number `1234567`, address "1 Piraeus Avenue, Athens, Greece", billing/support emails (lines 1034–1046).
- Two members: `user-marina` (the demo owner, email `operator@poseidonledger.com`, password hash from `demo1234`, role `owner`) and `user-nikos` ("Nikos Papadakis", `nikos@poseidonledger.com`, password hash from `member1234`, role `member`). Note: the seed uses `hashPassword` from the mock auth seam (`src/lib/auth/passwords.ts`) so demo logins work out of the box.
- `user_roles` table seeded by mapping the `ROLES` catalog from `src/lib/roles/catalog.ts` (lines 1048–1054) — the DB and the TS catalog can never drift.
- `organization_settings` row with `default_timezone: "UTC"`, `default_reporting_year: 2026`, `language: "en"`, and the default appearance/notification JSON (lines 1083–1095).
- All five integration credential rows present with status `CONNECTED` and `encrypted_config: { mock: true }` (lines 1096–1102) — so the Settings → Integrations screen already shows every provider as configured.

**The fleet (lines 45–51):** five vessels — Aurelia (IMO 9074729), Atlas (IMO 9432891), Horizon (IMO 9587420), Neptune (IMO 9338490), Odyssey (IMO 9712215), each with mmsi, MarineTraffic ship id, and gross tonnage.

**Operational data** is generated in-volume: 11 voyages across the five vessels (lines 86–98), live AIS positions per vessel (lines 109–115), port calls (lines 881–904), noon reports, fuel types (17 fuels from HFO 380 to ammonia, lines 944–973), fuel deliveries, FuelEU records, EU ETS records, MRV reports, compliance reports, verifier packages, certificates, documents, review tasks, SOx watch state and events, zone events, assistant conversations/messages, and knowledge documents.

**Environmental zones (lines 822–857)** — the reference dataset for the SOx ECA watch:
- `zone-med-sox-eca` — "Mediterranean Sea SOx Emission Control Area", category `ECA_SOX`, geometry type `POLYGON`, regulation reference `MARPOL Annex VI Reg. 14`, geometry version `1.0.0`, jurisdiction IMO, effective from `2025-05-01`.
- `zone-eu-port-control` — "EU Port / EEA Jurisdiction", category `PORT_CONTROL`, geometry `MULTIPOLYGON`, regulation reference `EU ETS Directive (EU) 2023/959`, jurisdiction European Union, effective from `2024-01-01`.

Zone events (lines 859–864) include entry/within/alert records that feed the notification seed (e.g. `ze-nep-2` is an `ALERT` with "Insufficient SOx evidence on entry", matching the `sox_alert` notification `ntf-1`).

## 10.1.3 The fake Supabase client

`src/lib/supabase/fake-client.ts` (790 lines) implements a `TypedSupabaseClient` entirely in memory. Key mechanics:
- `FakePostgrestError` has `name = "PostgrestError"` so repository error handling is exercised against realistic shapes (lines 1–18).
- Results come back as `{ data, error: null, count, status, statusText }` or `{ data: null, error: FakePostgrestError, ... }` via the `success`, `successWithCount`, `failure` helpers (lines 38–58).
- The query builder supports `select | insert | upsert | update | delete`, filters `eq | gte | lte | gt | lt` (`QueryFilter`, lines 67–73), ordering, `range` pagination, `head`/`count`, and `maybeSingle`/`single` semantics.
- Each table is a plain array; rows are shallow-copied on read and `buildRow` defaults are applied **only on insert** (documented in demo-seed.ts lines 16–19). This keeps seeds explicit (every field present) while still simulating DB defaults.
- `createFakeSupabaseClient({ tables, globalError? })` (lines 98–111) lets tests inject a `globalError` to simulate a broken upstream.

## 10.1.4 Demo entry point (one-click login)

- `src/constants/demo.ts` is the single source of truth for demo credentials, deliberately dependency-free so client components can import it: `DEMO_EMAIL = "operator@poseidonledger.com"`, `DEMO_PASSWORD = "demo1234"`, `DEMO_DEFAULT_IMO = "9074729"`, `DEMO_OWNER = { id: "user-marina", ... }`.
- `src/app/login/page.tsx` renders a "Enter demo workspace" button that calls `login(DEMO_OWNER.email, DEMO_OWNER.password)` then `router.replace("/")` (lines 33–41). The same constants seed the DB via `demo-seed.ts:24` and `demo-seed.ts:202`, so credentials can never drift between the button and the seed.


---

# 11. External Providers



## 10.2.1 MarineTraffic (Phase 1A)

Module: `src/lib/marinetraffic/` — files `index.ts`, `client.ts`, `config.ts`, `http.ts`, `mock.ts`, `parse.ts`, `types.ts`, `errors.ts`, plus a README.

- **Client** (`client.ts`): the single public door is `createMarineTrafficClient().getVoyageByIMO(imo)`. It (1) validates the IMO via `normalizeImo`, (2) calls the Voyage Forecast service, (3) non-fatally enriches with Port Calls (extended) for verified arrival + distance, (4) fuses into one normalized `Voyage` (lines 74–125). The mock→real swap happens only in `buildTransport` (lines 132–145).
- **Transport contract** (`http.ts:45-56`): `TransportResponse<T> { data, mock, fetchedAt }` and `Transport { getVoyageForecast, getPortCalls }`. `RealTransport` implements rate limiting (token bucket, lines 66–90), request timeout via `AbortController`, and retry with exponential backoff on 429/5xx/network/timeout, mapping to typed `RateLimitError`, `TimeoutError`, `UpstreamError`.
- **MockTransport** (`mock.ts`): fixtures shaped exactly like MarineTraffic's jsono output (same `SHIPNAME/IMO/LAST_PORT/ETA/...` field names) so `parse.ts` is proven correct against the real API's shapes before a key exists. Note the fixture narrative: IMO 9074729 is "Aurelia" (client/seed/verify-script) while the mock header comment says "SILVER CLOUD"-format yacht — the data row itself uses `SHIPNAME: "Aurelia"`.
- **Config defaults**: base URL `https://services.marinetraffic.com/api`, timeout 10,000 ms, rate limit 30/min, max retries 3 (`config.ts:90-97`).

**Verify script** — `scripts/verify-marinetraffic.ts`, run via `npm run verify:mt`. An end-to-end smoke test with no key/network that prints a human-readable fused Voyage for three cases: `9074729` (Aurelia, full fixture), `9707211` (Calypso Nova, forecast-only), `1234567` (unknown, `VesselNotFoundError` path), plus a bad-checksum IMO → `InvalidIMOError` (lines 21–95).

## 10.2.2 OCR — Google Document AI (Phase 2A.2)

- Provider factory `src/lib/ocr/provider.ts`: `OCR_USE_MOCK` defaults true → `createMockOcrProvider()`. Live mode additionally requires `GOOGLE_OCR_ENABLED=true` (a second safety gate) and then builds `createGoogleDocAiOcrProvider(loadGoogleDocAiConfig())`; any other combination falls back to mock (lines 12–28).
- Config (`google-docai.ts:62-102`): requires `GOOGLE_OCR_PROJECT_ID`, `GOOGLE_OCR_PROCESSOR_ID`; `GOOGLE_OCR_LOCATION` defaults `"us"`; credentials via `GOOGLE_OCR_CREDENTIALS` (JSON string, validated) or `GOOGLE_APPLICATION_CREDENTIALS` (file path).
- Mock fixtures (`mock-provider.ts`): deterministic `BdnExtractedData`, `CiiExtractedData`, `EuEtsExtractedData`, `FuelEuExtractedData` — e.g. BDN for IMO 9876543 / "MV Poseidon Explorer", VLSFO 1200.5 t at Rotterdam 2026-06-15, sulphur 0.48% (lines 28–39).

## 10.2.3 AI extraction — OpenAI (Phase 2A.3)

- `src/lib/ai/provider.ts`: `AI_USE_MOCK` default true → `createMockAiProvider()`. Live mode requires `OPENAI_API_KEY`, otherwise falls back to mock; the real provider is lazy-`require`d so mock mode never loads the `openai` package (lines 30–63). Model default `gpt-4o` with `OPENAI_MODEL`, `OPENAI_TIMEOUT_MS`, `OPENAI_TEMPERATURE`, `OPENAI_MAX_RETRIES`.
- Mock fixtures (`mock-provider.ts`): `MOCK_AI_FIXTURES` — BDN (confidence 0.96, usage 850/420/1270 tokens), CII (0.93, rating B for 2025, operational CII 3.12), EU ETS (0.91, 8,450 t CO₂, DTZ methodology), FuelEU (0.94, 89.2 gCO₂eq/MJ WTW, 65% VLSFO / 25% MGO / 10% LNG), and an "unrecognized document" fallback (0.45) for certificate/correspondence/logbook/other.

## 10.2.4 Storage — Supabase Storage (Phase 2A.2)

- `src/lib/storage/config.ts`: `STORAGE_USE_MOCK` default true, bucket default `"documents"`.
- `src/lib/storage/client.ts`: `getStorageClient()` returns `createMockStorageClient()` in mock mode; live mode lazy-requires the Supabase client singleton and builds `createSupabaseStorageClient`.

## 10.2.5 Email — Resend (Phase 4.5, integration catalog only)

Email is currently **entirely mock**: `createNotificationEmailProvider()` returns the mock provider when `NODE_ENV === "test"` or `MOCK_MODE === "true"`, otherwise a stub that throws `"Production email provider not configured"` (`src/lib/notifications/email-provider.ts:12-42`). "Resend" exists only as a catalog entry in Settings → Integrations (`src/lib/integrations/catalog.ts:69-80`) with fields `apiKey` (secret) + `fromAddress`; nothing ever calls it in Phase 4.5.

## 10.2.6 Map tiles

- `src/lib/map/types.ts:29-49`: default config — provider `"mock"`, CARTO light basemap (`{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`) with OSM/CARTO attribution, center `{38.0, 15.0}`, zoom 5, track color `#00B89F`, `isMock: true`.
- `src/lib/map/provider.ts:32-37`: `fetchMapConfigFromApi()` reads `NEXT_PUBLIC_API_URL` and falls back to the default config on failure.
- `src/app/api/map-config/route.ts`: serves the default config with `Cache-Control: public, max-age=3600, stale-while-revalidate=60`.

## 10.2.7 The integrations catalog & mock "encryption"

- `src/lib/integrations/catalog.ts`: five providers — `marinetraffic` (Fleet), `google_docai` (AI), `openai` (AI), `resend` (Email), `ais` (Data) — each with name, description, category, `configured`, `docsUrl`, and a `fields[]` list of `{ key, label, secret }` used by the Settings config form. Catalog entries are intentionally not wired to live providers in Phase 4.5.
- `src/lib/integrations/credentials.ts`: mock credential envelope. `encryptConfig` wraps every value as `pl:mock:v1:` + base64; `decryptConfig` unwraps; `isEnvelope` checks the prefix. The header is explicit: *"a placeholder for a real KMS-backed encryption layer in a later phase. Never rely on this for actual secrets."*

## 10.2.8 Email ingress (BDN-by-email)

- `src/lib/email-ingress/provider.ts`: `EmailIngressProvider.ingest(payload)` seam; `MockEmailIngressProvider` adds `setScenario()` / `currentScenario()`.
- Mock scenarios (`mock-provider.ts`): `valid_bdn`, `multiple_attachments`, `invalid_imo`, `unknown_vessel`, `duplicate_attachment` (and more), all addressed to `imo9876543@docs.poseidonledger.com` (mock domain constant, line 13). Webhook handler under `src/app/api/webhooks/email/resend/__tests__/handler.test.ts`.


---

# 12. Settings & Configuration



## 10.3.1 The settings bundle

`src/lib/settings/types.ts` defines the full shape served to the UI (lines 11–100):

- `OrganizationProfile` — id, name, companyLogoUrl, country, imoCompanyNumber, address, billingEmail, supportEmail.
- `GeneralSettings` — organizationName, defaultTimezone, defaultReportingYear, language.
- `AppearanceSettings` — theme `dark|light`, accent `blue|teal|slate`, sidebarDensity `compact|comfortable`, tableDensity `compact|comfortable|roomy`, gridView `grid|list`.
- `NotificationPreferences` — emails, complianceAlerts, certificateExpiry, fuelAlerts, noonReport, assistantDigests, systemAnnouncements.
- `SettingsUser`, `SettingsInvite` (status `pending|accepted|cancelled`, resendCount, expiresAt), `IntegrationState` (per provider: `NOT_CONFIGURED|CONFIGURED`, displayValues, configuredAt), `AboutInfo`, and the aggregate `SettingsBundle`.

Defaults live in `src/lib/settings/service.ts:111-127`: appearance defaults to `{ theme: "dark", accent: "blue", sidebarDensity: "compact", tableDensity: "compact", gridView: "grid" }` and every notification preference defaults to `true`. `normalizeAppearance` / `normalizeNotifications` (lines 129–171) coerce any incoming values back to the allowed sets, so the API never persists garbage.

## 10.3.2 SettingsService — the single owner of business rules

`src/lib/settings/service.ts` (header, lines 1–14) declares the rules enforced there and only there:

> *"The service is the ONLY owner of business rules: An organization keeps at least one active Owner. A member cannot change their own role/status. Invites are mocked through the notification email provider. Integration credentials are mock-encrypted, never dialed."*

Key behaviors:
- **getBundle(orgId)** (lines 186–247) — fetches org + settings + users + invites + credentials in parallel, normalizes, maps each catalog entry to an `IntegrationState`, and fills the `About` panel from `version.ts`.
- **updateUser** (lines 345–384) — enforces self-change prohibition (`CannotDemoteSelfError`), role-hierarchy via `mayManageUser(actor.role, target.role)` (`src/lib/roles/catalog.ts:180-185` — actor rank must be **strictly greater**), and the last-owner rule (`CannotDeactivateLastOwnerError` when deactivating the final active owner).
- **inviteUser / cancelInvite / resendInvite** (lines 388–472) — duplicate checks against existing members and pending invites (`InviteConflictError`), 7-day expiry, invite emails sent via the **mock** email provider; resend bumps `resend_count` and `last_sent_at`.
- **saveIntegration / disconnectIntegration** (lines 476–527) — validate the provider via catalog, `encryptConfig` on save, `{}` on disconnect, status `CONFIGURED`/`NOT_CONFIGURED`.
- Invite tokens reuse `generateToken()` from `src/lib/auth/tokens.ts`.

## 10.3.3 About panel versions

`src/lib/settings/version.ts`: `APP_NAME = "Poseidon Ledger"`, `APP_VERSION` from `package.json` (0.1.0), `BUILD_VERSION = "2026.08.02"`, `CALCULATION_ENGINE_VERSION = "1.0.0"`, `AUTH_MODE = "mock"`, `INTEGRATIONS_MODE = "mock"`. The About panel transparently reports the product is running in mock auth/integrations mode.

## 10.3.4 Typed errors

`src/lib/settings/errors.ts` — `SettingsError` base + `OrganizationNotFoundError` (ORGANIZATION_NOT_FOUND), `UserNotFoundError` (USER_NOT_FOUND), `InviteNotFoundError` (INVITE_NOT_FOUND), `InviteConflictError` (INVITE_CONFLICT), `CannotDeactivateLastOwnerError` (LAST_OWNER), `CannotDemoteSelfError` (SELF_CHANGE → mapped to HTTP `FORBIDDEN`), `InvalidIntegrationError` (INVALID_INTEGRATION).

## 10.3.5 The Settings API surface

Wiring lives in `src/app/api/settings/_lib.ts`: `buildDefaultSettingsApiDeps()` builds an `AuthService` (for session resolution) plus a `SettingsService` from real Supabase repositories and a mock email provider; `requireAuth` returns 401 when the `pl_session` cookie resolves to nothing; `requirePermission(session, permission)` returns 403 when `can(role, permission)` fails (`src/lib/roles/catalog.ts:174-177`).

Routes (all read, all behind `requireAuth`):

| Route | Method | Permission | Behavior |
|---|---|---|---|
| `/api/settings` | GET | — (session only) | returns full `SettingsBundle` |
| `/api/settings` | PATCH | `org_manage` / `settings_general` / `settings_integrations` per section | section-scoped updates: organization, general, appearance, notifications, integrations (configure/disconnect) — validated against `PatchBody` in `route.ts:17-38` |
| `/api/settings/invites` | POST | `users_invite` | create invite; 400 bad email/role; 409 `INVITE_CONFLICT` |
| `/api/settings/invites/[id]` | PATCH | `users_invite` | action `cancel` or `resend`; 404 `INVITE_NOT_FOUND`, 409 conflict |
| `/api/settings/users/[id]` | PATCH | `users_manage` | role/status change; 404 `USER_NOT_FOUND`, 403 `FORBIDDEN` (self/rank), 409 `LAST_OWNER` |

## 10.3.6 Client-side settings stack

- `src/services/settings.service.ts` — thin `apiFetch` wrappers returning typed section results (`UpdateSettingsResult` union, lines 13–43): `updateOrganization`, `updateGeneral`, `updateAppearance`, `updateNotificationPreferences`, `configureIntegration`, `disconnectIntegration`, `createInvite`, `cancelInvite`, `resendInvite`, `updateUser`.
- `src/services/auth.service.ts:59-61` — `getSettingsBundle()` fetches `/api/settings`.
- `src/hooks/use-settings.ts` — `useSettings()` returns `{ bundle, isLoading, error, refetch, ... }` and every mutating method re-fetches the bundle on success (`guard()` wraps errors as `ApiError`, lines 67–72). It imports `ApiError` from `src/services/api-client`.
- `src/services/api-client.ts` — `apiFetch(path)` prefixes `/api/`, parses `{ success, data }` / `{ success:false, error }`, throws `ApiError { code, status, details }`, and exports `DEFAULT_PAGE_SIZE = 20` + `pageOffset`.


---

# 13. Authentication & Authorization



## 10.4.1 Mock auth architecture (Phase 4.5)

The header of `src/lib/auth/service.ts` (lines 1–8): *"Implements the full auth flow against the `auth_tokens` + `organization_users` tables using a mock email provider for password reset. Everything is self-contained; real Supabase Auth replaces this seam in a later phase."*

The service is a class `AuthService` with four operations:

- **login(email, password)** (lines 124–156) — finds user by email, `verifyPassword`, rejects inactive accounts (`UserNotActiveError`), mints a session token, stores the SHA-256 hash in `auth_tokens` with kind `session`, updates `last_login_at`, returns `{ token, user, organization }`.
- **logout(token)** (lines 159–161) — revokes the token (no-op if unknown).
- **getSession(token)** (lines 167–183) — looks up a valid (un-revoked, un-expired) session token, loads user + org, requires `status === "active"`.
- **forgotPassword / resetPassword** (lines 190–242) — forgot always resolves successfully (anti-account-enumeration); issues a `password_reset` token and emails a mock reset link valid for 1 hour. Reset validates the token, enforces min password length 8, re-hashes, and revokes the token on success.

**Password hashing** (`src/lib/auth/passwords.ts`) is a *deliberately non-production* deterministic digest — format `mock$v1$<8-hex>`, salt `poseidon-ledger::phase-4.5`, djb2-style 32-bit hash (lines 15–34). `verifyPassword` rejects any stored value without the `mock$v1$` prefix, so a real hash can never silently pass.

**Tokens** (`src/lib/auth/tokens.ts`): `SESSION_TTL_MS = 12h`, `PASSWORD_RESET_TTL_MS = 1h`; `generateToken()` = 32-byte `base64url`; `hashToken()` = SHA-256 hex (so a leaked `auth_tokens` table is not directly replayable).

## 10.4.2 Auth API routes

All under `src/app/api/auth/`, wired via `_lib.ts` (`buildDefaultAuthApiDeps()` → `AuthService` over real repos + mock email provider):

| Route | Behavior |
|---|---|
| `POST /login` | 400 without email/password; 401 `INVALID_CREDENTIALS`; 403 `FORBIDDEN` for inactive; sets `Set-Cookie: pl_session=<token>; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200` |
| `GET /session` | resolves cookie → `{ user, organization }` or `{ user: null, organization: null }` |
| `POST /logout` | revokes token if present, clears cookie |
| `POST /forgot-password` | always `{ sent: true }`; base URL derived from request origin |
| `POST /reset-password` | 400 `INVALID_RESET_TOKEN` on bad/expired token; `{ reset: true }` on success |

Cookie helpers (`src/app/api/_lib/cookies.ts`): `AUTH_COOKIE_NAME = "pl_session"`, `readCookie` parses a raw Cookie header, `sessionCookieValue` (Max-Age 12h) and `clearSessionCookieValue` (Max-Age 0).

## 10.4.3 Frontend auth

- `src/hooks/use-auth.ts` — `useAuth()` exposes `{ user, organization, isLoading, error, login, logout, refetch }`. Notable design: a **module-level auth-change listener set** (lines 8–32). Because multiple components mount their own `useAuth()` (AuthGate, header, login page) and each resolves the session only once on mount, a login in one instance would leave the others stale — so login/logout fire `notifyAuthChanged()` and every mounted instance re-resolves `/api/auth/session` (lines 67–74). By the time `login()`/`logout()` resolve, the whole shell is in sync without a page reload.
- `src/components/auth/auth-gate.tsx` — route protection. `AUTH_PATHS = ["/login", "/forgot-password", "/reset-password"]` (line 7). While loading, renders a spinner labeled "Loading workspace". Anonymous users on protected paths → `router.replace("/login")`; authenticated users on auth paths → `/`. Renders bare children on auth pages.
- `src/components/auth/auth-shell.tsx` — branded layout for the auth pages (used by the login page).
- Login page (`src/app/login/page.tsx`): sign-in form + the one-click **"Enter demo workspace"** button using `DEMO_OWNER`.

## 10.4.4 Roles & permissions catalog

`src/lib/roles/catalog.ts` (198 lines) is the canonical RBAC source. `PERMISSIONS` (lines 9–43) enumerates 17 permission codes (org.view, org.manage, users.view, users.invite, users.manage, settings.general, settings.integrations, settings.about, fleet.view, voyages.view, ais.view, documents.view, review.view, compliance.view, analytics.view, assistant.use, noon.view). `RoleCode` (lines 45–50): `owner | administrator | compliance_manager | fleet_manager | viewer`.

`ROLES` (lines 73–158) assign each role a `rank` (owner 50, administrator 40, compliance_manager 30, fleet_manager 20, viewer 10) and a permission list:
- **owner / administrator** — all module reads + org/settings/users management (identical sets; differ only by label/description).
- **compliance_manager** — fleet/documents/review/compliance/noon + org.view + settings.about.
- **fleet_manager** — operational reads + assistant.use + users.view + org.view + settings.about.
- **viewer** — read-only across modules + settings.about.

Helpers: `getRole`, `can(role, permission)` — *the only enforcement entry point* — `mayManageUser(actor, target)` (strict rank greater), `isRoleCode`, `roleLabel`, `permissionsFor`. The DB mirror lives in migration `0017_init_organizations_auth.sql` (seeded `user_roles` rows, lines 64–75) and in the demo seed (`demo-seed.ts:1048-1054`).

## 10.4.5 How permission enforcement works in API routes

Two patterns coexist:
- **Guard helpers** (`src/app/api/settings/_lib.ts`): `requireAuth(deps, req)` → 401; `requirePermission(session, PERMISSIONS.x)` → 403. Used by all settings routes (see §10.3.5).
- **`httpStatusForError`** (`src/app/api/_lib/http.ts:46-137`): constructor-name-based mapping of every typed error class to an HTTP status + error code, including `InvalidCredentialsError`→401, `UserNotActiveError`→403, `InvalidResetTokenError`→400, `OrganizationNotFoundError`→404, `InviteConflictError`→409, `CannotDeactivateLastOwnerError`→409 (LAST_OWNER), `CannotDemoteSelfError`→403. `mapErrorResponse` adds `Retry-After` for `RateLimitError` (lines 139–155).

**Note:** the notifications API (§10.5.5) does **not** use these guards — it takes `recipient_id` directly as a query/body param, which is a deliberate (if notable) asymmetry vs the settings/auth routes.


---

# 14. Notifications



## 10.5.1 Module layout and types

`src/lib/notifications/` contains `types.ts`, `dispatcher.ts`, `email-provider.ts`, `preferences.ts`, `deadlines.ts`, `compliance-alerts.ts`, `templates.ts`, `index.ts`, plus a 6-test `__tests__` folder (compliance-alerts, deadlines, dispatcher, email-provider, preferences, templates).

`NOTIFICATION_SYSTEM_VERSION = "1.0.0"` (`types.ts:1`). The `NotificationEventType` union (lines 3–44) lists ~41 event kinds: EU ETS / FuelEU deadline warnings (ets_deadline_warning/urgent/overdue, fueleu_*), BDN lifecycle (bdn_auto_accepted, bdn_review_required, bdn_ocr_failed), compliance violations, AIS data gaps, green-zone port alerts, ISCC certificate expiring/missing, report/verifier-package generated/failed, certificate_* (survey_due/overdue, expiring/expired/missing/replaced/review_required, monitoring_plan_review_due), blocking_maintenance_detected, sox_eca_* (warning, non_conforming, no_evidence, review_required), and noon_* (received, impossible_fuel, unexpected_consumption, heavy_weather, unexpected_delay, fuel_discrepancy, voyage_anomaly, rob_inconsistency, low_confidence).

`NotificationEvent` (lines 46–57): `{ type, recipient_id, vessel_id?, organization_id?, title, message, severity: INFO|MEDIUM|HIGH|CRITICAL, payload?, source_event?, source_id? }`. `EmailNotification` (lines 59–65): `{ to, subject, html, text, notificationType }`.

## 10.5.2 The dispatcher (single write path)

`createNotificationDispatcher` (`dispatcher.ts:31-97`) is the **only place notifications get inserted and emails get sent**:
1. Always checks `prefService.isNotificationEnabled(recipientId, type)`.
2. Builds a `NotificationInsert` from the event and inserts via the notification repo.
3. If email is enabled for the type (`isEmailEnabled`), formats via the relevant template (certificate_/sox_eca_/noon_ prefixes select `formatCertificate/formatSox/formatNoon`) and sends through the email provider — **but email failures never fail dispatch** (try/catch, lines 90–92).
4. Returns `{ notificationId, emailSent }`.

Template formatting is injectable via `templateFormatter` (lines 15–24) with hooks for deadline, compliance, report, BDN, verifier-package, SOx, certificate, noon. Callers wire only the formatters they need (see §10.5.4).

## 10.5.3 Preferences (per-type over global)

`createPreferenceService` (`preferences.ts:19-63`): resolution order for an event of type `T` is (1) the `T`-specific row, (2) the global row (`notification_type IS NULL`), (3) built-in defaults `{ enabled: true, emailEnabled: true, inAppEnabled: true }` (line 20). `setPreference(recipientId, type|null, prefs)` upserts on `(recipient_id, notification_type)` — backed by the unique constraint in migration 0011 and the repo's `onConflict` upsert (`src/lib/supabase/repositories/notification_preferences.ts:58-73`).

## 10.5.4 Alert services

- **Deadline alerts** (`deadlines.ts`): `createDeadlineAlertService.checkAndAlert(vesselId, year, recipientId)` iterates deadlines, skips `OK`, maps status→severity via `SEVERITY_MAP` (OK→INFO, WARNING→MEDIUM, URGENT→HIGH, OVERDUE→CRITICAL, lines 4–9) and deadline kind→event type via `EVENT_TYPE_MAP` (ets_deadline→ets_deadline_warning, ets_submission→ets_deadline_urgent, mrv_submission→ets_deadline_warning, iscc_certificate→iscc_certificate_expiring, etc., lines 11–21), formats with `formatDeadlineTemplate`, stamps `source_event: "deadline_check"` and `source_id: vesselId_deadlineType_year`, then dispatches.
- **Compliance alerts** (`compliance-alerts.ts`): `alertViolation(vesselId, recipientId, HIGH|CRITICAL, ruleName, message, details?)` → `compliance_violation_error`; `alertWarning(...)` → `compliance_violation_warning` (MEDIUM). Both stamp `source_event: "compliance_check"`, `source_id: ${vesselId}_${ruleName}`, and return the created notification id (lines 29–80).

## 10.5.5 Email templates

`templates.ts` produces `{ subject, html, text }` for each format:
- Deadline: subject `[${status}] ${label} — ${days_remaining} day(s) remaining`; HTML color-codes OVERDUE/URGENT/WARNING (lines 3–20).
- Compliance: `[${severity}] Compliance Alert — ${vesselName}` (lines 22–41).
- Report: `Report Generated — ${reportType} — ${vesselName} (${year})`.
- BDN: `BDN ${event} — ${bdnFilename}`.
- Verifier package: `Verifier Package ${status} — ${vesselName} (${year})`.
- SOx: `[${severity}] SOx ECA — ${vesselName}` (lines 88–107).
- Certificate: `[${severity}] Certificate — ${vesselName}` (lines 132–151).
- Noon: `[${severity}] Noon Report — ${vesselName}` (lines 153–171).

## 10.5.6 Email provider seam

`email-provider.ts` (43 lines): `createNotificationEmailProvider()` → mock when `NODE_ENV === "test"` or `MOCK_MODE === "true"`; otherwise `createProductionNotificationEmailProvider()` which **throws** `"Production email provider not configured"`. The mock records everything into `sent[]` and exposes `reset()`, so route tests assert on the emails actually "sent" (used by auth/settings route tests).

## 10.5.7 Where notifications get dispatched in the app

The dispatcher is wired into three API `_lib` files that build real services:
- `src/app/api/vessels/[imo]/sox-watch/_lib.ts:99-107` — SOx compliance service; `templateFormatter: { formatSox }`.
- `src/app/api/vessels/[imo]/certificates/_lib.ts:117-124` — certificate service; `templateFormatter: { formatCertificate }`. (The deterministic in-memory mock variant at lines 130–155 uses a no-op `notify.dispatch`.)
- `src/app/api/vessels/[imo]/noon/_lib.ts:70-77` — noon report service; `templateFormatter: { formatNoon }`.

Each wires `createNotificationDispatcher({ notifRepo, emailProvider: createNotificationEmailProvider(), prefService: createPreferenceService(...) })`. The deadline/compliance alert services are exercised by their unit tests; the domain modules (sox-eca, certificates, noon-report) each have a `notifications.test.ts`.

## 10.5.8 Data layer & API

**Tables** (migration `0011_init_reporting_and_notifications.sql`):
- `notifications` (lines 121–150): `recipient_id` (text), `notification_type`, `severity` CHECK (`INFO|MEDIUM|HIGH|CRITICAL`), `vessel_id` FK→vessels, `organization_id`, `title`, `message`, `payload` jsonb, `is_read` default false, `read_at`, `source_event`, `source_id`, `created_at`. Indexes on recipient_id, unread (partial `WHERE is_read = false`), type, severity, created_at DESC. RLS enabled.
- `notification_preferences` (lines 154–170): `recipient_id`, nullable `notification_type`, `enabled`, `email_enabled`, `in_app_enabled`, unique on `(recipient_id, notification_type)` so upsert works; RLS enabled.
- (Same migration also creates `compliance_reports` and `verifier_packages`, lines 34–116.)

**Repositories** (both default to `getSupabaseClient()` when no client injected):
- `notifications.ts` — `findById`, `insert`, `markRead`, `markAllRead` (returns count), `listByRecipient` (order created_at desc, range pagination, default limit 50), `unreadCount` (head+count), `listByType`, `listUnread`, `delete`. All errors wrapped via `mapError`.
- `notification_preferences.ts` — `findByRecipient`, `findByRecipientAndType` (handles null type with `.is`), `upsert` (onConflict), `delete`.

**API routes** (no auth guard — `recipient_id` passed explicitly):
| Route | Behavior |
|---|---|
| `GET /api/notifications` | requires `recipient_id` (400 otherwise); optional `limit`, `offset`, `unread_only`, `type`; returns `{ notifications, unread_count }` |
| `GET /api/notifications/unread-count` | `?recipient_id=` → `{ unread_count }` |
| `POST /api/notifications/mark-all-read` | body `{ recipient_id }` → `{ marked_read: count }` |
| `PATCH /api/notifications/[id]/read` | 404 `NOTIFICATION_NOT_FOUND`; → `{ notification }` |

**Seed data** (`demo-seed.ts:906-942`): 20 notifications for the `"default"` recipient covering every family — `sox_alert` (CRITICAL, Neptune, evidence required), `certificate_expiring` (IAPP expired / IOPP in 8 days / SMC in 20 days / IAPP in 40 days), `review_task` (OCR quality + BDN rotation), `fueleu` (ISCC missing, 2026 surplus), `ets` (MRV incomplete, surrender plan), `fuel_delivery` (BDN awaiting assignment, reconciled), `noon_report` (received), `zone_event` (Med SOx ECA entries), and `system`. Read state is deterministic (`i % 3 === 0` read), and `source_id` is derived from `payload.documentId ?? payload.imo`.


---

# 15. Testing



## 10.6.1 Test runner

Tests run via **`tsx`** executing the test files directly — each file calls a tiny shared `run()` harness imported from `@/lib/marinetraffic/__tests__/_testRunner` (mirrored as `_fakeClient` for the fake Supabase client), not vitest. `vitest` is present in devDependencies (`package.json:200`) and configured with only a `@` alias (`vitest.config.ts`), but the `package.json` scripts use `tsx` end-to-end. The root `test` script chains **~27 sub-scripts sequentially** (`package.json:13`), each of which chains further.

## 10.6.2 Inventory

**150 test files total**: 139 under `src/lib`, 7 under `src/app`, 4 under `src/services`. Per-module (top-level lib folders): supabase 26, assistant 11, sox-eca 8, search-assistant 7, validation 7, notifications 6, noon-assistant 6, noon-report 6, maintenance-assistant 6, voyage-assistant 6, captain-assistant 6, fuel-delivery 5, certificates 4, ocr-assistant 4, compliance-assistant 4, ocr 3, auth 3, email-ingress 3, marinetraffic 3, verifier-package 2, geo 2, ai 2, and one each for storage, fueleu, mrv, eu-ets, roles, reporting, map, integrations, settings.

**API route tests (7):** `app/api/auth/__tests__/routes.test.ts`, `app/api/ocr/__tests__/routes.test.ts`, `app/api/settings/__tests__/routes.test.ts`, `app/api/vessels/[imo]/certificates/__tests__/routes.test.ts`, `app/api/vessels/[imo]/noon/__tests__/routes.test.ts`, `app/api/vessels/[imo]/sox-watch/__tests__/routes.test.ts`, `app/api/webhooks/email/resend/__tests__/handler.test.ts`. (There is **no** `app/api/notifications/__tests__` — notifications are covered at the lib level.)

**Service tests (4):** `src/services/__tests__/document-upload.service.test.ts`, `ai-extraction.service.test.ts`, `validation.service.test.ts`, `review.service.test.ts`.

## 10.6.3 What the Phase 4.5 tests verify

- **Auth** (`lib/auth` + `app/api/auth`): password hash/verify including the `mock$v1$` prefix guard, token TTLs/hashing, service login/session/forgot/reset flows (inactive account, invalid token, short password), and all five HTTP routes over a fake client + mock email provider (`auth routes.test.ts` seeds `owner@poseidonledger.com` / `demo1234`).
- **Settings** (`lib/settings/__tests__/service.test.ts` + `app/api/settings/__tests__/routes.test.ts`, 407 lines): bundle assembly, appearance/notification normalization, member role/status rules (last-owner, self-change, hierarchy), invites (conflict, cancel, resend, 7-day expiry), integration configure/disconnect, and the route guards (401 unauthenticated, 403 insufficient permission) with an injected fixed session.
- **Notifications** (`lib/notifications/__tests__`): dispatcher (enabled/disabled email, template selection, email-failure isolation), preferences resolution order + upsert, deadline status/severity/event mapping and payload stamps, compliance alert types/source stamps, and all template subject/html/text shapes.
- **Repos** (`lib/supabase/__tests__`): 26 repository test files (vessels, voyages, ais_positions, documents, document_versions, processing_jobs, ocr_results, document_entities, processing_logs, review_tasks, document_relationships, ai_extractions, validation_reports, review_audit_log, fuel_deliveries, ocr_quality_scores, ocr_review_suggestions, organizations, user_roles, organization_users, organization_settings, organization_invites, integration_credentials, auth_tokens, noon_reports, certificates) each against `_fakeClient` with a pinned `NOW`.
- **Role catalog** (`lib/roles/__tests__/catalog.test.ts`): permission lookups, `can`, hierarchy (`mayManageUser`), role label/code helpers.

## 10.6.4 Type-check status (advisory)

`npm run typecheck` (`tsc --noEmit`) currently reports **9 errors, all confined to two test files** (not production code):
- `src/lib/ai/__tests__/prompts.test.ts:51,114` — `"noon_report"` not assignable to `DocumentType`.
- `src/lib/ocr/__tests__/google-docai.test.ts:87,101,110,120,129,138,147` — test objects missing required `NODE_ENV` on `ProcessEnv`.

No errors originate from `src/lib/notifications`, `src/lib/settings`, `src/lib/auth`, `src/app/api/settings`, or `src/app/api/auth`.


---

# 16. Product Status

This chapter assesses what is implemented, what is partial, and what is intentionally
deferred, based on the full-stack audit. It reuses and extends the matrix from
`docs/AUDIT_2026-08-04.md`.

## 16.1 Overall maturity

| Axis | Assessment | Basis |
|---|---|---|
| Implementation vs. docs | ~90% | every architecture doc feature verified in code except the Crew assistant and monitoring-plan modeling |
| Demo readiness | ~95% | one-click login, deterministic seed, zero credentials, pinned assistant scenarios |
| Code health | good | 150 test files pass; production code is typecheck-clean |
| Production readiness | low | all providers mock-first; auth hashing and credential encryption are explicit placeholders (see Chapter 17) |
| Maturity class | **B** | stable, feature-complete demo with well-understood production gaps |

## 16.2 Feature-by-feature status

Legend: **Done** = implemented + tested; **Partial** = implemented with known gaps;
**Stub** = seam/placeholder present but not production; **Planned** = ComingSoon or
architecture-doc only.

| Module | Status | Notes |
|---|---|---|
| Fleet registry (vessels) | Done | list/detail/upsert, seed of 5 vessels |
| Voyages & voyage lifecycle | Done | list/latest/insert; 11 seeded voyages |
| AIS positions & tracks | Done | batch ingest, latest, gap detection (120-min), track processing |
| Port calls & zone events | Done | seeded port calls, ENTRY/EXIT/ALERT events |
| Noon reports | Done | ingest, deterministic analysis/validation/correlation, notifications |
| Documents pipeline | Done | upload → OCR → extraction → validation → review; 7 doc types (BDN via email only) |
| OCR (Google DocAI seam) | Stub→Partial | provider real, never dialed; deterministic OCR assistant is the workhorse |
| Human Review queue | Done | review tasks, 10 action types, audit trail |
| FuelEU Maritime engine | Done | v2025.1 parameters, target curves, surplus/deficit |
| EU ETS engine | Done | phase-in 40/70/100%, deadlines, EUA mock price |
| MRV / THETIS-MRV | Done | report builder + XML/CSV export, completeness gate |
| SOx ECA watch | Done | rules SOX-ECA-01…06, Med ECA geometry, evidence status, notifications |
| Certificates | Done | status derivation, expiry windows, IMO-mismatch guard, supersession |
| Verifier packages | Done | GENERATING→GENERATED, sha256 manifest, ZIP download |
| Compliance reporting | Done | thetis_mrv, fueleu, green_zone, fleet_summary, esg_package |
| Assistants (8 consoles) | Done (7 doc'd) | Compliance, Search, Captain, Voyage, Maintenance, OCR, Noon, general |
| Crew assistant | **Missing** | in architecture doc, not implemented |
| Poseidon Search | Done | 12 entity kinds, saved queries, rerun, audit |
| Settings & tenancy | Done | org profile, users, invites, appearance, notifications, integrations, About |
| Auth & RBAC | Partial | full mock flow works; real Supabase Auth is a future seam |
| Notifications | Done | ~41 event types, dispatcher, preferences, email templates |
| Integrations catalog | Partial | 5 providers listed; credentials mock-encrypted; nothing dialed |
| Email ingress (BDN by email) | Done | Resend-shaped webhook handler with mock scenarios |
| Monitoring plan (MRV/DCS) | **Missing** | referenced in notifications; no table or UI |
| Org-wide audit log | **Missing** | only scattered audit-shaped tables |
| MarineTraffic module UI | Planned | live client exists; `/marinetraffic` is ComingSoon |
| DNV module | Planned | `/dnv` is ComingSoon |

## 16.3 Test & quality status

- **150 test files**: 139 under `src/lib`, 7 under `src/app/api`, 4 under
  `src/services`. Largest groups: supabase repositories 26, assistant 11, sox-eca 8,
  search-assistant 7, validation 7, notifications 6, and 6 each for the noon/maintenance/
  voyage/captain assistant families.
- The root `npm test` chains ~27 sub-scripts sequentially via `tsx` (not vitest,
  though vitest is configured and present in devDependencies).
- **Typecheck**: `npm run typecheck` reports **9 errors, all in two test files**
  (`src/lib/ai/__tests__/prompts.test.ts` — `"noon_report"` not assignable to
  `DocumentType`; `src/lib/ocr/__tests__/google-docai.test.ts` — missing `NODE_ENV`
  on `ProcessEnv`). Zero errors in production code.

## 16.4 What is demo-ready on first load

- `npm install && npm run dev` → open `/login` → one click enters the demo workspace
  as Marina Alexiou (owner) with 20 notifications, a live-looking fleet, AIS tracks,
  noon reports, FuelEU/EU ETS/MRV records, an SOx ECA watch, certificates, documents,
  review tasks and assistant conversations — all deterministic for the process
  lifetime, all time-relative to first seed (`demo-seed.ts` lines 195–199).
- Every vessel-scoped console preselects IMO `9074729` (`DEMO_DEFAULT_IMO`).

---

# 17. Current Limitations

Concrete, verified limitations. Severity: **High** (blocks production), **Medium**
(demo-visible inconsistency or missing feature), **Low** (cosmetic/technical debt).

## 17.1 Production-gating (High)

1. **Mock-first is the whole runtime.** All six provider flags default to `true`; no
   real Postgres, storage, OCR, AI, AIS or email is exercised anywhere. Going live is
   designed to be one flag + credentials per module, but nothing has been provisioned.
2. **RLS is defined but never enforced.** 15 of 17 migrations enable RLS and 0 tables
   have `CREATE POLICY` statements; at runtime the fake client ignores RLS entirely.
   A real Postgres deployment would currently lock every table down (RLS enabled with
   no policies = deny-all).
3. **Authentication is a deliberate placeholder.** `mock$v1$` djb2-style hashing
   (fixed salt) and SHA-256 session tokens are fine for a demo but are not a real
   credential store; real Supabase Auth is the documented replacement seam.
4. **Credential "encryption" is a placeholder.** `src/lib/integrations/credentials.ts`
   wraps values as `pl:mock:v1:` + base64 with an explicit "never rely on this for
   actual secrets" header; a KMS-backed layer is needed before production.
5. **Email is mock-only.** The production email provider throws
   `"Production email provider not configured"`; Resend exists only as a catalog entry.
6. **No org-wide immutable `audit_log`.** Only `review_audit_log`,
   `email_ingestion_log` and search `AUDIT_EVENTS` exist — none is an append-only
   record of all domain mutations (ships, voyages, fuel, compliance events).
7. **No monitoring-plan modeling.** The MRV/DCS monitoring-plan requirement appears
   in notification event types but has no table, API or UI.

## 17.2 Functional gaps (Medium)

8. **Crew assistant missing** — declared in `docs/AI_ASSISTANT_ARCHITECTURE.md`, no
   console or service exists.
9. **API guard asymmetry** — only auth + settings routes enforce the session cookie;
   the notifications API (and the rest of the API) trusts explicit identity params.
10. **Two `apiError` helpers with swapped argument order** (`src/app/api/_lib/http.ts`
    vs `src/lib/api/helpers.ts`) — a documented footgun for new handlers.
11. **Raw vs enveloped responses** — track, port-calls, zone-events, map-config,
    environmental-zones, search POST/rerun and both download endpoints return bare
    shapes instead of `{ success, data }`.
12. **`apiPaginated` is dead code** — defined but unused; `Page<T>` is the real shape.
13. **No shared error boundary** — each route's `try/catch` is the boundary; behavior
    drift between the central mapper and local catches is possible.
14. **`GET /api/verifier-packages/[id]`** returns a bare `{ error }` 404 while its
    download sibling uses the `PACKAGE_NOT_FOUND` envelope.
15. **Search is in-memory** — the search service scans fake-client tables; there is no
    FTS index or external search engine.

## 17.3 Demo-visible / cosmetic (Low)

16. **Basemap needs network** — lazy Leaflet + CARTO tiles: offline demo shows the map
    without a basemap (positions/layers still render).
17. **Global dark theme is hard-coded** — `<html className="… dark">` in
    `src/app/layout.tsx`; appearance settings exist but the shell is dark regardless.
18. **AIS status label mismatch** — the AIS page badge map treats `"0"` as
    "under way" and `"15"` as "not defined"; the data model uses string codes.
19. **Typecheck noise** — 9 errors in two test files (test-only, listed in §16.3).
20. **Two fixture narratives for IMO 9074729** — the demo calls it "Aurelia" while
    the MarineTraffic mock header comment describes a "SILVER CLOUD"-format yacht
    (the data row itself is correct: `SHIPNAME: "Aurelia"`).

---

# 18. Future Roadmap

There is **no in-repo product roadmap document**; the following is the honest
forward-looking path implied by the code's own seams, headers and ComingSoon pages,
ordered by dependency. It is written as engineering guidance, not as a shipped plan.

## 18.1 Phase 4.6 — close the audit gaps (no new providers)

1. **Add an org-wide append-only `audit_log`** table (migration 0018) + repository +
   service wrapper; write on every domain mutation (vessels, voyages, fuel,
   documents, review actions, settings, auth events). Wire the existing
   `review_audit_log`/`email_ingestion_log` readers through it for a single view.
2. **Model the MRV/DCS monitoring plan** (`monitoring_plans` table with status and
   review cycle), the API routes, and a UI card; hook it to the existing
   `monitoring_plan_review_due` notification event type.
3. **Implement the Crew assistant** on the shared pipeline (a structured crew roster /
   watchkeeping tool + `CREW` intent), completing the assistant architecture.
4. **Unify the error helpers**: pick one `apiError` signature, delete `apiPaginated`,
   and migrate the raw-shape endpoints to the envelope (or document them as
   intentionally raw).
5. **Add auth guards to the notifications API** (or keep `recipient_id` but document
   the trust model); centralise the per-route error boundaries into a shared wrapper.

## 18.2 Phase 5 — production path (existing seams, one flag at a time)

6. **Real Supabase (Postgres + Storage)**: apply the 17 migrations, author
   `CREATE POLICY` rows (currently 0), enable service-role access, flip
   `SUPABASE_USE_MOCK=false`. This is the highest-risk step because RLS is enabled
   with no policies.
7. **Real Google Document AI**: set `OCR_USE_MOCK=false` + `GOOGLE_OCR_ENABLED=true`,
   provision project/processor/credentials (`google-docai.ts` validates all three).
8. **Real OpenAI extraction**: set `AI_USE_MOCK=false`, provide `OPENAI_API_KEY`
   (the provider lazily-requires the `openai` package, so mock mode never loads it).
9. **Real MarineTraffic**: set `MARINETRAFFIC_USE_MOCK=false`, provide the API key;
   the real transport (token-bucket rate limit 30/min, timeout, backoff) and jsono
   parsing are already implemented and proven by `npm run verify:mt`.
10. **Real email (Resend)**: implement the production email provider that currently
    throws; wire the Resend catalog entry to an SMTP/API client.
11. **KMS-backed credential encryption** replacing `pl:mock:v1:`; then dial the
    integration credentials.
12. **Production deploy** (`next build && next start` on a hosted platform; the
    vendored `node-runtime/` only matters for local Windows).

## 18.3 Product surface

13. **Enable the MarineTraffic module UI** (`/marinetraffic`) — the live client and
    mock transport already exist; the page is a ComingSoon placeholder.
14. **DNV module** (`/dnv`) — ComingSoon; scope to be defined by the product owner.
15. **Monitoring plan UI**, **audit log viewer**, and **real search** (external FTS
    or vector index) as the data layer grows beyond the in-memory demo seed.
16. **Appearance settings** to actually drive the theme (currently dark-forced), and
    AIS status-code normalisation (string codes vs. `"0"`/`"15"` numeric badges).

## 18.4 Engineering backlog (health)

17. Migrate the test runner from the `tsx` + custom `run()` harness to the configured
    vitest (present in devDependencies with a `@` alias).
18. Fix the 9 test-file typecheck errors and add a CI gate that blocks on
    `tsc --noEmit`.
19. Add a migration test that fails when RLS is enabled without policies, so the
    deny-all footgun can never silently ship again.

---

# 19. Developer Quick Start



## 10.7.1 Prerequisites

- **Node.js**: the repo vendors its own Windows runtime at `node-runtime/node-v22.16.0-win-x64/` (node.exe, npm, corepack) — no global install strictly required on Windows. `package.json` targets Node 20+ types (`@types/node: ^20.14.10`).
- **No API keys, no databases, no email provider** are required for the default experience. Everything is mocked.

## 10.7.2 Environment

Copy `.env.example` to `.env.local`. The defaults already produce a fully working demo:
```
MARINETRAFFIC_USE_MOCK=true
SUPABASE_USE_MOCK=true
STORAGE_USE_MOCK=true
OCR_USE_MOCK=true
AI_USE_MOCK=true
VALIDATION_USE_MOCK=true
```
Optional tunables: `MARINETRAFFIC_BASE_URL/TIMEOUT_MS/RATE_LIMIT_PER_MIN/MAX_RETRIES`, `SUPABASE_SCHEMA` (default `public`), `STORAGE_BUCKET` (default `documents`), `OPENAI_MODEL` (default `gpt-4o`), `GOOGLE_OCR_LOCATION` (default `us`). Going live = set a module's `USE_MOCK=false` **and** provide its credentials (hard-gated at config load, see §10.1.1).

## 10.7.3 Commands

| Command | What it does |
|---|---|
| `npm install` | install deps (incl. `@supabase/supabase-js`, `@google-cloud/documentai`, `next@14`, `react@18`, `zod`, `tsx`, `vitest`) |
| `npm run dev` | Next.js dev server (`next dev`) |
| `npm run build` / `npm run start` | production build / serve |
| `npm run lint` | `next lint` |
| `npm run typecheck` | `tsc --noEmit` (see §10.6.4 for the 9 known test-file errors) |
| `npm run verify:mt` | MarineTraffic E2E smoke test — prints fused Voyages with no key/network |
| `npm test` | full chained suite (~27 sub-scripts; all module/API/service tests) |

Targeted test scripts follow `test:<module>` naming, e.g. `npm run test:auth`, `npm run test:settings`, `npm run test:sox`, `npm run test:noon`, `npm run test:certificates`, `npm run test:supabase`, `npm run test:roles`, `npm run test:integrations` (each chains its own file-level tests).

## 10.7.4 First-run demo path

1. `npm install && npm run dev`.
2. Open `/login`, click **"Enter demo workspace"** (or sign in as `operator@poseidonledger.com` / `demo1234`).
3. The mock DB is seeded fresh per process (`demo-seed.ts`), so the fleet (Aurelia/Atlas/Horizon/Neptune/Odyssey), AIS positions, noon reports, FuelEU/EU ETS/MRV records, SOx ECA watch, certificates, documents, review tasks, assistant conversations and **20 notifications** all render immediately.
4. Default vessel preselected across vessel-scoped consoles: IMO `9074729` (`DEMO_DEFAULT_IMO`).

## 10.7.5 Project layout (modules referenced by this chapter)

- `src/lib/marinetraffic/` — AIS/voyage module (mock transport + jsono fixtures).
- `src/lib/supabase/` — config/client/fake-client/demo-seed + 26 repository files + types/schemas.
- `src/lib/notifications/` — dispatcher, preferences, alert services, email templates/provider.
- `src/lib/settings/` — settings service, version, typed errors.
- `src/lib/auth/` — mock auth service, tokens, password hashing.
- `src/lib/roles/` — RBAC catalog (`can` is the single enforcement point).
- `src/lib/integrations/` — catalog + mock credential envelope.
- `src/lib/ocr/`, `src/lib/ai/`, `src/lib/storage/`, `src/lib/validation/` — provider seams (mock-first).
- `src/lib/email-ingress/`, `src/lib/map/`, `src/lib/geo/` — BDN-by-email and map/zone support.
- `src/app/api/` — route handlers; `_lib/http.ts` + `_lib/errors.ts` + `_lib/cookies.ts` shared helpers; `auth/`, `settings/`, `notifications/`, `vessels/[imo]/*`, `ocr/`, `map-config/`, `webhooks/email/resend/`.
- `src/services/`, `src/hooks/` — apiFetch client layer + `useAuth`/`useSettings`.
- `supabase/migrations/0001…0017` — 17 numbered migrations; 0011 adds reporting+notifications, 0017 adds org/auth/roles.
- `scripts/verify-marinetraffic.ts` — E2E smoke test.
- `node-runtime/` — vendored Node 22.16.0 for Windows.

---

# 20. File Index

A navigational index of every part of the codebase that matters. Paths are relative
to `D:\ProjetoPLDemo`.

## 20.1 Top level

| Path | Purpose |
|---|---|
| `package.json` | scripts `dev`, `build`, `start`, `lint`, `typecheck`, `verify:mt`, `test`, `test:<module>`; ~27 chained test sub-scripts |
| `.env.example` | all six mock flags + tunables; the "no secrets required" contract |
| `tsconfig.json` | TS config with `@` path alias |
| `vitest.config.ts` | vitest present but unused by scripts (tests run via `tsx`) |
| `next.config.*` / `tailwind.config.*` | Next.js / Tailwind config |
| `node-runtime/` | vendored Node v22.16.0 win-x64 (local Windows dev) |
| `public/` | static assets, brand logos |
| `docs/` | `AUDIT_2026-08-04.md`, `AI_ASSISTANT_ARCHITECTURE.md`, `PHASE-2A.1-SUMMARY.md`, this handbook |
| `scripts/verify-marinetraffic.ts` | `npm run verify:mt` E2E smoke (no key/network) |
| `supabase/migrations/0001…0017` | Postgres schema — see Chapter 4 |

## 20.2 Pages (`src/app/**/page.tsx` — 31)

| Route | File |
|---|---|
| `/` Dashboard | `src/app/page.tsx` |
| `/fleet`, `/fleet/[imo]` | `src/app/fleet/page.tsx`, `src/app/fleet/[imo]/page.tsx` |
| `/voyages`, `/voyages/[id]` | `src/app/voyages/page.tsx`, `src/app/voyages/[id]/page.tsx` |
| `/ais` | `src/app/ais/page.tsx` |
| `/documents`, `/documents/[id]` | `src/app/documents/page.tsx`, `src/app/documents/[id]/page.tsx` |
| `/review`, `/review/[id]` | `src/app/review/page.tsx`, `src/app/review/[id]/page.tsx` |
| `/ocr` | `src/app/ocr/page.tsx` |
| `/compliance` | `src/app/compliance/page.tsx` |
| `/compliance-assistant`, `/assistant`, `/search`, `/captain`, `/voyage`, `/maintenance`, `/noon` | one file each under `src/app/` |
| `/analytics` | `src/app/analytics/page.tsx` |
| `/settings` (+ `users`, `organization`, `notifications`, `integrations`, `appearance`) | `src/app/settings/**/page.tsx` |
| `/login`, `/forgot-password`, `/reset-password` | `src/app/{login,forgot-password,reset-password}/page.tsx` |
| `/dnv`, `/marinetraffic` | ComingSoon placeholders |
| Root layout / fonts / dark theme | `src/app/layout.tsx`, `src/app/globals.css` |

## 20.3 API route groups (`src/app/api/` — 87 `route.ts`)

See Chapter 8 for the endpoint inventory. Groups:
`_lib` (shared helpers `http.ts`, `errors.ts`, `cookies.ts`, `schemas.ts`, `deps.ts`),
`auth`, `settings`, `notifications`, `vessels`, `voyages`, `voyage`, `ais-positions`,
`dashboard`, `analytics`, `fuel-types`, `fuel-deliveries`, `documents`, `review-tasks`,
`ocr`, `reports`, `verifier-packages`, `certificates`, `sox-watch`,
`environmental-zones`, `map-config`, `assistant`, `captain`, `maintenance`, `search`,
`ingest`, `webhooks/email/resend`.

## 20.4 Hooks (`src/hooks/` — 26 modules + `index.ts` barrel)

`useVessels`, `useVessel`, `useLatestVoyage`, `useLatestAisPosition`, `useVesselTrack`,
`useVoyages`, `useVoyageDetail`, `useAisPositions`, `usePortCalls`,
`useEnvironmentalZones`, `useZoneEvents`, `useDocuments`, `useDocument`,
`useDocumentUpload`, `useDocumentStatus`, `useDocumentValidation`,
`useDocumentReview`, `useCertificateRegistryLink`, `useReviewTasks`,
`useReviewTaskDetail`, `useReviewActions`, `useCertificates`, `useOcrQuality`,
`useSoxWatch`, `useNoon`, `useAuth`, `useSettings`, `useDebounce`. All follow the
`data | isLoading | error | refetch` contract; see Chapter 9 §4.

## 20.5 Services (`src/services/`)

| File | Purpose |
|---|---|
| `api-client.ts` | `apiFetch` — prefixes `/api`, unwraps envelope, throws `ApiError {code,status,details}`, `DEFAULT_PAGE_SIZE=20`, `pageOffset` |
| `auth.service.ts` | login/logout/session, `getSettingsBundle()` |
| `settings.service.ts` | 10 typed update/invite/integration calls |
| `vessels.service.ts`, `voyages.service.ts`, `ais.service.ts` | operational reads |
| `dashboard.service.ts`, `analytics.service.ts` | summary data |
| `documents.service.ts`, `document-upload.service.ts` | doc list + multipart upload |
| `ocr.service.ts`, `validation.service.ts`, `ai-extraction.service.ts`, `review.service.ts` | document pipeline stages |
| `compliance.service.ts`, `noon.service.ts` | compliance reports + noon |
| `index.ts` | barrel |

## 20.6 Lib modules (`src/lib/` — 35 directories)

| Module | Purpose (source of truth chapter) |
|---|---|
| `supabase/` | config, client, `fake-client.ts`, `demo-seed.ts`, `types.ts`, `schemas.ts`, `repositories/` (45) — Ch. 4 |
| `fueleu/` | FuelEU Maritime calculator (v2025.1) — Ch. 5 |
| `eu-ets/` | EU ETS calculator (phase-in 40/70/100%) — Ch. 5 |
| `eua-price/` | mock EUA price feed (€75.50) — Ch. 5 |
| `mrv/` | THETIS-MRV report builder + XML/CSV export — Ch. 5 |
| `sox-eca/` | SOx ECA engine, rules SOX-ECA-01…06, geometry — Ch. 5 |
| `certificates/` | certificate registry/status/expiry engine — Ch. 5 |
| `noon-report/` | noon report domain (analysis/validation/correlation) — Ch. 5 |
| `fuel-delivery/` | fuel delivery / BDN reconciliation — Ch. 5 |
| `verifier-package/` | verifier package builder (manifest sha256, ZIP) — Ch. 5 |
| `reporting/` | compliance report builder — Ch. 5 |
| `review/` | review task domain + actions — Ch. 6 |
| `validation/` | validation provider seam (`VALIDATOR_VERSION 2.0.0`) — Ch. 6 |
| `ocr/` | OCR provider seam (mock / Google DocAI) — Ch. 6 |
| `ocr-assistant/` | deterministic OCR assistant (v4.3.0, 12 families) — Ch. 6/7 |
| `ai/` | AI provider seam (mock GPT-4o fixtures / live OpenAI) — Ch. 7 |
| `assistant/` | shared pipeline: `assistant-service.ts`, `router.ts`, `safety.ts`, prompts — Ch. 7 |
| `compliance-assistant/` | compliance assistant (FuelEU/EU ETS/verifier legs, handoff) — Ch. 7 |
| `search-assistant/` | search assistant + saved-query rerun — Ch. 7 |
| `captain-assistant/` | captain assistant (readiness, ingest events) — Ch. 7 |
| `voyage-assistant/` | voyage assistant (gap ladder, VCR-01/02/03/05) — Ch. 7 |
| `maintenance-assistant/` | maintenance assistant (survey status, blocking) — Ch. 7 |
| `noon-assistant/` | noon assistant — Ch. 7 |
| `marinetraffic/` | MarineTraffic client, mock/real transport, jsono parsing — Ch. 11 |
| `email-ingress/` | BDN-by-email ingestion + scenarios — Ch. 11 |
| `storage/` | storage client seam (mock / Supabase Storage) — Ch. 11 |
| `map/` | map config + provider (CARTO light tiles) — Ch. 11 |
| `integrations/` | provider catalog + mock credential envelope — Ch. 11 |
| `notifications/` | dispatcher, preferences, deadlines, compliance-alerts, email templates — Ch. 14 |
| `settings/` | settings service, version panel, typed errors — Ch. 12 |
| `auth/` | mock auth service, tokens, passwords — Ch. 13 |
| `roles/` | RBAC catalog — `can()` single enforcement point — Ch. 13 |
| `geo/` | pure geometry: zones, point-in-polygon, track/gap processing, haversine — Ch. 9 |
| `api/` | `helpers.ts` (the second `apiError`), `apiPaginated` — Ch. 8 |
| `utils/` | shared helpers |

## 20.7 Components (`src/components/`)

| Path | Purpose |
|---|---|
| `ui/` | 14 shadcn-style Radix primitives (Button, Badge, Card, Input, Select, Table, Sheet, Tooltip, Avatar, …) |
| `layout/` | `sidebar.tsx`, `main-layout.tsx`, `header.tsx` |
| `auth/` | `auth-gate.tsx` (`AUTH_PATHS`), `auth-shell.tsx` |
| `map/` | 6 components: `map-container`, `vessel-map-view`, `track-layer`, `vessel-marker`, `port-marker`, `zone-layer` |
| `notifications/` | `notification-bell`, `notification-panel` |
| `sox/` | `sox-watch-card` |
| `certificates/` | `certificates-card` |
| `ocr/` | `ocr-quality-panel` |
| `reports/` | `reports-list` |
| `settings/` | `settings-ui.tsx` form kit (`SettingsCard`, `Field`, `SaveBar`, `Toggle`, …) |
| `shared/` | `assistant-page-container`, `coming-soon` |
| root | `data-table`, `search-bar`, `pagination-controls`, `loading-table`, `page-header`, `error-banner`, `empty-state` |

## 20.8 Constants, types, migrations, docs

| Path | Purpose |
|---|---|
| `src/constants/navigation.ts` | nav tree (4 sections, 2 disabled) — single source of truth |
| `src/constants/routes.ts` | 26 route keys incl. `vesselDetail(imo)`/`voyageDetail(id)` |
| `src/constants/demo.ts` | `DEMO_EMAIL/PASSWORD/OWNER`, `DEMO_DEFAULT_IMO=9074729` |
| `src/types/` | shared TS types |
| `supabase/migrations/0001…0017` | 50 tables, 124 indexes, RLS (see Ch. 4) |
| `docs/AUDIT_2026-08-04.md` | prior 8-section audit (matrix + verdict reused in Ch. 16) |
| `docs/AI_ASSISTANT_ARCHITECTURE.md` | assistant design authority (Ch. 7) |
| `docs/PHASE-2A.1-SUMMARY.md` | phase summary |

