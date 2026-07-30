import { createHash } from "node:crypto";
import type {
  EmailAttachment,
  EmailPayload,
  IngressAttachmentResult,
  IngressResult,
  IngressScenario,
} from "./types";
import { computeSha256, validateAttachment } from "./attachment";
import { parseRecipient } from "./recipient";
import type { MockEmailIngressProvider } from "./provider";

const MOCK_DOMAIN = "docs.poseidonledger.com";
const MOCK_SENDER = "captain@fleet-operator.com";

function makePayload(overrides: Partial<EmailPayload> & { recipient: string }): EmailPayload {
  return {
    messageId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sender: MOCK_SENDER,
    subject: "Bunker Delivery Note",
    textBody: "Please find attached the BDN for this bunkering operation.",
    htmlBody: null,
    attachments: [],
    receivedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeAttachment(overrides: Partial<EmailAttachment> & { filename: string }): EmailAttachment {
  const content = overrides.content ?? Buffer.from("mock bdn content for testing");
  return {
    content,
    mimeType: "application/pdf",
    ...overrides,
    size: overrides.size ?? content.length,
  };
}

const SCENARIO_MAP: Record<IngressScenario, () => EmailPayload> = {
  valid_bdn: () => makePayload({
    recipient: `imo9876543@${MOCK_DOMAIN}`,
    attachments: [
      makeAttachment({ filename: "bdn-report.pdf", mimeType: "application/pdf" }),
    ],
  }),

  multiple_attachments: () => makePayload({
    recipient: `imo9876543@${MOCK_DOMAIN}`,
    subject: "BDN and supporting documents",
    attachments: [
      makeAttachment({ filename: "bdn-report.pdf", mimeType: "application/pdf" }),
      makeAttachment({ filename: "delivery-note.jpg", mimeType: "image/jpeg", content: Buffer.from("mock jpg content") }),
      makeAttachment({ filename: "meter-reading.png", mimeType: "image/png", content: Buffer.from("mock png content") }),
    ],
  }),

  invalid_imo: () => makePayload({
    recipient: `imoabc1234@${MOCK_DOMAIN}`,
    subject: "BDN for vessel",
    attachments: [
      makeAttachment({ filename: "bdn.pdf", mimeType: "application/pdf" }),
    ],
  }),

  unknown_vessel: () => makePayload({
    recipient: `imo0000000@${MOCK_DOMAIN}`,
    subject: "BDN for unknown vessel",
    attachments: [
      makeAttachment({ filename: "bdn.pdf", mimeType: "application/pdf" }),
    ],
  }),

  duplicate_attachment: () => {
    const sameContent = Buffer.from("duplicate content for testing");
    const attachment: EmailAttachment = {
      filename: "bdn.pdf",
      content: sameContent,
      mimeType: "application/pdf",
      size: sameContent.length,
    };
    return makePayload({
      recipient: `imo9876543@${MOCK_DOMAIN}`,
      attachments: [attachment, { ...attachment, filename: "bdn-copy.pdf" }],
    });
  },

  unsupported_file: () => makePayload({
    recipient: `imo9876543@${MOCK_DOMAIN}`,
    subject: "BDN with unsupported attachment",
    attachments: [
      makeAttachment({ filename: "bdn.pdf", mimeType: "application/pdf" }),
      makeAttachment({ filename: "spreadsheet.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", content: Buffer.from("xlsx content") }),
    ],
  }),

  malformed_payload: () => makePayload({
    recipient: "",
    subject: null,
    textBody: null,
    attachments: [],
  }),

  review_required: () => makePayload({
    recipient: `imo9876543@${MOCK_DOMAIN}`,
    subject: "BDN - discrepancies found",
    textBody: "Some figures in this BDN may be inaccurate, please review.",
    attachments: [
      makeAttachment({ filename: "bdn-questionable.pdf", mimeType: "application/pdf" }),
    ],
  }),
};

export function createMockEmailIngressProvider(): MockEmailIngressProvider {
  let scenario: IngressScenario = "valid_bdn";

  return {
    setScenario(s: IngressScenario): void {
      scenario = s;
    },

    currentScenario(): IngressScenario {
      return scenario;
    },

    async ingest(payload: EmailPayload): Promise<IngressResult> {
      const parsed = parseRecipient(payload.recipient);
      const imo = parsed?.imo ?? null;

      if (scenario === "malformed_payload") {
        return {
          messageId: payload.messageId,
          imo: null,
          vesselId: null,
          accepted: false,
          rejectionReason: "Invalid payload: missing recipient",
          attachments: [],
          totalAttachments: 0,
          acceptedCount: 0,
          rejectedCount: 0,
          duplicateCount: 0,
        };
      }

      if (scenario === "invalid_imo") {
        return {
          messageId: payload.messageId,
          imo: null,
          vesselId: null,
          accepted: false,
          rejectionReason: `Invalid IMO in recipient: ${payload.recipient}`,
          attachments: [],
          totalAttachments: 0,
          acceptedCount: 0,
          rejectedCount: 0,
          duplicateCount: 0,
        };
      }

      if (imo === "0000000") {
        return {
          messageId: payload.messageId,
          imo,
          vesselId: null,
          accepted: false,
          rejectionReason: `Unknown vessel with IMO ${imo}`,
          attachments: [],
          totalAttachments: 0,
          acceptedCount: 0,
          rejectedCount: 0,
          duplicateCount: 0,
        };
      }

      const seenSha256s = new Set<string>();
      const attachmentResults: IngressAttachmentResult[] = [];

      for (const attachment of payload.attachments) {
        const validation = validateAttachment(attachment);
        const sha256 = validation.sha256;

        if (!validation.valid) {
          attachmentResults.push({
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            size: attachment.size,
            sha256,
            accepted: false,
            rejectionReason: validation.rejectionReason,
            storagePath: null,
            documentId: null,
          });
          continue;
        }

        if (seenSha256s.has(sha256)) {
          attachmentResults.push({
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            size: attachment.size,
            sha256,
            accepted: false,
            rejectionReason: "Duplicate attachment: same SHA-256 as previously accepted attachment",
            storagePath: null,
            documentId: null,
          });
          continue;
        }

        seenSha256s.add(sha256);

        const storageKey = `email-ingest/${imo}/${sha256}/${attachment.filename}`;
        attachmentResults.push({
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          size: attachment.size,
          sha256,
          accepted: true,
          rejectionReason: null,
          storagePath: `documents/${storageKey}`,
          documentId: `mock-doc-${sha256.slice(0, 8)}`,
        });
      }

      const accepted = attachmentResults.some((a) => a.accepted);

      return {
        messageId: payload.messageId,
        imo,
        vesselId: "mock-vessel-id",
        accepted,
        rejectionReason: accepted ? null : "No valid attachments were accepted",
        attachments: attachmentResults,
        totalAttachments: payload.attachments.length,
        acceptedCount: attachmentResults.filter((a) => a.accepted).length,
        rejectedCount: attachmentResults.filter((a) => !a.accepted).length,
        duplicateCount: attachmentResults.filter((a) => a.rejectionReason?.includes("Duplicate")).length,
      };
    },
  };
}
