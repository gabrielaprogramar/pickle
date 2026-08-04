import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { apiSuccess, mapErrorResponse } from "@/app/api/_lib/http";

export interface GhgPoint {
  readonly ghgIntensity: number;
  readonly target: number;
  readonly balance: number;
  readonly surplusOrDeficit: string;
}

export interface AnalyticsSummary {
  readonly fleet: {
    readonly totalVessels: number;
    readonly fuelDeliveries: number;
    readonly fuelDeliveriesPending: number;
  };
  readonly ghg: Array<{
    readonly vesselId: string;
    readonly vesselName: string;
    readonly y2025: GhgPoint;
    readonly y2026: GhgPoint;
  }>;
  readonly balance: Array<{
    readonly vesselId: string;
    readonly vesselName: string;
    readonly year: number;
    readonly balance: number;
    readonly surplusOrDeficit: string;
  }>;
  readonly byFuelType: Array<{ readonly fuelType: string; readonly quantityMt: number }>;
  readonly byMonth: Array<{ readonly month: string; readonly quantityMt: number }>;
}

export async function GET(_request: NextRequest) {
  try {
    const client = getSupabaseClient();

    const { data: vessels, error: vesselsError } = await client.from("vessels").select("*");
    if (vesselsError) throw vesselsError;
    const nameById = new Map((vessels ?? []).map((v) => [v.id as string, v.name as string]));

    const { data: fueleu, error: fueleuError } = await client.from("fuel_eu_records").select("*");
    if (fueleuError) throw fueleuError;

    const { data: deliveries, error: deliveriesError } = await client.from("fuel_deliveries").select("*");
    if (deliveriesError) throw deliveriesError;

    const byVessel: Record<string, { y2025?: GhgPoint; y2026?: GhgPoint }> = {};
    for (const r of fueleu ?? []) {
      const vesselId = r.vessel_id as string;
      const entry = byVessel[vesselId] ?? (byVessel[vesselId] = {});
      const point: GhgPoint = {
        ghgIntensity: Number(r.ghg_intensity_gco2e_per_mj),
        target: Number(r.target_gco2e_per_mj),
        balance: Number(r.compliance_balance),
        surplusOrDeficit: String(r.surplus_or_deficit),
      };
      if (Number(r.reporting_year) === 2025) entry.y2025 = point;
      else entry.y2026 = point;
    }

    const ghg = Object.entries(byVessel)
      .map(([vesselId, points]) => ({
        vesselId,
        vesselName: nameById.get(vesselId) ?? vesselId,
        y2025:
          points.y2025 ??
          ({ ghgIntensity: 0, target: 0, balance: 0, surplusOrDeficit: "N/A" } satisfies GhgPoint),
        y2026:
          points.y2026 ??
          ({ ghgIntensity: 0, target: 0, balance: 0, surplusOrDeficit: "N/A" } satisfies GhgPoint),
      }))
      .sort((a, b) => a.vesselName.localeCompare(b.vesselName));

    const balance = (fueleu ?? [])
      .map((r) => ({
        vesselId: r.vessel_id as string,
        vesselName: nameById.get(r.vessel_id as string) ?? (r.vessel_id as string),
        year: Number(r.reporting_year),
        balance: Number(r.compliance_balance),
        surplusOrDeficit: String(r.surplus_or_deficit),
      }))
      .sort((a, b) => a.vesselName.localeCompare(b.vesselName) || a.year - b.year);

    const byFuelTypeMap = new Map<string, number>();
    for (const d of deliveries ?? []) {
      const fuelType = d.fuel_type as string;
      byFuelTypeMap.set(fuelType, (byFuelTypeMap.get(fuelType) ?? 0) + Number(d.quantity_mt));
    }
    const byFuelType = [...byFuelTypeMap.entries()]
      .map(([fuelType, quantityMt]) => ({ fuelType, quantityMt }))
      .sort((a, b) => b.quantityMt - a.quantityMt);

    const byMonthMap = new Map<string, number>();
    for (const d of deliveries ?? []) {
      const month = (d.delivery_date as string).slice(0, 7);
      byMonthMap.set(month, (byMonthMap.get(month) ?? 0) + Number(d.quantity_mt));
    }
    const byMonth = [...byMonthMap.entries()]
      .map(([month, quantityMt]) => ({ month, quantityMt }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const summary: AnalyticsSummary = {
      fleet: {
        totalVessels: vessels?.length ?? 0,
        fuelDeliveries: deliveries?.length ?? 0,
        fuelDeliveriesPending: (deliveries ?? []).filter((d) => d.status === "pending").length,
      },
      ghg,
      balance,
      byFuelType,
      byMonth,
    };

    return apiSuccess(summary);
  } catch (err) {
    return mapErrorResponse(err);
  }
}
