import type {
  AisGap,
  AisPosition,
  GreenZoneEncounter,
  PortCall,
  Violation,
  VoyageClassification,
  VoyagePortRef,
  VoyageRecord,
  VoyageVessel,
} from "./types";
import { classifyGapDuration } from "./gap-ladder";

export type VoyageScenarioKey =
  | "clean-voyage"
  | "gap-under-30m"
  | "gap-30m-to-6h"
  | "gap-6h-to-48h"
  | "gap-over-48h"
  | "intra-eu"
  | "eu-to-third-country"
  | "third-country-to-eu"
  | "consistency-violation"
  | "green-zone-encounter";

export const VOYAGE_MOCK_NOW = "2026-07-10T12:00:00.000Z";

export const VOYAGE_MOCK_VESSELS: ReadonlyArray<VoyageVessel> = [
  { vesselId: "vsl-aurelia", name: "Aurelia", imo: "9074729" },
  { vesselId: "vsl-serenity", name: "Serenity", imo: "9384711" },
  { vesselId: "vsl-marguerite", name: "Marguerite", imo: "9612358" },
];

export const AURELIA: VoyageVessel = VOYAGE_MOCK_VESSELS[0]!;

export interface VoyagePortEntry {
  readonly locode: string;
  readonly name: string;
  readonly country: string;
  readonly euMember: boolean;
  readonly greenZone: boolean;
  readonly lat: number;
  readonly lng: number;
}

export const VOYAGE_PORT_REGISTRY: ReadonlyArray<VoyagePortEntry> = [
  { locode: "ITGOA", name: "Genoa", country: "Italy", euMember: true, greenZone: false, lat: 44.4056, lng: 8.9463 },
  { locode: "FRANT", name: "Antibes", country: "France", euMember: true, greenZone: true, lat: 43.5804, lng: 7.1251 },
  { locode: "ESPMI", name: "Palma de Mallorca", country: "Spain", euMember: true, greenZone: true, lat: 39.5696, lng: 2.6409 },
  { locode: "ESVLC", name: "Valencia", country: "Spain", euMember: true, greenZone: true, lat: 39.4499, lng: -0.3183 },
  { locode: "ESBCN", name: "Barcelona", country: "Spain", euMember: true, greenZone: true, lat: 41.3453, lng: 2.1667 },
  { locode: "FRMRS", name: "Marseille", country: "France", euMember: true, greenZone: false, lat: 43.2965, lng: 5.3698 },
  { locode: "TNTUN", name: "Tunis", country: "Tunisia", euMember: false, greenZone: false, lat: 36.8065, lng: 10.1815 },
  { locode: "DZALG", name: "Algiers", country: "Algeria", euMember: false, greenZone: false, lat: 36.77, lng: 3.06 },
];

export function getVoyagePort(locode: string): VoyagePortEntry {
  const found = VOYAGE_PORT_REGISTRY.find((p) => p.locode === locode);
  if (!found) {
    throw new Error(`Unknown port LOCODE: ${locode}`);
  }
  return found;
}

export interface VoyageMockState {
  readonly vessel: VoyageVessel;
  readonly voyages: ReadonlyArray<VoyageRecord>;
  readonly aisPositions: ReadonlyArray<AisPosition>;
  readonly gaps: ReadonlyArray<AisGap>;
  readonly portCalls: ReadonlyArray<PortCall>;
  readonly violations: ReadonlyArray<Violation>;
  readonly greenZoneEncounters: ReadonlyArray<GreenZoneEncounter>;
}

interface VoyageSeed {
  readonly id: string;
  readonly voyageNumber: string;
  readonly departurePort: VoyagePortRef;
  readonly arrivalPort: VoyagePortRef;
  readonly departureTs: string;
  readonly arrivalTs: string;
  readonly distanceNm: number | null;
  readonly classification: VoyageClassification;
  readonly etsCoverageRate: number | null;
  readonly dataQuality: "HIGH" | "MEDIUM" | "LOW";
}

