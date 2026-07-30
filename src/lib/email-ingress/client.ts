import type { EmailIngressProvider, MockEmailIngressProvider } from "./provider";
import { createMockEmailIngressProvider } from "./mock-provider";

let cachedProvider: EmailIngressProvider | null = null;

export function getEmailIngressProvider(): EmailIngressProvider {
  if (cachedProvider) return cachedProvider;
  cachedProvider = createMockEmailIngressProvider();
  return cachedProvider;
}

export function getMockEmailIngressProvider(): MockEmailIngressProvider {
  const provider = getEmailIngressProvider();
  if (!("setScenario" in provider)) {
    throw new Error("Current provider is not a MockEmailIngressProvider");
  }
  return provider as MockEmailIngressProvider;
}

export function createEmailIngressProvider(): EmailIngressProvider {
  return createMockEmailIngressProvider();
}

export function _resetEmailIngressProviderForTest(): void {
  cachedProvider = null;
}
