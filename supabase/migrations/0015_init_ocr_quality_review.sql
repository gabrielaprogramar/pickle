-- 0015_init_ocr_quality_review.sql
-- OCR Intelligence Assistant persistence (Phase 4.3).
-- ─────────────────────────────────────────────────────────────────────────────
-- Two new tables plus one additive column:
--   ocr_quality_scores      — one row per OCR result: deterministic composite
--                             quality score, level, sub-scores, confidence
--                             distribution, detected issues and the list of
--                             missing mandatory fields.
--   ocr_review_suggestions  — deterministic repair suggestions (IMO checksum,
--                             date format, fuel/port spelling, certificate
--                             number spacing, merged characters) presented to
--                             a human reviewer to accept or reject.
--   review_tasks.reason_code — additive nullable column recording WHY a task
--                             was created (e.g. OCR_REVIEW_REQUIRED). Added
--                             with IF NOT EXISTS so existing rows are untouched.
--
-- Design notes:
--   • Quality level CHECK matches the domain enum HIGH|MEDIUM|LOW|VERY_LOW.
--   • Suggestion kind CHECK matches the domain OcrRepairKind values.
--   • Suggestion priority CHECK matches ReviewPriority CRITICAL|HIGH|MEDIUM|LOW.
--   • Suggestion status is a workflow state (open -> accepted/rejected/resolved).
--   • All scores are NUMERIC(5,4) in [0,1]; confidence is [0,1].
--   • ocr_review_suggestions carries updated_at (status transitions); the
--     touch_updated_at() trigger from migration 0001 is reused.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. OCR QUALITY SCORES ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ocr_quality_scores (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ocr_result_id               UUID NOT NULL REFERENCES ocr_results(id) ON DELETE CASCADE,
  document_id                 UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  detected_family             TEXT NOT NULL,
  overall_quality_score       NUMERIC(5,4) NOT NULL,
  level                       TEXT NOT NULL CHECK (level IN ('HIGH', 'MEDIUM', 'LOW', 'VERY_LOW')),
  page_quality                NUMERIC(5,4) NOT NULL,
  text_coverage               NUMERIC(5,4) NOT NULL,
  field_coverage              NUMERIC(5,4) NOT NULL,
  confidence_score            NUMERIC(5,4) NOT NULL,
  confidence_distribution     JSONB NOT NULL,
  issues                      JSONB NOT NULL,
  missing_mandatory_fields    JSONB NOT NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ocr_quality_scores_score_range CHECK (
    overall_quality_score >= 0 AND overall_quality_score <= 1
    AND page_quality >= 0 AND page_quality <= 1
    AND text_coverage >= 0 AND text_coverage <= 1
    AND field_coverage >= 0 AND field_coverage <= 1
    AND confidence_score >= 0 AND confidence_score <= 1
  )
);

CREATE INDEX IF NOT EXISTS idx_ocr_quality_document ON ocr_quality_scores (document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ocr_quality_ocr_result ON ocr_quality_scores (ocr_result_id) WHERE ocr_result_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ocr_quality_level ON ocr_quality_scores (level);

COMMENT ON TABLE ocr_quality_scores IS
  'Deterministic OCR quality snapshot per OCR result (composite score, sub-scores, issues, missing fields).';
COMMENT ON COLUMN ocr_quality_scores.level IS
  'Quality level derived from overall_quality_score: HIGH|MEDIUM|LOW|VERY_LOW.';
COMMENT ON COLUMN ocr_quality_scores.confidence_distribution IS
  'JSONB map of word counts per confidence band (HIGH|MEDIUM|LOW|VERY_LOW).';
COMMENT ON COLUMN ocr_quality_scores.issues IS
  'JSONB array of detected quality issues (type, detected, evidence, severity).';

-- 2. OCR REVIEW SUGGESTIONS ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ocr_review_suggestions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ocr_result_id               UUID NOT NULL REFERENCES ocr_results(id) ON DELETE CASCADE,
  document_id                 UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  field_key                   TEXT NOT NULL,
  kind                        TEXT NOT NULL CHECK (kind IN (
    'IMO_CHECKSUM', 'DATE_FORMAT', 'FUEL_SPELLING', 'PORT_SPELLING',
    'CERTIFICATE_NUMBER_SPACING', 'MERGED_CHARACTERS'
  )),
  original_value              TEXT NOT NULL,
  suggested_value             TEXT NOT NULL,
  confidence                  NUMERIC(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  reason                      TEXT NOT NULL,
  priority                    TEXT NOT NULL CHECK (priority IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  status                      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'rejected', 'resolved')),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ocr_suggestions_document ON ocr_review_suggestions (document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ocr_suggestions_status ON ocr_review_suggestions (status);
CREATE INDEX IF NOT EXISTS idx_ocr_suggestions_kind ON ocr_review_suggestions (kind);

COMMENT ON TABLE ocr_review_suggestions IS
  'Deterministic OCR repair suggestions for a human reviewer to accept or reject.';
COMMENT ON COLUMN ocr_review_suggestions.kind IS
  'Correction kind: IMO_CHECKSUM, DATE_FORMAT, FUEL_SPELLING, PORT_SPELLING, CERTIFICATE_NUMBER_SPACING, MERGED_CHARACTERS.';
COMMENT ON COLUMN ocr_review_suggestions.priority IS
  'ReviewPriority derived for the parent document at suggestion time: CRITICAL|HIGH|MEDIUM|LOW.';
COMMENT ON COLUMN ocr_review_suggestions.status IS
  'Workflow state: open -> accepted/rejected/resolved.';

-- 3. REVIEW TASKS — additive reason code ──────────────────────────────────────

ALTER TABLE review_tasks ADD COLUMN IF NOT EXISTS reason_code TEXT;

CREATE INDEX IF NOT EXISTS idx_review_tasks_reason_code ON review_tasks (reason_code) WHERE reason_code IS NOT NULL;

COMMENT ON COLUMN review_tasks.reason_code IS
  'Deterministic code explaining why the review task exists (e.g. OCR_REVIEW_REQUIRED). Nullable for manually created tasks.';

-- 4. UPDATED_AT TRIGGERS ──────────────────────────────────────────────────────

CREATE TRIGGER ocr_review_suggestions_touch_updated_at
  BEFORE UPDATE ON ocr_review_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

-- 5. ROW-LEVEL SECURITY (deny-by-default, service-role only) ─────────────────

ALTER TABLE ocr_quality_scores     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_review_suggestions ENABLE ROW LEVEL SECURITY;
