-- ════════════════════════════════════════════════════════════════════════════
-- Poseidon Ledger — Document Domain Schema (Phase 2A.1)
-- Migration: 0002_init_document_domain
-- ───────────────────────────────────────────────────────────────────────────
-- WHY THIS FILE EXISTS
--   This is the SINGLE source of truth for the Phase 2A.1 document domain
--   database shape. Every TypeScript row type and repository maps to a
--   definition here. Apply this migration so the definition is version-
--   controlled and reproducible.
--
--   Eight tables for document ingestion, processing, and review:
--     documents              — core entity: one row per compliance document
--     document_versions      — version history (re-uploads, revisions)
--     processing_jobs        — async pipeline jobs (OCR, extraction, etc.)
--     ocr_results            — OCR text extraction output
--     document_entities      — named entities extracted from documents
--     processing_logs        — audit trail for processing events
--     review_tasks           — human review workflow items
--     document_relationships — typed links between documents
--
--   Design notes:
--     • Follows Phase 1B conventions: UUID v4 PKs, TIMESTAMPTZ, CHECK
--       constraints for enums, deny-by-default RLS, touch_updated_at triggers.
--     • documents.vessel_id is nullable: some documents (regulatory bulletins,
--       fleet-wide reports) are not vessel-specific.
--     • JSONB columns on documents, processing_jobs, ocr_results, and
--       document_entities store flexible metadata without schema churn.
--     • document_relationships prevents duplicate links via a UNIQUE composite.
--     • processing_logs is append-only (no UPDATE, no touch_updated_at).
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 1. DOCUMENTS (core entity)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE documents (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id       uuid        REFERENCES vessels(id) ON DELETE SET NULL,
    document_type   text        NOT NULL,
    status          text        NOT NULL DEFAULT 'uploaded',
    title           text        NOT NULL,
    filename        text        NOT NULL,
    mime_type       text        NOT NULL,
    file_size       bigint,
    storage_path    text        NOT NULL,
    metadata        jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT documents_type_check CHECK (
        document_type IN (
            'imo_dcs', 'eu_mrv', 'certificate', 'report',
            'correspondence', 'logbook', 'other'
        )
    ),
    CONSTRAINT documents_status_check CHECK (
        status IN (
            'uploaded', 'processing', 'ocr_complete', 'extracted',
            'under_review', 'approved', 'rejected', 'archived'
        )
    ),
    CONSTRAINT documents_file_size_nonneg CHECK (
        file_size IS NULL OR file_size >= 0
    )
);

CREATE INDEX documents_vessel_id_idx   ON documents (vessel_id) WHERE vessel_id IS NOT NULL;
CREATE INDEX documents_type_idx        ON documents (document_type);
CREATE INDEX documents_status_idx      ON documents (status);
CREATE INDEX documents_created_at_idx  ON documents (created_at DESC);

COMMENT ON TABLE  documents              IS 'Core document entity. One row per compliance document (certificate, report, etc.).';
COMMENT ON COLUMN documents.vessel_id    IS 'FK to vessels. Nullable for fleet-wide documents.';
COMMENT ON COLUMN documents.document_type IS 'Document classification. Controlled by documents_type_check.';
COMMENT ON COLUMN documents.status       IS 'Processing lifecycle status. Controlled by documents_status_check.';
COMMENT ON COLUMN documents.storage_path IS 'Internal storage path for the file.';
COMMENT ON COLUMN documents.metadata     IS 'Flexible JSONB metadata (source, tags, custom fields).';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. DOCUMENT VERSIONS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE document_versions (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     uuid        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number  int         NOT NULL,
    filename        text        NOT NULL,
    storage_path    text        NOT NULL,
    file_size       bigint,
    uploaded_by     text,
    upload_note     text,
    created_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT document_versions_number_nonneg CHECK (version_number > 0),
    CONSTRAINT document_versions_file_size_nonneg CHECK (
        file_size IS NULL OR file_size >= 0
    )
);

CREATE UNIQUE INDEX document_versions_doc_ver_uniq
    ON document_versions (document_id, version_number);

CREATE INDEX document_versions_document_id_idx
    ON document_versions (document_id);

