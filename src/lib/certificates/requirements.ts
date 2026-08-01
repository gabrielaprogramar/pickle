/**
 * certificates/requirements.ts — source-driven requirement & applicability service
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Every determination below is backed by a citation into
 * `docs/REGULATORY_RESEARCH.md` (section reference). Where the research does not
 * gate a certificate type, applicability is UNKNOWN and requires review — an LLM
 * NEVER decides requirements. The KNOWN_CERTIFICATE_TYPES list from types.ts is
 * the only certificate vocabulary.
 */

import type { RequirementApplicability, RequirementSpec } from "./types";
import { KNOWN_CERTIFICATE_TYPES } from "./types";
import { CERTIFICATE_REASON_CODES } from "./types";

/** Vessel facts available to the applicability service. Null = unknown. */
export interface VesselCertProfile {
  readonly imo: string;
  readonly name: string;
  readonly vesselType: "commercial" | "private" | "unknown";
  readonly gt: number | null;
  readonly lengthM: number | null;
  readonly ballastTanks: boolean | null;
}

export const VESSEL_CERT_PROFILE_SOURCE = "REGULATORY_RESEARCH.md";

/** Deterministic applicability determination for one certificate type. */
export type TypeDetermination = (
  profile: VesselCertProfile,
) => {
  readonly applicability: RequirementApplicability;
  readonly requiresReview: boolean;
  readonly notes: string | null;
};

/**
 * Per-type determinations. Each references the research section that gates it.
 * Types not gated by research (TONNAGE, ISCC) resolve to UNKNOWN + review.
 */
export const TYPE_DETERMINATIONS: ReadonlyArray<{
  readonly certificate_type: string;
  readonly label: string;
  readonly reference: string;
  readonly source: string;
  readonly determine: TypeDetermination;
}> = [
  {
    certificate_type: "AIR_POLLUTION_PREVENTION",
    label: "IAPP — International Air Pollution Prevention",
    reference: "MARPOL Annex VI (≥400 GT international)",
    source: "REGULATORY_RESEARCH.md §2",
    determine: (p) => gateByGt400(p, "IAPP"),
  },
  {
    certificate_type: "SAFETY_MANAGEMENT",
    label: "ISM — DOC & Safety Management Certificate",
    reference: "ISM Code via SOLAS Ch. IX (commercial ≥24 m)",
    source: "REGULATORY_RESEARCH.md §4",
    determine: (p) =>
      p.vesselType === "commercial"
        ? ok("REQUIRED", "Full ISM ≥500 GT; scaled 'mini ISM' for commercial 24–500 m.")
        : p.vesselType === "private"
          ? ok("NOT_REQUIRED", "Private pleasure craft: ISM is voluntary best practice.")
          : unknown("Vessel type not on file; cannot determine ISM applicability."),
  },
  {
    certificate_type: "ISPS",
    label: "ISSC — International Ship Security Certificate",
    reference: "SOLAS Ch. XI-2 (≥500 GT)",
    source: "REGULATORY_RESEARCH.md §1",
    determine: (p) => {
      if (p.vesselType !== "commercial") return ok("NOT_REQUIRED", "ISPS applies to ships in SOLAS scope; private craft are out.");
      return gateByGt500(p, "ISSC");
    },
  },
  {
    certificate_type: "LOAD_LINE",
    label: "International Load Line Certificate",
    reference: "Load Line Convention (≥24 m international)",
    source: "REGULATORY_RESEARCH.md §1",
    determine: (p) =>
      p.vesselType === "commercial"
        ? ok("REQUIRED", "Commercial craft ≥24 m international carry a load line certificate.")
        : unknown("Load line applicability for pleasure craft is not gated in the research — review."),
  },
  {
    certificate_type: "TONNAGE",
    label: "International Tonnage Certificate",
    reference: "ITC 1969",
    source: "REGULATORY_RESEARCH.md §14.4 (not gated)",
    determine: () => ({
      applicability: "UNKNOWN",
      requiresReview: true,
      notes: "Tonnage certificate applicability is not covered by REGULATORY_RESEARCH.md — record as UNKNOWN/REVIEW_REQUIRED rather than fabricating a requirement.",
    }),
  },
  {
    certificate_type: "BALLAST_WATER",
    label: "BWM Certificate",
    reference: "BWM Convention (ships with ballast tanks, international)",
    source: "REGULATORY_RESEARCH.md §5",
    determine: (p) => {
      if (p.ballastTanks === false) return ok("NOT_REQUIRED", "Vessel without ballast tanks is out of BWM scope.");
      if (p.ballastTanks === true && p.gt !== null && p.gt >= 400) {
        return ok("REQUIRED", "Large superyacht ≥400 GT with ballast tanks on international voyages — D-2 standard since 2024-09-08.");
      }
      return unknown("Ballast-tank capability / GT not on file — BWM applicability is conditional (mock: UNKNOWN).");
    },
  },
  {
    certificate_type: "MARPOL",
    label: "IOPP — International Oil Pollution Prevention",
    reference: "MARPOL Annex I (≥400 GT international)",
    source: "REGULATORY_RESEARCH.md §2",
    determine: (p) => gateByGt400(p, "IOPP"),
  },
  {
    certificate_type: "SEEMP",
    label: "SEEMP Part II / Part III",
    reference: "MARPOL Annex VI Reg. 27/28 (≥5,000 GT DCS)",
    source: "REGULATORY_RESEARCH.md §9, §7",
    determine: (p) =>
      p.gt !== null && p.gt >= 5000
        ? ok("REQUIRED", "≥5,000 GT: DCS in scope (SEEMP Part II verified); CII Part III applies only to cargo/RoPax/cruise ship types.")
        : p.gt === null
          ? unknown("GT not on file — cannot determine DCS/SEEMP applicability.")
          : ok("NOT_REQUIRED", "Below 5,000 GT: DCS/CII out of scope for yachts."),
  },
  {
    certificate_type: "ISCC",
    label: "ISCC Certificate (biofuel sustainability)",
    reference: "FuelEU Maritime — WtW claims",
    source: "REGULATORY_RESEARCH.md §11",
    determine: () => ({
      applicability: "UNKNOWN",
      requiresReview: true,
      notes: "ISCC is conditional: only needed when biofuel blends are claimed for a FuelEU WtW benefit. Record as UNKNOWN until a biofuel delivery evidence exists.",
    }),
  },
  {
    certificate_type: "CLASS_CERTIFICATE",
    label: "Class Certificate",
    reference: "Flag/RO issuance (commercial yachts)",
    source: "REGULATORY_RESEARCH.md §1, §4",
    determine: (p) =>
      p.vesselType === "commercial"
        ? ok("REQUIRED", "Commercial yachts are in class; class is the issuing vehicle for statutory certificates.")
        : unknown("Class requirement for non-commercial craft is not gated in the research — review."),
  },
  {
    certificate_type: "SAFETY_CERTIFICATE",
    label: "Safety Equipment / Construction Certificate",
    reference: "SOLAS + national commercial yacht codes",
    source: "REGULATORY_RESEARCH.md §1",
    determine: (p) =>
      p.vesselType === "commercial"
        ? ok("REQUIRED", "Commercial/charter yachts carry SOLAS-equivalent safety certificates via the applicable commercial yacht code.")
        : p.vesselType === "private"
          ? ok("NOT_REQUIRED", "SOLAS applies to cargo/passenger ships; private pleasure craft are outside it.")
          : unknown("Vessel type not on file; cannot determine safety certificate applicability."),
  },
];

