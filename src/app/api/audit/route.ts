/**
 * route.ts — POST /api/audit
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Lead intake for the public landing page (index.html). The audit form posts
 * the fleet profile + risk-simulator snapshot here. This route validates the
 * payload and acknowledges receipt so the form can surface its success state
 * with a reference number.
 *
 * Deliberately standalone: no auth (public page), no repository dependency.
 * Persistence/CRM wiring is intentionally out of scope for the demo landing
 * page — the route validates and acknowledges only.
 */

import { NextRequest } from "next/server";
import { apiCreated, apiError, parseJsonBody } from "@/app/api/_lib/http";
import { VALIDATION_ERROR } from "@/app/api/_lib/errors";
import { AUDIT_FLEET_SIZES } from "@/lib/constants";

export interface AuditRequestPayload {
  readonly firstName?: unknown;
  readonly lastName?: unknown;
  readonly email?: unknown;
  readonly company?: unknown;
  readonly fleetSize?: unknown;
  readonly region?: unknown;
  readonly complianceStatus?: unknown;
  readonly primaryConcern?: unknown;
  readonly auditRef?: unknown;
  readonly simVessels?: unknown;
  readonly simEtsLiability?: unknown;
  readonly simFueleuLiability?: unknown;
  readonly simInsuranceImpact?: unknown;
  readonly simRevenueRisk?: unknown;
  readonly simNetValue?: unknown;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest): Promise<Response> {
  const body = await parseJsonBody<AuditRequestPayload>(request);
  if (!body) {
    return apiError(VALIDATION_ERROR, "A JSON body is required", 400);
  }

  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const fleetSize = typeof body.fleetSize === "string" ? body.fleetSize.trim() : "";

  if (!firstName) {
    return apiError(VALIDATION_ERROR, "firstName is required", 400);
  }
  if (!email || !EMAIL_PATTERN.test(email)) {
    return apiError(VALIDATION_ERROR, "A valid email address is required", 400);
  }
  if (!fleetSize || !(AUDIT_FLEET_SIZES as readonly string[]).includes(fleetSize)) {
    return apiError(
      VALIDATION_ERROR,
      `fleetSize must be one of: ${AUDIT_FLEET_SIZES.join(", ")}`,
      400,
    );
  }

  const auditRef =
    typeof body.auditRef === "string" && body.auditRef.trim()
      ? body.auditRef.trim()
      : `PL-AU${Date.now().toString().slice(-6)}`;

  return apiCreated({ auditRef, status: "received" });
}
