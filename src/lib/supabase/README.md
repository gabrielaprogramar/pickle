# Supabase Module — Phase 1B

Production-ready persistence layer for the Poseidon Ledger maritime ESG compliance platform.

## Purpose

Given a normalized `Voyage` produced by the MarineTraffic module (Phase 1A), this module stores it
durably in Supabase (Postgres), along with vessel identity and AIS position fixes:

- **`vessels`** — canonical vessel identity, keyed by the unique 7-digit IMO.
- **`voyages`** — one row per port-to-port leg, owned by a vessel.
- **`ais_positions`** — high-volume time-series of position fixes, owned by a vessel.

Today the persistence code is fully built, type-checks cleanly, and is covered by **17 unit tests**
against an in-memory fake — all passing. It runs against a real Supabase project the moment
credentials are supplied. No code changes are required to go live.

## Architecture

```
src/lib/supabase/
├── index.ts                       ← barrel export — the ONLY import path for external modules
├── client.ts                      ← typed SupabaseClient<Database> factory + cached singleton
├── config.ts                      ← reads SUPABASE_USE_MOCK / URL / SERVICE_ROLE_KEY from env
├── types.ts                       ← row/insert types (1:1 with the migration) + Database interface
├── mapper.ts                      ← domain Voyage → DB payloads (VesselInsert / VoyageInsert)
├── errors.ts                      ← typed error hierarchy + mapError() (SQLSTATE → typed subclass)
├── repositories/
│   ├── vessels.ts                 ← upsertByImo() + findByImo()
│   ├── voyages.ts                 ← insertFromDomain() (resolves vessel FK + inserts voyage)
│   └── ais_positions.ts           ← insert() / insertBatch() / findLatestByVesselId()
└── __tests__/
    ├── _fakeClient.ts             ← in-memory fake satisfying TypedSupabaseClient (no network)
    ├── vessels.test.ts            ← 6 tests: upsert insert/update, lookup, error mapping
    ├── voyages.test.ts            ← 5 tests: domain insert, idempotency, lookup, error mapping
    └── ais_positions.test.ts      ← 6 tests: single/batch insert, latest lookup, error mapping
```

### Data flow

```
domain Voyage (from Phase 1A)
  → mapper.toVesselInsert(voyage)            // flatten vessel.imo + vessel.name
  → vessels.upsertByImo()                     // idempotent ON CONFLICT (imo), returns vessel UUID
  → mapper.toVoyageInsert(voyage, vesselId)   // flatten ports, attach FK
  → voyages.insert()                          // one row written, returned as VoyageRow
```

AIS position fixes are independent of the voyage flow — only the vessel FK is required, so a fix
can arrive before any voyage is recorded.

### The mock/real seam

One environment variable controls whether the module connects for real:

| `SUPABASE_USE_MOCK` | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Behavior |
|---|---|---|
| `true` (default) | not needed | Module imports cleanly with placeholder creds; tests inject a fake client |
| `false` | both required | `loadConfig()` throws `SupabaseConfigError` only if a credential is missing |

To go live:

```bash
# .env.local
SUPABASE_USE_MOCK=false
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # service role key — SERVER ONLY, bypasses RLS
```

No code changes required.

### Why the service role key

Phase 1B is a service-to-service write path (the Next.js API route runs server-side). The service
role key bypasses Row-Level Security entirely, which is intentional and safe because **this key
must never ship to the browser**. RLS is enabled on every table with no permissive policy, so even
a leaked anon/authenticated key is denied by default.

## Commands

```bash
npm run typecheck                                                  # tsc --noEmit (zero errors)
npx tsx src/lib/supabase/__tests__/vessels.test.ts                 # vessels (6 tests)
npx tsx src/lib/supabase/__tests__/voyages.test.ts                 # voyages (5 tests)
npx tsx src/lib/supabase/__tests__/ais_positions.test.ts           # ais_positions (6 tests)
```

## Database schema

Defined in `supabase/migrations/0001_init_ais_schema.sql` — the single source of truth.
Apply it once per environment:

```bash
supabase db push      # or: supabase migration up
```

Highlights:
- UUID v4 primary keys (`gen_random_uuid()`).
- `vessels.imo` is `char(7)` with a CHECK (`^[0-9]{7}$`) + UNIQUE index.
- `ais_positions(vessel_id, ts DESC)` index makes "latest fix for a vessel" an index-only lookup.
- `voyages(vessel_id, departure_time DESC)` composite index for "latest voyage for a vessel".
- CHECK constraints enforce voyage time-ordering, positive distance, and lat/lon bounds.
- An `updated_at` trigger keeps `vessels.updated_at` honest without app-layer bookkeeping.
- RLS enabled everywhere, deny-by-default (service role bypasses it).

## Error handling

All repository failures surface as typed errors via `mapError()`. Branch with `instanceof`:

| Error | When | Recoverable? |
|---|---|---|
| `SupabaseConfigError` | Live mode missing a credential | Fatal at startup |
| `RepositoryIntegrityError` | Unique / FK / CHECK violation (SQLSTATE 23502/23503/23505/23514) | No — caller input problem |
| `RepositoryUpstreamError` | Network error, 5xx, timeout | Yes — retryable |
| `RepositoryError` (base) | Unexpected / unknown failure | Investigate |

`mapError(operation, thrown)` inspects the PostgREST `code` (PostgreSQL SQLSTATE) and picks the
right subclass, so repositories stay thin: `try { ... } catch (e) { throw mapError("insert voyage", e); }`.

## Testing approach

Repository unit tests run with **zero Supabase setup and no network**. They inject
`createFakeSupabaseClient({ tables, globalError })`, an in-memory double that satisfies the same
`TypedSupabaseClient` shape the real client produces:

- Seed table rows; the fake deep-clones fixtures so tests can't mutate shared state.
- Insert/upsert append rows (with server defaults for `id`/`created_at`/`updated_at` and `null`
  for missing nullable columns, mirroring real PostgREST behavior).
- Upsert on conflict merges new values over the existing row, preserving `id`/`created_at`.
- `eq` filters scan the in-memory rows (dotted join paths like `vessels.imo` are resolved to the
  column name, since the fake doesn't implement joins).
- `globalError` simulates any PostgREST failure by SQLSTATE code, driving the error-mapping tests.

The fake is a test double, not a database simulator — it intentionally does not enforce CHECK
constraints or uniqueness beyond what a test scenario sets up. Those are covered by the migration
against a real Supabase project in a future integration-test phase.

## Dependencies

Only `@supabase/supabase-js` (already a project dependency). The fake client and test harness add
zero dependencies — they reuse the Phase 1A minimal `describe/it/expect` runner.
