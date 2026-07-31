import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createBdnForwarding, buildBdnInboxAddress } from "../forwarding";

describe("Captain Assistant — BDN forwarding", () => {
  const forwarding = createBdnForwarding();

  it("builds the inbox address from the vessel IMO", () => {
    expect(buildBdnInboxAddress("9074729")).toBe("imo9074729@docs.poseidonledger.com");
  });

  it("matches the existing email-ingress recipient pattern", () => {
    const info = forwarding.info("9074729");
    const address = info.address;
    // The same format accepted by the existing BDN Email Ingestion implementation.
    expect(/^imo\d{7}@docs\.poseidonledger\.com$/i.test(address)).toBe(true);
  });

  it("explains accepted file types and limits", () => {
    const info = forwarding.info("9074729");
    expect(info.acceptedTypes.length).toBeGreaterThan(0);
    expect(info.acceptedTypes.includes(".pdf")).toBe(true);
    expect(info.maxSizeMb).toBe(20);
  });

  it("explains the post-receipt workflow", () => {
    const info = forwarding.info("9074729");
    expect(info.workflow.toLowerCase()).toContainString("ocr");
    expect(info.text).toContainString("imo9074729@docs.poseidonledger.com");
    expect(info.text.toLowerCase()).toContainString("review");
  });
});

run();