COMMENT ON TABLE  document_versions              IS 'Version history for documents. Each re-upload creates a new version row.';
COMMENT ON COLUMN document_versions.version_number IS 'Monotonically increasing version number per document.';
COMMENT ON COLUMN document_versions.uploaded_by   IS 'User or system identifier who uploaded this version.';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. PROCESSING JOBS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE processing_jobs (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id         uuid        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    document_version_id uuid        REFERENCES document_versions(id) ON DELETE SET NULL,
    job_type            text        NOT NULL,
    status              text        NOT NULL DEFAULT 'pending',
    started_at          timestamptz,
    completed_at        timestamptz,
    error_message       text,
    result              jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT processing_jobs_type_check CHECK (
        job_type IN ('ocr', 'entity_extraction', 'validation', 'classification')
    ),
    CONSTRAINT processing_jobs_status_check CHECK (
        status IN ('pending', 'running', 'completed', 'failed', 'cancelled')
    ),
    CONSTRAINT processing_jobs_time_order CHECK (
        started_at IS NULL OR completed_at IS NULL OR completed_at >= started_at
    )
);

CREATE INDEX processing_jobs_document_id_idx    ON processing_jobs (document_id);
CREATE INDEX processing_jobs_status_idx          ON processing_jobs (status);
CREATE INDEX processing_jobs_document_status_idx ON processing_jobs (document_id, status);

COMMENT ON TABLE  processing_jobs              IS 'Async processing pipeline jobs for document ingestion.';
COMMENT ON COLUMN processing_jobs.job_type     IS 'Type of processing. Controlled by processing_jobs_type_check.';
COMMENT ON COLUMN processing_jobs.status       IS 'Job lifecycle status. Controlled by processing_jobs_status_check.';
COMMENT ON COLUMN processing_jobs.result       IS 'Job-specific result payload (JSONB).';
COMMENT ON COLUMN processing_jobs.document_version_id IS 'Which document version this job processes. Nullable for legacy.';

-- ────────────────────────────────────────────────────────────────────────────
-- 4. OCR RESULTS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE ocr_results (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    processing_job_id   uuid        NOT NULL REFERENCES processing_jobs(id) ON DELETE CASCADE,
    document_id         uuid        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    raw_text            text        NOT NULL,
    extracted_data      jsonb,
    confidence          numeric(5,4),
    created_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT ocr_results_confidence_range CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
    )
);

CREATE INDEX ocr_results_job_id_idx      ON ocr_results (processing_job_id);
CREATE INDEX ocr_results_document_id_idx ON ocr_results (document_id);

COMMENT ON TABLE  ocr_results              IS 'OCR text extraction output from a processing job.';
COMMENT ON COLUMN ocr_results.raw_text     IS 'Full extracted text from the document.';
COMMENT ON COLUMN ocr_results.extracted_data IS 'Structured extraction results (JSONB).';
COMMENT ON COLUMN ocr_results.confidence   IS 'Overall OCR confidence score [0.0000, 1.0000].';

-- ────────────────────────────────────────────────────────────────────────────
-- 5. DOCUMENT ENTITIES
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE document_entities (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     uuid        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    ocr_result_id   uuid        REFERENCES ocr_results(id) ON DELETE SET NULL,
    entity_type     text        NOT NULL,
    entity_value    text        NOT NULL,
    confidence      numeric(5,4),
    start_offset    int,
    end_offset      int,
    metadata        jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT document_entities_type_check CHECK (
        entity_type IN (
            'imo_number', 'vessel_name', 'port', 'date',
            'certificate_number', 'flag_state', 'measure', 'other'
        )
    ),
    CONSTRAINT document_entities_confidence_range CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
    ),
    CONSTRAINT document_entities_offset_check CHECK (
        (start_offset IS NULL AND end_offset IS NULL)
        OR (start_offset IS NOT NULL AND end_offset IS NOT NULL)
    ),
    CONSTRAINT document_entities_offset_order CHECK (
        start_offset IS NULL OR end_offset IS NULL OR end_offset >= start_offset
    )
);

CREATE INDEX document_entities_document_id_idx   ON document_entities (document_id);
CREATE INDEX document_entities_ocr_result_id_idx ON document_entities (ocr_result_id) WHERE ocr_result_id IS NOT NULL;
CREATE INDEX document_entities_type_idx          ON document_entities (entity_type);

COMMENT ON TABLE  document_entities            IS 'Named entities extracted from documents (IMO numbers, vessel names, ports, etc.).';
COMMENT ON COLUMN document_entities.entity_type IS 'Entity classification. Controlled by document_entities_type_check.';
COMMENT ON COLUMN document_entities.entity_value IS 'Extracted entity text value.';
COMMENT ON COLUMN document_entities.confidence IS 'Extraction confidence [0.0000, 1.0000].';
COMMENT ON COLUMN document_entities.start_offset IS 'Character offset of entity in raw text. NULL pair means source is not text.';

