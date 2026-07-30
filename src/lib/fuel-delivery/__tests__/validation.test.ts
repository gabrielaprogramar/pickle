import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { makeDeliveryRow, makeVoyageRow } from "./fixtures";
import {
  validateFuelTypeExists,
  validateSulphurContent,
  validateDeliveryQuantity,
  validateDeliveryPort,
  validateBdnDocumentType,
  validateFuelDelivery,
  validateReconciliationPortMatch,
} from "../validation";

describe("validateFuelTypeExists", () => {
  it("passes for known fuel types", () => {
    const row = makeDeliveryRow({ fuel_type: "vlsfo" });
    const result = validateFuelTypeExists(row);
    expect(result.passed).toBe(true);
  });

  it("fails for unknown fuel types", () => {
    const row = makeDeliveryRow({ fuel_type: "custom_fuel_x" });
    const result = validateFuelTypeExists(row);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
  });
});

describe("validateSulphurContent", () => {
  it("passes for ECA-compliant sulphur content", () => {
    const row = makeDeliveryRow({ sulphur_content_pct: 0.5 });
    const result = validateSulphurContent(row);
    expect(result.passed).toBe(true);
    expect(result.severity).toBe("info");
  });

  it("warns when sulphur content exceeds ECA limit", () => {
    const row = makeDeliveryRow({ sulphur_content_pct: 3.5 });
    const result = validateSulphurContent(row);
    expect(result.passed).toBe(true);
    expect(result.severity).toBe("warning");
  });

  it("warns when sulphur content is missing", () => {
    const row = makeDeliveryRow({ sulphur_content_pct: null });
    const result = validateSulphurContent(row);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("warning");
  });
});

describe("validateDeliveryQuantity", () => {
  it("passes for reasonable quantities", () => {
    const row = makeDeliveryRow({ quantity_mt: 250 });
    const result = validateDeliveryQuantity(row);
    expect(result.passed).toBe(true);
  });

  it("fails for negative quantities", () => {
    const row = makeDeliveryRow({ quantity_mt: -10 });
    const result = validateDeliveryQuantity(row);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
  });

  it("warns for unusually large quantities", () => {
    const row = makeDeliveryRow({ quantity_mt: 6000 });
    const result = validateDeliveryQuantity(row);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("warning");
  });
});

describe("validateDeliveryPort", () => {
  it("passes when port is present", () => {
    const row = makeDeliveryRow({ delivery_port: "Rotterdam" });
    const result = validateDeliveryPort(row);
    expect(result.passed).toBe(true);
  });

  it("fails when port is empty", () => {
    const row = makeDeliveryRow({ delivery_port: "" });
    const result = validateDeliveryPort(row);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
  });

  it("fails when port is only whitespace", () => {
    const row = makeDeliveryRow({ delivery_port: "   " });
    const result = validateDeliveryPort(row);
    expect(result.passed).toBe(false);
  });
});

describe("validateBdnDocumentType", () => {
  it("passes for bdn document type", () => {
    const doc = { document_type: "bdn" } as any;
    const result = validateBdnDocumentType(doc);
    expect(result.passed).toBe(true);
  });

  it("fails for non-BDN document type", () => {
    const doc = { document_type: "report" } as any;
    const result = validateBdnDocumentType(doc);
    expect(result.passed).toBe(false);
  });
});

describe("validateFuelDelivery", () => {
  it("runs all checks against a delivery", () => {
    const row = makeDeliveryRow();
    const results = validateFuelDelivery(row);
    expect(results.length).toBe(4);
    const allPassed = results.every((r) => r.passed);
    expect(allPassed).toBe(true);
  });
});

describe("validateReconciliationPortMatch", () => {
  it("passes when delivery port matches departure port", () => {
    const delivery = makeDeliveryRow({ delivery_port: "Rotterdam" });
    const voyage = makeVoyageRow({ departure_port_name: "Rotterdam" });
    const result = validateReconciliationPortMatch(delivery, voyage);
    expect(result.passed).toBe(true);
  });

  it("passes when delivery port matches arrival port", () => {
    const delivery = makeDeliveryRow({ delivery_port: "Hamburg" });
    const voyage = makeVoyageRow({ arrival_port_name: "Hamburg" });
    const result = validateReconciliationPortMatch(delivery, voyage);
    expect(result.passed).toBe(true);
  });

  it("fails when delivery port matches neither", () => {
    const delivery = makeDeliveryRow({ delivery_port: "Singapore" });
    const voyage = makeVoyageRow({ departure_port_name: "Rotterdam", arrival_port_name: "Hamburg" });
    const result = validateReconciliationPortMatch(delivery, voyage);
    expect(result.passed).toBe(false);
  });
});

run();
