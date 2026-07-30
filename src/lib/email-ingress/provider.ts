import type { EmailPayload, IngressResult, IngressScenario } from "./types";

export interface EmailIngressProvider {
  ingest(payload: EmailPayload): Promise<IngressResult>;
}

export interface MockEmailIngressProvider extends EmailIngressProvider {
  setScenario(scenario: IngressScenario): void;
  currentScenario(): IngressScenario;
}
