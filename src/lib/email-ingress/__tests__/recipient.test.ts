import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { parseRecipient } from "../recipient";

describe("parseRecipient", () => {
  it("parses valid imo{IMO}@docs.poseidonledger.com address", () => {
    const result = parseRecipient("imo9876543@docs.poseidonledger.com");
    expect(result).toBeTruthy();
    if (result) {
      expect(result.imo).toBe("9876543");
      expect(result.fullAddress).toBe("imo9876543@docs.poseidonledger.com");
    }
  });

  it("parses address with leading/trailing whitespace", () => {
    const result = parseRecipient("  imo1234567@docs.poseidonledger.com  ");
    expect(result).toBeTruthy();
    if (result) {
      expect(result.imo).toBe("1234567");
    }
  });

  it("rejects address with non-digit IMO", () => {
    const result = parseRecipient("imoabc1234@docs.poseidonledger.com");
    expect(result).toBeNull();
  });

  it("rejects address with too-short IMO", () => {
    const result = parseRecipient("imo123@docs.poseidonledger.com");
    expect(result).toBeNull();
  });

  it("rejects address with too-long IMO", () => {
    const result = parseRecipient("imo12345678@docs.poseidonledger.com");
    expect(result).toBeNull();
  });

  it("rejects address without imo prefix", () => {
    const result = parseRecipient("9876543@docs.poseidonledger.com");
    expect(result).toBeNull();
  });

  it("rejects address with wrong domain", () => {
    const result = parseRecipient("imo9876543@other-domain.com");
    expect(result).toBeNull();
  });

  it("rejects empty string", () => {
    const result = parseRecipient("");
    expect(result).toBeNull();
  });

  it("is case-insensitive for the imo prefix", () => {
    const result = parseRecipient("IMO9876543@docs.poseidonledger.com");
    expect(result).toBeTruthy();
    if (result) {
      expect(result.imo).toBe("9876543");
    }
  });
});

run();
