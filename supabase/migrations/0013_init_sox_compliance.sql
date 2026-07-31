-- 0013_init_sox_compliance.sql
-- Mediterranean SOx ECA / BDN sulphur compliance watch (Phase 4.1).
-- Append-only compliance events + current watch state. No second bunker schema:
-- sulphur evidence lives in fuel_deliveries (existing) and is referenced by id.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. SOX COMPLIANCE EVENTS (append-only audit trail) ────────────────────────

CREATE TABLE IF NOT EXISTS sox_compliance_events (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id                   UUID NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  imo                         TEXT NOT NULL,
  event_ts                    TIMESTAMPTZ NOT NULL,
  event_type                  TEXT NOT NULL CHECK (event_type IN ('ENTRY', 'EXIT', 'WITHIN', 'WATCH_CHANGE', 'EVALUATION')),
  zone_state                  TEXT NOT NULL CHECK (zone_state IN ('OUTSIDE', 'ENTRY', 'WITHIN', 'EXIT')),
  watch_status                TEXT NOT NULL CHECK (watch_status IN ('CLEAR', 'WARNING', 'NON_CONFORMING', 'NO_EVIDENCE', 'UNKNOWN')),
  severity                    TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'HIGH', 'CRITICAL')),
  rule_id                     TEXT,
  rule_result                 JSONB,
  evidence_status             TEXT CHECK (evidence_status IN ('CONFORMING', 'NON_CONFORMING', 'INSUFFICIENT_EVIDENCE', 'UNKNOWN')),
  inside_eca                  BOOLEAN NOT NULL,
  eca_effective               BOOLEAN NOT NULL,
  latitude                    NUMERIC(9,6),
  longitude                   NUMERIC(9,6),
  ais_position_id             UUID REFERENCES ais_positions(id) ON DELETE SET NULL,
  applicable_limit_pct        NUMERIC(5,3),
  sulphur_content_pct         NUMERIC(6,4),
  selected_delivery_id        UUID REFERENCES fuel_deliveries(id) ON DELETE SET NULL,
  parameter_version           TEXT NOT NULL,
  geometry_version            TEXT,
  calculation_version         TEXT NOT NULL,
  details                     JSONB,
  dedup_key                   TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sox_events_vessel_ts ON sox_compliance_events(vessel_id, event_ts DESC);
CREATE INDEX IF NOT EXISTS idx_sox_events_vessel_dedup ON sox_compliance_events(vessel_id, dedup_key);
CREATE INDEX IF NOT EXISTS idx_sox_events_watch_status ON sox_compliance_events(watch_status);

COMMENT ON TABLE sox_compliance_events IS
  'Append-only MARPOL Annex VI Med SOx ECA compliance watch events (SOX-ECA-01..06).';

-- 2. SOX WATCH STATE (latest snapshot per vessel) ───────────────────────────

CREATE TABLE IF NOT EXISTS sox_watch_state (
  vessel_id                   UUID PRIMARY KEY REFERENCES vessels(id) ON DELETE CASCADE,
  imo                         TEXT NOT NULL,
  status                      TEXT NOT NULL CHECK (status IN ('CLEAR', 'WARNING', 'NON_CONFORMING', 'NO_EVIDENCE', 'UNKNOWN')),
  severity                    TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'HIGH', 'CRITICAL')),
  inside_eca                  BOOLEAN NOT NULL,
  eca_effective               BOOLEAN NOT NULL,
  zone_state                  TEXT NOT NULL CHECK (zone_state IN ('OUTSIDE', 'ENTRY', 'WITHIN', 'EXIT')),
  evidence_status             TEXT CHECK (evidence_status IN ('CONFORMING', 'NON_CONFORMING', 'INSUFFICIENT_EVIDENCE', 'UNKNOWN')),
  applicable_limit_pct        NUMERIC(5,3),
  sulphur_content_pct         NUMERIC(6,4),
  selected_delivery_id        UUID REFERENCES fuel_deliveries(id) ON DELETE SET NULL,
  last_entry_ts               TIMESTAMPTZ,
  last_exit_ts                TIMESTAMPTZ,
  latest_event_id             UUID REFERENCES sox_compliance_events(id) ON DELETE SET NULL,
  parameter_version           TEXT NOT NULL,
  geometry_version            TEXT,
  review_required             BOOLEAN NOT NULL DEFAULT FALSE,
  last_evaluated_at           TIMESTAMPTZ NOT NULL,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sox_watch_status ON sox_watch_state(status);
CREATE INDEX IF NOT EXISTS idx_sox_watch_inside_eca ON sox_watch_state(inside_eca);

COMMENT ON TABLE sox_watch_state IS
  'Current Med SOx ECA watch snapshot per vessel (latest of sox_compliance_events).';
