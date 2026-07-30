import { DefaultMapProvider } from "./provider";
import type { MapProviderConfig } from "./types";

export class MockMapProvider extends DefaultMapProvider {
  override readonly name = "mock";

  constructor() {
    super({
      provider: "mock",
      isMock: true,
    });
  }

  static createConfig(): MapProviderConfig {
    const p = new MockMapProvider();
    return p.getConfig();
  }
}
