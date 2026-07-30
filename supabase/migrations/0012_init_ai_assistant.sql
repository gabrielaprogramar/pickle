-- ════════════════════════════════════════════════════════════════════════════
-- Poseidon Ledger — AI Assistant Foundation
-- Migration: 0012_init_ai_assistant
-- ───────────────────────────────────────────────────────────────────────────
-- WHY THIS FILE EXISTS
--   Creates the data layer for Phase 3A (AI Assistant Foundation). Six tables:
--
--   1. knowledge_documents — versioned regulatory source documents (EU ETS
--      Directive, FuelEU Regulation, MARPOL Annex VI, THETIS-MRV guidance,
--      etc.). Each document is a single source with metadata.
--
--   2. knowledge_chunks — chunked sections of knowledge documents with
--      pgvector embedding support. Each chunk references its parent document
--      and stores the specific article/section reference.
--
--   3. assistant_conversations — top-level conversation container, scoped
--      to a user/organization. Tracks model ID, prompt version, status.
--
--   4. assistant_messages — individual messages within a conversation.
--      Stores role (user/assistant/system/tool), content, and references to
--      tool calls and citations.
--
--   5. assistant_tool_calls — audit-grade record of every tool invocation.
--      Captures tool name, input, output, success/failure, latency.
--
--   6. assistant_evaluation_log — evaluation harness results. Tracks
--      citation accuracy, hallucination flags, tool selection accuracy,
--      latency, and no-math-leak violations.
--
--   Design notes:
--     • knowledge_documents.version enables tracking regulatory updates.
--     • knowledge_chunks.embedding is a vector(384) column for pgvector.
--       In mock mode, chunking/retrieval uses keyword matching instead.
--     • assistant_tool_calls is append-only audit log — never modified.
--     • All tables have RLS enabled (policy creation deferred to auth phase).
-- ════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Knowledge documents — versioned regulatory sources
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE knowledge_documents (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    source          text        NOT NULL,
    regulation      text        NOT NULL,
    title           text        NOT NULL,
    article_section text,
    effective_date  date,
    version         text        NOT NULL DEFAULT '1.0',
    content         text        NOT NULL,
    metadata        jsonb       NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT knowledge_documents_source_check CHECK (source IN (
        'eu_ets_directive',
        'fueleu_regulation',
        'thetis_mrv_guidance',
        'marpol_annex_vi',
        'fueleu_guidance',
        'poseidon_policy'
    )),

    CONSTRAINT knowledge_documents_regulation_check CHECK (regulation IN (
        'EU_ETS',
        'FuelEU',
        'THETIS_MRV',
        'MARPOL',
        'POSEIDON'
    ))
);

CREATE INDEX knowledge_documents_source_idx      ON knowledge_documents (source);
CREATE INDEX knowledge_documents_regulation_idx  ON knowledge_documents (regulation);
CREATE INDEX knowledge_documents_effective_date_idx ON knowledge_documents (effective_date);

COMMENT ON TABLE  knowledge_documents
    IS 'Versioned regulatory source documents for the AI Assistant knowledge base.';
COMMENT ON COLUMN knowledge_documents.source
    IS 'Controlled by knowledge_documents_source_check. Identifies the regulatory source.';
COMMENT ON COLUMN knowledge_documents.regulation
    IS 'Controlled by knowledge_documents_regulation_check. Regulation category.';

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Knowledge chunks — embedded sections of knowledge documents
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE knowledge_chunks (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     uuid        NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    chunk_index     integer     NOT NULL,
    content         text        NOT NULL,
    article_section text,
    heading         text,
    embedding       vector(384),
    token_count     integer,
    metadata        jsonb       NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT knowledge_chunks_document_id_fkey FOREIGN KEY (document_id)
        REFERENCES knowledge_documents(id) ON DELETE CASCADE
);

CREATE INDEX knowledge_chunks_document_id_idx ON knowledge_chunks (document_id);
CREATE INDEX knowledge_chunks_embedding_idx   ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);

