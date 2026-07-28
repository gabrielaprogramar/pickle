/**
 * verify-marinetraffic.ts — end-to-end smoke test of the mocked pipeline
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * A single command (`npm run verify:mt`) that proves the entire Phase 1A module
 * works end-to-end with NO API key and NO network: config → transport (mock) →
 * parse → fused Voyage. It exercises the real public surface
 * (createMarineTrafficClient().getVoyageByIMO) against the realistic fixtures.
 *
 * It is intentionally human-readable output — not a unit test — so a developer
 * (or CI) can eyeball that the fused Voyage has every Phase 1 field populated:
 *   vessel name, IMO, departure port + time, arrival port + time, distance.
 *
 * Run via: npm run verify:mt
 */

import { createMarineTrafficClient } from "../src/lib/marinetraffic/client";
import { InvalidIMOError, VesselNotFoundError } from "../src/lib/marinetraffic/errors";

const PRIMARY_IMO = "9074729"; // "Aurelia" — full fixture (forecast + port calls)
const SECONDARY_IMO = "9707211"; // "Calypso Nova" — forecast only
const UNKNOWN_IMO = "1234567"; // valid checksum, no fixture → exercises the not-found path

function line(label: string, value: unknown): void {
  const pad = label.length < 28 ? " ".repeat(28 - label.length) : "";
  console.log(`  ${label}${pad}${value}`);
}

/** Safe name extraction for a caught `unknown` value. */
function typeName(err: unknown): string {
  if (err instanceof Error) return err.constructor.name;
  if (typeof err === "object" && err !== null && "constructor" in err) {
    return String((err as { constructor: { name: string } }).constructor.name);
  }
  return typeof err;
}

async function runOne(imo: string, label: string): Promise<boolean> {
  console.log(`\n────────────────────────────────────────────────────────`);
  console.log(` ${label} — IMO ${imo}`);
  console.log(`────────────────────────────────────────────────────────`);

  const client = createMarineTrafficClient();
  try {
    const voyage = await client.getVoyageByIMO(imo);
    line("vessel.name", voyage.vessel.name);
    line("vessel.imo", voyage.vessel.imo);
    line("departure.port", voyage.departure.port.name);
    line("departure.port.id", voyage.departure.port.id);
    line("departure.timestamp", voyage.departure.timestamp);
    line("arrival.port", voyage.arrival.port.name);
    line("arrival.port.id", voyage.arrival.port.id);
    line("arrival.timestamp", voyage.arrival.timestamp);
    line("distanceNm", voyage.distanceNm);
    line("source.mock", voyage.source.mock);
    line("source.fetchedAt", voyage.source.fetchedAt);
    return true;
  } catch (err) {
    console.log(`  ✗ threw ${(err as Error).constructor.name}: ${(err as Error).message}`);
    return false;
  }
}

async function runErrorPaths(): Promise<boolean> {
  console.log(`\n────────────────────────────────────────────────────────`);
  console.log(` Error path coverage`);
  console.log(`────────────────────────────────────────────────────────`);
  const client = createMarineTrafficClient();
  let ok = true;

  // Invalid IMO (bad check digit) → InvalidIMOError.
  try {
    await client.getVoyageByIMO("9707212");
    console.log("  ✗ bad-check-digit IMO did NOT throw");
    ok = false;
  } catch (err) {
    const pass = err instanceof InvalidIMOError;
    console.log(`  ${pass ? "✓" : "✗"} invalid IMO → ${typeName(err)}`);
    ok = ok && pass;
  }

  // Unknown IMO → VesselNotFoundError.
  try {
    await client.getVoyageByIMO(UNKNOWN_IMO);
    console.log("  ✗ unknown IMO did NOT throw");
    ok = false;
  } catch (err) {
    const pass = err instanceof VesselNotFoundError;
    console.log(`  ${pass ? "✓" : "✗"} unknown IMO → ${typeName(err)}`);
    ok = ok && pass;
  }

  return ok;
}

async function main(): Promise<void> {
  console.log("\nPoseidon Ledger — MarineTraffic module (Phase 1A) end-to-end verify");
  console.log("Mode: MOCKED (no API key, no network)\n");

  const r1 = await runOne(PRIMARY_IMO, "Primary vessel (forecast + port calls)");
  const r2 = await runOne(SECONDARY_IMO, "Secondary vessel (forecast only)");
  const r3 = await runErrorPaths();

  const allOk = r1 && r2 && r3;
  console.log(
    `\n  ${allOk ? "✓ ALL CHECKS PASSED" : "✗ ONE OR MORE CHECKS FAILED"}\n`,
  );
  process.exitCode = allOk ? 0 : 1;
}

main().catch((err) => {
  console.error("Verify script crashed:", err);
  process.exitCode = 1;
});
