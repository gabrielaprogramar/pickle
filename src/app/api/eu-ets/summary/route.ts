import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { apiSuccess, mapErrorResponse } from "@/app/api/_lib/http";

export interface EtsVesselRow {
  readonly vesselId: string;
  readonly vesselName: string;
  readonly imo: string;
  readonly reportingYear: number;
  readonly gt: number | null;
  readonly etsScope: string;
  readonly totalTtwCo2Tonnes: number;
  readonly coveredCo2Tonnes: number;
  readonly coverageRate: number;
  readonly euaObligationTonnes: number;
  readonly euaPriceEur: number | null;
  readonly estimatedCostEur: number | null;
  readonly allowancesHeld: number | null;
  readonly allowanceBalance: number | null;
  readonly surrenderDeadline: string | null;
  readonly surrenderStatus: string | null;
  readonly mrvDeadline: string | null;
  readonly mrvDeadlineStatus: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EtsFleetTotals {
  readonly totalVesselsWithRecords: number;
  readonly totalTtwCo2Tonnes: number;
  readonly totalCoveredCo2Tonnes: number;
  readonly totalEuaObligationTonnes: number;
  readonly totalEstimatedCostEur: number;
  readonly totalAllowancesHeld: number | null;
  readonly fleetAllowanceBalance: number | null;
  readonly euaPriceEur: number | null;
  readonly surrenderDeadlines: Array<{
    readonly type: string;
    readonly month: number;
    readonly day: number;
    readonly label: string;
  }>;
}

export interface EtsSummary {
  readonly fleet: EtsFleetTotals;
  readonly vessels: ReadonlyArray<EtsVesselRow>;
}

export async function GET(_request: NextRequest) {
  try {
    const client = getSupabaseClient();

    const { data: vessels, error: vesselsError } = await client.from("vessels").select("*");
    if (vesselsError) throw vesselsError;

    const { data: records, error: recordsError } = await client.from("eu_ets_records").select("*");
    if (recordsError) throw recordsError;

    const vesselById = new Map(
      (vessels ?? []).map((v) => [v.id as string, v]),
    );

    const rows: EtsVesselRow[] = (records ?? [])
      .map((r) => {
        const vessel = vesselById.get(r.vessel_id as string);
        const details = (r.calculation_details as Record<string, unknown> | null) ?? {};
        const held = typeof details["allowancesHeld"] === "number" ? (details["allowancesHeld"] as number) : null;
        const obligation = Number(r.eua_obligation_tonnes ?? 0);
        return {
          vesselId: r.vessel_id as string,
          vesselName: (vessel?.name as string | undefined) ?? (r.vessel_id as string),
          imo: (vessel?.imo as string | undefined) ?? "—",
          reportingYear: Number(r.reporting_year),
          gt: Number(r.gt) || null,
          etsScope: String(r.ets_scope ?? ""),
          totalTtwCo2Tonnes: Number(r.total_ttw_co2_tonnes ?? 0),
          coveredCo2Tonnes: Number(r.covered_co2_tonnes ?? 0),
          coverageRate: Number(r.coverage_rate ?? 0),
          euaObligationTonnes: obligation,
          euaPriceEur: r.eua_price_eur === null || r.eua_price_eur === undefined ? null : Number(r.eua_price_eur),
          estimatedCostEur: r.estimated_cost_eur === null || r.estimated_cost_eur === undefined ? null : Number(r.estimated_cost_eur),
          allowancesHeld: held,
          allowanceBalance: held === null ? null : held - obligation,
          surrenderDeadline: (r.surrender_deadline as string | null) ?? null,
          surrenderStatus: (r.surrender_status as string | null) ?? null,
          mrvDeadline: (r.mrv_deadline as string | null) ?? null,
          mrvDeadlineStatus: (r.mrv_deadline_status as string | null) ?? null,
          createdAt: (r.created_at as string) ?? "",
          updatedAt: (r.updated_at as string) ?? "",
        };
      })
      .sort(
        (a, b) =>
          a.vesselName.localeCompare(b.vesselName) || a.reportingYear - b.reportingYear,
      );

    const hasHeld = rows.some((r) => r.allowancesHeld !== null);

    const fleet: EtsFleetTotals = {
      totalVesselsWithRecords: rows.length,
      totalTtwCo2Tonnes: rows.reduce((acc, r) => acc + r.totalTtwCo2Tonnes, 0),
      totalCoveredCo2Tonnes: rows.reduce((acc, r) => acc + r.coveredCo2Tonnes, 0),
      totalEuaObligationTonnes: rows.reduce((acc, r) => acc + r.euaObligationTonnes, 0),
      totalEstimatedCostEur: rows.reduce((acc, r) => acc + (r.estimatedCostEur ?? 0), 0),
      totalAllowancesHeld:
        hasHeld
          ? rows
              .filter((r) => r.allowancesHeld !== null)
              .reduce((acc, r) => acc + (r.allowancesHeld ?? 0), 0)
          : null,
      fleetAllowanceBalance: null,
      euaPriceEur: rows.find((r) => r.euaPriceEur !== null)?.euaPriceEur ?? null,
      surrenderDeadlines: [
        { type: "surrender", month: 9, day: 30, label: "EUA Surrender" },
        { type: "mrv_reporting", month: 3, day: 31, label: "MRV Annual Report" },
      ],
    };

    const fleetAllowanceBalance =
      hasHeld && fleet.totalAllowancesHeld !== null
        ? fleet.totalAllowancesHeld - fleet.totalEuaObligationTonnes
        : null;

    return apiSuccess<EtsSummary>({ fleet: { ...fleet, fleetAllowanceBalance }, vessels: rows });
  } catch (err) {
    return mapErrorResponse(err);
  }
}
