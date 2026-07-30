/**
 * mock-ais-data.ts — Synthetic AIS track fixture for Aurelia (IMO 9074729)
 * sailing Antibes → Palma de Mallorca.
 *
 * 25 position fixes at ~30-minute intervals along a realistic route.
 * Antibes (43.58, 7.13) → Palma (39.57, 2.64).
 */

import type { AisPositionInsert } from "../../supabase/types";

export const AURELIA_VESSEL_ID = "00000000-0000-0000-0000-000000000001";

export const MOCK_AURELIA_AIS_POSITIONS: AisPositionInsert[] = [
  // Departing Antibes
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T06:00:00Z", latitude: 43.5804, longitude: 7.1251, sog: 0.0, cog: 180.0, heading: 180.0, nav_status: "moored" },
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T06:30:00Z", latitude: 43.5600, longitude: 7.1300, sog: 5.2, cog: 185.0, heading: 185.0, nav_status: "under way" },
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T07:00:00Z", latitude: 43.5200, longitude: 7.1400, sog: 10.1, cog: 190.0, heading: 190.0, nav_status: "under way" },
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T07:30:00Z", latitude: 43.4700, longitude: 7.1500, sog: 12.3, cog: 192.0, heading: 192.0, nav_status: "under way" },
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T08:00:00Z", latitude: 43.4100, longitude: 7.1600, sog: 13.0, cog: 195.0, heading: 195.0, nav_status: "under way" },
  // Coast of Corsica
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T08:30:00Z", latitude: 43.3400, longitude: 7.1200, sog: 13.5, cog: 200.0, heading: 200.0, nav_status: "under way" },
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T09:00:00Z", latitude: 43.2600, longitude: 7.0500, sog: 13.2, cog: 210.0, heading: 210.0, nav_status: "under way" },
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T09:30:00Z", latitude: 43.1800, longitude: 6.9500, sog: 13.8, cog: 215.0, heading: 215.0, nav_status: "under way" },
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T10:00:00Z", latitude: 43.0900, longitude: 6.8300, sog: 14.0, cog: 220.0, heading: 220.0, nav_status: "under way" },
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T10:30:00Z", latitude: 43.0000, longitude: 6.7000, sog: 13.5, cog: 225.0, heading: 225.0, nav_status: "under way" },
  // Bonifacio Strait
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T11:00:00Z", latitude: 42.9000, longitude: 6.5800, sog: 12.8, cog: 230.0, heading: 230.0, nav_status: "under way" },
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T11:30:00Z", latitude: 42.7900, longitude: 6.4500, sog: 12.5, cog: 235.0, heading: 235.0, nav_status: "under way" },
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T12:00:00Z", latitude: 42.6800, longitude: 6.3200, sog: 12.0, cog: 240.0, heading: 240.0, nav_status: "under way" },
  // Sardinia north
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T12:30:00Z", latitude: 42.5500, longitude: 6.1500, sog: 11.8, cog: 245.0, heading: 245.0, nav_status: "under way" },
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T13:00:00Z", latitude: 42.4000, longitude: 5.9500, sog: 12.2, cog: 250.0, heading: 250.0, nav_status: "under way" },
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T13:30:00Z", latitude: 42.2500, longitude: 5.7500, sog: 12.5, cog: 255.0, heading: 255.0, nav_status: "under way" },
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T14:00:00Z", latitude: 42.1000, longitude: 5.5500, sog: 12.8, cog: 258.0, heading: 258.0, nav_status: "under way" },
  // Sardinia west → Balearics
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T14:30:00Z", latitude: 41.9300, longitude: 5.3000, sog: 13.0, cog: 260.0, heading: 260.0, nav_status: "under way" },
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T15:00:00Z", latitude: 41.7500, longitude: 5.0500, sog: 13.2, cog: 262.0, heading: 262.0, nav_status: "under way" },
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T15:30:00Z", latitude: 41.5500, longitude: 4.7500, sog: 13.5, cog: 265.0, heading: 265.0, nav_status: "under way" },
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T16:00:00Z", latitude: 41.3500, longitude: 4.4500, sog: 13.0, cog: 268.0, heading: 268.0, nav_status: "under way" },
  // Approaching Mallorca
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T16:30:00Z", latitude: 41.1500, longitude: 4.1000, sog: 12.5, cog: 270.0, heading: 270.0, nav_status: "under way" },
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T17:00:00Z", latitude: 40.8000, longitude: 3.6000, sog: 12.0, cog: 275.0, heading: 275.0, nav_status: "under way" },
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T17:30:00Z", latitude: 40.1000, longitude: 3.1000, sog: 10.5, cog: 280.0, heading: 280.0, nav_status: "under way" },
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T18:00:00Z", latitude: 39.5700, longitude: 2.6400, sog: 8.0, cog: 290.0, heading: 290.0, nav_status: "under way" },
  // Arriving Palma
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T18:30:00Z", latitude: 39.5600, longitude: 2.6200, sog: 4.0, cog: 300.0, heading: 300.0, nav_status: "under way" },
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T19:00:00Z", latitude: 39.5500, longitude: 2.6100, sog: 1.5, cog: 310.0, heading: 310.0, nav_status: "moored" },
  { vessel_id: AURELIA_VESSEL_ID, ts: "2026-05-15T19:30:00Z", latitude: 39.5450, longitude: 2.6050, sog: 0.0, cog: 0.0, heading: 0.0, nav_status: "moored" },
];
