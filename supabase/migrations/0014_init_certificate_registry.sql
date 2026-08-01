-- 0014_init_certificate_registry.sql
-- Poseidon Certificate & Statutory Document Registry (Phase 4.2).
-- ─────────────────────────────────────────────────────────────────────────────
-- Two tables:
--   certificate_registry         — one row per certificate record, versioned.
--                                  A record NEVER detaches from its evidence
--                                  (document_id). Superseded rows are kept with
--                                  is_current = FALSE; history is never deleted.
--   certificate_registry_events  — append-only audit trail of deterministic
--                                  expiry/replacement/missing/review events
--                                  routed to the Notification System.
--
-- Design notes:
--   • certificate_type is free TEXT (no CHECK enum) so new certificate types
--     can be added without a migration. Known values are documented below.
--   • status is a stored snapshot; the deterministic status engine derives
--     VALID / EXPIRING_SOON / EXPIRED from dates and folds stored review /
--     validation flags into PENDING_REVIEW / INVALID / UNKNOWN / MISSING.
--   • An IMO mismatch on the source document is BLOCKING and forces
--     PENDING_REVIEW (event REVIEW_REQUIRED, severity CRITICAL).
--   • A missing expiry date is REVIEW_REQUIRED; no expiry date is ever invented.
--   • Severity scale is INFO|MEDIUM|HIGH|CRITICAL (notification severity),
--     NOT the WARNING scale used by sox_compliance_events.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. CERTIFICATE REGISTRY (current + historical records) ─────────────────────

CREATE TABLE IF NOT EXISTS certificate_registry (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id             UUID NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  imo                   TEXT NOT NULL,
  document_id           UUID REFERENCES documents(id) ON DELETE SET NULL,
  certificate_type      TEXT NOT NULL,
  certificate_number    TEXT,
  issuing_authority     TEXT,
  class_society         TEXT,
  issue_date            DATE,
  expiry_date           DATE,
  status                TEXT NOT NULL CHECK (status IN ('VALID', 'EXPIRING_SOON', 'EXPIRED', 'MISSING', 'PENDING_REVIEW', 'INVALID', 'UNKNOWN')),
  source                TEXT NOT NULL CHECK (source IN ('document_ocr', 'manual', 'api', 'import', 'unknown')),
  validation_status     TEXT CHECK (validation_status IN ('pending', 'valid', 'invalid')),
  review_status         TEXT CHECK (review_status IN ('PENDING', 'APPROVED', 'REJECTED', 'NOT_REQUIRED')),
  review_required       BOOLEAN NOT NULL DEFAULT FALSE,
  blocking              BOOLEAN NOT NULL DEFAULT FALSE,
  reason_code           TEXT,
  confidence            NUMERIC(5,4),
  notes                 TEXT,
  version               INTEGER NOT NULL DEFAULT 1,
  supersedes_id         UUID REFERENCES certificate_registry(id) ON DELETE SET NULL,
  is_current            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT certificate_registry_version_positive CHECK (version > 0),
  CONSTRAINT certificate_registry_confidence_range CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  CONSTRAINT certificate_registry_dates_order CHECK (issue_date IS NULL OR expiry_date IS NULL OR expiry_date >= issue_date),
  CONSTRAINT certificate_registry_no_self_supersede CHECK (supersedes_id IS NULL OR supersedes_id <> id)
);