interface GapSeed {
  readonly from: string;
  readonly to: string;
  readonly notes: string | null;
}

function ref(locode: string): VoyagePortRef {
  const port = getVoyagePort(locode);
  return { name: port.name, locode: port.locode };
}

function buildVoyageRecord(seed: VoyageSeed): VoyageRecord {
  return {
    id: seed.id,
    vesselId: AURELIA.vesselId,
    voyageNumber: seed.voyageNumber,
    departurePort: seed.departurePort,
    arrivalPort: seed.arrivalPort,
    departureTs: seed.departureTs,
    arrivalTs: seed.arrivalTs,
    distanceNm: seed.distanceNm,
    classification: seed.classification,
    etsCoverageRate: seed.etsCoverageRate,
    dataQuality: seed.dataQuality,
    source: "Voyage ledger",
  };
}

function isInsideGap(ts: string, gaps: ReadonlyArray<GapSeed>): boolean {
  const t = new Date(ts).getTime();
  return gaps.some((g) => t >= new Date(g.from).getTime() && t <= new Date(g.to).getTime());
}

function buildAisPositions(
  voyage: VoyageRecord,
  gaps: ReadonlyArray<GapSeed>,
): ReadonlyArray<AisPosition> {
  const from = getVoyagePort(voyage.departurePort.locode);
  const to = getVoyagePort(voyage.arrivalPort.locode);
  const dep = new Date(voyage.departureTs).getTime();
  const arr = new Date(voyage.arrivalTs).getTime();
  const stepMs = 60 * 60 * 1000;
  const positions: AisPosition[] = [];
  for (let t = dep; t <= arr; t += stepMs) {
    const ts = new Date(t).toISOString();
    if (isInsideGap(ts, gaps)) continue;
    const frac = arr === dep ? 0 : (t - dep) / (arr - dep);
    positions.push({
      id: `ais-${voyage.id}-${positions.length + 1}`,
      vesselId: AURELIA.vesselId,
      voyageId: voyage.id,
      ts,
      lat: Math.round((from.lat + (to.lat - from.lat) * frac) * 10000) / 10000,
      lng: Math.round((from.lng + (to.lng - from.lng) * frac) * 10000) / 10000,
      speedKnots: 15,
      source: "AIS mock transport",
    });
  }
  return positions;
}

function buildGaps(voyage: VoyageRecord, seeds: ReadonlyArray<GapSeed>): ReadonlyArray<AisGap> {
  return seeds.map((g, idx) => {
    const durationMinutes = Math.round(
      (new Date(g.to).getTime() - new Date(g.from).getTime()) / 60_000,
    );
    const classification = classifyGapDuration(durationMinutes);
    return {
      id: `gap-${voyage.id}-${idx + 1}`,
      vesselId: AURELIA.vesselId,
      voyageId: voyage.id,
      from: g.from,
      to: g.to,
      durationMinutes,
      tier: classification.tier,
      actionRequired: classification.actionRequired,
      escalation: classification.escalation,
      notes: g.notes,
    };
  });
}

function buildPortCalls(voyage: VoyageRecord): ReadonlyArray<PortCall> {
  const dep = getVoyagePort(voyage.departurePort.locode);
  const arr = getVoyagePort(voyage.arrivalPort.locode);
  return [
    {
      id: `pc-${voyage.id}-dep`,
      vesselId: AURELIA.vesselId,
      voyageId: voyage.id,
      portName: dep.name,
      locode: dep.locode,
      country: dep.country,
      greenZone: dep.greenZone,
      arrTs: null,
      depTs: voyage.departureTs,
      source: "Port call ledger",
    },
    {
      id: `pc-${voyage.id}-arr`,
      vesselId: AURELIA.vesselId,
      voyageId: voyage.id,
      portName: arr.name,
      locode: arr.locode,
      country: arr.country,
      greenZone: arr.greenZone,
      arrTs: voyage.arrivalTs,
      depTs: null,
      source: "Port call ledger",
    },
  ];
}

