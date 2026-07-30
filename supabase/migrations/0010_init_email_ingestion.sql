-- ════════════════════════════════════════════════════════════════════════════
-- Poseidon Ledger — BDN Email Ingestion (Phase 2C.5)
-- Migration: 0010_init_email_ingestion
-- ───────────────────────────────────────────────────────────────────────────
-- WHY THIS FILE EXISTS
--   Adds the data layer for BDN email ingestion. Three changes:
--
--   1. ALTER documents — add source_channel column with CHECK constraint
--      so every row records whether it arrived via manual upload or email.
--      Existing rows default to 'MANUAL'.
--
--   2. ALTER documents — add 'bdn' to the documents_type_check constraint
--      so email-ingested BDNs can be classified correctly.
--
--   3. CREATE email_ingestion_log — append-only log that records every
--      email processing event (received, accepted, rejected, duplicate, etc.)
--      with full provenance (message ID, sender, recipient, checksums).
--
--   Design notes:
--     • source_channel is NOT nullable — every document must declare its origin.
--     • email_ingestion_log is append-only (no UPDATE trigger, no touch_updated_at).
--     • A document FK is optional because an email may be rejected before a
--       document is created (e.g. duplicate, unknown IMO, unsupported file).
-- ════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Add source_channel to documents
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE documents
    ADD COLUMN source_channel text NOT NULL DEFAULT 'MANUAL';

ALTER TABLE documents
    ADD CONSTRAINT documents_source_channel_check
        CHECK (source_channel IN ('MANUAL', 'EMAIL'));

COMMENT ON COLUMN documents.source_channel
    IS 'How the document entered the system. MANUAL = web upload, EMAIL = email ingestion.';

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Add 'bdn' to the documents_type_check constraint
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE documents
    DROP CONSTRAINT IF EXISTS documents_type_check;

ALTER TABLE documents
    ADD CONSTRAINT documents_type_check
        CHECK (document_type IN (
            'bdn', 'imo_dcs', 'eu_mrv', 'certificate', 'report',
            'correspondence', 'logbook', 'other'
        ));

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Email ingestion audit log
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE email_ingestion_log (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id        text        NOT NULL,
    sender            text        NOT NULL,
    recipient         text        NOT NULL,
    subject           text,
    imo               text,
    vessel_id         uuid        REFERENCES vessels(id) ON DELETE SET NULL,
    document_id       uuid        REFERENCES documents(id) ON DELETE SET NULL,
    event             text        NOT NULL,
    details           jsonb,
    created_at        timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT email_ingestion_log_event_check CHECK (
        event IN (
            'EMAIL_RECEIVED',
            'ATTACHMENT_ACCEPTED',
            'ATTACHMENT_REJECTED',
            'DUPLICATE_DETECTED',
            'DOCUMENT_CREATED',
            'PROCESSING_QUEUED',
            'PROCESSING_STARTED',
            'PROCESSING_FAILED'
        )
    )
);

CREATE INDEX email_ingestion_log_message_id_idx ON email_ingestion_log (message_id);
CREATE INDEX email_ingestion_log_vessel_id_idx  ON email_ingestion_log (vessel_id) WHERE vessel_id IS NOT NULL;
CREATE INDEX email_ingestion_log_document_id_idx ON email_ingestion_log (document_id) WHERE document_id IS NOT NULL;
CREATE INDEX email_ingestion_log_event_idx      ON email_ingestion_log (event);
CREATE INDEX email_ingestion_log_created_at_idx ON email_ingestion_log (created_at DESC);

COMMENT ON TABLE  email_ingestion_log
    IS 'Append-only audit log for email ingestion pipeline events.';
COMMENT ON COLUMN email_ingestion_log.message_id
    IS 'Message-ID header from the original email (used for dedup / provenance).';
COMMENT ON COLUMN email_ingestion_log.imo
    IS 'IMO parsed from the recipient address. Null when parsing fails.';
COMMENT ON COLUMN email_ingestion_log.event
    IS 'Event type. Controlled by email_ingestion_log_event_check.';
COMMENT ON COLUMN email_ingestion_log.details
    IS 'Event-specific payload (checksums, rejection reasons, etc.).';

ALTER TABLE email_ingestion_log ENABLE ROW LEVEL SECURITY;
