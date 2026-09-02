/**
 * demo-seed.ts — deterministic demo dataset for the Poseidon Ledger sales demo
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * In mock mode (SUPABASE_USE_MOCK=true, the default) the fake Supabase client
 * is seeded with fixture data so the app looks like a finished commercial
 * product on first run. Every value below is hard-coded and stable for the
 * life of the process so dashboards, lists and charts render identically.
 *
 * HOW IT FITS
 * `getSupabaseClient()` in client.ts calls `buildDemoSeedTables()` and passes
 * the result to `createFakeSupabaseClient({ tables })`. Repositories query
 * these tables exactly as they would a real database.
 *
 * NOTE
 * The fake client shallow-copies each row and applies `buildRow` defaults only
 * on insert, so every seeded row below carries every field it needs
 * (including explicit `id` and `created_at` for deterministic ordering).
 */

import { ROLES } from "@/lib/roles/catalog";
import { hashPassword } from "@/lib/auth/passwords";
import { DEMO_OWNER } from "@/constants/demo";

const HOUR = 3_600_000;
const DAY = 86_400_000;

export interface DemoSeedVessel {
  readonly id: string;
  readonly imo: string;
  readonly name: string;
  readonly mmsi: string;
  readonly shipId: string;
  readonly grossTonnage: number;
  readonly flag: string;
  readonly vesselType: string;
  readonly vesselCategory: string;
}

export const DEMO_ORG = {
  id: "org-poseidon",
  name: "Poseidon Shipping Ltd.",
} as const;

export { DEMO_OWNER };

export const DEMO_VESSELS: ReadonlyArray<DemoSeedVessel> = [
  { id: "vsl-aurelia", imo: "9074729", name: "Aurelia", mmsi: "310625000", shipId: "371663", grossTonnage: 31240, flag: "PAN", vesselType: "passenger", vesselCategory: "commercial" },
  { id: "vsl-atlas", imo: "9432891", name: "Atlas", mmsi: "538005432", shipId: "411552", grossTonnage: 55460, flag: "PAN", vesselType: "cargo", vesselCategory: "commercial" },
  { id: "vsl-horizon", imo: "9587420", name: "Horizon", mmsi: "636012345", shipId: "623451", grossTonnage: 29870, flag: "MHL", vesselType: "tanker", vesselCategory: "commercial" },
  { id: "vsl-neptune", imo: "9338490", name: "Neptune", mmsi: "215008765", shipId: "884532", grossTonnage: 18650, flag: "MLT", vesselType: "pleasure", vesselCategory: "private" },
  { id: "vsl-odyssey", imo: "9712215", name: "Odyssey", mmsi: "374712000", shipId: "915611", grossTonnage: 38980, flag: "GRC", vesselType: "cargo", vesselCategory: "commercial" },
];

interface PortRef {
  readonly name: string;
  readonly id: string | null;
  readonly country: string | null;
  readonly lat: number;
  readonly lng: number;
}

const PORTS: Record<string, PortRef> = {
  Piraeus: { name: "Piraeus", id: "grc_pir", country: "Greece", lat: 37.94, lng: 23.62 },
  Valencia: { name: "Valencia", id: "esp_vlc", country: "Spain", lat: 39.45, lng: -0.32 },
  Genoa: { name: "Genoa", id: "ita_goa", country: "Italy", lat: 44.41, lng: 8.92 },
  Rotterdam: { name: "Rotterdam", id: "nld_rtm", country: "Netherlands", lat: 51.95, lng: 4.12 },
  Marseille: { name: "Marseille", id: "fra_mrs", country: "France", lat: 43.3, lng: 5.35 },
  Hamburg: { name: "Hamburg", id: "deu_ham", country: "Germany", lat: 53.55, lng: 9.95 },
  Algeciras: { name: "Algeciras", id: "esp_alg", country: "Spain", lat: 36.13, lng: -5.44 },
  Barcelona: { name: "Barcelona", id: "esp_bcn", country: "Spain", lat: 41.38, lng: 2.19 },
  Singapore: { name: "Singapore", id: "sgp_sin", country: "Singapore", lat: 1.29, lng: 103.85 },
  Fujairah: { name: "Fujairah", id: "are_fuj", country: "United Arab Emirates", lat: 25.11, lng: 56.34 },
  "Le Havre": { name: "Le Havre", id: "fra_leh", country: "France", lat: 49.49, lng: 0.12 },
  Cadiz: { name: "Cadiz", id: "esp_cad", country: "Spain", lat: 36.53, lng: -6.29 },
};

interface VoyageSeed {
  readonly id: string;
  readonly vesselId: string;
  readonly departurePort: keyof typeof PORTS;
  readonly arrivalPort: keyof typeof PORTS;
  readonly depTs: number;
  readonly arrTs: number | null;
  readonly distanceNm: number;
}

const VOYAGES: ReadonlyArray<VoyageSeed> = [
  { id: "voy-aur-1", vesselId: "vsl-aurelia", departurePort: "Piraeus", arrivalPort: "Valencia", depTs: -9 * DAY, arrTs: -7 * DAY, distanceNm: 1002 },
  { id: "voy-aur-2", vesselId: "vsl-aurelia", departurePort: "Valencia", arrivalPort: "Genoa", depTs: -30 * HOUR, arrTs: 34 * HOUR, distanceNm: 623 },
  { id: "voy-atl-1", vesselId: "vsl-atlas", departurePort: "Rotterdam", arrivalPort: "Piraeus", depTs: -12 * DAY, arrTs: -10 * DAY, distanceNm: 2695 },
  { id: "voy-atl-2", vesselId: "vsl-atlas", departurePort: "Piraeus", arrivalPort: "Marseille", depTs: -48 * HOUR, arrTs: 10 * HOUR, distanceNm: 1280 },
  { id: "voy-hrz-1", vesselId: "vsl-horizon", departurePort: "Rotterdam", arrivalPort: "Hamburg", depTs: -6 * HOUR, arrTs: 5 * HOUR, distanceNm: 398 },
  { id: "voy-hrz-2", vesselId: "vsl-horizon", departurePort: "Hamburg", arrivalPort: "Rotterdam", depTs: -5 * DAY, arrTs: -4 * DAY, distanceNm: 398 },
  { id: "voy-nep-1", vesselId: "vsl-neptune", departurePort: "Algeciras", arrivalPort: "Barcelona", depTs: -3 * DAY, arrTs: 16 * HOUR, distanceNm: 760 },
  { id: "voy-nep-2", vesselId: "vsl-neptune", departurePort: "Barcelona", arrivalPort: "Algeciras", depTs: -15 * DAY, arrTs: -13 * DAY, distanceNm: 760 },
  { id: "voy-ody-1", vesselId: "vsl-odyssey", departurePort: "Singapore", arrivalPort: "Fujairah", depTs: -5 * DAY, arrTs: 6 * DAY, distanceNm: 3185 },
  { id: "voy-ody-2", vesselId: "vsl-odyssey", departurePort: "Fujairah", arrivalPort: "Singapore", depTs: -30 * DAY, arrTs: -27 * DAY, distanceNm: 3185 },
  { id: "voy-ody-3", vesselId: "vsl-odyssey", departurePort: "Singapore", arrivalPort: "Fujairah", depTs: -45 * DAY, arrTs: -42 * DAY, distanceNm: 3185 },
];

interface CurrentPosition {
  readonly lat: number;
  readonly lng: number;
  readonly sog: number;
  readonly cog: number;
  readonly heading: number;
  readonly navStatus: string;
}

