-- ════════════════════════════════════════════════════════════════════════════
-- Poseidon Ledger — Org-wide immutable audit log (Truth Week)
-- Migration: 0018_init_audit_log
-- ───────────────────────────────────────────────────────────────────────────
-- WHY THIS FILE EXISTS
--   Truth Week milestone: a single, org-scoped, IMMUTABLE audit trail that
--   records every meaningful state change (who, what, entity, before/after).
--   Unlike the existing scoped logs (review_audit_log, processing_logs,
--   reconciliation_log, …), this table is append-only at the DATABASE level —
--   not merely by application convention.
--
--   Immutability is enforced two ways (both needed):
--     1. Append-only guard TRIGGER on UPDATE/DELETE. This is the hard,
--        role-independent guarantee — it raises even for the service role /
--        table owner, so no code path can silently mutate history.
--     2. Row-Level Security, deny-by-default, consistent with every other
--        table. The Next.js app writes with the service role (bypasses RLS),
--        so RLS is defense-in-depth for the day Supabase Auth is adopted.
--
--   Actor model: Poseidon uses custom (non-Supabase) auth, so actor_id /
--   actor_email are application-supplied values stamped server-side, not
--   derived from auth.uid(). Kept explicit so a later auth migration can tie
--   them to auth.users without changing this contract.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. TABLE -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_log (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_id        uuid        REFERENCES organization_users(id) ON DELETE SET NULL,
    actor_email     text,
    action          text        NOT NULL,
    entity_type     text        NOT NULL,
    entity_id       text,
    before_data     jsonb       NOT NULL DEFAULT '{}'::jsonb,
    after_data      jsonb       NOT NULL DEFAULT '{}'::jsonb,
    source          text        NOT NULL DEFAULT 'app',
    correlation_id  text,
    recorded_at     timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT audit_log_action_nonempty CHECK (length(trim(action)) > 0),
    CONSTRAINT audit_log_entity_type_nonempty CHECK (length(trim(entity_type)) > 0),
    CONSTRAINT audit_log_source_check CHECK (source IN ('app', 'api', 'system', 'migration'))
);

-- indexed for the common "audit trail for an organization" query, newest first.
CREATE INDEX IF NOT EXISTS audit_log_org_recorded_at_idx
    ON audit_log (organization_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx
    ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_action_idx
    ON audit_log (action);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx
    ON audit_log (actor_id, recorded_at DESC) WHERE actor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_log_correlation_idx
    ON audit_log (correlation_id) WHERE correlation_id IS NOT NULL;

-- ── 2. IMMUTABILITY (hard, role-independent) ---------------------------------

CREATE OR REPLACE FUNCTION audit_log_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only; UPDATE/DELETE is not permitted (%, %)',
        TG_OP,
        row_to_json(NEW)::text;
END;
$$;

DROP TRIGGER IF EXISTS audit_log_block_mutation_trg ON audit_log;
CREATE TRIGGER audit_log_block_mutation_trg
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW
    EXECUTE FUNCTION audit_log_block_mutation();

-- ── 3. RLS (deny-by-default, defense-in-depth) --------------------------------

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- No policies are created: consistent with the rest of the schema, RLS is
-- deny-by-default and the app writes via the service role (bypasses RLS).
-- The append-only trigger above is the immutable guarantee for every role.
-- When Supabase Auth is adopted, add org-scoped SELECT / INSERT policies here.

-- ── 4. COMMENTS ---------------------------------------------------------------

COMMENT ON TABLE audit_log IS
  'Immutable org-wide audit trail. Append-only at the DB level via audit_log_block_mutation trigger.';
COMMENT ON COLUMN audit_log.before_data IS 'Snapshot of the entity state before the change (JSONB).';
COMMENT ON COLUMN audit_log.after_data IS 'Snapshot of the entity state after the change (JSONB).';
COMMENT ON COLUMN audit_log.source IS 'Origin of the entry: app, api, system, or migration.';
COMMENT ON COLUMN audit_log.correlation_id IS 'Optional correlation id to group a logical operation across entries.';
