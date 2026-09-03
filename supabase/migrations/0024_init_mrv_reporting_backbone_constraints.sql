-- ════════════════════════════════════════════════════════════════════════════
-- Poseidon Ledger — Part 4.6: MRV / THETIS correctness & production-safety
--   Fixes the Part 4.5 adversarial-audit defects that are DATABASE-scoped:
--
--     1. `mrv_reports.upsert(onConflict:"vessel_id, reporting_year")` in
--        `repositories/mrv_reports.ts` has no matching UNIQUE constraint
--        (0008 created only a NON-unique index). PostgREST `onConflict` requires
--        a unique constraint/index on that exact column set, so every persistence
--        of an annual MRV report failed at runtime. This migration adds the
--        missing UNIQUE constraint deterministically.
--
--     2. No DEFAULT 0 on compliance-critical fields is introduced here. The
--        existing `mrv_report_versions` numeric columns keep numeric defaults; we
--        do NOT add new "unknown-hidden-as-zero" defaults. (Zero is a legitimate
--        reporting value only for a genuinely measured/calculated zero; the
--        application layer now records UNKNOWN explicitly, never as 0.)
--
-- Determinism & duplicate safety:
--   * We DO NOT delete or merge existing rows. If a duplicate (vessel_id,
--     reporting_year) currently exists, the constraint add FAILS LOUDLY so an
--     operator must reconcile data before the migration can succeed — we never
--     silently discard a valid historical record.
--   * `ADD CONSTRAINT ... UNIQUE` has no `IF NOT EXISTS` in Postgres, so the add
--     is wrapped in a `DO $$ ... IF NOT EXISTS` guard to make it re-runnable and
--     deterministic.
--
--   This migration is STATIC-VERIFIED ONLY (no live Supabase/Postgres is
--   available in this environment). It must be executed against a real database
--   and confirmed (constraint create + no duplicate rows) by an operator.
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 1. MARKET-CHECK: surface existing duplicates before we add the constraint.
--    This is diagnostic only; the add below still fails loudly if duplicates
--    remain. Preserves every existing valid record; deletes nothing.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF EXISTS (
        SELECT vessel_id, reporting_year
        FROM mrv_reports
        GROUP BY vessel_id, reporting_year
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Cannot add UNIQUE (vessel_id, reporting_year) to mrv_reports: '
            'duplicate rows exist. Reconcile duplicates first; no records deleted.';
    END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. UNIQUE CONFLICT TARGET for the @/lib/supabase repositories/mrv_reports
--    `upsert(onConflict: "vessel_id, reporting_year")`.
--    The unique constraint backs PostgREST's onConflict resolution.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'mrv_reports_vessel_year_unique'
          AND conrelid = 'mrv_reports'::regclass
    ) THEN
        ALTER TABLE mrv_reports
            ADD CONSTRAINT mrv_reports_vessel_year_unique
            UNIQUE (vessel_id, reporting_year);
    END IF;
END $$;

COMMENT ON CONSTRAINT mrv_reports_vessel_year_unique ON mrv_reports
    IS 'UNIQUE conflict target backing mrv_reports.upsert(onConflict:"vessel_id, reporting_year"). One annual MRV report HEAD per (vessel, year); history lives in mrv_report_versions.';