import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { suggestReconciliation, findBestMatch } from "../reconciliation";
import { makeDeliveryRow, makeVoyageRow } from "./fixtures";

describe("suggestReconciliation", () => {
  it("returns a high-confidence match for matching port and date", () => {
    const delivery = makeDeliveryRow({
      delivery_port: "Rotterdam",
      delivery_date: "2026-07-10T08:00:00.000Z",
    });
    const voyage = makeVoyageRow({
      departure_port_name: "Rotterdam",
      departure_time: "2026-07-08T06:00:00.000Z",
      arrival_port_name: "Hamburg",
      arrival_time: "2026-07-11T14:00:00.000Z",
    });

    const suggestions = suggestReconciliation(delivery, [voyage]);
    expect(suggestions.length).toBe(1);
    expect(suggestions[0]!.confidence).toBeGreaterThan(79);
    expect(suggestions[0]!.match_type).toBe("auto");
  });

  it("returns lower confidence for port mismatch", () => {
    const delivery = makeDeliveryRow({
      delivery_port: "Singapore",
      delivery_date: "2026-07-10T08:00:00.000Z",
    });
    const voyage = makeVoyageRow({
      departure_port_name: "Rotterdam",
      arrival_port_name: "Hamburg",
      departure_time: "2026-07-08T06:00:00.000Z",
      arrival_time: "2026-07-11T14:00:00.000Z",
    });

    const suggestions = suggestReconciliation(delivery, [voyage]);
    expect(suggestions.length).toBe(1);
    expect(suggestions[0]!.confidence).toBeLessThanOrEqual(79);
    expect(suggestions[0]!.match_type).toBe("manual");
  });

  it("returns suggestions sorted by confidence descending", () => {
    const delivery = makeDeliveryRow({
      delivery_port: "Rotterdam",
      delivery_date: "2026-07-10T08:00:00.000Z",
    });
    const voyage1 = makeVoyageRow({
      id: "voy-1",
      departure_port_name: "Rotterdam",
      departure_time: "2026-07-08T06:00:00.000Z",
      arrival_port_name: "Hamburg",
      arrival_time: "2026-07-11T14:00:00.000Z",
    });
    const voyage2 = makeVoyageRow({
      id: "voy-2",
      departure_port_name: "Amsterdam",
      departure_time: "2026-07-05T06:00:00.000Z",
      arrival_port_name: "Antwerp",
      arrival_time: "2026-07-06T14:00:00.000Z",
    });

    const suggestions = suggestReconciliation(delivery, [voyage1, voyage2]);
    expect(suggestions.length).toBe(2);
    expect(suggestions[0]!.confidence).toBeGreaterThan(suggestions[1]!.confidence);
  });

  it("handles voyage without timestamps", () => {
    const delivery = makeDeliveryRow({
      delivery_port: "Rotterdam",
      delivery_date: "2026-07-10T08:00:00.000Z",
    });
    const voyage = makeVoyageRow({
      departure_port_name: "Rotterdam",
      departure_time: null,
      arrival_time: null,
    });

    const suggestions = suggestReconciliation(delivery, [voyage]);
    expect(suggestions.length).toBe(1);
    expect(suggestions[0]!.voyage_id).toBe("voy-uuid-001");
  });

  it("returns empty array when no voyages match", () => {
    const delivery = makeDeliveryRow({
      delivery_port: "Xyz",
      delivery_date: "2025-01-01T00:00:00.000Z",
    });
    const voyage = makeVoyageRow({
      departure_port_name: "Rotterdam",
      departure_time: "2026-07-08T06:00:00.000Z",
      arrival_port_name: "Hamburg",
      arrival_time: "2026-07-11T14:00:00.000Z",
    });

    const suggestions = suggestReconciliation(delivery, [voyage], { maxDaysOffset: 1, autoReconcileThreshold: 80 });
    expect(suggestions.length).toBe(0);
  });
});

describe("findBestMatch", () => {
  it("returns the best match when one exists", () => {
    const delivery = makeDeliveryRow({
      delivery_port: "Rotterdam",
      delivery_date: "2026-07-10T08:00:00.000Z",
    });
    const voyage = makeVoyageRow({
      departure_port_name: "Rotterdam",
      departure_time: "2026-07-08T06:00:00.000Z",
      arrival_port_name: "Hamburg",
      arrival_time: "2026-07-11T14:00:00.000Z",
    });

    const best = findBestMatch(delivery, [voyage]);
    expect(best).toBeTruthy();
    expect(best!.voyage_id).toBe("voy-uuid-001");
  });
});

run();
