import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { mapBdnToFuelDelivery, toFuelDeliveryInsert } from "../bdn-mapping";
import { makeBdnExtractionData } from "./fixtures";

const DOC_ID = "doc-uuid-001";
const VESSEL_ID = "vessel-uuid-001";
const OCR_ID = "ocr-uuid-001";

describe("mapBdnToFuelDelivery", () => {
  it("maps a BDN extraction to a fuel delivery input", () => {
    const bdnData = makeBdnExtractionData();
    const result = mapBdnToFuelDelivery(bdnData, DOC_ID, VESSEL_ID, OCR_ID);

    expect(result.document_id).toBe(DOC_ID);
    expect(result.ocr_result_id).toBe(OCR_ID);
    expect(result.vessel_id).toBe(VESSEL_ID);
    expect(result.supplier).toBe("BunkerSupplier Ltd");
    expect(result.delivery_port).toBe("Rotterdam");
    expect(result.fuel_type).toBe("vlsfo");
    expect(result.quantity_mt).toBe(250);
    expect(result.sulphur_content_pct).toBe(0.5);
    expect(result.bdn_reference).toBe("BDN-2026-001");
  });

  it("normalises fuel type from BDN", () => {
    const bdnData = makeBdnExtractionData({ fuelType: "HFO 380" });
    const result = mapBdnToFuelDelivery(bdnData, DOC_ID, VESSEL_ID);
    expect(result.fuel_type).toBe("hfo_380");
  });

  it("handles missing optional values", () => {
    const bdnData = makeBdnExtractionData({
      densityKgM3: null,
      sulphurContentPct: null,
    });
    const result = mapBdnToFuelDelivery(bdnData, DOC_ID, VESSEL_ID);
    expect(result.density_kgm3).toBeNull();
    expect(result.sulphur_content_pct).toBeNull();
  });
});

describe("toFuelDeliveryInsert", () => {
  it("converts BDN input to DB insert with default status", () => {
    const bdnData = makeBdnExtractionData();
    const input = mapBdnToFuelDelivery(bdnData, DOC_ID, VESSEL_ID, OCR_ID);
    const insert = toFuelDeliveryInsert(input);

    expect(insert.document_id).toBe(DOC_ID);
    expect(insert.ocr_result_id).toBe(OCR_ID);
    expect(insert.status).toBe("pending");
    expect(insert.supplier).toBe("BunkerSupplier Ltd");
  });

  it("nulls out undefined optional references", () => {
    const bdnData = makeBdnExtractionData();
    const input = mapBdnToFuelDelivery(bdnData, DOC_ID, VESSEL_ID);
    const insert = toFuelDeliveryInsert(input);

    expect(insert.ocr_result_id).toBeNull();
    expect(insert.ai_extraction_id).toBeNull();
  });
});

run();
