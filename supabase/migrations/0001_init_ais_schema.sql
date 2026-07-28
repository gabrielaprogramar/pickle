-- ════════════════════════════════════════════════════════════════════════════
-- Poseidon Ledger — AIS Ingestion Schema (Phase 1B)
-- Migration: 0001_init_ais_schema
-- ───────────────────────────────────────────────────────────────────────────
-- WHY THIS FILE EXISTS
--   This is the SINGLE source of truth for the Phase 1B database shape. Every
--   TypeScript row type and repository maps to a definition here. Never edit
--   the runtime schema by hand in Supabase Studio — apply this migration so the
--   definition is version-controlled and reproducible.
--
--   Three tables, designed for AIS ingestion:
--     vessels       — one row per vessel (canonical identity keyed by IMO)
--     voyages       — one row per port-to-port leg, owned by a vessel
--     ais_positions — high-volume time-series of fixes, owned by a vessel
--
--   Design notes:
--     • id columns are UUID v4 (gen_random_uuid) — avoids sequential ID guessing
--       and lets us merge rows across environments safely.
--     • IMO is stored as a 7-char string with a CHECK enforcing the format, and
--       UNIQUE so two vessel rows can never share an IMO.
--     • All timestamps are TIMESTAMPTZ (UTC). The application always writes ISO.
--     • voyages.departure_port_name/arrival_port_name are denormalized strings.
--       MarineTraffic gives port names as text (with optional numeric IDs in a
--       separate lookup). For Phase 1 we store the text directly; a future
--       `ports` dimension table can normalize this without a breaking change.
--     • ais_positions is partitioning-ready: indexed on (vessel_id, ts DESC) so
--       the common query "latest fix for a vessel" is an index-only lookup.
--     • Row-Level Security is ENABLED everywhere and locked to the service role
--       for Phase 1B. The Next.js API route will run server-side with the
--       service role, so anon/authenticated keys never reach these tables. RLS
--       policies are added as defensive defaults (deny-by-empty) so that even a
--       leaked anon key cannot read or write.
-- ════════════════════════════════════════════════════════════════════════════

-- Required extensions --------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- ────────────────────────────────────────────────────────────────────────────
-- 1. VESSELS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE vessels (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    imo             char(7)     NOT NULL,
    name            text        NOT NULL,
    -- Optional identifying fields MarineTraffic returns alongside a voyage. NULL
    -- when the upstream did not provide them; never required for ingest.
    mmsi            text,
    ship_id         text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    -- IMO is always 7 ASCII digits. The check digit itself is validated in the
    -- application layer (Phase 1A: parse.normalizeImo) before insert, but the
    -- DB enforces the shape as a second line of defense.
    CONSTRAINT vessels_imo_format CHECK (imo ~ '^[0-9]{7}$')
);

CREATE UNIQUE INDEX vessels_imo_uniq      ON vessels (imo);
CREATE INDEX        vessels_name_idx      ON vessels (name);
CREATE INDEX        vessels_mmsi_idx      ON vessels (mmsi) WHERE mmsi IS NOT NULL;

COMMENT ON TABLE  vessels        IS 'One row per vessel. Canonical identity keyed by IMO (7-digit, unique).';
COMMENT ON COLUMN vessels.imo    IS '7-digit IMO number, ASCII digits only. Validated by app layer + DB CHECK.';
COMMENT ON COLUMN vessels.mmsi   IS '9-digit Maritime Mobile Service Identity. Nullable — MT may omit it.';
COMMENT ON COLUMN vessels.ship_id IS 'MarineTraffic internal ship identifier (string). Nullable.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. VOYAGES
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE voyages (
    id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id            uuid        NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
    -- The originating MarineTraffic voyage forecast fetched_at, captured for
    -- audit/provenance. Matches Phase 1A VoyageSource.fetchedAt.
    source_fetched_at    timestamptz NOT NULL,
    -- Provenance flag from Phase 1A. false once the real API is wired in.
    source_is_mock       boolean     NOT NULL DEFAULT true,
    -- Denormalized port text (see header). Port IDs are optional and nullable.
    departure_port_name  text        NOT NULL,
    departure_port_id    text,
    departure_time       timestamptz,
    arrival_port_name    text        NOT NULL,
    arrival_port_id      text,
    arrival_time         timestamptz,
    -- Voyage distance in nautical miles. Nullable: the upstream may omit it.
    distance_nm          numeric(8,2),
    created_at           timestamptz NOT NULL DEFAULT now(),

    -- A voyage must describe a real leg: at least one of departure/arrival time
    -- must be present. Both-null rows are useless for compliance and rejected.
    CONSTRAINT voyages_has_timestamp CHECK (
        departure_time IS NOT NULL OR arrival_time IS NOT NULL
    ),
    -- Logical ordering sanity check: if both times exist, arrival must not
    -- precede departure. (Equal is allowed to tolerate ETA == departure edge.)
    CONSTRAINT voyages_time_order CHECK (
        departure_time IS NULL OR arrival_time IS NULL OR arrival_time >= departure_time
    ),
    -- Distance is a positive magnitude when present.
    CONSTRAINT voyages_distance_nonneg CHECK (distance_nm IS NULL OR distance_nm >= 0)
);

