-- ════════════════════════════════════════════════════════════════════════════
-- Poseidon Ledger — Truth Week migration & schema verification
-- ───────────────────────────────────────────────────────────────────────────
-- Run this in the Supabase SQL editor (or via psql) AFTER migrations 0001–0018
-- are applied, to confirm the expected baseline.
--
-- Expected baseline (from the Truth Week migration audit):
--   50 tables, 3 functions, 13+ triggers, ~124 indexes, ~68 foreign keys,
--   41+ RLS-enabled tables, 0 policies, 17 fuel_types, 5 user_roles,
--   2 environmental_zones, 1 map_config, pgcrypto + vector extensions.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. TABLE COUNT -------------------------------------------------------------
SELECT count(*) AS expected_50_tables
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';

-- 2. SEED COUNTS -------------------------------------------------------------
SELECT 'fuel_types' AS ref, count(*) AS n FROM fuel_types
UNION ALL SELECT 'user_roles', count(*) FROM user_roles
UNION ALL SELECT 'environmental_zones', count(*) FROM environmental_zones
UNION ALL SELECT 'map_config', count(*) FROM map_config;

-- 3. FRESH VESSELS (should be 0 on a fresh pilot DB — proof we are NOT on the
--    demo seed, which otherwise seeds 5+ vessels in mock mode) ----------------
SELECT count(*) AS vessels_fresh_count FROM vessels;

-- 4. ROW-LEVEL SECURITY STATE ------------------------------------------------
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- 5. RLS POLICIES (we expect 0 — deny-by-default, service-role only) ---------
SELECT count(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public';

-- 6. TRIGGERS -----------------------------------------------------------------
SELECT count(*) AS trigger_count
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- 7. INDEXES ------------------------------------------------------------------
SELECT count(*) AS index_count
FROM pg_indexes
WHERE schemaname = 'public';

-- 8. FOREIGN KEYS --------------------------------------------------------------
SELECT count(*) AS fk_count
FROM information_schema.table_constraints
WHERE constraint_schema = 'public' AND constraint_type = 'FOREIGN KEY';

-- 9. EXTENSIONS ----------------------------------------------------------------
-- 0012 self-enables pgvector (`CREATE EXTENSION IF NOT EXISTS vector;`) BEFORE
-- it uses the type, so on a fresh target `vector` MUST be present here.
SELECT extname, extversion
FROM pg_extension
WHERE extname IN ('pgcrypto', 'vector')
ORDER BY extname;

-- 10. PGVECTOR / AI ASSISTANT (migration 0012) ----------------------------------
--    a) knowledge_chunks.embedding must actually resolve to the `vector` type.
SELECT data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'knowledge_chunks'
  AND column_name = 'embedding';

--    b) The HNSW vector_cosine_ops index must exist (proves index creation ran
--       after the extension was enabled, i.e. 0012 did not hit `type "vector"
--       does not exist`).
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'knowledge_chunks'
  AND indexdef ILIKE '%USING hnsw%vector_cosine_ops%';

-- 11. MIGRATION HISTORY ---------------------------------------------------------
-- Supabase CLI records applied migrations here (hosted CLI/studio). When present:
-- SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;

-- 12. IMMUTABLE AUDIT LOG (migration 0018) ---------------------------------------
--    The append-only trigger MUST be present, and UPDATE/DELETE MUST fail.
SELECT tgname, tgtype
FROM pg_trigger
WHERE tgrelid = 'audit_log'::regclass;

--   This UPDATE must raise (append-only): comment/uncomment to test:
-- UPDATE audit_log SET action = 'tampered' WHERE false;
