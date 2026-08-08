import { NextRequest, NextResponse } from "next/server";
import { createZoneEventRepository } from "@/lib/supabase/repositories/zone_events";
import { createVesselRepository } from "@/lib/supabase/repositories/vessels";
import { createEnvironmentalZoneRepository } from "@/lib/supabase/repositories/environmental_zones";
import { getSupabaseClient } from "@/lib/supabase";
import { checkZoneAlerts } from "@/lib/geo";
import { processAisTrack } from "@/lib/geo";
import { createAisPositionsRepository } from "@/lib/supabase/repositories/ais_positions";

export async function GET(
  _req: NextRequest,
  { params }: { params: { imo: string } },
) {
  try {
    const { imo } = params;
    const vessels = createVesselRepository({ client: getSupabaseClient() });
    const vessel = await vessels.findByImo(imo);
    if (!vessel) {
      return NextResponse.json({ error: "Vessel not found" }, { status: 404 });
    }

    const zoneRepo = createEnvironmentalZoneRepository({
      client: getSupabaseClient(),
    });
    const zones = await zoneRepo.findAllActive();

    const ais = createAisPositionsRepository({
      client: getSupabaseClient(),
      vesselRepository: vessels,
    });
    const page = await ais.findByVesselImo(imo, { limit: 100, offset: 0 });
    const track = processAisTrack(page.rows);
    const trackPoints = track.points.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      ts: p.ts,
    }));

    const zoneDomains = zones.map((z) => ({
      id: z.id,
      code: z.code,
      name: z.name,
      category: z.category as import("@/lib/geo").ZoneCategory,
      geometryType: z.geometry_type,
      geometryCoordinates: z.geometry_coordinates as number[] | number[][] | number[][][] | number[][][][],
      description: z.description,
      regulationReference: z.regulation_reference,
      geometryVersion: z.geometry_version,
      jurisdiction: z.jurisdiction,
      effectiveFrom: z.effective_from,
      effectiveUntil: z.effective_until,
      isActive: z.is_active,
    }));

    const alerts = checkZoneAlerts(
      trackPoints,
      zoneDomains,
      vessel.id,
      new Date().toISOString(),
    );

    return NextResponse.json({ vesselId: vessel.id, alerts, zoneCount: zones.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
