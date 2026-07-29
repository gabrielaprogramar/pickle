import { createMockReviewProvider } from "./mock-review";
import type { ReviewProvider } from "./types";

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

let cached: ReviewProvider | null = null;

export function getReviewProvider(): ReviewProvider {
  if (cached) return cached;

  const useMock = parseBoolean(process.env.REVIEW_USE_MOCK, true);

  if (useMock) {
    cached = createMockReviewProvider();
  } else {
    cached = createMockReviewProvider();
  }

  return cached;
}

export function createReviewProvider(): ReviewProvider {
  return createMockReviewProvider();
}

export function _resetReviewProviderForTest(): void {
  cached = null;
}
