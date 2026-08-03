/**
 * credentials.ts — mock credential encryption seam (Phase 4.5)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Phase 4.5 stores integration credentials without reaching any provider. The
 * "encryption" here is a transparent base64 envelope so values never sit in
 * plaintext in the DB but are trivially reversible — a placeholder for a real
 * KMS-backed encryption layer in a later phase. Never rely on this for actual
 * secrets.
 */

const ENVELOPE_PREFIX = "pl:mock:v1:";

export function encryptConfig(plain: Record<string, unknown>): Record<string, unknown> {
  const envelope: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(plain)) {
    envelope[key] = ENVELOPE_PREFIX + Buffer.from(String(value)).toString("base64");
  }
  return envelope;
}

export function decryptConfig(encrypted: Record<string, unknown>): Record<string, unknown> {
  const plain: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(encrypted)) {
    if (typeof value === "string" && value.startsWith(ENVELOPE_PREFIX)) {
      plain[key] = Buffer.from(value.slice(ENVELOPE_PREFIX.length), "base64").toString("utf8");
    } else {
      plain[key] = value;
    }
  }
  return plain;
}

export function isEnvelope(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(ENVELOPE_PREFIX);
}
