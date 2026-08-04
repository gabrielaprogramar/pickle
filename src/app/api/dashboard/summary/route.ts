import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { apiSuccess, mapErrorResponse } from "@/app/api/_lib/http";

export interface DashboardSummary {
  readonly totalVessels: number;
  readonly activeVoyages: number;
  readonly latestAisUpdate: string | null;
  readonly documents: number;
  readonly reviewQueue: number;
  readonly ocrQueue: number;
  readonly complianceAlerts: number;
  readonly fuelDeliveriesPending: number;
  readonly unreadNotifications: number;
}

export async function GET(_request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);

    const { count: totalVessels, error: vesselsError } = await client
      .from("vessels")
      .select("*", { count: "exact", head: true });
    if (vesselsError) throw vesselsError;

    const { count: activeVoyages, error: voyagesError } = await client
      .from("voyages")
      .select("*", { count: "exact", head: true })
      .gte("arrival_time", nowIso);
    if (voyagesError) throw voyagesError;

    const { count: documents, error: documentsError } = await client
      .from("documents")
      .select("*", { count: "exact", head: true });
    if (documentsError) throw documentsError;

    const { data: latestAis, error: aisError } = await client
      .from("ais_positions")
      .select("*")
      .order("ts", { ascending: false })
      .limit(1);
    if (aisError) throw aisError;
    const latestAisUpdate = (latestAis?.[0] as { ts?: string } | undefined)?.ts ?? null;

    const { data: reviewTasks, error: reviewError } = await client.from("review_tasks").select("*");
    if (reviewError) throw reviewError;
    const reviewQueue = (reviewTasks ?? []).filter(
      (t) => t.status === "pending" || t.status === "in_progress",
    ).length;

    const { data: docs, error: docsError } = await client.from("documents").select("*");
    if (docsError) throw docsError;
    const ocrQueue = (docs ?? []).filter((d) =>
      ["processing", "extracted", "under_review"].includes(d.status),
    ).length;

    const { data: soxStates, error: soxError } = await client.from("sox_watch_state").select("*");
    if (soxError) throw soxError;
    const soxAlerts = (soxStates ?? []).filter((s) => s.status !== "CLEAR").length;

    const { data: reports, error: reportsError } = await client.from("compliance_reports").select("*");
    if (reportsError) throw reportsError;
    const failedReports = (reports ?? []).filter((r) =>
      r.status === "FAILED" || r.status === "REJECTED",
    ).length;

    const { data: certs, error: certsError } = await client.from("certificate_registry").select("*");
    if (certsError) throw certsError;
    const expiredCerts = (certs ?? []).filter(
      (c) => typeof c.expiry_date === "string" && c.expiry_date < today,
    ).length;

    const { data: fuelDeliveries, error: fuelError } = await client.from("fuel_deliveries").select("*");
    if (fuelError) throw fuelError;
    const fuelDeliveriesPending = (fuelDeliveries ?? []).filter((f) => f.status === "pending").length;

    const { data: notifications, error: notifError } = await client.from("notifications").select("*");
    if (notifError) throw notifError;
    const unreadNotifications = (notifications ?? []).filter(
      (n) => n.is_read === false && (n.severity === "HIGH" || n.severity === "CRITICAL"),
    ).length;

    const summary: DashboardSummary = {
      totalVessels: totalVessels ?? 0,
      activeVoyages: activeVoyages ?? 0,
      latestAisUpdate,
      documents: documents ?? 0,
      reviewQueue,
      ocrQueue,
      complianceAlerts: soxAlerts + failedReports + expiredCerts,
      fuelDeliveriesPending,
      unreadNotifications,
    };

    return apiSuccess(summary);
  } catch (err) {
    return mapErrorResponse(err);
  }
}
