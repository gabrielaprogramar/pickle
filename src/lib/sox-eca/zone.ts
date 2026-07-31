/**
 * sox-eca/zone.ts — Med SOx ECA zone resolution + transition state
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Reuses the existing geo engine (`@/lib/geo`): the same `pointInZone` /
 * `detectZoneTransition` used by the Green Zone module. No second
 * point-in-polygon implementation lives here.
 */

import { pointInZone, detectZoneTransition } from "@/lib/geo";
import type { EnvironmentalZone, GeoPoint } from "@/lib/geo";
import { MED_SOX_ECA_CODE } from "./parameters";
import type { ZoneState } from "./types";

/** Convert a persisted environmental_zone row into the domain shape. */
export function toEnvironmentalZone(
  row: {
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly category: string;
    readonly geometry_type: string;
    readonly geometry_coordinates: unknown;
    readonly description: string | null;
    readonly regulation_reference: string | null;
    readonly geometry_version: string;
    readonly jurisdiction: string | null;
    readonly effective_from: string;
    readonly effective_until: string | null;
    readonly is_active: boolean;
  },
): EnvironmentalZone {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category as EnvironmentalZone["category"],
    geometryType: row.geometry_type,
    geometryCoordinates:
      row.geometry_coordinates as EnvironmentalZone["geometryCoordinates"],
    description: row.description,
    regulationReference: row.regulation_reference,
    geometryVersion: row.geometry_version,
    jurisdiction: row.jurisdiction,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until,
    isActive: row.is_active,
  };
}

/** Is the zone the Med SOx ECA (by code) and geometrically usable? */
export function isMedSoxZone(zone: EnvironmentalZone | null): boolean {
  return zone !== null && zone.code === MED_SOX_ECA_CODE && zone.isActive;
}

export function hasUsableGeometry(zone: EnvironmentalZone | null): boolean {
  if (!zone) return false;
  if (zone.geometryType !== "POLYGON" && zone.geometryType !== "MULTIPOLYGON") {
    return false;
  }
  if (!Array.isArray(zone.geometryCoordinates)) return false;
  const first = zone.geometryCoordinates[0];
  if (!first || !Array.isArray(first)) return false;
  const ring = first as unknown[];
  return Array.isArray(ring) && ring.length >= 3;
}

/**
 * Compute the geometric zone state for the current evaluation, reusing the
 * geo engine's transition detector when a previous position is available.
 */
export function computeZoneState(
  previousZoneState: ZoneState | null,
  position: { readonly lat: number; readonly lng: number } | null,
  previousPosition: { readonly lat: number; readonly lng: number } | null,
  zone: EnvironmentalZone | null,
): ZoneState {
  if (!position) return "OUTSIDE";
  if (!zone) return "OUTSIDE";
  if (!hasUsableGeometry(zone)) return "OUTSIDE";
  const current: GeoPoint = { lat: position.lat, lng: position.lng };

  if (previousPosition) {
    const prev: GeoPoint = { lat: previousPosition.lat, lng: previousPosition.lng };
    const transition = detectZoneTransition(prev, current, zone);
    if (transition === "ENTRY") return "ENTRY";
    if (transition === "EXIT") return "EXIT";
    if (transition === "WITHIN") return "WITHIN";
    return "OUTSIDE";
  }

  // No previous position: fall back to the last known state + current containment.
  if (pointInZone(current, zone)) {
    if (previousZoneState === "OUTSIDE" || previousZoneState === null) return "ENTRY";
    return previousZoneState === "EXIT" ? "ENTRY" : "WITHIN";
  }
  if (previousZoneState === "ENTRY" || previousZoneState === "WITHIN") return "EXIT";
  return "OUTSIDE";
}

/** Is a position inside the ECA geometry? Reuses the geo engine. */
export function isInsideZone(
  position: { readonly lat: number; readonly lng: number } | null,
  zone: EnvironmentalZone | null,
): boolean {
  if (!position) return false;
  if (!zone) return false;
  if (!hasUsableGeometry(zone)) return false;
  return pointInZone({ lat: position.lat, lng: position.lng }, zone);
}
