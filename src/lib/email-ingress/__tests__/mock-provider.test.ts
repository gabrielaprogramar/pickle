import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createMockEmailIngressProvider } from "../mock-provider";
import type { EmailPayload } from "../types";

const MOCK_DOMAIN = "docs.poseidonledger.com";

describe("MockEmailIngressProvider — valid_bdn scenario", () => {
  it("accepts a valid BDN email and creates document references", async () => {
    const provider = createMockEmailIngressProvider();
    provider.setScenario("valid_bdn");

    const payload: EmailPayload = {
      messageId: "test-msg-001",
      sender: "captain@vessel.com",
      recipient: `imo9876543@${MOCK_DOMAIN}`,
      subject: "BDN - Port of Rotterdam",
      textBody: "Please find the BDN attached.",
      htmlBody: null,
      attachments: [
        { filename: "bdn.pdf", content: Buffer.from("bdn content"), mimeType: "application/pdf", size: 100 },
      ],
      receivedAt: "2026-07-30T12:00:00Z",
    };

    const result = await provider.ingest(payload);
    expect(result.accepted).toBe(true);
    expect(result.imo).toBe("9876543");
    expect(result.vesselId).toBe("mock-vessel-id");
    expect(result.totalAttachments).toBe(1);
    expect(result.acceptedCount).toBe(1);
    expect(result.rejectedCount).toBe(0);
    expect(result.attachments[0]?.accepted).toBe(true);
    expect(result.attachments[0]?.storagePath).toBeTruthy();
    if (result.attachments[0]?.storagePath) {
      expect(result.attachments[0].storagePath.indexOf("documents/email-ingest/9876543/") === 0).toBe(true);
    }
  });
});

describe("MockEmailIngressProvider — multiple_attachments scenario", () => {
  it("accepts multiple valid attachments", async () => {
    const provider = createMockEmailIngressProvider();
    provider.setScenario("multiple_attachments");

    const payload: EmailPayload = {
      messageId: "test-msg-002",
      sender: "captain@vessel.com",
      recipient: `imo9876543@${MOCK_DOMAIN}`,
      subject: "BDN with supporting docs",
      textBody: null,
      htmlBody: null,
      attachments: [
        { filename: "bdn.pdf", content: Buffer.from("bdn content"), mimeType: "application/pdf", size: 100 },
        { filename: "photo.jpg", content: Buffer.from("jpg content"), mimeType: "image/jpeg", size: 200 },
        { filename: "scan.png", content: Buffer.from("png content"), mimeType: "image/png", size: 150 },
      ],
      receivedAt: "2026-07-30T12:00:00Z",
    };

    const result = await provider.ingest(payload);
    expect(result.accepted).toBe(true);
    expect(result.totalAttachments).toBe(3);
    expect(result.acceptedCount).toBe(3);
    expect(result.rejectedCount).toBe(0);
  });
});

describe("MockEmailIngressProvider — invalid_imo scenario", () => {
  it("rejects email with invalid IMO in recipient", async () => {
    const provider = createMockEmailIngressProvider();
    provider.setScenario("invalid_imo");

    const payload: EmailPayload = {
      messageId: "test-msg-003",
      sender: "captain@vessel.com",
      recipient: `imoabc1234@${MOCK_DOMAIN}`,
      subject: "BDN",
      textBody: null,
      htmlBody: null,
      attachments: [
        { filename: "bdn.pdf", content: Buffer.from("content"), mimeType: "application/pdf", size: 100 },
      ],
      receivedAt: "2026-07-30T12:00:00Z",
    };

    const result = await provider.ingest(payload);
    expect(result.accepted).toBe(false);
    expect(result.imo).toBeNull();
    expect(result.rejectionReason).toBeTruthy();
    if (result.rejectionReason) {
      expect(result.rejectionReason.indexOf("Invalid IMO") >= 0).toBe(true);
    }
  });
});

describe("MockEmailIngressProvider — unknown_vessel scenario", () => {
  it("rejects email for IMO 0000000 as unknown vessel", async () => {
    const provider = createMockEmailIngressProvider();
    provider.setScenario("unknown_vessel");

    const payload: EmailPayload = {
      messageId: "test-msg-004",
      sender: "captain@vessel.com",
      recipient: `imo0000000@${MOCK_DOMAIN}`,
      subject: "BDN for unknown vessel",
      textBody: null,
      htmlBody: null,
      attachments: [
        { filename: "bdn.pdf", content: Buffer.from("content"), mimeType: "application/pdf", size: 100 },
      ],
      receivedAt: "2026-07-30T12:00:00Z",
    };

    const result = await provider.ingest(payload);
    expect(result.accepted).toBe(false);
    expect(result.imo).toBe("0000000");
    expect(result.vesselId).toBeNull();
    expect(result.rejectionReason).toBeTruthy();
    if (result.rejectionReason) {
      expect(result.rejectionReason.indexOf("Unknown vessel") >= 0).toBe(true);
    }
  });
});