function ok(applicability: RequirementApplicability, notes: string) {
  return { applicability, requiresReview: false, notes };
}

function unknown(notes: string) {
  return { applicability: "UNKNOWN" as const, requiresReview: true, notes };
}

function gateByGt400(p: VesselCertProfile, label: string) {
  if (p.gt === null) return unknown(`${label}: GT not on file — cannot determine Annex VI applicability.`);
  return p.gt >= 400
    ? ok("REQUIRED", `Annex VI applies at ≥400 GT international; ${label} carried.`)
    : ok("NOT_REQUIRED", `Below 400 GT — ${label} not required under Annex VI.`);
}

function gateByGt500(p: VesselCertProfile, label: string) {
  if (p.gt === null) return unknown(`${label}: GT not on file — cannot determine SOLAS applicability.`);
  return p.gt >= 500
    ? ok("REQUIRED", `≥500 GT commercial — ${label} required.`)
    : ok("NOT_REQUIRED", `Below 500 GT — ${label} not required.`);
}

/** Evaluate all known certificate types against a vessel profile. */
export function evaluateRequirements(profile: VesselCertProfile): ReadonlyArray<RequirementSpec> {
  return TYPE_DETERMINATIONS.map(({ certificate_type, label, reference, source, determine }) => {
    const d = determine(profile);
    return {
      certificate_type,
      label,
      applicability: d.applicability,
      source,
      reference,
      requiresReview: d.requiresReview,
      notes: d.notes,
    };
  });
}

/** All certificate types this registry is aware of (derived from KNOWN_CERTIFICATE_TYPES). */
export function knownCertificateTypes(): ReadonlyArray<string> {
  return KNOWN_CERTIFICATE_TYPES as ReadonlyArray<string>;
}

/** Human-readable title for a certificate type, defaulting to the raw code. */
export function certificateTypeLabel(certificateType: string): string {
  const known = TYPE_DETERMINATIONS.find((t) => t.certificate_type === certificateType);
  return known?.label ?? certificateType;
}

/**
 * Base fields for a placeholder record produced for a REQUIRED/UNKNOWN spec that
 * has no current evidence. Missing placeholders are MISSING; uncertain ones are
 * UNKNOWN and require review. No dates are invented.
 */
export function placeholderRecordFor(
  spec: RequirementSpec,
  vessel: { readonly vessel_id: string; readonly imo: string },
): {
  readonly certificate_type: string;
  readonly status: "MISSING" | "UNKNOWN";
  readonly source: "unknown";
  readonly review_required: boolean;
  readonly reason_code: string;
  readonly notes: string;
} {
  const isUnknown = spec.applicability === "UNKNOWN";
  return {
    certificate_type: spec.certificate_type,
    status: isUnknown ? "UNKNOWN" : "MISSING",
    source: "unknown",
    review_required: isUnknown ? true : spec.requiresReview,
    reason_code: isUnknown
      ? CERTIFICATE_REASON_CODES.UNCERTAIN_APPLICABILITY
      : CERTIFICATE_REASON_CODES.MISSING_DOCUMENT,
    notes: `${spec.label} — ${spec.reference}. Source: ${spec.source}.`,
  };
}
