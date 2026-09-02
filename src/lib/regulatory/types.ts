/**
 * regulatory/types.ts — domain types for the regulatory foundation
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `VesselProfile` is the set of vessel facts the applicability service may
 * consult. Null = the fact is not on file — the service must NOT guess.
 */

export interface VesselProfile {
  readonly vessel_id: string;
  readonly imo: string;
  readonly gt: number | null;
  readonly flag: string | null;
  readonly vesselType: string | null;
  readonly vesselCategory: string | null;
}