const CURRENT_POSITIONS: Record<string, CurrentPosition> = {
  "vsl-aurelia": { lat: 41.95, lng: 7.95, sog: 15.2, cog: 45, heading: 47, navStatus: "Under way using engine" },
  "vsl-atlas": { lat: 41.2, lng: 5.8, sog: 14.0, cog: 280, heading: 275, navStatus: "Under way using engine" },
  "vsl-horizon": { lat: 53.3, lng: 7.2, sog: 11.5, cog: 95, heading: 92, navStatus: "Under way using engine" },
  "vsl-neptune": { lat: 37.85, lng: 1.1, sog: 13.8, cog: 55, heading: 52, navStatus: "Under way using engine" },
  "vsl-odyssey": { lat: 12.6, lng: 77.2, sog: 16.4, cog: 300, heading: 305, navStatus: "Under way using engine" },
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Demo seed invariant violated: missing ${label}`);
  }
  return value;
}

/**
 * Build a deterministic AIS position history for the vessel's current voyage:
 * from the departure port to the current position, ~42 points spaced evenly
 * over the elapsed leg. The final point is the "live" position.
 */
function buildAisTrack(
  vesselId: string,
  depPort: PortRef,
  depTs: number,
  now: number,
  current: CurrentPosition,
  startId: number,
): Array<Record<string, unknown>> {
  const points: Array<Record<string, unknown>> = [];
  const count = 42;
  const span = now - depTs;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const ts = depTs + span * t;
    const lat = Number(lerp(depPort.lat, current.lat, t).toFixed(4));
    const lng = Number(lerp(depPort.lng, current.lng, t).toFixed(4));
    points.push({
      id: `ais-${vesselId}-${startId + i}`,
      vessel_id: vesselId,
      ts: new Date(ts).toISOString(),
      latitude: lat,
      longitude: lng,
      sog: Number((current.sog * (0.85 + 0.3 * Math.sin(i))).toFixed(1)),
      cog: Number((current.cog + Math.round(Math.sin(i * 0.7) * 6)).toFixed(1)),
      heading: Number((current.heading + Math.round(Math.cos(i * 0.5) * 4)).toFixed(0)),
      nav_status: current.navStatus,
      created_at: new Date(ts).toISOString(),
    });
  }
  return points;
}

/**
 * Seed row shapes that mirror the OCR assistant's deterministic mock registry
 * (ids, titles, families) so a review handoff from the OCR workspace resolves
 * against real document rows in the Review queue.
 */
const OCR_MIRROR_DOCS: ReadonlyArray<{
  readonly id: string;
  readonly title: string;
  readonly documentType: "bdn" | "certificate" | "report" | "eu_mrv" | "other";
  readonly status: string;
  readonly level: "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW";
  readonly ocrConfidence: number;
  readonly family: string;
}> = [
  { id: "ocr-doc-perfect-bdn", title: "BDN — Aurelia (Singapore, 2026-07-18)", documentType: "bdn", status: "approved", level: "HIGH", ocrConfidence: 0.95, family: "BDN" },
  { id: "ocr-doc-rotated-bdn", title: "BDN — Aurelia (rotated 90°)", documentType: "bdn", status: "under_review", level: "MEDIUM", ocrConfidence: 0.6, family: "BDN" },
  { id: "ocr-doc-blurred-certificate", title: "IAPP Certificate — Aurelia (blurred)", documentType: "certificate", status: "under_review", level: "MEDIUM", ocrConfidence: 0.45, family: "CERTIFICATE" },
  { id: "ocr-doc-unreadable-noon-report", title: "Noon Report — Aurelia (unreadable)", documentType: "report", status: "processing", level: "VERY_LOW", ocrConfidence: 0.2, family: "NOON_REPORT" },
  { id: "ocr-doc-mixed-language", title: "BDN — Aurelia (mixed-language supplier block)", documentType: "bdn", status: "extracted", level: "MEDIUM", ocrConfidence: 0.8, family: "BDN" },
  { id: "ocr-doc-duplicate-scan", title: "BDN — Aurelia (duplicate page scan)", documentType: "bdn", status: "under_review", level: "MEDIUM", ocrConfidence: 0.75, family: "BDN" },
  { id: "ocr-doc-damaged-scan", title: "EU ETS Report — Aurelia (damaged scan)", documentType: "eu_mrv", status: "processing", level: "VERY_LOW", ocrConfidence: 0.3, family: "EU_ETS" },
  { id: "ocr-doc-cropped-statement", title: "Account Statement — Aurelia Shipping (cropped)", documentType: "other", status: "extracted", level: "MEDIUM", ocrConfidence: 0.8, family: "STATEMENT" },
  { id: "ocr-doc-wrong-type", title: "Uploaded as Certificate — content is a BDN", documentType: "certificate", status: "under_review", level: "HIGH", ocrConfidence: 0.95, family: "BDN" },
];

/**
 * Build the full demo dataset. Timestamps are relative to `Date.now()` at
 * seed time so the demo always looks "live" on first load.
 */
export function buildDemoSeedTables(): Record<string, readonly unknown[]> {
  const NOW = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const ago = (ms: number) => iso(NOW - ms);
  const ahead = (ms: number) => iso(NOW + ms);
  const nowIso = iso(NOW);

  const orgId = DEMO_ORG.id;
  const ownerId = DEMO_OWNER.id;

  const vessels = DEMO_VESSELS.map((v) => ({
    id: v.id,
    imo: v.imo,
    name: v.name,
    mmsi: v.mmsi,
    ship_id: v.shipId,
    gross_tonnage: v.grossTonnage,
    flag: v.flag,
    vessel_type: v.vesselType,
    vessel_category: v.vesselCategory,
    created_at: ago(60 * DAY),
    updated_at: ago(60 * DAY),
  }));

  const voyages = VOYAGES.map((v) => {
    const dep = must(PORTS[v.departurePort], `departure port for ${v.id}`);
    const arr = must(PORTS[v.arrivalPort], `arrival port for ${v.id}`);
    return {
      id: v.id,
      vessel_id: v.vesselId,
      source_fetched_at: iso(NOW + v.depTs),
      source_is_mock: true,
      departure_port_name: dep.name,
      departure_port_id: dep.id,
      departure_time: iso(NOW + v.depTs),
      arrival_port_name: arr.name,
      arrival_port_id: arr.id,
      arrival_time: v.arrTs === null ? null : iso(NOW + v.arrTs),
      distance_nm: v.distanceNm,
      created_at: iso(NOW + v.depTs),
    };
  });

  const aisPositions: Array<Record<string, unknown>> = [];
  for (const v of DEMO_VESSELS) {
    const current = must(CURRENT_POSITIONS[v.id], `current position for ${v.id}`);
    const activeVoyage = VOYAGES.find((voy) => voy.vesselId === v.id && voy.arrTs !== null && voy.arrTs > 0);
    const depPort = activeVoyage ? must(PORTS[activeVoyage.departurePort], `departure port for ${activeVoyage.id}`) : must(PORTS.Cadiz, "Cadiz");
    const depTs = activeVoyage ? activeVoyage.depTs : -2 * DAY;
    aisPositions.push(...buildAisTrack(v.id, depPort, NOW + depTs, NOW - 10 * 60 * 1000, current, aisPositions.length));
  }

  // Noon reports — 2 to 3 per vessel, latest analysed with full fields.
  const noonReports: Array<Record<string, unknown>> = [];
  let noonIdx = 0;
  for (const v of DEMO_VESSELS) {
    const current = must(CURRENT_POSITIONS[v.id], `current position for ${v.id}`);
    const inPort = v.id === "vsl-horizon";
    const days = inPort ? 2 : 3;
    for (let d = days - 1; d >= 0; d--) {
      const reportDate = ago(d * DAY + 0.5 * HOUR);
      const isLatest = d === 0;
      const fuelConsumption = inPort ? (isLatest ? 12.4 : 11.8) : 18.6 + (v.id === "vsl-odyssey" ? 6.2 : 0);
      const rob = inPort ? 92.1 : 310 + (v.id === "vsl-odyssey" ? 420 : 0) - d * 14;
      noonReports.push({
        id: `noon-${v.id}-${d}`,
        vessel_id: v.id,
        imo: v.imo,
        vessel_name: v.name,
        report_date: reportDate,
        position_latitude: Number((current.lat + (d % 2 === 0 ? 0.02 : -0.015)).toFixed(4)),
        position_longitude: Number((current.lng + (d % 2 === 0 ? 0.03 : -0.02)).toFixed(4)),
        speed_knots: inPort ? 0 : Number((current.sog - d * 0.2).toFixed(2)),
        course_degrees: inPort ? null : current.cog,
        distance_to_go_nm: inPort ? null : 220 - d * 160,
        fuel_consumption_tonnes: fuelConsumption,
        fuel_robs_tonnes: rob,
        engine_rpm: inPort ? 0 : v.id === "vsl-odyssey" ? 84 : 76,
        sea_state: inPort ? null : d % 2 === 0 ? "Moderate" : "Slight",
        wind_speed_knots: inPort ? null : 14 + (d % 3) * 3,
        wind_direction: inPort ? null : d % 2 === 0 ? "NW" : "NE",
        summary: isLatest
          ? `${v.name} — ${inPort ? "in port" : `en route, ${fuelConsumption.toFixed(1)} t consumed since last report`}.`
          : null,
        warnings: [],
        confidence: isLatest ? 0.94 : 0.9,
        source: "EMAIL",
        source_document_id: null,
        review_state: isLatest ? "EVALUATED" : null,
        is_blocked: false,
        analysis: isLatest
          ? {
              engineVersion: "1.0.0",
              evaluatedAt: ago(0.4 * HOUR),
              vessel: { vesselId: v.id, imo: v.imo, name: v.name },
              operationalState: inPort ? "IN_PORT" : "AT_SEA",
              consumption: {
                totalTonnes: fuelConsumption,
                sinceLastReportTonnes: fuelConsumption,
                intervalDays: 1,
                rateTonnesPerDay: Number(fuelConsumption.toFixed(1)),
                trendPct: -1.4,
                confidence: 0.92,
              },
              fuelBreakdown: {
                items: [
                  { fuelType: "vlsfo", tonnes: Number((fuelConsumption * 0.82).toFixed(1)), sharePct: 82 },
                  { fuelType: "lsmgo", tonnes: Number((fuelConsumption * 0.18).toFixed(1)), sharePct: 18 },
                ],
                resolved: true,
                unresolvedFuelTypes: [],
              },
              remainingOnBoard: { robTonnes: rob, enduranceDays: inPort ? 8 : 12, confidence: 0.9 },
              engine: { rpm: inPort ? 0 : 76, rpmConfidence: 0.93, loadPct: inPort ? 0 : 78.4, atDesign: true },
              weather: {
                seaState: inPort ? null : "Moderate",
                windSpeedKnots: inPort ? null : 17,
                windDirection: inPort ? null : "NW",
                significant: false,
                confidence: 0.88,
              },
              voyage: {
                position: { latitude: current.lat, longitude: current.lng },
                courseDegrees: current.cog,
                distanceMadeGoodNm: 352,
                speedMadeGoodKnots: Number((current.sog - 0.4).toFixed(2)),
                confidence: 0.91,
              },
              distance: {
                plannedDistanceNm: 623,
                distanceMadeGoodNm: 352,
                distanceToGoNm: 220,
                progressPct: 56.5,
                remainingPct: 43.5,
              },
              slip: { slipPct: 4.2, theoreticalSpeedKnots: Number((current.sog + 0.7).toFixed(2)), actualSpeedKnots: current.sog, confidence: 0.85 },
              rpm: { rpm: inPort ? 0 : 76, designRpm: 78, deviationFromDesignPct: -2.6, atReference: false },
              speed: {
                speedKnots: current.sog,
                designSpeedKnots: 17,
                plannedSpeedKnots: 15.5,
                deviationFromDesignPct: -11.2,
                deviationFromPlannedPct: -2.3,
                slowSteaming: false,
              },
              waiting: inPort ? null : { stationary: false, speedKnots: current.sog, distanceToGoNm: 220, note: null },
              port: inPort ? { inPort: true, destinationPort: "Hamburg", note: "Alongside berth 3" } : { inPort: false, destinationPort: null, note: null },
              prediction: {
                arrivalDate: ahead(34 * HOUR),
                remainingConsumptionTonnes: Number((18.6 * 1.4).toFixed(1)),
                predictedArrivalRobTonnes: Number((rob - 26).toFixed(1)),
                confidence: 0.87,
              },
              deviations: [],
              dedupKey: `noon:${v.imo}:${reportDate}`,
            }
          : null,
        findings: isLatest && !inPort
          ? [
              {
                id: `f-noon-${v.id}-slip`,
                severity: "INFO",
                confidence: 0.85,
                reason: "Apparent slip of 4.2% is within the 3–6% design band.",
                remediation: null,
                category: "engine",
                ruleId: "slip_band_check",
                field: "engine_rpm",
              },
              {
                id: `f-noon-${v.id}-eta`,
                severity: "INFO",
                confidence: 0.8,
                reason: "Current speed keeps the vessel on schedule for the planned ETA.",
                remediation: null,
                category: "voyage",
                ruleId: "eta_deviation_check",
                field: "distance_to_go_nm",
              },
            ]
          : isLatest && inPort
            ? [
                {
                  id: `f-noon-${v.id}-inport`,
                  severity: "INFO",
                  confidence: 0.9,
                  reason: "Vessel is alongside; consumption reflects auxiliary load only.",
                  remediation: null,
                  category: "structural",
                  ruleId: "operational_state_check",
                  field: "speed_knots",
                },
              ]
            : [],
        fuel_correlation: isLatest
          ? {
              attribution: [{ fuelType: "vlsfo", tonnes: Number((fuelConsumption * 0.82).toFixed(1)) }],
              attributionResolved: true,
              deliveredTonnes: null,
              consumedTonnes: fuelConsumption,
              deliveryDiscrepancyTonnes: null,
              deliveryDiscrepancyPct: null,
              deliveryState: "INSUFFICIENT_DATA",
              robDeltaTonnes: -fuelConsumption,
              robExpectedConsumptionTonnes: fuelConsumption,
              robDiscrepancyPct: 0.0,
              robState: "CONSISTENT",
              findings: [],
            }
          : null,
        voyage_correlation: isLatest
          ? {
              distanceMadeGoodNm: 352,
              plannedDistanceNm: 623,
              progressPct: 56.5,
              speedMadeGoodKnots: Number((current.sog - 0.4).toFixed(2)),
              plannedSpeedKnots: 15.5,
              speedDeviationPct: -2.3,
              etaDeviationHours: 0,
              plannedArrival: ahead(34 * HOUR),
              predictedArrival: ahead(34 * HOUR),
              lateHours: 0,
              state: "ON_SCHEDULE",
              findings: [],
            }
          : null,
        fueleu_operational: isLatest
          ? {
              reportingYear: 2026,
              reportCount: days,
              daysCovered: days,
              energyMeters: [
                { fuelType: "vlsfo", tonnes: Number((fuelConsumption * 0.82).toFixed(1)), energyMj: null, lhvSource: null, resolved: true },
              ],
              totalEnergyMj: null,
              totalTonnes: fuelConsumption,
              dataAvailable: true,
              findings: [],
            }
          : null,
        ets_operational: isLatest
          ? {
              reportingYear: 2026,
              reportCount: days,
              daysCovered: days,
              emissions: [
                { fuelType: "vlsfo", tonnes: Number((fuelConsumption * 0.82).toFixed(1)), co2Tonnes: Number((fuelConsumption * 0.82 * 3.151).toFixed(1)), factorSource: "fuel_types", resolved: true },
              ],
              totalCo2Tonnes: Number((fuelConsumption * 3.151).toFixed(1)),
              totalTonnes: fuelConsumption,
              dataAvailable: true,
              findings: [],
            }
          : null,
        evaluated_at: isLatest ? ago(0.4 * HOUR) : null,
        evaluation_version: isLatest ? "1.0.0" : null,
        dedup_key: `noon:${v.imo}:${reportDate}`,
        created_at: reportDate,
        updated_at: reportDate,
      });
      noonIdx++;
    }
  }

  // Fuel deliveries, each traceable to a BDN document.
  const fuelDeliveries: Array<Record<string, unknown>> = [
    { id: "fuel-aur-1", vesselId: "vsl-aurelia", documentId: "doc-bdn-aurelia-valencia", supplier: "Bunker Holding Iberia S.L.", port: "Valencia", date: -8 * DAY, fuelType: "vlsfo", quantityMt: 320, density: 920.4, sulphur: 0.49, bdn: "BDN-2026-0726", status: "reconciled", voyageId: "voy-aur-1" },
    { id: "fuel-atl-1", vesselId: "vsl-atlas", documentId: "doc-bdn-atlas-piraeus", supplier: "Hellas Bunkers S.A.", port: "Piraeus", date: -11 * DAY, fuelType: "vlsfo", quantityMt: 400, density: 921.1, sulphur: 0.48, bdn: "BDN-2026-0723", status: "reconciled", voyageId: "voy-atl-1" },
    { id: "fuel-atl-2", vesselId: "vsl-atlas", documentId: "doc-bdn-atlas-rotterdam", supplier: "Vitol Bunkers B.V.", port: "Rotterdam", date: -13 * DAY, fuelType: "lsmgo", quantityMt: 120, density: 888.7, sulphur: 0.05, bdn: "BDN-2026-0721", status: "verified", voyageId: "voy-atl-1" },
    { id: "fuel-hrz-1", vesselId: "vsl-horizon", documentId: "doc-bdn-horizon-rotterdam", supplier: "Vitol Bunkers B.V.", port: "Rotterdam", date: -7 * DAY, fuelType: "vlsfo", quantityMt: 480, density: 918.9, sulphur: 0.49, bdn: "BDN-2026-0727", status: "verified", voyageId: "voy-hrz-1" },
    { id: "fuel-hrz-2", vesselId: "vsl-horizon", documentId: "doc-bdn-horizon-hamburg", supplier: "Marine Bunkers GmbH", port: "Hamburg", date: -4 * DAY, fuelType: "lsmgo", quantityMt: 90, density: 887.5, sulphur: 0.05, bdn: "BDN-2026-0730", status: "pending", voyageId: null },
    { id: "fuel-nep-1", vesselId: "vsl-neptune", documentId: "doc-bdn-neptune-algeciras", supplier: "Cepsa Marine", port: "Algeciras", date: -3 * DAY, fuelType: "vlsfo", quantityMt: 550, density: 920.8, sulphur: 0.49, bdn: "BDN-2026-0731", status: "pending", voyageId: null },
    { id: "fuel-nep-2", vesselId: "vsl-neptune", documentId: "doc-bdn-neptune-barcelona", supplier: "Cepsa Marine", port: "Barcelona", date: -14 * DAY, fuelType: "mgo", quantityMt: 40, density: 890.2, sulphur: 0.1, bdn: "BDN-2026-0720", status: "reconciled", voyageId: "voy-nep-2" },
    { id: "fuel-ody-1", vesselId: "vsl-odyssey", documentId: "doc-bdn-odyssey-singapore", supplier: "Oceania Marine Fuels Pte Ltd", port: "Singapore", date: -5 * DAY, fuelType: "vlsfo", quantityMt: 700, density: 919.6, sulphur: 0.49, bdn: "BDN-2026-0729", status: "verified", voyageId: "voy-ody-1" },
    { id: "fuel-ody-2", vesselId: "vsl-odyssey", documentId: "doc-bdn-odyssey-fujairah", supplier: "Gulf Marine Bunkers FZE", port: "Fujairah", date: -29 * DAY, fuelType: "hfo", quantityMt: 500, density: 987.0, sulphur: 0.48, bdn: "BDN-2026-0705", status: "reconciled", voyageId: "voy-ody-2" },
  ].map((f) => ({
    id: f.id,
    document_id: f.documentId,
    ocr_result_id: null,
    ai_extraction_id: null,
    vessel_id: f.vesselId,
    supplier: f.supplier,
    delivery_port: f.port,
    delivery_date: iso(NOW + f.date),
    fuel_type: f.fuelType,
    quantity_mt: f.quantityMt,
    density_kgm3: f.density,
    sulphur_content_pct: f.sulphur,
    bdn_reference: f.bdn,
    status: f.status,
    reconciled_voyage_id: f.voyageId,
    reconciled_at: f.voyageId ? iso(NOW + f.date + 0.5 * HOUR) : null,
    notes: null,
    created_at: iso(NOW + f.date),
    updated_at: iso(NOW + f.date),
  }));

  const documents: Array<Record<string, unknown>> = [
    ...OCR_MIRROR_DOCS.map((d, i) => ({
      id: d.id,
      vessel_id: null,
      document_type: d.documentType,
      status: d.status,
      source_channel: "EMAIL",
      title: d.title,
      filename: `${d.id}.pdf`,
      mime_type: "application/pdf",
      file_size: 182_400 + i * 12_300,
      storage_path: `demo/ocr/${d.id}.pdf`,
      metadata: { family: d.family, ocrConfidence: d.ocrConfidence, level: d.level },
      created_at: ago((8 - i) * DAY),
      updated_at: ago((8 - i) * DAY + 2 * HOUR),
    })),
    { id: "doc-bdn-aurelia-valencia", vessel_id: "vsl-aurelia", document_type: "bdn", status: "approved", source_channel: "EMAIL", title: "BDN — Aurelia (Valencia, 2026-07-26)", filename: "bdn-aurelia-valencia-2026-0726.pdf", mime_type: "application/pdf", file_size: 412_800, storage_path: "demo/bdns/bdn-aurelia-valencia-2026-0726.pdf", metadata: { bdnReference: "BDN-2026-0726", fuelType: "VLSFO" }, created_at: ago(8 * DAY), updated_at: ago(8 * DAY) },
    { id: "doc-bdn-atlas-piraeus", vessel_id: "vsl-atlas", document_type: "bdn", status: "approved", source_channel: "EMAIL", title: "BDN — Atlas (Piraeus, 2026-07-23)", filename: "bdn-atlas-piraeus-2026-0723.pdf", mime_type: "application/pdf", file_size: 388_200, storage_path: "demo/bdns/bdn-atlas-piraeus-2026-0723.pdf", metadata: { bdnReference: "BDN-2026-0723", fuelType: "VLSFO" }, created_at: ago(11 * DAY), updated_at: ago(11 * DAY) },
    { id: "doc-bdn-atlas-rotterdam", vessel_id: "vsl-atlas", document_type: "bdn", status: "approved", source_channel: "EMAIL", title: "BDN — Atlas (Rotterdam, 2026-07-21)", filename: "bdn-atlas-rotterdam-2026-0721.pdf", mime_type: "application/pdf", file_size: 351_400, storage_path: "demo/bdns/bdn-atlas-rotterdam-2026-0721.pdf", metadata: { bdnReference: "BDN-2026-0721", fuelType: "LSMGO" }, created_at: ago(13 * DAY), updated_at: ago(13 * DAY) },
    { id: "doc-bdn-horizon-rotterdam", vessel_id: "vsl-horizon", document_type: "bdn", status: "extracted", source_channel: "EMAIL", title: "BDN — Horizon (Rotterdam, 2026-07-27)", filename: "bdn-horizon-rotterdam-2026-0727.pdf", mime_type: "application/pdf", file_size: 402_100, storage_path: "demo/bdns/bdn-horizon-rotterdam-2026-0727.pdf", metadata: { bdnReference: "BDN-2026-0727", fuelType: "VLSFO" }, created_at: ago(7 * DAY), updated_at: ago(7 * DAY) },
    { id: "doc-bdn-horizon-hamburg", vessel_id: "vsl-horizon", document_type: "bdn", status: "processing", source_channel: "EMAIL", title: "BDN — Horizon (Hamburg, 2026-07-30)", filename: "bdn-horizon-hamburg-2026-0730.pdf", mime_type: "application/pdf", file_size: 366_700, storage_path: "demo/bdns/bdn-horizon-hamburg-2026-0730.pdf", metadata: { bdnReference: "BDN-2026-0730", fuelType: "LSMGO" }, created_at: ago(4 * DAY), updated_at: ago(4 * DAY) },
    { id: "doc-bdn-neptune-algeciras", vessel_id: "vsl-neptune", document_type: "bdn", status: "ocr_complete", source_channel: "EMAIL", title: "BDN — Neptune (Algeciras, 2026-07-31)", filename: "bdn-neptune-algeciras-2026-0731.pdf", mime_type: "application/pdf", file_size: 421_900, storage_path: "demo/bdns/bdn-neptune-algeciras-2026-0731.pdf", metadata: { bdnReference: "BDN-2026-0731", fuelType: "VLSFO" }, created_at: ago(3 * DAY), updated_at: ago(3 * DAY) },
    { id: "doc-bdn-neptune-barcelona", vessel_id: "vsl-neptune", document_type: "bdn", status: "approved", source_channel: "EMAIL", title: "BDN — Neptune (Barcelona, 2026-07-20)", filename: "bdn-neptune-barcelona-2026-0720.pdf", mime_type: "application/pdf", file_size: 331_500, storage_path: "demo/bdns/bdn-neptune-barcelona-2026-0720.pdf", metadata: { bdnReference: "BDN-2026-0720", fuelType: "MGO" }, created_at: ago(14 * DAY), updated_at: ago(14 * DAY) },
    { id: "doc-bdn-odyssey-singapore", vessel_id: "vsl-odyssey", document_type: "bdn", status: "extracted", source_channel: "EMAIL", title: "BDN — Odyssey (Singapore, 2026-07-29)", filename: "bdn-odyssey-singapore-2026-0729.pdf", mime_type: "application/pdf", file_size: 455_000, storage_path: "demo/bdns/bdn-odyssey-singapore-2026-0729.pdf", metadata: { bdnReference: "BDN-2026-0729", fuelType: "VLSFO" }, created_at: ago(5 * DAY), updated_at: ago(5 * DAY) },
    { id: "doc-bdn-odyssey-fujairah", vessel_id: "vsl-odyssey", document_type: "bdn", status: "approved", source_channel: "EMAIL", title: "BDN — Odyssey (Fujairah, 2026-07-05)", filename: "bdn-odyssey-fujairah-2026-0705.pdf", mime_type: "application/pdf", file_size: 489_300, storage_path: "demo/bdns/bdn-odyssey-fujairah-2026-0705.pdf", metadata: { bdnReference: "BDN-2026-0705", fuelType: "HFO" }, created_at: ago(29 * DAY), updated_at: ago(29 * DAY) },
    { id: "doc-iapp-aurelia", vessel_id: "vsl-aurelia", document_type: "certificate", status: "approved", source_channel: "MANUAL", title: "IAPP Certificate — Aurelia", filename: "iapp-aurelia-2025.pdf", mime_type: "application/pdf", file_size: 268_100, storage_path: "demo/certificates/iapp-aurelia-2025.pdf", metadata: { certificateType: "IAPP" }, created_at: ago(50 * DAY), updated_at: ago(50 * DAY) },
    { id: "doc-mrv-atlas-2025", vessel_id: "vsl-atlas", document_type: "eu_mrv", status: "approved", source_channel: "MANUAL", title: "MRV Report — Atlas (2025)", filename: "mrv-atlas-2025.pdf", mime_type: "application/pdf", file_size: 1_204_000, storage_path: "demo/reports/mrv-atlas-2025.pdf", metadata: { reportType: "thetis_mrv", reportingYear: 2025 }, created_at: ago(20 * DAY), updated_at: ago(20 * DAY) },
    { id: "doc-corr-harbourmaster", vessel_id: "vsl-horizon", document_type: "correspondence", status: "archived", source_channel: "EMAIL", title: "Hamburg Harbourmaster — pre-arrival correspondence", filename: "hamburg-hm-2026-0729.eml", mime_type: "message/rfc822", file_size: 84_500, storage_path: "demo/correspondence/hamburg-hm-2026-0729.eml", metadata: {}, created_at: ago(5 * DAY), updated_at: ago(5 * DAY) },
  ];

  const reviewTasks: Array<Record<string, unknown>> = [
    { id: "rt-ocr-rotated", documentId: "ocr-doc-rotated-bdn",     assignedTo: DEMO_OWNER.email, status: "in_progress", priority: "high", dueAt: ahead(1 * DAY), reasonCode: "OCR_REVIEW_REQUIRED" },
    { id: "rt-ocr-blurred", documentId: "ocr-doc-blurred-certificate",     assignedTo: DEMO_OWNER.email, status: "pending", priority: "high", dueAt: ahead(2 * DAY), reasonCode: "OCR_REVIEW_REQUIRED" },
    { id: "rt-ocr-unreadable", documentId: "ocr-doc-unreadable-noon-report", assignedTo: null, status: "pending", priority: "urgent", dueAt: ahead(12 * HOUR), reasonCode: "OCR_REVIEW_REQUIRED" },
    { id: "rt-ocr-duplicate", documentId: "ocr-doc-duplicate-scan",     assignedTo: DEMO_OWNER.email, status: "pending", priority: "normal", dueAt: ahead(2 * DAY), reasonCode: "OCR_REVIEW_REQUIRED" },
    { id: "rt-ocr-wrongtype", documentId: "ocr-doc-wrong-type", assignedTo: null, status: "pending", priority: "high", dueAt: ahead(1 * DAY), reasonCode: "DOCUMENT_TYPE_MISMATCH" },
    { id: "rt-bdn-horizon", documentId: "doc-bdn-horizon-hamburg",     assignedTo: DEMO_OWNER.email, status: "in_progress", priority: "normal", dueAt: ahead(3 * DAY), reasonCode: "BDN_RECONCILIATION_PENDING" },
    { id: "rt-bdn-neptune", documentId: "doc-bdn-neptune-algeciras", assignedTo: null, status: "pending", priority: "high", dueAt: ahead(1 * DAY), reasonCode: "BDN_VESSEL_ASSIGNMENT" },
    { id: "rt-mrv-atlas", documentId: "doc-mrv-atlas-2025",     assignedTo: DEMO_OWNER.email, status: "completed", priority: "normal", completedAt: ago(2 * DAY), reviewNote: "Verified MRV 2025 figures; submitted to THETIS.", reasonCode: null },
    { id: "rt-ocr-damaged", documentId: "ocr-doc-damaged-scan", assignedTo: null, status: "pending", priority: "urgent", dueAt: ahead(6 * HOUR), reasonCode: "OCR_REVIEW_REQUIRED" },
  ].map((r) => ({
    id: r.id,
    document_id: r.documentId,
    assigned_to: r.assignedTo ?? null,
    status: r.status,
    priority: r.priority,
    due_at: r.dueAt ?? null,
    completed_at: r.completedAt ?? null,
    review_note: r.reviewNote ?? null,
    reason_code: r.reasonCode ?? null,
    created_at: ago(1 * DAY + (r.id.length % 5) * HOUR),
    updated_at: ago(1 * DAY + (r.id.length % 5) * HOUR),
  }));

  const certificates: Array<Record<string, unknown>> = [
    { id: "cert-aur-iapp", vesselId: "vsl-aurelia", certificateType: "IAPP", certificateNumber: "IAPP-2025-0811", authority: "DNV", classSociety: "DNV", issue: -150 * DAY, expiry: 215 * DAY, source: "MANUAL", validationStatus: "valid", reviewStatus: "NOT_REQUIRED", reviewRequired: false, blocking: false, version: 1, isCurrent: true },
    { id: "cert-aur-iocp", vesselId: "vsl-aurelia", certificateType: "IOPP", certificateNumber: "IOPP-2025-0812", authority: "DNV", classSociety: "DNV", issue: -150 * DAY, expiry: 215 * DAY, source: "MANUAL", validationStatus: "valid", reviewStatus: "NOT_REQUIRED", reviewRequired: false, blocking: false, version: 1, isCurrent: true },
    { id: "cert-aur-sse", vesselId: "vsl-aurelia", certificateType: "SSE", certificateNumber: "SSE-2026-0112", authority: "ClassNK", classSociety: "ClassNK", issue: -70 * DAY, expiry: 75 * DAY, source: "MANUAL", validationStatus: "valid", reviewStatus: "NOT_REQUIRED", reviewRequired: false, blocking: false, version: 1, isCurrent: true },
    { id: "cert-atl-iapp", vesselId: "vsl-atlas", certificateType: "IAPP", certificateNumber: "IAPP-2026-0203", authority: "LR", classSociety: "Lloyds Register", issue: -60 * DAY, expiry: 305 * DAY, source: "MANUAL", validationStatus: "valid", reviewStatus: "NOT_REQUIRED", reviewRequired: false, blocking: false, version: 1, isCurrent: true },
    { id: "cert-atl-iocp", vesselId: "vsl-atlas", certificateType: "IOPP", certificateNumber: "IOPP-2026-0204", authority: "LR", classSociety: "Lloyds Register", issue: -60 * DAY, expiry: 305 * DAY, source: "MANUAL", validationStatus: "valid", reviewStatus: "NOT_REQUIRED", reviewRequired: false, blocking: false, version: 1, isCurrent: true },
    { id: "cert-atl-smc", vesselId: "vsl-atlas", certificateType: "SMC", certificateNumber: "SMC-2024-1188", authority: "LR", classSociety: "Lloyds Register", issue: -400 * DAY, expiry: 20 * DAY, source: "MANUAL", validationStatus: "valid", reviewStatus: "NOT_REQUIRED", reviewRequired: false, blocking: false, version: 1, isCurrent: true },
    { id: "cert-hrz-iapp", vesselId: "vsl-horizon", certificateType: "IAPP", certificateNumber: "IAPP-2023-0917", authority: "Bureau Veritas", classSociety: "Bureau Veritas", issue: -700 * DAY, expiry: -5 * DAY, source: "MANUAL", validationStatus: "valid", reviewStatus: "NOT_REQUIRED", reviewRequired: false, blocking: true, version: 1, isCurrent: true },
    { id: "cert-hrz-iems", vesselId: "vsl-horizon", certificateType: "IEM", certificateNumber: "IEM-2025-0315", authority: "Bureau Veritas", classSociety: "Bureau Veritas", issue: -110 * DAY, expiry: 60 * DAY, source: "MANUAL", validationStatus: "valid", reviewStatus: "NOT_REQUIRED", reviewRequired: false, blocking: false, version: 1, isCurrent: true },
    { id: "cert-nep-iapp", vesselId: "vsl-neptune", certificateType: "IAPP", certificateNumber: "IAPP-2025-1142", authority: "RINA", classSociety: "RINA", issue: -95 * DAY, expiry: 50 * DAY, source: "MANUAL", validationStatus: "valid", reviewStatus: "NOT_REQUIRED", reviewRequired: false, blocking: false, version: 1, isCurrent: true },
    { id: "cert-nep-iocp", vesselId: "vsl-neptune", certificateType: "IOPP", certificateNumber: "IOPP-2024-0707", authority: "RINA", classSociety: "RINA", issue: -400 * DAY, expiry: 8 * DAY, source: "MANUAL", validationStatus: "valid", reviewStatus: "NOT_REQUIRED", reviewRequired: false, blocking: false, version: 1, isCurrent: true },
    { id: "cert-ody-iapp", vesselId: "vsl-odyssey", certificateType: "IAPP", certificateNumber: "IAPP-2025-1301", authority: "ClassNK", classSociety: "ClassNK", issue: -80 * DAY, expiry: 40 * DAY, source: "MANUAL", validationStatus: "valid", reviewStatus: "NOT_REQUIRED", reviewRequired: false, blocking: false, version: 1, isCurrent: true },
    { id: "cert-ody-sopa", vesselId: "vsl-odyssey", certificateType: "SoPA", certificateNumber: "SOPA-2025-0014", authority: "ClassNK", classSociety: "ClassNK", issue: -80 * DAY, expiry: 40 * DAY, source: "MANUAL", validationStatus: "valid", reviewStatus: "NOT_REQUIRED", reviewRequired: false, blocking: false, version: 1, isCurrent: true },
  ].map((c) => ({
    id: c.id,
    vessel_id: c.vesselId,
    imo: DEMO_VESSELS.find((v) => v.id === c.vesselId)?.imo ?? "0000000",
    document_id: null,
    certificate_type: c.certificateType,
    certificate_number: c.certificateNumber,
    issuing_authority: c.authority,
    class_society: c.classSociety,
    issue_date: iso(NOW + c.issue).slice(0, 10),
    expiry_date: iso(NOW + c.expiry).slice(0, 10),
    status: "VALID",
    source: c.source,
    validation_status: c.validationStatus,
    review_status: c.reviewStatus,
    review_required: c.reviewRequired,
    blocking: c.blocking,
    reason_code: null,
    confidence: 0.98,
    notes: null,
    version: c.version,
    supersedes_id: null,
    is_current: c.isCurrent,
    created_at: iso(NOW + c.issue),
    updated_at: ago(2 * DAY),
  }));

  const soxWatch: Array<Record<string, unknown>> = [
    { vesselId: "vsl-aurelia", status: "CLEAR", severity: "INFO", insideEca: true, ecaEffective: true, zoneState: "WITHIN", evidenceStatus: "CONFORMING", limitPct: 0.1, sulphurPct: 0.49, deliveryId: "fuel-aur-1", lastEntry: ago(14 * HOUR), reviewRequired: false },
    { vesselId: "vsl-atlas", status: "CLEAR", severity: "INFO", insideEca: true, ecaEffective: true, zoneState: "WITHIN", evidenceStatus: "CONFORMING", limitPct: 0.1, sulphurPct: 0.48, deliveryId: "fuel-atl-1", lastEntry: ago(20 * HOUR), reviewRequired: false },
    { vesselId: "vsl-horizon", status: "CLEAR", severity: "INFO", insideEca: false, ecaEffective: false, zoneState: "OUTSIDE", evidenceStatus: "CONFORMING", limitPct: 0.1, sulphurPct: 0.49, deliveryId: null, lastEntry: null, reviewRequired: false },
    { vesselId: "vsl-neptune", status: "WARNING", severity: "WARNING", insideEca: true, ecaEffective: true, zoneState: "WITHIN", evidenceStatus: "INSUFFICIENT_EVIDENCE", limitPct: 0.1, sulphurPct: 0.49, deliveryId: "fuel-nep-1", lastEntry: ago(30 * HOUR), reviewRequired: true },
    { vesselId: "vsl-odyssey", status: "CLEAR", severity: "INFO", insideEca: false, ecaEffective: false, zoneState: "OUTSIDE", evidenceStatus: "CONFORMING", limitPct: 0.1, sulphurPct: 0.49, deliveryId: "fuel-ody-1", lastEntry: null, reviewRequired: false },
  ].map((s) => ({
    vessel_id: s.vesselId,
    imo: DEMO_VESSELS.find((v) => v.id === s.vesselId)?.imo ?? "0000000",
    status: s.status,
    severity: s.severity,
    inside_eca: s.insideEca,
    eca_effective: s.ecaEffective,
    zone_state: s.zoneState,
    evidence_status: s.evidenceStatus,
    applicable_limit_pct: s.limitPct,
    sulphur_content_pct: s.sulphurPct,
    selected_delivery_id: s.deliveryId,
    last_entry_ts: s.lastEntry,
    last_exit_ts: null,
    latest_event_id: null,
    parameter_version: "1.0.0",
    geometry_version: "1.0.0",
    review_required: s.reviewRequired,
    last_evaluated_at: ago(0.5 * HOUR),
    updated_at: ago(0.5 * HOUR),
  }));

  const soxEvents: Array<Record<string, unknown>> = [
    { id: "sox-ev-aur-entry", vesselId: "vsl-aurelia", imo: "9074729", eventTs: ago(14 * HOUR), eventType: "ENTRY", zoneState: "ENTRY", watchStatus: "CLEAR", severity: "INFO", ruleId: "sox.inside_eca", ruleResult: { passed: true }, evidenceStatus: "CONFORMING", insideEca: true, ecaEffective: true, lat: 40.85, lng: 3.15, limitPct: 0.1, sulphurPct: 0.49, deliveryId: "fuel-aur-1" },
    { id: "sox-ev-aur-within", vesselId: "vsl-aurelia", imo: "9074729", eventTs: ago(6 * HOUR), eventType: "WITHIN", zoneState: "WITHIN", watchStatus: "CLEAR", severity: "INFO", ruleId: "sox.inside_eca", ruleResult: { passed: true }, evidenceStatus: "CONFORMING", insideEca: true, ecaEffective: true, lat: 41.6, lng: 5.9, limitPct: 0.1, sulphurPct: 0.49, deliveryId: "fuel-aur-1" },
    { id: "sox-ev-atl-entry", vesselId: "vsl-atlas", imo: "9432891", eventTs: ago(20 * HOUR), eventType: "ENTRY", zoneState: "ENTRY", watchStatus: "CLEAR", severity: "INFO", ruleId: "sox.inside_eca", ruleResult: { passed: true }, evidenceStatus: "CONFORMING", insideEca: true, ecaEffective: true, lat: 39.2, lng: 17.4, limitPct: 0.1, sulphurPct: 0.48, deliveryId: "fuel-atl-1" },
    { id: "sox-ev-nep-entry", vesselId: "vsl-neptune", imo: "9338490", eventTs: ago(30 * HOUR), eventType: "ENTRY", zoneState: "ENTRY", watchStatus: "WARNING", severity: "WARNING", ruleId: "sox.inside_eca", ruleResult: { passed: false, note: "Insufficient evidence to confirm compliant fuel on board." }, evidenceStatus: "INSUFFICIENT_EVIDENCE", insideEca: true, ecaEffective: true, lat: 36.5, lng: -3.4, limitPct: 0.1, sulphurPct: 0.49, deliveryId: "fuel-nep-1" },
  ].map((e) => ({
    id: e.id,
    vessel_id: e.vesselId,
    imo: e.imo,
    event_ts: e.eventTs,
    event_type: e.eventType,
    zone_state: e.zoneState,
    watch_status: e.watchStatus,
    severity: e.severity,
    rule_id: e.ruleId,
    rule_result: e.ruleResult,
    evidence_status: e.evidenceStatus,
    inside_eca: e.insideEca,
    eca_effective: e.ecaEffective,
    latitude: e.lat,
    longitude: e.lng,
    ais_position_id: null,
    applicable_limit_pct: e.limitPct,
    sulphur_content_pct: e.sulphurPct,
    selected_delivery_id: e.deliveryId,
    parameter_version: "1.0.0",
    geometry_version: "1.0.0",
    calculation_version: "1.0.0",
    details: { zoneCode: "MED_SOX_ECA" },
    dedup_key: `sox:${e.imo}:${e.eventType}:${e.eventTs}`,
    created_at: e.eventTs,
  }));

  // FuelEU 2025 + 2026 records (2026 in progress).
  const fueleuRecords = DEMO_VESSELS.map((v, i) => {
    const ghg2025 = 88.4 + (i % 3) * 1.7;
    const target2025 = Number((91.16 * 0.98).toFixed(2));
    return {
      id: `fueleu-${v.id}-2025`,
      vessel_id: v.id,
      reporting_year: 2025,
      calculation_version: "1.0.0",
      status: "FINAL",
      energy_input_mj: 1_250_000_000 + i * 220_000_000,
      total_wtw_emissions_gco2e: 88_400_000_000 + i * 15_000_000_000,
      ghg_intensity_gco2e_per_mj: Number(ghg2025.toFixed(2)),
      target_gco2e_per_mj: target2025,
      compliance_balance: Number((target2025 - ghg2025).toFixed(2)),
      surplus_or_deficit: ghg2025 <= target2025 ? "SURPLUS" : "DEFICIT",
      penalty_exposure_estimate: null,
      penalty_formula_version: null,
      biofuel_energy_mj: 42_000_000,
      fossil_energy_mj: 1_208_000_000,
      iscc_missing_flag: i % 2 === 0,
      iscc_missing_details: i % 2 === 0 ? { fuelTypes: ["B30"], note: "ISCC certificate not yet uploaded." } : null,
      ops_energy_mj: 9_800_000,
      ops_data_available: true,
      parameter_version: "2026.1",
      calculation_details: { engine: "deterministic", reportCount: 342, daysCovered: 355 },
      calculated_at: ago(15 * DAY),
      created_at: ago(15 * DAY),
      updated_at: ago(15 * DAY),
    };
  }).concat(
    DEMO_VESSELS.map((v, i) => ({
      id: `fueleu-${v.id}-2026`,
      vessel_id: v.id,
      reporting_year: 2026,
      calculation_version: "1.1.0",
      status: "PROVISIONAL",
      energy_input_mj: 640_000_000 + i * 110_000_000,
      total_wtw_emissions_gco2e: 44_800_000_000 + i * 7_500_000_000,
      ghg_intensity_gco2e_per_mj: Number((87.2 + (i % 2) * 1.1).toFixed(2)),
      target_gco2e_per_mj: Number((91.16 * 0.98).toFixed(2)),
      compliance_balance: Number((91.16 * 0.98 - (87.2 + (i % 2) * 1.1)).toFixed(2)),
      surplus_or_deficit: "SURPLUS",
      penalty_exposure_estimate: null,
      penalty_formula_version: null,
      biofuel_energy_mj: 21_000_000,
      fossil_energy_mj: 619_000_000,
      iscc_missing_flag: i === 1,
      iscc_missing_details: i === 1 ? { fuelTypes: ["B30"], note: "ISCC certificate pending." } : null,
      ops_energy_mj: 4_900_000,
      ops_data_available: true,
      parameter_version: "2026.2",
      calculation_details: { engine: "deterministic", reportCount: 176, daysCovered: 183, inProgress: true },
      calculated_at: ago(1 * DAY),
      created_at: ago(1 * DAY),
      updated_at: ago(1 * DAY),
    })),
  );

  const euEtsRecords = DEMO_VESSELS.map((v, i) => {
    const gt = v.grossTonnage;
    const covered = 41_500 + i * 12_000;
    return {
      id: `ets-${v.id}-2025`,
      vessel_id: v.id,
      reporting_year: 2025,
      calculation_version: "1.0.0",
      gt,
      ets_scope: "50%:2025",
      mrv_scope: "MRV:2025",
      total_ttw_co2_tonnes: 58_200 + i * 14_600,
      covered_co2_tonnes: covered,
      coverage_rate: 100,
      coverage_rate_version: "1.0.0",
      eua_obligation_tonnes: Number((covered * 0.5).toFixed(0)),
      eua_price_eur: 78.5,
      eua_price_available: true,
      estimated_cost_eur: Number((covered * 0.5 * 78.5).toFixed(0)),
      surrender_deadline: "2026-09-30T00:00:00.000Z",
      surrender_status: i % 3 === 0 ? "ON_TRACK" : "REVIEW",
      mrv_deadline: "2026-04-30T00:00:00.000Z",
      mrv_deadline_status: i % 2 === 0 ? "SUBMITTED" : "APPROACHING",
      parameter_version: "2026.1",
      calculation_details: { engine: "deterministic", allowancesHeld: Math.round(covered * 0.5 * 0.62) },
      calculated_at: ago(12 * DAY),
      created_at: ago(12 * DAY),
      updated_at: ago(12 * DAY),
    };
  });

  const mrvReports = [
    { id: "mrv-atlas-2025", vesselId: "vsl-atlas", status: "SUBMITTED", completeness: "COMPLETE", totalVoyages: 28, totalFuelMt: 9842, totalCo2: 30_200, checklistStatus: "PASSED" },
    { id: "mrv-aurelia-2025", vesselId: "vsl-aurelia", status: "VERIFIED", completeness: "COMPLETE", totalVoyages: 34, totalFuelMt: 7421, totalCo2: 22_850, checklistStatus: "PASSED" },
    { id: "mrv-neptune-2025", vesselId: "vsl-neptune", status: "DRAFT", completeness: "INCOMPLETE", totalVoyages: 21, totalFuelMt: 5102, totalCo2: 15_680, checklistStatus: "FAILED" },
  ].map((m) => ({
    id: m.id,
    vessel_id: m.vesselId,
    reporting_year: 2025,
    status: m.status,
    completeness_status: m.completeness,
    completeness_checks: [],
    blocking_issues: m.status === "DRAFT" ? [{ check: "voyage_coverage", detail: "6 voyages missing noon fuel data" }] : [],
    warnings: m.status === "DRAFT" ? ["Some ETA fields missing for 3 port calls"] : [],
    checklist_status: m.checklistStatus,
    checklist_details: {},
    export_format: m.status === "DRAFT" ? null : "XML",
    export_generated_at: m.status === "DRAFT" ? null : ago(14 * DAY),
    export_content_hash: m.status === "DRAFT" ? null : "sha256:demo",
    export_file_path: m.status === "DRAFT" ? null : `demo/reports/${m.id}.xml`,
    report_data: { monitoringMethodology: "F" },
    total_voyages: m.totalVoyages,
    total_fuel_mt: m.totalFuelMt,
    total_co2_tonnes: m.totalCo2,
    monitoring_plan_version: "1.0.0",
    methodology: "F",
    calculation_version: "1.0.0",
    parameter_version: "2026.1",
    ets_record_id: null,
    generated_at: m.status === "DRAFT" ? null : ago(14 * DAY),
    created_at: ago(14 * DAY),
    updated_at: ago(14 * DAY),
  }));

  const complianceReports = [
    { id: "cr-fueleu-fleet-2026", type: "fueleu", title: "FuelEU Maritime — Fleet 2026 (provisional)", year: 2026, status: "GENERATED", season: "2026 calendar" },
    { id: "cr-fueleu-atlas-2025", type: "fueleu", title: "FuelEU Maritime — Atlas 2025", year: 2025, status: "GENERATED", season: "2025 calendar" },
    { id: "cr-mrv-atlas-2025", type: "thetis_mrv", title: "THETIS-MRV — Atlas 2025", year: 2025, status: "GENERATED", season: "MRV 2025" },
    { id: "cr-mrv-aurelia-2025", type: "thetis_mrv", title: "THETIS-MRV — Aurelia 2025", year: 2025, status: "GENERATED", season: "MRV 2025" },
    { id: "cr-mrv-neptune-2025", type: "thetis_mrv", title: "THETIS-MRV — Neptune 2025", year: 2025, status: "FAILED", season: "MRV 2025" },
    { id: "cr-ets-fleet-2025", type: "fleet_summary", title: "EU ETS — Fleet surrender plan 2025", year: 2025, status: "DRAFT", season: "ETS 2025" },
    { id: "cr-green-fleet-2026", type: "green_zone", title: "Green Zone — fleet exposure Q2 2026", year: 2026, status: "DRAFT", season: "Q2 2026" },
    { id: "cr-esg-2025", type: "esg_package", title: "ESG package — FY2025", year: 2025, status: "DRAFT", season: "FY2025" },
  ].map((c, i) => ({
    id: c.id,
    report_type: c.type,
    vessel_id: null,
    vessel_ids: [],
    title: c.title,
    reporting_year: c.year,
    season: c.season,
    status: c.status,
    calculation_version: "1.0.0",
    source_data_refs: { fuelEuRecords: 5, mrvReports: 3 },
    storage_path: c.status === "GENERATED" ? `demo/reports/${c.id}.json` : null,
    file_size: c.status === "GENERATED" ? 842_000 + i * 13_000 : null,
    checksum: c.status === "GENERATED" ? `sha256:${c.id}` : null,
    content: { summary: `${c.title} — deterministic demo package` },
    generated_at: c.status === "GENERATED" ? ago((i + 3) * DAY) : c.status === "FAILED" ? ago(2 * DAY) : null,
    generated_by: "demo-operator",
    submitted_at: null,
    verified_at: null,
    verification_notes: null,
    metadata: {},
    created_at: ago((i + 5) * DAY),
    updated_at: ago((i + 5) * DAY),
  }));

  const verifierPackages = [
    { id: "vp-atlas-2025", vesselId: "vsl-atlas", year: 2025, status: "GENERATED", title: "Atlas — verifier package 2025", version: "1.0.0" },
    { id: "vp-aurelia-2025", vesselId: "vsl-aurelia", year: 2025, status: "GENERATED", title: "Aurelia — verifier package 2025", version: "1.0.0" },
    { id: "vp-neptune-2025", vesselId: "vsl-neptune", year: 2025, status: "FAILED", title: "Neptune — verifier package 2025", version: "1.0.0" },
  ].map((p, i) => ({
    id: p.id,
    vessel_id: p.vesselId,
    reporting_year: p.year,
    status: p.status,
    title: p.title,
    manifest: { fuelDeliveries: 9, noonReports: 14, mrvReports: 3 },
    storage_path: p.status === "GENERATED" ? `demo/packages/${p.id}.zip` : null,
    file_size: p.status === "GENERATED" ? 4_210_000 + i * 340_000 : null,
    checksum: p.status === "GENERATED" ? `sha256:${p.id}` : null,
    package_version: p.version,
    validation_result: p.status === "GENERATED" ? { passed: true, score: 100 } : { passed: false, score: 62, blockingIssues: ["voyage_coverage"] },
    generated_at: p.status === "GENERATED" ? ago((i + 4) * DAY) : null,
    generated_by: "demo-operator",
    created_at: ago((i + 6) * DAY),
    updated_at: ago((i + 6) * DAY),
  }));

  const zones = [
    {
      id: "zone-med-sox-eca",
      code: "MED_SOX_ECA",
      name: "Mediterranean Sea SOx Emission Control Area",
      category: "ECA_SOX",
      geometry_type: "POLYGON",
      geometry_coordinates: [[[-5.0, 35.0], [5.0, 35.0], [5.0, 46.0], [30.0, 46.0], [30.0, 36.0], [36.0, 36.0], [36.0, 32.0], [20.0, 30.0], [10.0, 30.0], [-5.0, 35.0], [-5.0, 35.0]]],
      description: "Mediterranean Sea SOx Emission Control Area effective 1 May 2025 (MARPOL Annex VI).",
      regulation_reference: "MARPOL Annex VI Reg. 14",
      geometry_version: "1.0.0",
      jurisdiction: "IMO",
      effective_from: "2025-05-01T00:00:00.000Z",
      effective_until: null,
      is_active: true,
      created_at: ago(120 * DAY),
      updated_at: ago(120 * DAY),
    },
    {
      id: "zone-eu-port-control",
      code: "EU_PORT_CONTROL",
      name: "EU Port / EEA Jurisdiction",
      category: "PORT_CONTROL",
      geometry_type: "MULTIPOLYGON",
      geometry_coordinates: [[[[-10.0, 36.0], [-10.0, 42.0], [-10.0, 44.0], [-9.0, 46.0], [-8.0, 48.0], [-6.0, 49.0], [-4.0, 50.0], [-2.0, 50.5], [0.0, 50.0], [2.0, 50.5], [4.0, 51.5], [6.0, 54.5], [8.0, 55.0], [12.0, 56.0], [18.0, 57.5], [24.0, 57.0], [24.0, 56.0], [22.0, 55.5], [20.0, 54.5], [18.0, 54.0], [15.0, 54.5], [12.0, 54.5], [10.0, 54.0], [8.0, 53.5], [5.0, 52.0], [0.0, 50.0]]]],
      description: "EU/EEA port jurisdiction for EU ETS and FuelEU scope.",
      regulation_reference: "EU ETS Directive (EU) 2023/959",
      geometry_version: "1.0.0",
      jurisdiction: "European Union",
      effective_from: "2024-01-01T00:00:00.000Z",
      effective_until: null,
      is_active: true,
      created_at: ago(150 * DAY),
      updated_at: ago(150 * DAY),
    },
  ];

  const zoneEvents: Array<Record<string, unknown>> = [
    { id: "ze-aur-1", vesselId: "vsl-aurelia", zoneId: "zone-med-sox-eca", eventType: "ENTRY", detectedAt: ago(14 * HOUR), entryTs: ago(14 * HOUR), durationMinutes: null, lat: 40.85, lng: 3.15, details: { fromPort: "Valencia" } },
    { id: "ze-aur-2", vesselId: "vsl-aurelia", zoneId: "zone-med-sox-eca", eventType: "WITHIN", detectedAt: ago(6 * HOUR), entryTs: ago(14 * HOUR), durationMinutes: 480, lat: 41.6, lng: 5.9, details: {} },
    { id: "ze-atl-1", vesselId: "vsl-atlas", zoneId: "zone-med-sox-eca", eventType: "ENTRY", detectedAt: ago(20 * HOUR), entryTs: ago(20 * HOUR), durationMinutes: null, lat: 39.2, lng: 17.4, details: { fromPort: "Piraeus" } },
    { id: "ze-nep-1", vesselId: "vsl-neptune", zoneId: "zone-med-sox-eca", eventType: "ENTRY", detectedAt: ago(30 * HOUR), entryTs: ago(30 * HOUR), durationMinutes: null, lat: 36.5, lng: -3.4, details: { fromPort: "Algeciras" } },
    { id: "ze-nep-2", vesselId: "vsl-neptune", zoneId: "zone-eu-port-control", eventType: "ALERT", detectedAt: ago(30 * HOUR), entryTs: null, durationMinutes: null, lat: 36.5, lng: -3.4, details: { severity: "WARNING", note: "Insufficient SOx evidence on entry." } },
  ].map((e) => ({
    id: e.id,
    vessel_id: e.vesselId,
    zone_id: e.zoneId,
    event_type: e.eventType,
    ais_position_id: null,
    detected_at: e.detectedAt,
    entry_ts: e.entryTs,
    exit_ts: null,
    duration_minutes: e.durationMinutes,
    coordinates: e.lat !== undefined ? { lat: e.lat, lng: e.lng } : null,
    details: e.details,
    calculation_version: "1.0.0",
    created_at: e.detectedAt,
  }));

  const portCalls: Array<Record<string, unknown>> = [
    { id: "pc-aur-val", vesselId: "vsl-aurelia", voyageId: "voy-aur-2", portName: "Valencia", portId: "esp_vlc", portCountry: "Spain", portLat: 39.45, portLng: -0.32, arrTs: ago(30 * HOUR), depTs: ago(30 * HOUR) },
    { id: "pc-aur-pir", vesselId: "vsl-aurelia", voyageId: "voy-aur-1", portName: "Piraeus", portId: "grc_pir", portCountry: "Greece", portLat: 37.94, portLng: 23.62, arrTs: ago(9 * DAY), depTs: ago(9 * DAY) },
    { id: "pc-atl-pir", vesselId: "vsl-atlas", voyageId: "voy-atl-2", portName: "Piraeus", portId: "grc_pir", portCountry: "Greece", portLat: 37.94, portLng: 23.62, arrTs: ago(48 * HOUR), depTs: ago(48 * HOUR) },
    { id: "pc-atl-rtm", vesselId: "vsl-atlas", voyageId: "voy-atl-1", portName: "Rotterdam", portId: "nld_rtm", portCountry: "Netherlands", portLat: 51.95, portLng: 4.12, arrTs: ago(12 * DAY), depTs: ago(12 * DAY) },
    { id: "pc-hrz-rtm", vesselId: "vsl-horizon", voyageId: "voy-hrz-1", portName: "Rotterdam", portId: "nld_rtm", portCountry: "Netherlands", portLat: 51.95, portLng: 4.12, arrTs: ago(6 * HOUR), depTs: ago(6 * HOUR) },
    { id: "pc-nep-alg", vesselId: "vsl-neptune", voyageId: "voy-nep-1", portName: "Algeciras", portId: "esp_alg", portCountry: "Spain", portLat: 36.13, portLng: -5.44, arrTs: ago(3 * DAY), depTs: ago(3 * DAY) },
    { id: "pc-ody-sin", vesselId: "vsl-odyssey", voyageId: "voy-ody-1", portName: "Singapore", portId: "sgp_sin", portCountry: "Singapore", portLat: 1.29, portLng: 103.85, arrTs: ago(5 * DAY), depTs: ago(5 * DAY) },
  ].map((p) => ({
    id: p.id,
    vessel_id: p.vesselId,
    voyage_id: p.voyageId,
    port_name: p.portName,
    port_id: p.portId,
    port_country: p.portCountry,
    port_latitude: p.portLat,
    port_longitude: p.portLng,
    arr_ts: p.arrTs,
    dep_ts: p.depTs,
    is_mock: true,
    source: "mock",
    source_fetched_at: p.arrTs,
    created_at: p.arrTs,
  }));

  const notifications: Array<Record<string, unknown>> = [
    { id: "ntf-1", type: "sox_eca_no_evidence", severity: "CRITICAL", vesselId: "vsl-neptune", title: "SOx watch — evidence required", message: "Neptune entered the Med SOx ECA with insufficient compliant-fuel evidence on file.", payload: { imo: "9338490", zone: "MED_SOX_ECA" } },
    { id: "ntf-2", type: "certificate_expired", severity: "HIGH", vesselId: "vsl-horizon", title: "IAPP certificate expired", message: "IAPP for Horizon (IAPP-2023-0917) expired 5 days ago. No renewal on file.", payload: { imo: "9587420" } },
    { id: "ntf-3", type: "certificate_expiring", severity: "HIGH", vesselId: "vsl-neptune", title: "IOPP expiring in 8 days", message: "IOPP for Neptune expires in 8 days. Book an outport survey.", payload: { imo: "9338490" } },
    { id: "ntf-4", type: "certificate_expiring", severity: "MEDIUM", vesselId: "vsl-atlas", title: "SMC expiring in 20 days", message: "SMC for Atlas expires in 20 days.", payload: { imo: "9432891" } },
    { id: "ntf-5", type: "certificate_expiring", severity: "MEDIUM", vesselId: "vsl-odyssey", title: "IAPP expiring in 40 days", message: "IAPP for Odyssey expires in 40 days.", payload: { imo: "9712215" } },
    { id: "ntf-6", type: "review_task_created", severity: "HIGH", vesselId: null, title: "Review needed — Noon report (unreadable)", message: "OCR quality VERY_LOW: ocr-doc-unreadable-noon-report requires re-scan.", payload: { documentId: "ocr-doc-unreadable-noon-report" } },
    { id: "ntf-7", type: "review_task_created", severity: "HIGH", vesselId: null, title: "Review needed — EU ETS report (damaged)", message: "OCR quality VERY_LOW: ocr-doc-damaged-scan requires re-scan.", payload: { documentId: "ocr-doc-damaged-scan" } },
    { id: "ntf-8", type: "review_task_created", severity: "MEDIUM", vesselId: null, title: "Review needed — rotated BDN", message: "ocr-doc-rotated-bdn scanned rotated 90°; fields low-confidence.", payload: { documentId: "ocr-doc-rotated-bdn" } },
    { id: "ntf-9", type: "iscc_certificate_missing", severity: "HIGH", vesselId: "vsl-atlas", title: "FuelEU — ISCC certificate missing", message: "B30 biofuel energy for Atlas 2026 lacks an ISCC certificate for full credit.", payload: { year: 2026 } },
    { id: "ntf-10", type: "fueleu_surplus_reported", severity: "INFO", vesselId: "vsl-aurelia", title: "FuelEU 2026 provisional surplus", message: "Aurelia is tracking a 2.7 gCO2e/MJ surplus against the 2026 target.", payload: { year: 2026 } },
    { id: "ntf-11", type: "mrv_report_incomplete", severity: "MEDIUM", vesselId: "vsl-neptune", title: "EU ETS — MRV 2025 incomplete", message: "Neptune MRV 2025 draft is missing 6 voyages of noon fuel data.", payload: { year: 2025 } },
    { id: "ntf-12", type: "ets_deadline_warning", severity: "MEDIUM", vesselId: "vsl-odyssey", title: "EU ETS — surrender plan in review", message: "Allowance budget review open for Odyssey 2025.", payload: { year: 2025 } },
    { id: "ntf-13", type: "bdn_review_required", severity: "MEDIUM", vesselId: "vsl-neptune", title: "BDN awaiting vessel assignment", message: "BDN-2026-0731 (Algeciras) could not be reconciled to a voyage.", payload: { documentId: "doc-bdn-neptune-algeciras" } },
    { id: "ntf-14", type: "bdn_auto_accepted", severity: "INFO", vesselId: "vsl-horizon", title: "BDN reconciled", message: "BDN-2026-0727 reconciled to Rotterdam→Hamburg.", payload: { documentId: "doc-bdn-horizon-rotterdam" } },
    { id: "ntf-15", type: "noon_report_received", severity: "INFO", vesselId: "vsl-odyssey", title: "Noon report received", message: "Odyssey filed its noon report; consumption 24.8 t.", payload: { reportDate: "2026-08-03" } },
    { id: "ntf-16", type: "noon_report_received", severity: "INFO", vesselId: "vsl-aurelia", title: "Noon report received", message: "Aurelia filed its noon report; consumption 18.6 t.", payload: {} },
    { id: "ntf-17", type: "sox_eca_warning", severity: "INFO", vesselId: "vsl-atlas", title: "Atlas entered Med SOx ECA", message: "Detected entry at 39.20°N 17.40°E; sulphur on board 0.48%.", payload: { zone: "MED_SOX_ECA" } },
    { id: "ntf-18", type: "sox_eca_warning", severity: "INFO", vesselId: "vsl-aurelia", title: "Aurelia entered Med SOx ECA", message: "Detected entry at 40.85°N 3.15°E; sulphur on board 0.49%.", payload: { zone: "MED_SOX_ECA" } },
    { id: "ntf-19", type: "system_notice", severity: "INFO", vesselId: null, title: "Data synchronized", message: "Fleet, compliance, and document records are up to date across the workspace.", payload: {} },
    { id: "ntf-20", type: "system_notice", severity: "MEDIUM", vesselId: null, title: "Email ingestion queue clear", message: "All queued email attachments processed in the last 24h. 6 documents are awaiting OCR review.", payload: {} },
  ].map((n, i) => ({
    id: n.id,
    recipient_id: "default",
    notification_type: n.type,
    severity: n.severity,
    vessel_id: n.vesselId,
    organization_id: orgId,
    title: n.title,
    message: n.message,
    payload: n.payload,
    is_read: i % 3 === 0,
    read_at: i % 3 === 0 ? ago((i % 7) * HOUR) : null,
    source_event: null,
    source_id: n.payload?.documentId ?? n.payload?.imo ?? null,
    created_at: ago((i % 10 + 1) * 3 * HOUR),
  }));

  const fuelTypes = [
    ["hfo_380", "HFO 380", "residual", 3.114, 0.02, 0.002, 991.0, true],
    ["hfo_180", "HFO 180", "residual", 3.114, 0.02, 0.0018, 985.0, true],
    ["hfo", "HFO (general)", "residual", 3.114, 0.02, 0.0018, 988.0, true],
    ["rmg_380", "RMG 380", "residual", 3.114, 0.02, 0.002, 991.0, true],
    ["rmk_380", "RMK 380", "residual", 3.114, 0.02, 0.002, 991.0, true],
    ["vlsfo", "VLSFO", "residual", 3.151, 0.005, 0.001, 920.0, true],
    ["ulfso", "ULSFO", "residual", 3.151, 0.001, 0.0008, 900.0, true],
    ["lsmgo", "LSMGO", "distillate", 3.206, 0.001, 0.0005, 890.0, true],
    ["mgo", "MGO", "distillate", 3.206, 0.01, 0.0005, 890.0, true],
    ["mdo", "MDO", "distillate", 3.206, 0.01, 0.0005, 895.0, true],
    ["lng", "LNG", "lng", 2.75, 0.0, 0.0, 460.0, false],
    ["lpg", "LPG", "lpg", 3.0, 0.0, 0.0, 540.0, false],
    ["methanol", "Methanol", "methanol", 1.375, 0.0, 0.0, 793.0, false],
    ["biodiesel", "Biodiesel (B100)", "biofuel", 2.85, 0.001, 0.0003, 880.0, true],
    ["b30", "B30 (30% bio)", "residual", 3.061, 0.004, 0.0008, 910.0, true],
    ["hydrogen", "Hydrogen", "hydrogen", 0.0, 0.0, 0.0, 0.0, false],
    ["ammonia", "Ammonia", "ammonia", 0.0, 0.0, 0.0, 680.0, false],
  ].map((f) => ({
    id: f[0] as string,
    display_name: f[1] as string,
    category: f[2] as string,
    description: null,
    co2_factor: f[3] as number,
    sox_factor: f[4] as number,
    pm_factor: f[5] as number,
    density_default: f[6] as number,
    is_drop_in: f[7] as boolean,
    created_at: nowIso,
  }));

  const assistantConversations = [
    { id: "conv-1", userId: "user-001", title: "FuelEU 2025 compliance gap", modelId: "gpt-4o-mini", promptVersion: "1.0.0" },
    { id: "conv-2", userId: "user-001", title: "EU ETS surrender deadline tracking", modelId: "gpt-4o-mini", promptVersion: "1.0.0" },
    { id: "conv-3", userId: "user-001", title: "Med SOx ECA fuel switch plan", modelId: "gpt-4o-mini", promptVersion: "1.0.0" },
  ].map((c, i) => ({
    id: c.id,
    user_id: c.userId,
    organization_id: orgId,
    title: c.title,
    model_id: c.modelId,
    prompt_version: c.promptVersion,
    status: "ACTIVE",
    metadata: {},
    created_at: ago((i + 1) * 2 * DAY),
    updated_at: ago(3 * HOUR),
  }));

  const assistantMessages = [
    { id: "msg-1-1", conversationId: "conv-1", role: "user", content: "Which vessels are off-target for FuelEU 2026 and by how much?", citations: [], metadata: {} },
    { id: "msg-1-2", conversationId: "conv-1", role: "assistant", content: "Atlas is tracking a 1.6 gCO2e/MJ surplus against the 2026 target (91.16 × 0.98); the rest of the fleet is on track. The ISCC gap on Atlas B30 energy needs closure to keep the credit.", citations: [{ source: "fuel_eu_records", vesselId: "vsl-atlas", year: 2026 }], metadata: {} },
    { id: "msg-2-1", conversationId: "conv-2", role: "user", content: "Summarise our EU ETS surrender position for 2025.", citations: [], metadata: {} },
    { id: "msg-2-2", conversationId: "conv-2", role: "assistant", content: "Fleet obligation ≈ 116,400 EUAs at €78.50 ≈ €9.1M. Neptune's MRV 2025 draft is incomplete and its surrender plan is flagged for review.", citations: [{ source: "eu_ets_records", year: 2025 }], metadata: {} },
    { id: "msg-3-1", conversationId: "conv-3", role: "user", content: "What should Neptune switch to before entering the Med SOx ECA?", citations: [], metadata: {} },
    { id: "msg-3-2", conversationId: "conv-3", role: "assistant", content: "Neptune should burn VLSFO (≤0.10% sulphur) inside the ECA. BDN-2026-0731 from Algeciras is pending assignment — reconcile it to the voyage and the SOx watch clears.", citations: [{ source: "sox_watch_state", vesselId: "vsl-neptune" }], metadata: {} },
  ].map((m) => ({
    id: m.id,
    conversation_id: m.conversationId,
    role: m.role,
    content: m.content,
    tool_call_id: null,
    tool_name: null,
    tool_input: null,
    tool_output: null,
    tool_status: null,
    citations: m.citations,
    metadata: m.metadata,
    created_at: ago(2 * HOUR),
  }));

  const knowledgeDocuments = [
    { id: "kd-fueleu", source: "fueleu_regulation", regulation: "FuelEU", title: "FuelEU Maritime Regulation (EU) 2023/1805", articleSection: "Art. 4–9", version: "2023", content: "GHG intensity targets for maritime fuels from 2025. Penalties apply for non-compliance, with a reward-and-penalty mechanism." },
    { id: "kd-ets", source: "eu_ets_directive", regulation: "EU_ETS", title: "EU ETS — Maritime Directive (EU) 2023/959", articleSection: "Art. 3ga", version: "2024", content: "Shipping included in EU ETS from 2024; 40% of verified emissions covered in 2024, 70% in 2025, 100% from 2026." },
    { id: "kd-mrv", source: "thetis_mrv_guidance", regulation: "THETIS_MRV", title: "THETIS-MRV reporting guidance", articleSection: "Section 2", version: "2025", content: "Verified MRV reports must be submitted by 30 April; completeness checks cover voyage coverage and fuel data." },
    { id: "kd-marpol", source: "marpol_annex_vi", regulation: "MARPOL", title: "MARPOL Annex VI — Reg. 14 SOx", articleSection: "Reg. 14", version: "2025", content: "Mediterranean SOx ECA effective 1 May 2025 with a 0.10% sulphur limit inside the zone." },
  ].map((k) => ({
    id: k.id,
    source: k.source,
    regulation: k.regulation,
    title: k.title,
    article_section: k.articleSection,
    effective_date: "2025-01-01",
    version: k.version,
    content: k.content,
    metadata: {},
    created_at: ago(90 * DAY),
    updated_at: ago(90 * DAY),
  }));

  return {
    organizations: [
      {
        id: orgId,
        name: DEMO_ORG.name,
        company_logo_url: null,
        country: "GR",
        imo_company_number: "1234567",
        address: "1 Piraeus Avenue, Athens, Greece",
        billing_email: "billing@poseidonledger.com",
        support_email: "support@poseidonledger.com",
        created_at: nowIso,
        updated_at: nowIso,
      },
    ],
    user_roles: ROLES.map((role) => ({
      code: role.code,
      label: role.label,
      description: role.description,
      permissions: [...role.permissions],
      rank: role.rank,
    })),
    organization_users: [
      {
        id: ownerId,
        organization_id: orgId,
        email: DEMO_OWNER.email,
        full_name: DEMO_OWNER.fullName,
        avatar_url: null,
        password_hash: hashPassword(DEMO_OWNER.password),
        role: "owner",
        status: "active",
        last_login_at: ago(0.5 * HOUR),
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: "user-nikos",
        organization_id: orgId,
        email: "nikos@poseidonledger.com",
        full_name: "Nikos Papadakis",
        avatar_url: null,
        password_hash: hashPassword("member1234"),
        role: "member",
        status: "active",
        last_login_at: ago(3 * DAY),
        created_at: nowIso,
        updated_at: nowIso,
      },
    ],
    organization_settings: [
      {
        id: "org-settings-1",
        organization_id: orgId,
        default_timezone: "UTC",
        default_reporting_year: 2026,
        language: "en",
        appearance: { theme: "dark", accent: "teal", sidebarDensity: "compact", tableDensity: "compact", gridView: "list" },
        notification_preferences: { emails: true, complianceAlerts: true, certificateExpiry: true, fuelAlerts: true, noonReport: true, assistantDigests: true, systemAnnouncements: true },
        created_at: nowIso,
        updated_at: nowIso,
      },
    ],
    integration_credentials: [
      { id: "cred-mt", organization_id: orgId, provider: "marinetraffic", status: "CONNECTED", encrypted_config: { mock: true }, configured_at: ago(10 * DAY), created_at: nowIso, updated_at: ago(10 * DAY) },
      { id: "cred-gdoc", organization_id: orgId, provider: "google_docai", status: "CONNECTED", encrypted_config: { mock: true }, configured_at: ago(10 * DAY), created_at: nowIso, updated_at: ago(10 * DAY) },
      { id: "cred-openai", organization_id: orgId, provider: "openai", status: "CONNECTED", encrypted_config: { mock: true }, configured_at: ago(10 * DAY), created_at: nowIso, updated_at: ago(10 * DAY) },
      { id: "cred-resend", organization_id: orgId, provider: "resend", status: "CONNECTED", encrypted_config: { mock: true }, configured_at: ago(10 * DAY), created_at: nowIso, updated_at: ago(10 * DAY) },
      { id: "cred-ais", organization_id: orgId, provider: "ais", status: "CONNECTED", encrypted_config: { mock: true }, configured_at: ago(10 * DAY), created_at: nowIso, updated_at: ago(10 * DAY) },
    ],
    vessels,
    voyages,
    ais_positions: aisPositions,
    vessel_tracks: [],
    noon_reports: noonReports,
    fuel_types: fuelTypes,
    fuel_deliveries: fuelDeliveries,
    fuel_eu_records: fueleuRecords,
    eu_ets_records: euEtsRecords,
    mrv_reports: mrvReports,
    compliance_reports: complianceReports,
    verifier_packages: verifierPackages,
    environmental_zones: zones,
    zone_events: zoneEvents,
    port_calls: portCalls,
    sox_watch_state: soxWatch,
    sox_compliance_events: soxEvents,
    certificate_registry: certificates,
    documents,
    review_tasks: reviewTasks,
    notifications,
    notification_preferences: [
      { id: "pref-default", recipient_id: "default", notification_type: null, enabled: true, email_enabled: true, in_app_enabled: true, created_at: nowIso, updated_at: nowIso },
    ],
    assistant_conversations: assistantConversations,
    assistant_messages: assistantMessages,
    knowledge_documents: knowledgeDocuments,
  };
}
