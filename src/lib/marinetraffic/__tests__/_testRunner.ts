/**
 * _testRunner.ts — minimal dependency-free test harness
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Phase 1A needs unit tests but adding a full test runner (Vitest/Jest) is out
 * of scope for "only the MarineTraffic module". This ~40-line harness gives us
 * `describe/it/expect` ergonomics, async support, and clean pass/fail output
 * with zero new dependencies. tsx runs these .ts files directly.
 *
 * When a later phase adopts a real test framework, these tests port verbatim —
 * only this harness file is deleted.
 */

export type TestFn = () => void | Promise<void>;

interface TestResult {
  readonly name: string;
  readonly passed: boolean;
  readonly error?: string;
}

const results: TestResult[] = [];
let currentSuite = "";

export function describe(name: string, fn: () => void): void {
  currentSuite = name;
  try {
    fn();
  } catch (err) {
    results.push({
      name: `${name} (suite body)`,
      passed: false,
      error: err instanceof Error ? err.stack ?? err.message : String(err),
    });
  } finally {
    currentSuite = "";
  }
}

export function it(name: string, fn: TestFn): void {
  const fullName = currentSuite ? `${currentSuite} › ${name}` : name;
  try {
    const result = fn();
    if (result instanceof Promise) {
      // Queue async test; run() awaits all of them.
      pendingAsync.push(
        result.then(
          () => {
            results.push({ name: fullName, passed: true });
          },
          (err) => {
            results.push({
              name: fullName,
              passed: false,
              error: err instanceof Error ? err.stack ?? err.message : String(err),
            });
          },
        ),
      );
    } else {
      results.push({ name: fullName, passed: true });
    }
  } catch (err) {
    results.push({
      name: fullName,
      passed: false,
      error: err instanceof Error ? err.stack ?? err.message : String(err),
    });
  }
}

const pendingAsync: Promise<void>[] = [];

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (!Object.is(actual, expected)) {
        throw new Error(`Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`);
      }
    },
    toEqual(expected: unknown) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(
          `Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`,
        );
      }
    },
    toBeNull() {
      if (actual !== null) throw new Error(`Expected null, got ${JSON.stringify(actual)}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`);
    },
    toContain(expected: T extends (infer U)[] ? U : never) {
      if (!Array.isArray(actual) || !actual.includes(expected)) {
        throw new Error(`Expected array to contain ${JSON.stringify(expected)}`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (!(Number(actual) > expected)) {
        throw new Error(`Expected ${String(actual)} > ${expected}`);
      }
    },
    toBeLessThanOrEqual(expected: number) {
      if (!(Number(actual) <= expected)) {
        throw new Error(`Expected ${String(actual)} <= ${expected}`);
      }
    },
    toContainString(expected: string) {
      if (typeof actual !== "string" || !actual.includes(expected)) {
        throw new Error(`Expected string to contain "${expected}", got ${JSON.stringify(actual)}`);
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async toThrow(expected?: string | (new (...args: any[]) => Error)) {
      if (typeof actual !== "function") {
        throw new Error("toThrow expects a function");
      }
      let threw = false;
      let caught: unknown;
      try {
        const r = (actual as () => unknown | Promise<unknown>)();
        if (r instanceof Promise) await r;
      } catch (err) {
        threw = true;
        caught = err;
      }
      if (!threw) throw new Error("Expected function to throw, but it did not");
      if (expected === undefined) return;
      if (typeof expected === "string") {
        const msg = caught instanceof Error ? caught.message : String(caught);
        if (!msg.includes(expected)) {
          throw new Error(`Expected error message to include "${expected}", got "${msg}"`);
        }
        return;
      }
      // expected is an error class constructor.
      if (!(caught instanceof expected)) {
        const gotName = caught instanceof Error ? caught.constructor.name : typeof caught;
        throw new Error(
          `Expected thrown error to be instance of ${expected.name}, got ${gotName}`,
        );
      }
    },
  };
}

// Overload: expect(fn) for toThrow, expect(value) otherwise. TS merges them.
export { expect };

export async function run(): Promise<void> {
  await Promise.all(pendingAsync);
  pendingAsync.length = 0;
  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);

  for (const r of passed) {
    console.log(`  \u2713 ${r.name}`);
  }
  for (const r of failed) {
    console.log(`  \u2717 ${r.name}`);
    if (r.error) console.log(`      ${r.error.split("\n").join("\n      ")}`);
  }

  console.log("");
  console.log(
    `  ${passed.length} passed, ${failed.length} failed, ${results.length} total`,
  );
  if (failed.length > 0) process.exitCode = 1;
}
