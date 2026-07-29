-- 0004_init_validation_reports.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Validation reports table. Stores structured validation results for each
-- document extraction. One document may have multiple validation reports
-- (re-runs, different validator versions).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS validation_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id         UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  extraction_id       UUID REFERENCES ai_extractions(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'passed', 'warning', 'failed', 'error')),
  score               INTEGER NOT NULL DEFAULT 0
                      CHECK (score >= 0 AND score <= 100),
  rule_results        JSONB NOT NULL DEFAULT '[]',
  passed_count        INTEGER NOT NULL DEFAULT 0,
  failed_count        INTEGER NOT NULL DEFAULT 0,
  error_count         INTEGER NOT NULL DEFAULT 0,
  warning_count       INTEGER NOT NULL DEFAULT 0,
  blocking_issues     JSONB NOT NULL DEFAULT '[]',
  recommended_review  JSONB NOT NULL DEFAULT '[]',
  ready_for_review    BOOLEAN NOT NULL DEFAULT false,
  validator_version   TEXT NOT NULL DEFAULT '1.0.0',
  latency_ms          INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common query patterns.
CREATE INDEX IF NOT EXISTS idx_validation_reports_document_id
  ON validation_reports (document_id);
CREATE INDEX IF NOT EXISTS idx_validation_reports_status
  ON validation_reports (status);
CREATE INDEX IF NOT EXISTS idx_validation_reports_document_status
  ON validation_reports (document_id, status);

-- RLS: enable for authenticated users (same pattern as other tables).
ALTER TABLE validation_reports ENABLE ROW LEVEL SECURITY;

-- updated_at trigger.
CREATE OR REPLACE FUNCTION update_validation_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validation_reports_updated_at
  BEFORE UPDATE ON validation_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_validation_reports_updated_at();