COMMENT ON TABLE  knowledge_chunks
    IS 'Chunked sections of knowledge documents with pgvector embeddings.';
COMMENT ON COLUMN knowledge_chunks.embedding
    IS '384-dim vector embedding for cosine-similarity search. Used when pgvector available.';

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Assistant conversations
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE assistant_conversations (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         text        NOT NULL,
    organization_id text,
    title           text        NOT NULL DEFAULT 'New conversation',
    model_id        text        NOT NULL DEFAULT 'mock',
    prompt_version  text        NOT NULL DEFAULT '1.0',
    status          text        NOT NULL DEFAULT 'ACTIVE',
    metadata        jsonb       NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT assistant_conversations_status_check CHECK (status IN (
        'ACTIVE', 'ARCHIVED', 'DELETED'
    ))
);

CREATE INDEX assistant_conversations_user_id_idx ON assistant_conversations (user_id);
CREATE INDEX assistant_conversations_status_idx  ON assistant_conversations (status);

COMMENT ON TABLE  assistant_conversations
    IS 'Top-level conversation container for the AI Assistant.';

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Assistant messages
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE assistant_messages (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid        NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
    role            text        NOT NULL,
    content         text,
    tool_call_id    uuid,
    tool_name       text,
    tool_input      jsonb,
    tool_output     jsonb,
    tool_status     text,
    citations       jsonb       NOT NULL DEFAULT '[]',
    metadata        jsonb       NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT assistant_messages_role_check CHECK (role IN (
        'system', 'user', 'assistant', 'tool'
    )),

    CONSTRAINT assistant_messages_tool_status_check CHECK (tool_status IN (
        'pending', 'running', 'success', 'error'
    ))
);

CREATE INDEX assistant_messages_conversation_id_idx ON assistant_messages (conversation_id);
CREATE INDEX assistant_messages_created_at_idx      ON assistant_messages (created_at);

COMMENT ON TABLE  assistant_messages
    IS 'Individual messages within an assistant conversation.';

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. Assistant tool calls — append-only audit log
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE assistant_tool_calls (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid        NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
    message_id      uuid        REFERENCES assistant_messages(id) ON DELETE SET NULL,
    tool_name       text        NOT NULL,
    tool_input      jsonb       NOT NULL,
    tool_output     jsonb,
    success         boolean     NOT NULL DEFAULT false,
    error_message   text,
    latency_ms      integer,
    permission_granted boolean  NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX assistant_tool_calls_conversation_id_idx ON assistant_tool_calls (conversation_id);
CREATE INDEX assistant_tool_calls_tool_name_idx       ON assistant_tool_calls (tool_name);
CREATE INDEX assistant_tool_calls_created_at_idx      ON assistant_tool_calls (created_at);

COMMENT ON TABLE  assistant_tool_calls
    IS 'Append-only audit log of every tool invocation by the AI Assistant.';

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. Assistant evaluation log
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE assistant_evaluation_log (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    test_name           text        NOT NULL,
    assistant_type      text        NOT NULL DEFAULT 'unknown',
    query               text        NOT NULL,
    response            text,
    citation_accuracy   real,
    retrieval_precision real,
    hallucination_flag  boolean     NOT NULL DEFAULT false,
    tool_selection_accuracy real,
    response_latency_ms integer,
    no_math_leak_violation boolean NOT NULL DEFAULT false,
    metadata            jsonb       NOT NULL DEFAULT '{}',
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX assistant_evaluation_log_test_name_idx   ON assistant_evaluation_log (test_name);
CREATE INDEX assistant_evaluation_log_created_at_idx  ON assistant_evaluation_log (created_at);

COMMENT ON TABLE  assistant_evaluation_log
    IS 'Evaluation harness results for the AI Assistant. Tracks key metrics.';

-- ──────────────────────────────────────────────────────────────────────────────
-- 7. Enable Row-Level Security on all tables
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE knowledge_documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_tool_calls        ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_evaluation_log    ENABLE ROW LEVEL SECURITY;
