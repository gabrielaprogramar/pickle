-- 0003_init_ai_extractions.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- AI Extraction results table. Stores structured output from the AI extraction
-- pipeline (GPT-4o or mock) for each document. One document may have multiple
-- extractions (re-runs, different providers).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_extractions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  ocr_result_id UUID REFERENCES ocr_results(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'completed', 'failed', 'unknown_document')),
  confidence    DOUBLE PRECISION CHECK (confidence >= 0 AND confidence <= 1),
  summary       TEXT,
  document_type TEXT NOT NULL,
  fields        JSONB NOT NULL DEFAULT '{}',
  warnings      JSONB NOT NULL DEFAULT '[]',
  missing_fields JSONB NOT NULL DEFAULT '[]',
  provider      TEXT NOT NULL DEFAULT 'mock',
  model         TEXT NOT NULL DEFAULT 'mock',
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens  INTEGER,
  latency_ms    INTEGER,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common query patterns.
CREATE INDEX IF NOT EXISTS idx_ai_extractions_document_id
  ON ai_extractions (document_id);
CREATE INDEX IF NOT EXISTS idx_ai_extractions_status
  ON ai_extractions (status);
CREATE INDEX IF NOT EXISTS idx_ai_extractions_document_status
  ON ai_extractions (document_id, status);

-- RLS: enable for authenticated users (same pattern as other tables).
ALTER TABLE ai_extractions ENABLE ROW LEVEL SECURITY;

-- updated_at trigger.
CREATE OR REPLACE FUNCTION update_ai_extractions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_extractions_updated_at
  BEFORE UPDATE ON ai_extractions
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_extractions_updated_at();
