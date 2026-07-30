-- 0009_init_map_and_zones.sql
-- Environmental zones, port calls, zone events for Phase 2C.4.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. ENVIRONMENTAL ZONES ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS environmental_zones (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                        TEXT NOT NULL UNIQUE,
  name                        TEXT NOT NULL,
  category                    TEXT NOT NULL CHECK (category IN ('ECA_SOX', 'ECA_NOX', 'SECA', 'PSSA', 'MED_BALLAST', 'PORT_CONTROL')),
  geometry_type               TEXT NOT NULL DEFAULT 'POLYGON',
  geometry_coordinates        JSONB NOT NULL,
  description                 TEXT,
  regulation_reference        TEXT,
  geometry_version            TEXT NOT NULL DEFAULT '1.0',
  jurisdiction                TEXT,
  effective_from              DATE NOT NULL,
  effective_until             DATE,
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_env_zones_category ON environmental_zones(category);
CREATE INDEX IF NOT EXISTS idx_env_zones_code ON environmental_zones(code);
CREATE INDEX IF NOT EXISTS idx_env_zones_active ON environmental_zones(is_active);

-- 2. PORT CALLS ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS port_calls (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id                   UUID NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  voyage_id                   UUID REFERENCES voyages(id) ON DELETE SET NULL,
  port_name                   TEXT NOT NULL,
  port_id                     TEXT,
  port_country                TEXT,
  port_latitude               NUMERIC(9,6),
  port_longitude              NUMERIC(9,6),
  arr_ts                      TIMESTAMPTZ,
  dep_ts                      TIMESTAMPTZ,
  is_mock                     BOOLEAN NOT NULL DEFAULT FALSE,
  source                      TEXT NOT NULL DEFAULT 'marine_traffic',
  source_fetched_at           TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_port_calls_vessel ON port_calls(vessel_id);
CREATE INDEX IF NOT EXISTS idx_port_calls_voyage ON port_calls(voyage_id);
CREATE INDEX IF NOT EXISTS idx_port_calls_arr_ts ON port_calls(arr_ts DESC);
CREATE INDEX IF NOT EXISTS idx_port_calls_port_name ON port_calls(port_name);

COMMENT ON TABLE port_calls IS 'Vessel port-call history with arrival/departure timestamps.';

-- 3. ZONE EVENTS ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS zone_events (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id                   UUID NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  zone_id                     UUID NOT NULL REFERENCES environmental_zones(id) ON DELETE CASCADE,
  event_type                  TEXT NOT NULL CHECK (event_type IN ('ENTRY', 'EXIT', 'WITHIN', 'ALERT')),
  ais_position_id             UUID REFERENCES ais_positions(id) ON DELETE SET NULL,
  detected_at                 TIMESTAMPTZ NOT NULL,
  entry_ts                    TIMESTAMPTZ,
  exit_ts                     TIMESTAMPTZ,
  duration_minutes            INTEGER,
  coordinates                 JSONB,
  details                     JSONB,
  calculation_version         TEXT NOT NULL DEFAULT '1.0',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zone_events_vessel ON zone_events(vessel_id);
CREATE INDEX IF NOT EXISTS idx_zone_events_zone ON zone_events(zone_id);
CREATE INDEX IF NOT EXISTS idx_zone_events_detected ON zone_events(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_zone_events_type ON zone_events(event_type);

COMMENT ON TABLE zone_events IS 'Zone entry/exit/alert events for environmental compliance tracking.';

-- 4. VESSEL TRACKS (cached AIS track for map rendering) ────────────────────

CREATE TABLE IF NOT EXISTS vessel_tracks (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id                   UUID NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  voyage_id                   UUID REFERENCES voyages(id) ON DELETE CASCADE,
  track                       JSONB NOT NULL,
  point_count                 INTEGER NOT NULL DEFAULT 0,
  distance_nm                 NUMERIC(10,2),
  start_ts                    TIMESTAMPTZ NOT NULL,
  end_ts                      TIMESTAMPTZ NOT NULL,
  calculation_version         TEXT NOT NULL DEFAULT '1.0',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vessel_tracks_vessel ON vessel_tracks(vessel_id);
CREATE INDEX IF NOT EXISTS idx_vessel_tracks_voyage ON vessel_tracks(voyage_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vessel_tracks_vessel_voyage ON vessel_tracks(vessel_id, voyage_id);

COMMENT ON TABLE vessel_tracks IS 'Cached processed AIS track for a vessel on a specific voyage.';

-- 5. MAP CONFIG (client-safe map provider configuration) ───────────────────

CREATE TABLE IF NOT EXISTS map_config (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider                    TEXT NOT NULL DEFAULT 'mock',
  tile_url                    TEXT,
  tile_attribution            TEXT,
  default_center_lat          NUMERIC(9,6) NOT NULL DEFAULT 38.0,
  default_center_lng          NUMERIC(9,6) NOT NULL DEFAULT 15.0,
  default_zoom                INTEGER NOT NULL DEFAULT 5,
  min_zoom                    INTEGER NOT NULL DEFAULT 2,
  max_zoom                    INTEGER NOT NULL DEFAULT 18,
  is_mock                     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE map_config IS 'Client-safe map tile provider configuration (never exposes API keys).';

-- Seed the default map config row.
INSERT INTO map_config (provider, tile_url, tile_attribution, is_mock)
VALUES (
  'mock',
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
  TRUE
) ON CONFLICT DO NOTHING;

-- Seed the Mediterranean SOx ECA zone (approximate bounding polygon).
INSERT INTO environmental_zones (code, name, category, geometry_type, geometry_coordinates, description, regulation_reference, effective_from, jurisdiction)
VALUES (
  'MED_SOX_ECA',
  'Mediterranean Sea SOx Emission Control Area',
  'ECA_SOX',
  'POLYGON',
  '[[[-5.0,35.0],[5.0,35.0],[5.0,46.0],[30.0,46.0],[30.0,36.0],[36.0,36.0],[36.0,32.0],[20.0,30.0],[10.0,30.0],[-5.0,35.0],[-5.0,35.0]]]',
  'Mediterranean Sea designated as SOx ECA under MARPOL Annex VI, effective 1 May 2025. Fuel sulphur content not to exceed 0.10% m/m.',
  'MARPOL Annex VI, Regulation 14; IMO MEPC.361(79)',
  '2025-05-01',
  'Mediterranean Sea — all riparian states'
) ON CONFLICT (code) DO NOTHING;

-- Seed the EU Port Control zone (ports in EU/EEA).
INSERT INTO environmental_zones (code, name, category, geometry_type, geometry_coordinates, description, regulation_reference, effective_from, jurisdiction)
VALUES (
  'EU_PORT_CONTROL',
  'EU Port / EEA Jurisdiction',
  'PORT_CONTROL',
  'MULTIPOLYGON',
  '[[[0.0,50.0],[3.0,51.5],[5.0,52.0],[8.0,53.5],[10.0,54.0],[12.0,54.5],[15.0,54.5],[18.0,54.0],[20.0,54.5],[22.0,55.5],[24.0,56.0],[24.0,57.0],[22.0,58.0],[20.0,58.0],[18.0,57.5],[15.0,57.0],[12.0,56.0],[10.0,55.5],[8.0,55.0],[6.0,54.5],[4.0,54.0],[2.0,53.5],[0.0,52.5],[-2.0,52.0],[-4.0,51.5],[-6.0,51.0],[-8.0,50.0],[-8.0,49.0],[-6.0,48.5],[-4.0,48.0],[-2.0,47.5],[0.0,47.0],[2.0,46.5],[4.0,46.0],[6.0,45.5],[8.0,44.5],[10.0,44.0],[12.0,43.5],[14.0,43.0],[15.0,42.0],[15.0,40.0],[14.0,39.0],[12.0,38.5],[10.0,38.0],[8.0,38.0],[6.0,37.5],[4.0,37.5],[2.0,37.0],[0.0,36.5],[-2.0,36.5],[-4.0,37.0],[-6.0,37.5],[-8.0,38.0],[-10.0,38.0],[-10.0,40.0],[-10.0,42.0],[-10.0,44.0],[-9.0,46.0],[-8.0,48.0],[-6.0,49.0],[-4.0,50.0],[-2.0,50.5],[0.0,50.0]]]',
  'Approximate boundary of EU/EEA member states for port state control and EU ETS applicability.',
  'EU MRV Regulation (EU) 2015/757; EU ETS Directive 2003/87/EC',
  '2015-01-01',
  'EU/EEA member states'
) ON CONFLICT (code) DO NOTHING;
