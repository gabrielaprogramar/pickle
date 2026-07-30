import { NextRequest, NextResponse } from "next/server";
import { createPortCallRepository } from "@/lib/supabase/repositories/port_calls";
import { createVesselRepository } from "@/lib/supabase/repositories/vessels";
import { getSupabaseClient } from "@/lib/supabase";

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

    const repo = createPortCallRepository({ client: getSupabaseClient() });
    const portCalls = await repo.findByVesselId(vessel.id);

    return NextResponse.json({ portCalls, vesselId: vessel.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
