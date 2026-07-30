export { parseRecipient } from "./recipient";
export type { ParsedRecipient } from "./recipient";

export { validateAttachment, computeSha256 } from "./attachment";
export type { AttachmentValidationResult } from "./attachment";

export { createAuditLogger } from "./audit";
export type { AuditLogger } from "./audit";

export { createMockEmailIngressProvider } from "./mock-provider";
export type { MockEmailIngressProvider } from "./provider";

export {
  getEmailIngressProvider,
  getMockEmailIngressProvider,
  createEmailIngressProvider,
} from "./client";

export type { EmailIngressProvider } from "./provider";

export type {
  EmailPayload,
  EmailAttachment,
  IngressAttachmentResult,
  IngressResult,
  IngressScenario,
} from "./types";

export {
  MAX_ATTACHMENT_SIZE,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
} from "./types";
