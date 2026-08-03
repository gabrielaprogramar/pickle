/**
 * catalog.ts — integration catalog (Phase 4.5)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The canonical list of external integrations surfaced in Settings →
 * Integrations. Every entry is intentionally NOT wired to a live provider in
 * Phase 4.5: config forms store values (mock-encrypted) but nothing is ever
 * called. `status` derives purely from whether a credential row exists with
 * status CONFIGURED.
 */

export type IntegrationProvider =
  | "marinetraffic"
  | "google_docai"
  | "openai"
  | "resend"
  | "ais";

export interface IntegrationCatalogEntry {
  readonly provider: IntegrationProvider;
  readonly name: string;
  readonly description: string;
  readonly category: "Data" | "AI" | "Email" | "Fleet";
  readonly configured: boolean;
  readonly docsUrl: string;
  /** Fields the config form collects. Values are mock-encrypted at rest. */
  readonly fields: readonly { readonly key: string; readonly label: string; readonly secret: boolean }[];
}

export const INTEGRATIONS: readonly IntegrationCatalogEntry[] = [
  {
    provider: "marinetraffic",
    name: "MarineTraffic",
    description: "Live AIS positions, vessel tracking and port calls.",
    category: "Fleet",
    configured: false,
    docsUrl: "https://www.marinetraffic.com",
    fields: [
      { key: "apiKey", label: "API Key", secret: true },
      { key: "endpoint", label: "Endpoint URL", secret: false },
    ],
  },
  {
    provider: "google_docai",
    name: "Google Document AI",
    description: "OCR and document understanding for bunker and logbook ingestion.",
    category: "AI",
    configured: false,
    docsUrl: "https://cloud.google.com/document-ai",
    fields: [
      { key: "projectId", label: "Project ID", secret: false },
      { key: "location", label: "Location", secret: false },
      { key: "processorId", label: "Processor ID", secret: false },
      { key: "serviceAccountKey", label: "Service Account Key (JSON)", secret: true },
    ],
  },
  {
    provider: "openai",
    name: "OpenAI",
    description: "LLM-powered extraction and assistant capabilities.",
    category: "AI",
    configured: false,
    docsUrl: "https://openai.com",
    fields: [
      { key: "apiKey", label: "API Key", secret: true },
      { key: "organization", label: "Organization ID", secret: false },
    ],
  },
  {
    provider: "resend",
    name: "Resend",
    description: "Transactional email for invites, notifications and reports.",
    category: "Email",
    configured: false,
    docsUrl: "https://resend.com",
    fields: [
      { key: "apiKey", label: "API Key", secret: true },
      { key: "fromAddress", label: "From Address", secret: false },
    ],
  },
  {
    provider: "ais",
    name: "AIS",
    description: "AIS data feed for vessel monitoring and anomaly detection.",
    category: "Data",
    configured: false,
    docsUrl: "https://www.imo.org",
    fields: [
      { key: "apiKey", label: "API Key", secret: true },
      { key: "endpoint", label: "Feed Endpoint", secret: false },
    ],
  },
];

const INDEX: Readonly<Record<string, IntegrationCatalogEntry>> = INTEGRATIONS.reduce(
  (acc, entry) => {
    acc[entry.provider] = entry;
    return acc;
  },
  {} as Record<string, IntegrationCatalogEntry>,
);

export function getIntegration(provider: string): IntegrationCatalogEntry | null {
  return INDEX[provider] ?? null;
}

export function isIntegrationProvider(value: string): value is IntegrationProvider {
  return getIntegration(value) !== null;
}
