const RECIPIENT_PATTERN = /^imo(\d{7})@docs\.poseidonledger\.com$/i;

export interface ParsedRecipient {
  readonly imo: string;
  readonly fullAddress: string;
}

export function parseRecipient(recipient: string): ParsedRecipient | null {
  const match = recipient.trim().match(RECIPIENT_PATTERN);
  if (!match || !match[1]) return null;
  return { imo: match[1], fullAddress: recipient.trim() };
}