const HISTORY_VOYAGES: ReadonlyArray<VoyageSeed> = [
  {
    id: "voy-hist-mars-gen",
    voyageNumber: "V-2026-008",
    departurePort: ref("FRMRS"),
    arrivalPort: ref("ITGOA"),
    departureTs: "2026-06-28T06:00:00.000Z",
    arrivalTs: "2026-06-29T06:00:00.000Z",
    distanceNm: 285,
    classification: "INTRA_EU",
    etsCoverageRate: 100,
    dataQuality: "HIGH",
  },
  {
    id: "voy-hist-gen-mars",
    voyageNumber: "V-2026-007",
    departurePort: ref("ITGOA"),
    arrivalPort: ref("FRMRS"),
    departureTs: "2026-06-24T06:00:00.000Z",
    arrivalTs: "2026-06-25T06:00:00.000Z",
    distanceNm: 285,
    classification: "INTRA_EU",
    etsCoverageRate: 100,
    dataQuality: "HIGH",
  },
];

const CLEAN_VOYAGE: VoyageSeed = {
  id: "voy-clean",
  voyageNumber: "V-2026-011",
  departurePort: ref("ITGOA"),
  arrivalPort: ref("FRANT"),
  departureTs: "2026-07-06T06:00:00.000Z",
  arrivalTs: "2026-07-06T12:30:00.000Z",
  distanceNm: 94,
  classification: "INTRA_EU",
  etsCoverageRate: 100,
  dataQuality: "HIGH",
};

function buildState(
  primary: VoyageSeed,
  gapSeeds: ReadonlyArray<GapSeed>,
  extra: Partial<{
    readonly portCalls: ReadonlyArray<PortCall>;
    readonly violations: ReadonlyArray<Violation>;
    readonly greenZoneEncounters: ReadonlyArray<GreenZoneEncounter>;
  }> = {},
): VoyageMockState {
  const voyage = buildVoyageRecord(primary);
  const histories = HISTORY_VOYAGES.map((h) => buildVoyageRecord(h));
  const allVoyages = [voyage, ...histories];
  const gaps = buildGaps(voyage, gapSeeds);
  const positions = [...buildAisPositions(voyage, gapSeeds), ...HISTORY_VOYAGES.flatMap((h) => buildAisPositions(buildVoyageRecord(h), []))];
  const portCalls = [
    ...buildPortCalls(voyage),
    ...HISTORY_VOYAGES.flatMap((h) => buildPortCalls(buildVoyageRecord(h))),
    ...(extra.portCalls ?? []),
  ];
  return {
    vessel: AURELIA,
    voyages: allVoyages,
    aisPositions: positions,
    gaps,
    portCalls,
    violations: extra.violations ?? [],
    greenZoneEncounters: extra.greenZoneEncounters ?? [],
  };
}

