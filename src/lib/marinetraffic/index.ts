/**
 * index.ts — public barrel export for the MarineTraffic module
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * A barrel file gives the rest of Poseidon ONE clean import path:
 *
 *   import { createMarineTrafficClient } from "@/lib/marinetraffic";
 *
 * It deliberately re-exports ONLY the public surface: the factory, the domain
 * types, and the error classes callers may catch. The internals — http, mock,
 * parse, raw types, the RealTransport/MockTransport classes — stay private to
 * this folder. That keeps the dependency direction one-way and stops other
 * modules from coupling to MarineTraffic's wire format.
 *
 * HOW IT FITS
 * Future phases import from here and nowhere else in this directory. When the
 * API key is purchased, NOTHING in this file changes.
 */

export { createMarineTrafficClient } from "./client";
export type {
  MarineTrafficClient,
  CreateClientOptions,
} from "./client";

// Domain types — the stable vocabulary the rest of the app speaks.
export type {
  Vessel,
  Port,
  PortEvent,
  Voyage,
  VoyageSource,
} from "./types";

// Errors — callers branch on these with `instanceof`.
export {
  MarineTrafficError,
  ConfigurationError,
  InvalidIMOError,
  RateLimitError,
  TimeoutError,
  UpstreamError,
  VesselNotFoundError,
  MalformedResponseError,
} from "./errors";

// Config (callers may want to inspect useMock for branching/logging).
export { loadConfig } from "./config";
export type { MarineTrafficConfig } from "./config";