describe("MockEmailIngressProvider — duplicate_attachment scenario", () => {
  it("rejects duplicate attachment with same SHA-256", async () => {
    const provider = createMockEmailIngressProvider();
    provider.setScenario("duplicate_attachment");

    const sameContent = Buffer.from("duplicate content for testing");
    const payload: EmailPayload = {
      messageId: "test-msg-005",
      sender: "captain@vessel.com",
      recipient: `imo9876543@${MOCK_DOMAIN}`,
      subject: "BDN with duplicate",
      textBody: null,
      htmlBody: null,
      attachments: [
        { filename: "bdn.pdf", content: sameContent, mimeType: "application/pdf", size: sameContent.length },
        { filename: "bdn-copy.pdf", content: sameContent, mimeType: "application/pdf", size: sameContent.length },
      ],
      receivedAt: "2026-07-30T12:00:00Z",
    };

    const result = await provider.ingest(payload);
    expect(result.totalAttachments).toBe(2);
    expect(result.acceptedCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
    expect(result.attachments[0]?.accepted).toBe(true);
    expect(result.attachments[1]?.accepted).toBe(false);
    expect(result.attachments[1]?.rejectionReason).toBeTruthy();
    if (result.attachments[1]?.rejectionReason) {
      expect(result.attachments[1].rejectionReason.indexOf("Duplicate") >= 0).toBe(true);
    }
  });
});

describe("MockEmailIngressProvider — unsupported_file scenario", () => {
  it("accepts pdf but rejects xlsx", async () => {
    const provider = createMockEmailIngressProvider();
    provider.setScenario("unsupported_file");

    const payload: EmailPayload = {
      messageId: "test-msg-006",
      sender: "captain@vessel.com",
      recipient: `imo9876543@${MOCK_DOMAIN}`,
      subject: "BDN with spreadsheet",
      textBody: null,
      htmlBody: null,
      attachments: [
        { filename: "bdn.pdf", content: Buffer.from("pdf"), mimeType: "application/pdf", size: 100 },
        { filename: "data.xlsx", content: Buffer.from("xlsx"), mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 200 },
      ],
      receivedAt: "2026-07-30T12:00:00Z",
    };

    const result = await provider.ingest(payload);
    expect(result.totalAttachments).toBe(2);
    expect(result.acceptedCount).toBe(1);
    expect(result.rejectedCount).toBe(1);
    expect(result.attachments[0]?.accepted).toBe(true);
    expect(result.attachments[1]?.accepted).toBe(false);
    expect(result.attachments[1]?.rejectionReason).toBeTruthy();
    if (result.attachments[1]?.rejectionReason) {
      expect(result.attachments[1].rejectionReason.indexOf("Unsupported") >= 0).toBe(true);
    }
  });
});

describe("MockEmailIngressProvider — malformed_payload scenario", () => {
  it("rejects malformed payload with empty recipient", async () => {
    const provider = createMockEmailIngressProvider();
    provider.setScenario("malformed_payload");

    const payload: EmailPayload = {
      messageId: "test-msg-007",
      sender: "captain@vessel.com",
      recipient: "",
      subject: null,
      textBody: null,
      htmlBody: null,
      attachments: [],
      receivedAt: "2026-07-30T12:00:00Z",
    };

    const result = await provider.ingest(payload);
    expect(result.accepted).toBe(false);
    expect(result.totalAttachments).toBe(0);
    expect(result.rejectionReason).toBeTruthy();
    if (result.rejectionReason) {
      expect(result.rejectionReason.indexOf("missing recipient") >= 0).toBe(true);
    }
  });
});

describe("MockEmailIngressProvider — review_required scenario", () => {
  it("accepts BDN with review flag in metadata", async () => {
    const provider = createMockEmailIngressProvider();
    provider.setScenario("review_required");

    const payload: EmailPayload = {
      messageId: "test-msg-008",
      sender: "captain@vessel.com",
      recipient: `imo9876543@${MOCK_DOMAIN}`,
      subject: "BDN - discrepancies found",
      textBody: "Some figures in this BDN may be inaccurate, please review.",
      htmlBody: null,
      attachments: [
        { filename: "bdn-questionable.pdf", content: Buffer.from("questionable bdn"), mimeType: "application/pdf", size: 200 },
      ],
      receivedAt: "2026-07-30T12:00:00Z",
    };

    const result = await provider.ingest(payload);
    expect(result.accepted).toBe(true);
    expect(result.acceptedCount).toBe(1);
  });
});

describe("MockEmailIngressProvider — scenario lifecycle", () => {
  it("defaults to valid_bdn scenario", () => {
    const provider = createMockEmailIngressProvider();
    expect(provider.currentScenario()).toBe("valid_bdn");
  });

  it("tracks current scenario after setScenario", () => {
    const provider = createMockEmailIngressProvider();
    provider.setScenario("duplicate_attachment");
    expect(provider.currentScenario()).toBe("duplicate_attachment");
  });
});

run();
