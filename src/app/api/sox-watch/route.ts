import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { apiSuccess, mapErrorResponse } from "@/app/api/_lib/http";

export async function GET(_request: NextRequest) {
  try {
    const client = getSupabaseClient();

    const { data: vessels, error: vesselsError } = await client.from("vessels").select("*");
    if (vesselsError) throw vesselsError;

    const { data: states, error: statesError } = await client.from("sox_watch_state").select("*");
    if (statesError) throw statesError;

    const { data: events, error: eventsError } = await client.from("sox_compliance_events").select("*");
    if (eventsError) throw eventsError;

    const nameById = new Map((vessels ?? []).map((v) => [v.id as string, v.name as string]));
    const imoById = new Map((vessels ?? []).map((v) => [v.id as string, v.imo as string]));

    const latestEventByVessel = new Map<string, Record<string, unknown>>();
    for (const e of events ?? []) {
      const vesselId = e.vessel_id as string;
      const existing = latestEventByVessel.get(vesselId);
      if (!existing || (e.event_ts as string) > (existing.event_ts as string)) {
        latestEventByVessel.set(vesselId, e);
      }
    }

    const watch = (states ?? []).map((s) => {
      const vesselId = s.vessel_id as string;
      const event = latestEventByVessel.get(vesselId) ?? null;
      return {
        vesselId,
        imo: imoById.get(vesselId) ?? null,
        name: nameById.get(vesselId) ?? null,
        status: s.status,
        severity: s.severity,
        insideEca: s.inside_eca,
        ecaEffective: s.eca_effective,
        zoneState: s.zone_state,
        evidenceStatus: s.evidence_status,
        applicableLimitPct: s.applicable_limit_pct,
        sulphurContentPct: s.sulphur_content_pct,
        selectedDeliveryId: s.selected_delivery_id,
        lastEvaluatedAt: s.last_evaluated_at,
        latestEvent: event
          ? {
              id: event.id,
              eventType: event.event_type,
              eventTs: event.event_ts,
              severity: event.severity,
              watchStatus: event.watch_status,
              evidenceStatus: event.evidence_status,
              ruleId: event.rule_id,
            }
          : null,
      };
    });

    return apiSuccess({ watch });
  } catch (err) {
    return mapErrorResponse(err);
  }
}
