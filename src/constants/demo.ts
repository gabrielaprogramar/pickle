/**
 * demo.ts — one-click demo access credentials (single source of truth)
 * ─────────────────────────────────────────────────────────────────────────────
 * Referenced by the login page (demo button) and the demo seed module so the
 * credentials can never drift apart. This file is intentionally dependency-free
 * so it is safe to import from client components.
 */

export const DEMO_EMAIL = "operator@poseidonledger.com";
export const DEMO_PASSWORD = "demo1234";

/** Default vessel (IMO) preselected in vessel-scoped consoles. */
export const DEMO_DEFAULT_IMO = "9074729";

export const DEMO_OWNER = {
  id: "user-marina",
  email: DEMO_EMAIL,
  password: DEMO_PASSWORD,
  fullName: "Marina Alexiou",
} as const;
