/**
 * version.ts — app/build metadata for the Settings → About panel
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Single source of truth for version strings surfaced in the About section.
 * `package.json` stays the source for the app version; the build and
 * calculation-engine versions are tracked here so the About panel, the header
 * and any diagnostics agree.
 */

import packageJson from "../../../package.json" assert { type: "json" };

export const APP_NAME = "Poseidon Ledger";
export const APP_VERSION = packageJson.version ?? "0.1.0";
/** Build identifier — bump on each release that changes bundled assets. */
export const BUILD_VERSION = "2026.08.02";
/** Deterministic calculation engines (noon, fueleu, ets, mrv, sox). */
export const CALCULATION_ENGINE_VERSION = "1.0.0";
/** The mock auth seam that backs login/session in Phase 4.5. */
export const AUTH_MODE = "mock";
/** The mock provider mode used for integrations in Phase 4.5. */
export const INTEGRATIONS_MODE = "mock";
