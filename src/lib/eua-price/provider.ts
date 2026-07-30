/**
 * EUA Price provider abstraction.
 *
 * In Phase 2C.3 only the mock provider is active. A real market feed
 * (e.g. ICE, EEX) can be wired in later by implementing `EuaPriceProvider`.
 */

export interface EuaPriceProvider {
  readonly name: string;
  getPrice(): Promise<number | null>;
}

// ── Mock provider ──────────────────────────────────────────────────────────

export class MockEuaPriceProvider implements EuaPriceProvider {
  readonly name = "mock";

  /**
   * Returns a fixed deterministic price (EUR per tonne CO₂).
   * This is an INDICATIVE figure, not a live market price.
   */
  async getPrice(): Promise<number | null> {
    return 75.50;
  }
}

// ── Real provider seam ─────────────────────────────────────────────────────

/**
 * Placeholder for a future real provider.
 * @internal — not ready for production use.
 */
export class RealEuaPriceProvider implements EuaPriceProvider {
  readonly name = "real";

  async getPrice(): Promise<number | null> {
    // Not yet implemented — returns null to indicate price unavailable.
    return null;
  }
}

// ── Default ────────────────────────────────────────────────────────────────

let defaultProvider: EuaPriceProvider = new MockEuaPriceProvider();

export function setDefaultEuaPriceProvider(provider: EuaPriceProvider): void {
  defaultProvider = provider;
}

export function getDefaultEuaPriceProvider(): EuaPriceProvider {
  return defaultProvider;
}

/**
 * Convenience function: get the current EUA price from default provider.
 */
export async function getEuaPrice(): Promise<number | null> {
  return defaultProvider.getPrice();
}
