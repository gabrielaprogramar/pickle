import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { createVerifierPackageRepository } from "@/lib/supabase/repositories/verifier_packages";
import { apiSuccess, mapErrorResponse } from "@/app/api/_lib/http";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit")) || 50;
    const offset = Number(searchParams.get("offset")) || 0;

    const repo = createVerifierPackageRepository({ client: getSupabaseClient() });
    const packages = await repo.list(limit, offset);

    return apiSuccess({ packages });
  } catch (err) {
    return mapErrorResponse(err);
  }
}
