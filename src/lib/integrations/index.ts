/**
 * index.ts — public barrel for the integrations module
 */
export { INTEGRATIONS, getIntegration, isIntegrationProvider } from "./catalog";
export type {
  IntegrationProvider,
  IntegrationCatalogEntry,
} from "./catalog";
export { encryptConfig, decryptConfig, isEnvelope } from "./credentials";