-- ────────────────────────────────────────────────────────────────────────────
-- 6. PROCESSING LOGS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE processing_logs (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    processing_job_id   uuid        NOT NULL REFERENCES processing_jobs(id) ON DELETE CASCADE,
    level               text        NOT NULL,
    message             text        NOT NULL,
    details             jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT processing_logs_level_check CHECK (
        level IN ('debug', 'info', 'warning', 'error')
    )
);

CREATE INDEX processing_logs_job_id_idx ON processing_logs (processing_job_id);
CREATE INDEX processing_logs_level_idx  ON processing_logs (level);

COMMENT ON TABLE  processing_logs          IS 'Append-only audit trail for processing pipeline events.';
COMMENT ON COLUMN processing_logs.level    IS 'Log severity. Controlled by processing_logs_level_check.';
COMMENT ON COLUMN processing_logs.details  IS 'Additional structured context (JSONB).';

-- ────────────────────────────────────────────────────────────────────────────
-- 7. REVIEW TASKS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE review_tasks (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     uuid        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    assigned_to     text,
    status          text        NOT NULL DEFAULT 'pending',
    priority        text        NOT NULL DEFAULT 'normal',
    due_at          timestamptz,
    completed_at    timestamptz,
    review_note     text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT review_tasks_status_check CHECK (
        status IN ('pending', 'in_progress', 'completed', 'cancelled')
    ),
    CONSTRAINT review_tasks_priority_check CHECK (
        priority IN ('low', 'normal', 'high', 'urgent')
    )
);

CREATE INDEX review_tasks_document_id_idx ON review_tasks (document_id);
CREATE INDEX review_tasks_status_idx      ON review_tasks (status);
CREATE INDEX review_tasks_assigned_to_idx ON review_tasks (assigned_to) WHERE assigned_to IS NOT NULL;

COMMENT ON TABLE  review_tasks            IS 'Human review workflow tasks for documents.';
COMMENT ON COLUMN review_tasks.assigned_to IS 'User or system identifier assigned to review. Nullable for unassigned.';
COMMENT ON COLUMN review_tasks.priority   IS 'Review urgency. Controlled by review_tasks_priority_check.';
COMMENT ON COLUMN review_tasks.review_note IS 'Reviewer comments after completing the review.';

-- ────────────────────────────────────────────────────────────────────────────
-- 8. DOCUMENT RELATIONSHIPS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE document_relationships (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    source_document_id      uuid        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    target_document_id      uuid        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    relationship_type       text        NOT NULL,
    metadata                jsonb,
    created_at              timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT document_relationships_type_check CHECK (
        relationship_type IN (
            'supersedes', 'amends', 'references', 'requires', 'attached_to'
        )
    ),
    CONSTRAINT document_relationships_no_self_ref CHECK (
        source_document_id <> target_document_id
    )
);

CREATE UNIQUE INDEX document_relationships_uniq
    ON document_relationships (source_document_id, target_document_id, relationship_type);

CREATE INDEX document_relationships_source_idx ON document_relationships (source_document_id);
CREATE INDEX document_relationships_target_idx ON document_relationships (target_document_id);

COMMENT ON TABLE  document_relationships              IS 'Typed links between documents (supersedes, amends, references, etc.).';
COMMENT ON COLUMN document_relationships.source_document_id IS 'The referencing/originating document.';
COMMENT ON COLUMN document_relationships.target_document_id IS 'The referenced/affected document.';
COMMENT ON COLUMN document_relationships.relationship_type IS 'Link semantics. Controlled by document_relationships_type_check.';

-- ────────────────────────────────────────────────────────────────────────────
-- 9. UPDATED_AT TRIGGERS
-- ────────────────────────────────────────────────────────────────────────────
-- Reuses the touch_updated_at() function created in migration 0001.

CREATE TRIGGER documents_touch_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER review_tasks_touch_updated_at
    BEFORE UPDATE ON review_tasks
    FOR EACH ROW
    EXECUTE FUNCTION touch_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- 10. ROW-LEVEL SECURITY (deny-by-default, service-role only)
-- ────────────────────────────────────────────────────────────────────────────
-- Same policy as Phase 1B: RLS enabled, no permissive policies. The service
-- role bypasses RLS; anon/authenticated keys are denied by default.

ALTER TABLE documents              ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_results            ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_entities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_relationships ENABLE ROW LEVEL SECURITY;
