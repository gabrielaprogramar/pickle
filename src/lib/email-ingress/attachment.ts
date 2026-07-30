import { createHash } from "node:crypto";
import type { EmailAttachment } from "./types";
import { ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS, MAX_ATTACHMENT_SIZE } from "./types";

export interface AttachmentValidationResult {
  readonly sha256: string;
  readonly valid: boolean;
  readonly rejectionReason: string | null;
}

export function computeSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function validateAttachment(attachment: EmailAttachment): AttachmentValidationResult {
  const sha256 = computeSha256(attachment.content);

  if (attachment.size > MAX_ATTACHMENT_SIZE) {
    return {
      sha256,
      valid: false,
      rejectionReason: `File too large: ${attachment.size} bytes exceeds max ${MAX_ATTACHMENT_SIZE}`,
    };
  }

  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(attachment.mimeType)) {
    return {
      sha256,
      valid: false,
      rejectionReason: `Unsupported MIME type: ${attachment.mimeType}`,
    };
  }

  const ext = getExtension(attachment.filename);
  if (ext && !(ALLOWED_EXTENSIONS as readonly string[]).includes(ext.toLowerCase())) {
    return {
      sha256,
      valid: false,
      rejectionReason: `Unsupported file extension: ${ext}`,
    };
  }

  return { sha256, valid: true, rejectionReason: null };
}

function getExtension(filename: string): string | null {
  const idx = filename.lastIndexOf(".");
  if (idx === -1) return null;
  return filename.slice(idx);
}
