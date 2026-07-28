# MarineTraffic Module — Phase 1A

Production-ready AIS ingestion client for the Poseidon Ledger maritime ESG compliance platform.

## Purpose

Given an IMO number, this module retrieves a vessel's current voyage data from the MarineTraffic API and returns a normalized `Voyage` object:

- Vessel name + IMO
- Departure port + timestamp
- Arrival port + timestamp
- Voyage distance (nautical miles)

Today it runs entirely on **mocked responses**. The day the MarineTraffic API subscription is purchased, the only change is setting two environment variables.

## Architecture

```
src/lib/marinetraffic/
├── index.ts        ← barrel export — the ONLY import path for external modules
├── client.ts       ← public factory: createMarineTrafficClient() → getVoyageByIMO(imo)
├── config.ts       ← reads MARINETRAFFIC_USE_MOCK / API_KEY from env
├── http.ts         ← Transport interface + RealTransport (fetch/retry/rate-limit)
├── mock.ts         ← MockTransport + realistic fixtures (exact MT wire format)
├── parse.ts        ← IMO validation + raw MT fields → domain types
├── types.ts        ← raw wire types (MT field names) + domain types (Voyage, etc.)
├── errors.ts       ← typed error hierarchy (InvalidIMOError, RateLimitError, etc.)
└── __tests__/
    ├── _testRunner.ts              ← minimal dependency-free test harness
    ├── parse.test.ts               ← 20 tests: IMO validation + mapping
    ├── mockTransport.test.ts       ← 9 tests: fixture resolution + latency
    └── client.test.ts              ← 9 tests: E2E fusion + error + degradation
```

### Data flow

```
IMO input
  → client.ts: normalizeImo(imo)        // validation, never touches network
  → client.ts: transport.getVoyageForecast({imo, ...})
    → [MockTransport returns fixtures] or [RealTransport fetches live API]
  → parse.ts: parseVoyageFromForecast(raw)   // raw MT fields → domain Voyage
  → client.ts: transport.getPortCalls({imo, ...})
    → parse.ts: parseVoyageFromPortCalls(raw)  // enrichment (arrival time, distance)
  → client.ts: fuse(forecast + portCalls)     // verified arrival overrides ETA
  → returns Voyage
```

### The mock/real seam

One environment variable controls the transport wiring in `client.ts`:

| `MARINETRAFFIC_USE_MOCK` | `MARINETRAFFIC_API_KEY` | Transport |
|---|---|---|
| `true` (default) | not needed | `MockTransport` — canned fixtures, no network |
| `false` | required | `RealTransport` — live fetch to MarineTraffic |

To go live:

```bash
# .env.local
MARINETRAFFIC_USE_MOCK=false
MARINETRAFFIC_API_KEY=abc123def456...  # 40-char hex from MarineTraffic
```

No code changes required.

## Commands

```bash
npm run typecheck           # TypeScript compilation check (zero errors)
npm test                   # Run all 38 unit tests
npm run test:parse         # Parse tests only (20 tests)
npm run test:mock          # Mock transport tests only (9 tests)
npm run test:client        # Client tests only (9 tests)
npm run verify:mt          # End-to-end mock pipeline smoke test
```

## Required MarineTraffic services

When purchasing the subscription, ensure access to these two endpoints:

1. **Voyage Information** (`/voyageforecast/{apiKey}`) — live leg: vessel name, last port, next port, ETA, distance
2. **Single Vessel Events** (`/portcalls/{apiKey}?msgtype=extended`) — historical arrival/departure pairs with per-leg distance

## Error handling

All errors extend `MarineTrafficError` and are caught with `instanceof`:

| Error | When | Recoverable? |
|---|---|---|
| `InvalidIMOError` | IMO fails 7-digit format or checksum | No — caller input error |
| `VesselNotFoundError` | No vessel data for the IMO | No — valid IMO, no data |
| `ConfigurationError` | Missing API key in live mode | Fatal at startup |
| `RateLimitError` | HTTP 429 from MarineTraffic | Yes — retry after `retryAfterSeconds` |
| `TimeoutError` | Request exceeded timeout | Yes — automatic retry |
| `UpstreamError` | HTTP 5xx or network failure | Yes — automatic retry |
| `MalformedResponseError` | API returned unparseable data | No — upstream bug |

## Dependencies

Zero runtime dependencies beyond the Next.js project scaffold. The mock transport requires no network access and no API key.
