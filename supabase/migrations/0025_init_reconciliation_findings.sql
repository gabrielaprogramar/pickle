-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Poseidon Ledger — Part 5: Reconciliation & Consistency Engine
--   Creates the persistence layer for reconciliation findings, evidence
--   chain edge statuses, and versioned reconciliation rules.
--
--   This migration is STATICALLY VERIFIED ONLY (no live Supabase/Postgres).
--   Must be executed against a real database by an operator.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 1. Reconciliation rules (versioned tolerance & severity configuration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'reconciliation_rules' AND table_schema = 'public'
  ) THEN
    CREATE TABLE reconciliation_rules (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_type     TEXT NOT NULL,
      rule_key      TEXT NOT NULL,
      tolerance_value DOUBLE PRECISION NOT NULL DEFAULT 0,
      tolerance_unit TEXT NOT NULL DEFAULT 'absolute',
      severity_override TEXT,
      enabled       BOOLEAN NOT NULL DEFAULT true,
      version       INTEGER NOT NULL DEFAULT 1,
      effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
      effective_until TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX idx_reconciliation_rules_type_key_version
      ON reconciliation_rules (rule_type, rule_key, version);

    COMMENT ON TABLE reconciliation_rules IS 'Versioned tolerance and severity rules for reconciliation. Immutable once created; new versions are appended.';
  END IF;
END $$;

-- 2. Reconciliation findings (core output of the reconciliation engine)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'reconciliation_findings' AND table_schema = 'public'
  ) THEN
    CREATE TABLE reconciliation_findings (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reconciliation_key TEXT NOT NULL,
      vessel_id          UUID NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
      voyage_id          UUID,
      reporting_year     INTEGER NOT NULL,
      reconciliation_type TEXT NOT NULL,
      status             TEXT NOT NULL DEFAULT 'UNKNOWN',
      severity           TEXT NOT NULL DEFAULT 'INFO',
      expected_value     DOUBLE PRECISION,
      observed_value     DOUBLE PRECISION,
      difference         DOUBLE PRECISION,
      tolerance          DOUBLE PRECISION,
      unit               TEXT,
      source_record_ids  JSONB NOT NULL DEFAULT '[]'::jsonb,
      affected_regulation TEXT NOT NULL DEFAULT 'ALL',
      explanation        TEXT NOT NULL DEFAULT '',
      resolution_status  TEXT NOT NULL DEFAULT 'UNRESOLVED',
      resolution_actor   TEXT,
      resolution_reason  TEXT,
      resolution_at      TIMESTAMPTZ,
      audit_log_id       UUID,
      rule_version       TEXT,
      tolerance_version  TEXT,
      calculation_version TEXT,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX idx_reconciliation_findings_key
      ON reconciliation_findings (reconciliation_key);

    CREATE INDEX idx_reconciliation_findings_vessel_year
      ON reconciliation_findings (vessel_id, reporting_year);

    CREATE INDEX idx_reconciliation_findings_voyage
      ON reconciliation_findings (voyage_id)
      WHERE voyage_id IS NOT NULL;

    CREATE INDEX idx_reconciliation_findings_status
      ON reconciliation_findings (status)
      WHERE status NOT IN ('MATCH', 'RESOLVED');

    CREATE INDEX idx_reconciliation_findings_type_status
      ON reconciliation_findings (reconciliation_type, status);

    COMMENT ON TABLE reconciliation_findings IS 'Reconciliation findings produced by the Part 5 engine. Idempotent via reconciliation_key (unique). Immutable finding history; resolution is tracked but the original finding persists.';
  END IF;
END $$;

-- 3. Evidence chain edge statuses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'reconciliation_edge_status' AND table_schema = 'public'
  ) THEN
    CREATE TABLE reconciliation_edge_status (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      vessel_id        UUID NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
      voyage_id        UUID,
      reporting_year   INTEGER NOT NULL,
      edge             TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'UNKNOWN',
      source_record_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      target_record_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      explanation      TEXT NOT NULL DEFAULT '',
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX idx_reconciliation_edge_vessel_voyage_edge
      ON reconciliation_edge_status (vessel_id, voyage_id, edge)
      WHERE voyage_id IS NOT NULL;

    CREATE UNIQUE INDEX idx_reconciliation_edge_vessel_year_edge
      ON reconciliation_edge_status (vessel_id, reporting_year, edge)
      WHERE voyage_id IS NULL;

    CREATE INDEX idx_reconciliation_edge_vessel_year
      ON reconciliation_edge_status (vessel_id, reporting_year);

    COMMENT ON TABLE reconciliation_edge_status IS 'Evidence chain edge statuses (AIS→VOYAGE, PORTCALL→VOYAGE, etc.). Idempotent via partial unique indexes.';
  END IF;
END $$;

-- 4. Updated_at trigger (reconciliation_findings)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_reconciliation_findings_updated'
  ) THEN
    CREATE OR REPLACE FUNCTION update_reconciliation_findings_updated_at()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_reconciliation_findings_updated
      BEFORE UPDATE ON reconciliation_findings
      FOR EACH ROW
      EXECUTE FUNCTION update_reconciliation_findings_updated_at();
  END IF;
END $$;

-- 5. Updated_at trigger (reconciliation_edge_status)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_reconciliation_edge_status_updated'
  ) THEN
    CREATE OR REPLACE FUNCTION update_reconciliation_edge_status_updated_at()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_reconciliation_edge_status_updated
      BEFORE UPDATE ON reconciliation_edge_status
      FOR EACH ROW
      EXECUTE FUNCTION update_reconciliation_edge_status_updated_at();
  END IF;
END $$;

-- 6. Seed default reconciliation rules (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM reconciliation_rules WHERE rule_key = 'co2_absolute' AND version = 1
  ) THEN
    INSERT INTO reconciliation_rules (rule_type, rule_key, tolerance_value, tolerance_unit, version)
    VALUES
      ('CROSS_REGULATION', 'co2_absolute', 1.0, 'tonnes', 1),
      ('CROSS_REGULATION', 'co2_relative', 0.05, 'percent', 1),
      ('CROSS_REGULATION', 'fuel_absolute', 0.5, 'metric_tonnes', 1),
      ('CROSS_REGULATION', 'fuel_relative', 0.03, 'percent', 1),
      ('MRV_CONSUMPTION', 'mrv_vs_canonical', 1.0, 'metric_tonnes', 1),
      ('ETS_CONSUMPTION', 'ets_vs_canonical', 1.0, 'metric_tonnes', 1),
      ('FUELEU_CONSUMPTION', 'fueleu_vs_canonical', 1.0, 'metric_tonnes', 1),
      ('NOON_CONSUMPTION', 'noon_vs_canonical', 1.0, 'metric_tonnes', 1),
      ('BDN_CONSUMPTION', 'bdn_vs_canonical', 2.0, 'metric_tonnes', 1),
      ('AIS_VOYAGE', 'ais_gap_hours', 6.0, 'hours', 1),
      ('PORTCALL_VOYAGE', 'port_classification_confidence', 0.8, 'confidence', 1),
      ('FUEL_VOYAGE', 'fuel_delivery_window_days', 7.0, 'days', 1);
  END IF;
END $$;
