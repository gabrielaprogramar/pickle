/**
 * routes.test.ts — POST /api/audit
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the public landing-page lead intake. The route has no state and no
 * repository dependency, so tests run against the handler directly without the
 * fake Supabase client.
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { NextRequest } from "next/server";
import { POST } from "../route";

function auditRequest(body: unknown): NextRequest {
  return new NextRequest("https://example.com/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  firstName: "James",
  lastName: "Whitmore",
  email: "j.whitmore@cmb-monaco.com",
  company: "CMB Fleet Services",
  fleetSize: "6–15 vessels",
  region: "Western Mediterranean",
  complianceStatus: "Partial / manual logs",
  primaryConcern: "",
  auditRef: "PL-AU123456",
  simVessels: "8 vessels",
  simEtsLiability: "€74,400",
  simFueleuLiability: "€11,160",
  simInsuranceImpact: "+€45,760",
  simRevenueRisk: "€140,000",
  simNetValue: "+€185,880",
};

describe("POST /api/audit", () => {
  it("accepts a complete audit request and returns the reference", async () => {
    const response = await POST(auditRequest(validBody));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("received");
    expect(body.data.auditRef).toBe("PL-AU123456");
  });

  it("generates a reference when none is supplied", async () => {
    const { auditRef: _omit, ...withoutRef } = validBody;
    const response = await POST(auditRequest(withoutRef));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(typeof body.data.auditRef).toBe("string");
    expect(body.data.auditRef.length).toBeGreaterThan(0);
  });

  it("rejects when firstName is missing", async () => {
    const response = await POST(auditRequest({ email: validBody.email, fleetSize: validBody.fleetSize }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an invalid email", async () => {
    const response = await POST(
      auditRequest({ ...validBody, email: "not-an-email" }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an unknown fleet size", async () => {
    const response = await POST(
      auditRequest({ ...validBody, fleetSize: "1000 vessels" }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a non-object body", async () => {
    const response = await POST(auditRequest([1, 2, 3]));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });
});

run();
