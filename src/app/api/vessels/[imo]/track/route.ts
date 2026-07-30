import { NextRequest, NextResponse } from "next/server";
import { createAisPositionsRepository } from "@/lib/supabase/repositories/ais_positions";
import { createVesselRepository } from "@/lib/supabase/repositories/vessels";
import { getSupabaseClient } from "@/lib/supabase";
import { processAisTrack } from "@/lib/geo";

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

    const ais = createAisPositionsRepository({
      client: getSupabaseClient(),
      vesselRepository: vessels,
    });
    const page = await ais.findByVesselImo(imo, { limit: 1000, offset: 0 });
    const track = processAisTrack(page.rows);

    return NextResponse.json({
      vesselId: vessel.id,
      imo,
      track,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