CREATE INDEX voyages_vessel_id_idx        ON voyages (vessel_id);
CREATE INDEX voyages_departure_time_idx   ON voyages (departure_time DESC);
CREATE INDEX voyages_arrival_time_idx     ON voyages (arrival_time DESC);
-- Composite index supports "latest voyage for a vessel" in one seek.
CREATE INDEX voyages_vessel_departure_idx ON voyages (vessel_id, departure_time DESC);

COMMENT ON TABLE  voyages                    IS 'One row per port-to-port voyage leg, owned by a vessel.';
COMMENT ON COLUMN voyages.source_is_mock     IS 'Provenance: true when sourced from the mocked MarineTraffic transport.';
COMMENT ON COLUMN voyages.distance_nm        IS 'Voyage distance in nautical miles. Nullable when upstream omitted it.';
COMMENT ON COLUMN voyages.departure_port_id  IS 'MarineTraffic port identifier (string). Nullable.';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. AIS POSITIONS (high-volume time-series)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE ais_positions (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id   uuid        NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
    ts          timestamptz NOT NULL,
    -- WGS84 latitude/longitude. Decimal degrees.
    latitude    numeric(8,6)  NOT NULL,
    longitude   numeric(9,6)  NOT NULL,
    -- Optional AIS fields. NULL when the fix did not include them.
    sog         numeric(5,2),   -- speed over ground, knots
    cog         numeric(5,2),   -- course over ground, degrees
    heading     numeric(5,2),   -- true heading, degrees
    -- "nav_status" mirrors AIS navigation status text (e.g. "Under way using engine").
    nav_status  text,
    created_at  timestamptz NOT NULL DEFAULT now(),

    -- Geographic bounds for lat/long. Guards against swapped/garbage fixes.
    CONSTRAINT ais_positions_lat_range  CHECK (latitude  BETWEEN -90  AND 90),
    CONSTRAINT ais_positions_lon_range  CHECK (longitude BETWEEN -180 AND 180),
    -- Speed/heading are non-negative magnitudes when present.
    CONSTRAINT ais_positions_sog_nonneg CHECK (sog IS NULL OR sog >= 0),
    CONSTRAINT ais_positions_cog_range  CHECK (cog IS NULL OR (cog >= 0 AND cog < 360)),
    CONSTRAINT ais_positions_hdg_range  CHECK (heading IS NULL OR (heading >= 0 AND heading < 360))
);

-- The dominant query for this table: "newest position for vessel X".
CREATE INDEX ais_positions_vessel_ts_idx ON ais_positions (vessel_id, ts DESC);
-- Secondary: chronological scan within a window for a single vessel.
CREATE INDEX ais_positions_ts_idx        ON ais_positions (ts DESC);

COMMENT ON TABLE  ais_positions        IS 'High-volume time-series of AIS fixes (lat/long/SOG/COG/heading).';
COMMENT ON COLUMN ais_positions.ts     IS 'Timestamp of the AIS fix (UTC). NOT NULL — a fix without a time is meaningless.';
COMMENT ON COLUMN ais_positions.sog    IS 'Speed over ground in knots. Nullable.';
COMMENT ON COLUMN ais_positions.cog    IS 'Course over ground in degrees [0,360). Nullable.';

-- ────────────────────────────────────────────────────────────────────────────
-- 4. UPDATED_AT TRIGGER (vessels)
-- ────────────────────────────────────────────────────────────────────────────
-- Keep vessels.updated_at honest on every UPDATE without app-layer bookkeeping.
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER vessels_touch_updated_at
    BEFORE UPDATE ON vessels
    FOR EACH ROW
    EXECUTE FUNCTION touch_updated_at();

COMMENT ON FUNCTION touch_updated_at IS 'Sets NEW.updated_at = now() on UPDATE. Used by vessels trigger.';

-- ────────────────────────────────────────────────────────────────────────────
-- 5. ROW-LEVEL SECURITY (deny-by-default, service-role only)
-- ────────────────────────────────────────────────────────────────────────────
-- Phase 1B access is server-side only, via the service role key. RLS is enabled
-- and NO permissive policy is created — so anon/authenticated keys are denied by
-- default. When Phase 2 adds user-scoped reads, add explicit policies there.

ALTER TABLE vessels       ENABLE ROW LEVEL SECURITY;
ALTER TABLE voyages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ais_positions ENABLE ROW LEVEL SECURITY;

-- The service role bypasses RLS entirely; this is intentional and safe because
-- the service role key never leaves the server. No GRANT changes needed beyond
-- defaults (Supabase grants all on public.* to anon/authenticated/service_role
-- by default; RLS is what enforces the boundary).
