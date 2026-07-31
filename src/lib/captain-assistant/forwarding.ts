import { ALLOWED_EXTENSIONS, MAX_ATTACHMENT_SIZE } from "@/lib/email-ingress";

export interface BdnForwardingInfo {
  readonly address: string;
  readonly acceptedTypes: ReadonlyArray<string>;
  readonly maxSizeMb: number;
  readonly workflow: string;
  readonly text: string;
}

export interface BdnForwarding {
  info(imo: string): BdnForwardingInfo;
}

export function buildBdnInboxAddress(imo: string): string {
  const digits = imo.replace(/\D/g, "");
  return `imo${digits}@docs.poseidonledger.com`;
}

export function createBdnForwarding(): BdnForwarding {
  function info(imo: string): BdnForwardingInfo {
    const address = buildBdnInboxAddress(imo);
    const maxSizeMb = Math.floor(MAX_ATTACHMENT_SIZE / (1024 * 1024));
    const acceptedTypes = [...ALLOWED_EXTENSIONS];
    const workflow =
      "Once received, the BDN enters OCR, AI extraction, validation and then the review queue. " +
      "You will get a notification when it arrives and when processing completes.";

    const text = [
      `Send your BDN as an email attachment to:`,
      ``,
      `  ${address}`,
      ``,
      `Accepted file types: ${acceptedTypes.join(", ")} (max ${maxSizeMb} MB).`,
      ``,
      `After we receive it, the BDN enters OCR, AI extraction, validation and review.`,
      `You will be notified when it is received and again when processing completes.`,
    ].join("\n");

    return { address, acceptedTypes, maxSizeMb, workflow, text };
  }

  return { info };
}
