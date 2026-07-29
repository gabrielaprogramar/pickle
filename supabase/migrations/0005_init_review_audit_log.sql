-- 0005_init_review_audit_log.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Review audit log table. Records every action taken during human review.
-- This is an append-only log — no deletions, no updates.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS review_audit_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_task_id      UUID NOT NULL REFERENCES review_tasks(id) ON DELETE CASCADE,
  field_name          TEXT,
  action              TEXT NOT NULL
                      CHECK (action IN (
                        'approved', 'rejected', 'needs_changes', 'escalated',
                        'field_approved', 'field_rejected', 'field_edited',
                        'field_uncertain', 'comment_added', 'assigned'
                      )),
  previous_value      JSONB,
  new_value           JSONB,
  reviewer            TEXT NOT NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_audit_log_task_id
  ON review_audit_log (review_task_id);
CREATE INDEX IF NOT EXISTS idx_review_audit_log_created_at
  ON review_audit_log (created_at DESC);

ALTER TABLE review_audit_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE  review_audit_log              IS 'Append-only audit trail for human review actions.';
COMMENT ON COLUMN review_audit_log.field_name   IS 'Field name this action relates to, or null for document-level decisions.';
COMMENT ON COLUMN review_audit_log.action       IS 'Type of review action taken.';
COMMENT ON COLUMN review_audit_log.previous_value IS 'Previous field value before edit (JSONB). Null for non-edit actions.';
COMMENT ON COLUMN review_audit_log.new_value    IS 'New field value after edit or decision (JSONB).';
COMMENT ON COLUMN review_audit_log.reviewer     IS 'Who performed this action.';
COMMENT ON COLUMN review_audit_log.notes        IS 'Optional reviewer notes or comments.';
