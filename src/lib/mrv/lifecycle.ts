/**
 * mrv/lifecycle.ts — explicit EU MRV report lifecycle state machine
 * ───────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Part 4 requires an explicit report lifecycle with NO illegal forward jumps:
 * `DATA_INCOMPLETE → VERIFIED` or `UNKNOWN → EXPORTED` must be impossible
 * without evidence. This module encodes the allowed transitions as a pure
 * function.
 *
 * States (see MRV_LIFECYCLE in types.ts):
 *   DATA_INCOMPLETE        — blocking data gaps; report cannot be trusted.
 *   DRAFT                  — being prepared.
 *   VALIDATED              — internal validation passed (deterministic checks).
 *   REQUIRES_REVIEW        — evidence ambiguity; no forward progress until
 *                            resolved.
 *   SCHEMA_VALIDATED_LOCALLY — export content validated against the Annex II
 *                            field set; NOT verified by an accredited verifier,
 *                            NOT submitted to THETIS.
 *   VERIFIED               — verified (internal surrogate: requires verifier
 *                            evidence/records; never auto-granted by this
 *                            engine).
 *   EXPORTED               — export content produced.
 *   SUPERSEDED             — terminal; a revision replaced this version.
 *
 * No transition may be SILENTLY coerced; every transition that requires
 * evidence must fail when that evidence is absent.
 */

export type MrvLifecycle =
  | "DATA_INCOMPLETE"
  | "DRAFT"
  | "VALIDATED"
  | "REQUIRES_REVIEW"
  | "SCHEMA_VALIDATED_LOCALLY"
  | "VERIFIED"
  | "EXPORTED"
  | "SUPERSEDED";

export interface LifecycleTransition {
  readonly ok: boolean;
  readonly from: MrvLifecycle;
  readonly to: MrvLifecycle;
  readonly reason?: string;
}

const ALLOWED: Record<MrvLifecycle, ReadonlyArray<MrvLifecycle>> = {
  DATA_INCOMPLETE: ["DRAFT", "REQUIRES_REVIEW", "SUPERSEDED"],
  DRAFT: ["DATA_INCOMPLETE", "VALIDATED", "REQUIRES_REVIEW", "SCHEMA_VALIDATED_LOCALLY", "SUPERSEDED"],
  VALIDATED: ["DRAFT", "REQUIRES_REVIEW", "SCHEMA_VALIDATED_LOCALLY", "VERIFIED", "EXPORTED", "SUPERSEDED"],
  REQUIRES_REVIEW: ["DATA_INCOMPLETE", "DRAFT", "SUPERSEDED"],
  SCHEMA_VALIDATED_LOCALLY: ["VERIFIED", "REQUIRES_REVIEW", "DRAFT", "EXPORTED", "SUPERSEDED"],
  VERIFIED: ["SCHEMA_VALIDATED_LOCALLY", "EXPORTED", "REQUIRES_REVIEW", "DRAFT", "SUPERSEDED"],
  EXPORTED: ["SUPERSEDED", "REQUIRES_REVIEW", "DRAFT", "VERIFIED"],
  SUPERSEDED: [],
};

/**
 * Determine whether a lifecycle transition is permitted.
 * Deterministic. Disallowed edges (e.g. DATA_INCOMPLETE→VERIFIED,
 * REQUIRES_REVIEW→EXPORTED) return ok:false — no silent coercion.
 */
export function canTransition(
  from: MrvLifecycle,
  to: MrvLifecycle,
): LifecycleTransition {
  if (from === to) {
    return { ok: true, from, to, reason: "no-op transition" };
  }
  const allowed = ALLOWED[from] ?? [];
  if (allowed.includes(to)) {
    return { ok: true, from, to };
  }
  return {
    ok: false,
    from,
    to,
    reason: `Illegal MRV report lifecycle transition ${from} → ${to}; requires review/evidence, no silent coercion.`,
  };
}
