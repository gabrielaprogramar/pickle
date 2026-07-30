-- ════════════════════════════════════════════════════════════════════════════
-- Poseidon Ledger — Reporting + Verifier Package + Notification Foundation
-- Migration: 0011_init_reporting_and_notifications
-- ───────────────────────────────────────────────────────────────────────────
-- WHY THIS FILE EXISTS
--   Adds the data layer for Phase 2C.6. Four tables:
--
--   1. compliance_reports — generated compliance reports (THETIS-MRV, FuelEU,
--      Green Zone, fleet summary, ESG package). Reports consume data from
--      existing mrv_reports, fuel_eu_records, eu_ets_records, and
--      environmental_zone_events tables — they do NOT recalculate.
--
--   2. verifier_packages — verifier data package ZIPs with manifest, checksum,
--      signed URLs. Stores metadata; the ZIP blob lives in Supabase Storage.
--
--   3. notifications — in-app notification queue. One row per notification
--      per recipient. Can be extended to multi-tenant with organization_id.
--
--   4. notification_preferences — per-recipient opt-in/out per notification
--      type. NULL notification_type = global defaults.
--
--   Design notes:
--     • compliance_reports.content holds the generated report JSON so it can
--       be served without re-running generation queries.
--     • verifier_packages.storage_path references the Supabase Storage blob.
--     • notifications are queryable by recipient_id for multi-tenant future.
--     • notification_preferences uses a unique constraint so upsert works.
--     • All tables have RLS enabled (policy creation deferred to auth phase).
-- ════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Compliance reports
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE compliance_reports (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type       text        NOT NULL,
    vessel_id         uuid        REFERENCES vessels(id) ON DELETE SET NULL,
    vessel_ids        jsonb,
    title             text        NOT NULL,
    reporting_year    integer     NOT NULL,
    season            text,
    status            text        NOT NULL DEFAULT 'DRAFT',
    calculation_version text,
    source_data_refs  jsonb,
    storage_path      text,
    file_size         bigint,
    checksum          text,
    content           jsonb,
    generated_at      timestamptz,
    generated_by      text,
    submitted_at      timestamptz,
    verified_at       timestamptz,
    verification_notes text,
    metadata          jsonb       NOT NULL DEFAULT '{}',
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT compliance_reports_type_check CHECK (report_type IN (
        'thetis_mrv', 'fueleu', 'green_zone', 'fleet_summary', 'esg_package'
    )),

    CONSTRAINT compliance_reports_status_check CHECK (status IN (
        'DRAFT', 'READY', 'GENERATED', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'FAILED'
    ))
);

CREATE INDEX compliance_reports_vessel_id_idx ON compliance_reports (vessel_id) WHERE vessel_id IS NOT NULL;
CREATE INDEX compliance_reports_type_idx      ON compliance_reports (report_type);
CREATE INDEX compliance_reports_year_idx      ON compliance_reports (reporting_year);
CREATE INDEX compliance_reports_status_idx    ON compliance_reports (status);

COMMENT ON TABLE  compliance_reports
    IS 'Generated compliance reports (THETIS-MRV, FuelEU, Green Zone, fleet summary).';
COMMENT ON COLUMN compliance_reports.report_type
    IS 'Controlled by compliance_reports_type_check. thetis_mrv | fueleu | green_zone | fleet_summary | esg_package.';
COMMENT ON COLUMN compliance_reports.content
    IS 'The generated report body as JSON. Allows serving without regeneration.';
COMMENT ON COLUMN compliance_reports.source_data_refs
    IS 'References to source records used to generate this report (e.g. list of fuel_eu_record IDs).';

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Verifier packages
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE verifier_packages (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id         uuid        REFERENCES vessels(id) ON DELETE SET NULL,
    reporting_year    integer     NOT NULL,
    status            text        NOT NULL DEFAULT 'DRAFT',
    title             text        NOT NULL,
    manifest          jsonb       NOT NULL DEFAULT '{}',
    storage_path      text,
    file_size         bigint,
    checksum          text,
    package_version   text        NOT NULL DEFAULT '1.0.0',
    validation_result jsonb,
    generated_at      timestamptz,
    generated_by      text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT verifier_packages_status_check CHECK (status IN (
        'DRAFT', 'GENERATING', 'GENERATED', 'FAILED'
    ))
);

CREATE INDEX verifier_packages_vessel_id_idx ON verifier_packages (vessel_id) WHERE vessel_id IS NOT NULL;
CREATE INDEX verifier_packages_year_idx      ON verifier_packages (reporting_year);

COMMENT ON TABLE  verifier_packages
    IS 'Verifier data package ZIP metadata. The ZIP blob lives in Supabase Storage.';
COMMENT ON COLUMN verifier_packages.manifest
    IS 'Package manifest: list of included files with their checksums and sizes.';
COMMENT ON COLUMN verifier_packages.storage_path
    IS 'Supabase Storage path to the generated ZIP.';
COMMENT ON COLUMN verifier_packages.checksum
    IS 'SHA-256 checksum of the ZIP archive for verification.';

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Notifications
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE notifications (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id      text        NOT NULL,
    notification_type text        NOT NULL,
    severity          text        NOT NULL,
    vessel_id         uuid        REFERENCES vessels(id) ON DELETE SET NULL,
    organization_id   text,
    title             text        NOT NULL,
    message           text        NOT NULL,
    payload           jsonb,
    is_read           boolean     NOT NULL DEFAULT false,
    read_at           timestamptz,
    source_event      text,
    source_id         text,
    created_at        timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT notifications_severity_check CHECK (severity IN (
        'INFO', 'MEDIUM', 'HIGH', 'CRITICAL'
    ))
);

CREATE INDEX notifications_recipient_id_idx ON notifications (recipient_id);
CREATE INDEX notifications_unread_idx       ON notifications (recipient_id) WHERE is_read = false;
CREATE INDEX notifications_type_idx         ON notifications (notification_type);
CREATE INDEX notifications_severity_idx     ON notifications (severity);
CREATE INDEX notifications_created_at_idx   ON notifications (created_at DESC);

COMMENT ON TABLE  notifications
    IS 'In-app notification queue. One row per notification per recipient.';

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Notification preferences
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE notification_preferences (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id      text        NOT NULL,
    notification_type text,
    enabled           boolean     NOT NULL DEFAULT true,
    email_enabled     boolean     NOT NULL DEFAULT true,
    in_app_enabled    boolean     NOT NULL DEFAULT true,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT notification_preferences_type_recipient_unique UNIQUE (recipient_id, notification_type)
);

CREATE INDEX notification_preferences_recipient_id_idx ON notification_preferences (recipient_id);

COMMENT ON TABLE  notification_preferences
    IS 'Per-recipient notification opt-in/out per type. NULL type = global defaults.';

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. Enable Row-Level Security on all new tables
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE compliance_reports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifier_packages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