export function createMockVoyageState(scenario: VoyageScenarioKey): VoyageMockState {
  switch (scenario) {
    case "gap-under-30m":
      return buildState(CLEAN_VOYAGE, [
        { from: "2026-07-06T08:10:00.000Z", to: "2026-07-06T08:35:00.000Z", notes: "25-minute AIS interruption." },
      ]);

    case "gap-30m-to-6h": {
      const voyage: VoyageSeed = {
        id: "voy-flagged",
        voyageNumber: "V-2026-012",
        departurePort: ref("FRANT"),
        arrivalPort: ref("ESPMI"),
        departureTs: "2026-07-04T08:00:00.000Z",
        arrivalTs: "2026-07-05T04:00:00.000Z",
        distanceNm: 246,
        classification: "INTRA_EU",
        etsCoverageRate: 100,
        dataQuality: "MEDIUM",
      };
      return buildState(voyage, [
        { from: "2026-07-04T20:00:00.000Z", to: "2026-07-04T22:15:00.000Z", notes: "Two-hour AIS interruption flagged as interpolation-uncertain." },
      ]);
    }

    case "gap-6h-to-48h": {
      const voyage: VoyageSeed = {
        id: "voy-manual",
        voyageNumber: "V-2026-013",
        departurePort: ref("ESVLC"),
        arrivalPort: ref("TNTUN"),
        departureTs: "2026-07-03T06:00:00.000Z",
        arrivalTs: "2026-07-04T18:00:00.000Z",
        distanceNm: 312,
        classification: "EU_TO_THIRD_COUNTRY",
        etsCoverageRate: 50,
        dataQuality: "LOW",
      };
      return buildState(
        voyage,
        [{ from: "2026-07-03T22:00:00.000Z", to: "2026-07-04T16:00:00.000Z", notes: "18-hour AIS interruption requiring a manual voyage draft." }],
        {
          violations: [
            {
              id: "vio-01-gap-manual",
              code: "VCR-01",
              voyageId: "voy-manual",
              severity: "MEDIUM",
              title: "Unsubstantiated AIS gap",
              description:
                "An AIS data gap of 18 hours on this voyage has not been substantiated by a manual voyage draft.",
              ruleReference: "AIS gap ladder — 6h to 48h tier",
              recommendation:
                "Draft a manual voyage with supporting evidence (noon report, logbook extract) to cover the segment.",
            },
          ],
        },
      );
    }

    case "gap-over-48h": {
      const voyage: VoyageSeed = {
        id: "voy-critical",
        voyageNumber: "V-2026-014",
        departurePort: ref("ESBCN"),
        arrivalPort: ref("DZALG"),
        departureTs: "2026-07-01T06:00:00.000Z",
        arrivalTs: "2026-07-04T06:00:00.000Z",
        distanceNm: 380,
        classification: "EU_TO_THIRD_COUNTRY",
        etsCoverageRate: 50,
        dataQuality: "LOW",
      };
      return buildState(
        voyage,
        [{ from: "2026-07-01T12:00:00.000Z", to: "2026-07-03T18:00:00.000Z", notes: "54-hour AIS interruption requiring escalation." }],
        {
          violations: [
            {
              id: "vio-01-gap-critical",
              code: "VCR-01",
              voyageId: "voy-critical",
              severity: "HIGH",
              title: "Critical unsubstantiated AIS gap",
              description:
                "An AIS data gap of 54 hours exceeds the 48-hour escalation threshold and has no substantiation on file.",
              ruleReference: "AIS gap ladder — over 48h tier",
              recommendation:
                "Escalate and draft a manual voyage with supporting evidence before the segment can be accepted.",
            },
            {
              id: "vio-03-coverage",
              code: "VCR-03",
              voyageId: "voy-critical",
              severity: "MEDIUM",
              title: "ETS coverage below 100% without substantiation",
              description:
                "The voyage record carries 50% ETS coverage with no manual substantiation on file.",
              ruleReference: "EU ETS — MRV voyage coverage",
              recommendation:
                "Substantiate the unmonitored portion with a manual voyage draft or correct the coverage field on the voyage record.",
            },
          ],
        },
      );
    }

    case "intra-eu": {
      const voyage: VoyageSeed = {
        id: "voy-intra-eu",
        voyageNumber: "V-2026-015",
        departurePort: ref("ITGOA"),
        arrivalPort: ref("ESVLC"),
        departureTs: "2026-07-02T06:00:00.000Z",
        arrivalTs: "2026-07-03T04:00:00.000Z",
        distanceNm: 402,
        classification: "INTRA_EU",
        etsCoverageRate: 100,
        dataQuality: "HIGH",
      };
      return buildState(voyage, []);
    }

    case "eu-to-third-country": {
      const voyage: VoyageSeed = {
        id: "voy-eu-third",
        voyageNumber: "V-2026-016",
        departurePort: ref("ESPMI"),
        arrivalPort: ref("TNTUN"),
        departureTs: "2026-07-01T06:00:00.000Z",
        arrivalTs: "2026-07-02T10:00:00.000Z",
        distanceNm: 433,
        classification: "EU_TO_THIRD_COUNTRY",
        etsCoverageRate: 50,
        dataQuality: "HIGH",
      };
      return buildState(voyage, []);
    }

    case "third-country-to-eu": {
      const voyage: VoyageSeed = {
        id: "voy-third-eu",
        voyageNumber: "V-2026-017",
        departurePort: ref("TNTUN"),
        arrivalPort: ref("ITGOA"),
        departureTs: "2026-06-30T06:00:00.000Z",
        arrivalTs: "2026-07-01T12:00:00.000Z",
        distanceNm: 455,
        classification: "THIRD_COUNTRY_TO_EU",
        etsCoverageRate: 50,
        dataQuality: "HIGH",
      };
      return buildState(voyage, []);
    }

    case "consistency-violation": {
      const voyage: VoyageSeed = {
        id: "voy-consistency",
        voyageNumber: "V-2026-018",
        departurePort: ref("ITGOA"),
        arrivalPort: ref("FRANT"),
        departureTs: "2026-06-27T06:00:00.000Z",
        arrivalTs: "2026-06-27T12:30:00.000Z",
        distanceNm: 94,
        classification: "INTRA_EU",
        etsCoverageRate: 100,
        dataQuality: "LOW",
      };
      const portCallOverride: PortCall = {
        id: "pc-voy-consistency-arr",
        vesselId: AURELIA.vesselId,
        voyageId: "voy-consistency",
        portName: "Palma de Mallorca",
        locode: "ESPMI",
        country: "Spain",
        greenZone: true,
        arrTs: "2026-06-27T12:30:00.000Z",
        depTs: null,
        source: "Port call ledger",
      };
      return buildState(voyage, [], {
        portCalls: [portCallOverride],
        violations: [
          {
            id: "vio-05-consistency",
            code: "VCR-05",
            voyageId: "voy-consistency",
            severity: "HIGH",
            title: "Cross-source arrival port mismatch",
            description:
              "The voyage record lists Antibes as the arrival port but the port call ledger records a Palma de Mallorca arrival for the same voyage.",
            ruleReference: "Voyage ledger vs port call ledger consistency",
            recommendation:
              "Reconcile the arrival port between the voyage record and the port call ledger before finalizing the MRV report.",
          },
        ],
      });
    }

    case "green-zone-encounter": {
      const voyage: VoyageSeed = {
        id: "voy-green-zone",
        voyageNumber: "V-2026-019",
        departurePort: ref("ITGOA"),
        arrivalPort: ref("FRANT"),
        departureTs: "2026-06-26T06:00:00.000Z",
        arrivalTs: "2026-06-26T12:30:00.000Z",
        distanceNm: 94,
        classification: "INTRA_EU",
        etsCoverageRate: 100,
        dataQuality: "HIGH",
      };
      return buildState(voyage, [], {
        greenZoneEncounters: [
          {
            id: "gze-ligurian-pssa",
            vesselId: AURELIA.vesselId,
            voyageId: "voy-green-zone",
            zoneName: "Ligurian Sea PSSA",
            zoneCategory: "PSSA",
            enteredAt: "2026-06-26T07:15:00.000Z",
            exitedAt: "2026-06-26T11:20:00.000Z",
            durationMinutes: 245,
            actionRequired: "Log the PSSA transit and declare the Green Zone port call at Antibes.",
          },
        ],
        violations: [
          {
            id: "vio-02-green-zone",
            code: "VCR-02",
            voyageId: "voy-green-zone",
            severity: "LOW",
            title: "Missing Green Zone port declaration",
            description:
              "The arrival at the Green Zone port of Antibes has no green zone declaration on file.",
            ruleReference: "Med green lanes — green zone port call declaration",
            recommendation:
              "Submit the green zone declaration for the Antibes port call to keep the Med green lanes benefit.",
          },
        ],
      });
    }

    case "clean-voyage":
    default:
      return buildState(CLEAN_VOYAGE, []);
  }
}
