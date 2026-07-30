export interface EmailPayload {
  readonly messageId: string;
  readonly sender: string;
  readonly recipient: string;
  readonly subject: string | null;
  readonly textBody: string | null;
  readonly htmlBody: string | null;
  readonly attachments: EmailAttachment[];
  readonly receivedAt: string;
}

export interface EmailAttachment {
  readonly filename: string;
  readonly content: Buffer;
  readonly mimeType: string;
  readonly size: number;
}

export interface IngressAttachmentResult {
  readonly filename: string;
  readonly mimeType: string;
  readonly size: number;
  readonly sha256: string;
  readonly accepted: boolean;
  readonly rejectionReason: string | null;
  readonly storagePath: string | null;
  readonly documentId: string | null;
}

export interface IngressResult {
  readonly messageId: string;
  readonly imo: string | null;
  readonly vesselId: string | null;
  readonly accepted: boolean;
  readonly rejectionReason: string | null;
  readonly attachments: IngressAttachmentResult[];
  readonly totalAttachments: number;
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly duplicateCount: number;
}

export type IngressScenario =
  | "valid_bdn"
  | "multiple_attachments"
  | "invalid_imo"
  | "unknown_vessel"
  | "duplicate_attachment"
  | "unsupported_file"
  | "malformed_payload"
  | "review_required";

export const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/tiff",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".tiff"] as const;

export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];