CREATE INDEX IF NOT EXISTS idx_cert_registry_vessel_current ON certificate_registry (vessel_id) WHERE is_current;
CREATE INDEX IF NOT EXISTS idx_cert_registry_vessel_type ON certificate_registry (vessel_id, certificate_type) WHERE is_current;
CREATE INDEX IF NOT EXISTS idx_cert_registry_status ON certificate_registry (status);
CREATE INDEX IF NOT EXISTS idx_cert_registry_expiry ON certificate_registry (expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cert_registry_document ON certificate_registry (document_id) WHERE document_id IS NOT NULL;

COMMENT ON TABLE certificate_registry IS
  'Certificate & statutory document registry. One row per certificate record, versioned; superseded rows kept with is_current = FALSE.';
COMMENT ON COLUMN certificate_registry.certificate_type IS
  'Certificate type. Free text to allow future types; known: AIR_POLLUTION_PREVENTION (IAPP), SAFETY_MANAGEMENT (DOC/SMC), ISPS (ISSC), LOAD_LINE, TONNAGE, BALLAST_WATER (BWM), MARPOL (IOPP), SEEMP, ISCC, CLASS_CERTIFICATE, SAFETY_CERTIFICATE, OTHER.';
COMMENT ON COLUMN certificate_registry.document_id IS
  'Evidence document. A record never detaches from its evidence; nullable only for MISSING placeholders.';
COMMENT ON COLUMN certificate_registry.status IS
  'Stored status snapshot derived by the deterministic status engine (VALID/EXPIRING_SOON/EXPIRED/MISSING/PENDING_REVIEW/INVALID/UNKNOWN).';
COMMENT ON COLUMN certificate_registry.source IS
  'Provenance of the record: document_ocr, manual, api, import, unknown.';
COMMENT ON COLUMN certificate_registry.reason_code IS
  'Deterministic code for a non-VALID state (IMO_MISMATCH, MISSING_EXPIRY, MISSING_DOCUMENT, UNCERTAIN_APPLICABILITY, PENDING_REVIEW, VALIDATION_INVALID, ...).';
COMMENT ON COLUMN certificate_registry.blocking IS
  'True when the record blocks vessel operations (e.g. IMO mismatch on evidence).';
COMMENT ON COLUMN certificate_registry.version IS
  'Record version; each supersession creates a new version row. History is never deleted.';

-- 2. CERTIFICATE REGISTRY EVENTS (append-only audit trail) ───────────────────

CREATE TABLE IF NOT EXISTS certificate_registry_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id        UUID NOT NULL REFERENCES certificate_registry(id) ON DELETE CASCADE,
  vessel_id             UUID NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  imo                   TEXT NOT NULL,
  event_ts              TIMESTAMPTZ NOT NULL,
  event_type            TEXT NOT NULL CHECK (event_type IN ('CREATED', 'UPDATED', 'CERTIFICATE_EXPIRING', 'CERTIFICATE_EXPIRED', 'REPLACED', 'MISSING', 'REVIEW_REQUIRED')),
  severity              TEXT NOT NULL CHECK (severity IN ('INFO', 'MEDIUM', 'HIGH', 'CRITICAL')),
  previous_status       TEXT,
  new_status            TEXT,
  reason_code           TEXT,
  details               JSONB,
  dedup_key             TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cert_events_cert_ts ON certificate_registry_events (certificate_id, event_ts DESC);
CREATE INDEX IF NOT EXISTS idx_cert_events_vessel_ts ON certificate_registry_events (vessel_id, event_ts DESC);
CREATE INDEX IF NOT EXISTS idx_cert_events_vessel_dedup ON certificate_registry_events (vessel_id, dedup_key);
CREATE INDEX IF NOT EXISTS idx_cert_events_type ON certificate_registry_events (event_type);

COMMENT ON TABLE certificate_registry_events IS
  'Append-only audit trail of certificate registry events (deterministic expiry events routed to the Notification System).';
COMMENT ON COLUMN certificate_registry_events.severity IS
  'Notification severity scale: INFO|MEDIUM|HIGH|CRITICAL.';
COMMENT ON COLUMN certificate_registry_events.dedup_key IS
  'Optional key used to deduplicate repeated events (e.g. same expiry status per day).';

-- 3. UPDATED_AT TRIGGER ──────────────────────────────────────────────────────

CREATE TRIGGER certificate_registry_touch_updated_at
  BEFORE UPDATE ON certificate_registry
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

-- 4. ROW-LEVEL SECURITY (deny-by-default, service-role only) ─────────────────

ALTER TABLE certificate_registry        ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_registry_events ENABLE ROW LEVEL SECURITY;
