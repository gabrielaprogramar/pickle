# PHASE 2A.1 — Document Domain Persistence Layer

## Status: COMPLETE

## Deliverables

### 1. Database Migration (`supabase/migrations/0002_init_document_domain.sql`)

Eight tables implementing the document domain for maritime ESG compliance:

| Table | Purpose |
|---|---|
| `documents` | Core entity — one row per compliance document |
| `document_versions` | Upload history / revision tracking |
| `processing_jobs` | Async pipeline jobs (OCR, extraction, validation, classification) |
| `ocr_results` | OCR text extraction output |
| `document_entities` | Named entities extracted from documents (IMO numbers, vessel names, ports, dates, etc.) |
| `processing_logs` | Append-only audit trail for processing events |
| `review_tasks` | Human-in-the-loop review workflow items |
| `document_relationships` | Typed links between documents (supersedes, amends, references, requires, attached_to) |

Constraints:
- CHECK constraints on all enum columns (document_type, status, job_type, log level, priority, entity_type, relationship_type)
- Non-negative file size checks
- Confidence range [0, 1] checks
- Time ordering checks on processing_jobs and review_tasks
- Self-reference prevention on document_relationships
- UNIQUE composite on document_relationships (source, target, type)
- UNIQUE composite on document_versions (document_id, version_number)
- UUID v4 primary keys (gen_random_uuid)
- TIMESTAMPTZ for all timestamps
- Indexes on all foreign keys and frequently queried columns
- RLS enabled, deny-by-default (service-role only)
- `touch_updated_at` trigger on documents and review_tasks (reuses Phase 1B function)

### 2. TypeScript Types (`src/lib/supabase/types.ts`)

Extended with:
- 10 union types mirroring CHECK constraints (DocumentType, DocumentStatus, ProcessingJobType, ProcessingJobStatus, ProcessingLogLevel, ReviewTaskStatus, ReviewTaskPriority, DocumentRelationshipType, DocumentEntityType)
- 8 row types (DocumentRow, DocumentVersionRow, ProcessingJobRow, OcrResultRow, DocumentEntityRow, ProcessingLogRow, ReviewTaskRow, DocumentRelationshipRow)
- 8 insert types (DocumentInsert, DocumentVersionInsert, ProcessingJobInsert, OcrResultInsert, DocumentEntityInsert, ProcessingLogInsert, ReviewTaskInsert, DocumentRelationshipInsert)
- Database interface extended with all 8 new tables

### 3. Zod Validation Schemas (`src/lib/supabase/schemas.ts`)

Runtime validation schemas mirroring all CHECK constraints. Each insert schema validates:
- Required fields and their types
- Enum values match database CHECK constraints
- String length limits
- UUID format for FK references
- Numeric ranges (confidence 0-1, non-negative file sizes)
- Optional/nullable fields

### 4. Repositories (8 files in `src/lib/supabase/repositories/`)

| Repository | Key Methods |
|---|---|
| `documents.ts` | insert, findById, updateStatus, listByVesselId, listByType |
| `document_versions.ts` | insert, listByDocumentId, findLatestByDocumentId |
| `processing_jobs.ts` | insert, findById, listByDocumentId, findLatestByDocumentAndType, updateStatus |
| `ocr_results.ts` | insert, findById, findByJobId, listByDocumentId |
| `document_entities.ts` | insert, insertBatch, findById, listByDocumentId, listByDocumentAndType |
| `processing_logs.ts` | insert, listByJobId, listByJobAndLevel |
| `review_tasks.ts` | insert, findById, listByDocumentId, listByAssignee, listByStatus, updateStatus, assign, complete |
| `document_relationships.ts` | insert, findById, listBySourceDocumentId, listByTargetDocumentId, listBySourceAndType |

All repositories follow Phase 1B patterns:
- Factory function with optional client injection
- Lazy singleton resolution
- RepositoryError subclasses via mapError()
- No business logic in repositories

### 5. Test Infrastructure

- `_fakeClient.ts` extended with `.update()` support and nullable column defaults for all 8 document tables
- 8 repository test files covering insert, find, list, update, batch, error mapping

### 6. Barrel Exports (`src/lib/supabase/index.ts`)

Extended to re-export all document domain types, repositories, and Zod schemas.

### 7. Test Script (`package.json`)

`npm run test` now includes all Phase 1B and Phase 2A.1 repository tests via `npm run test:supabase`.

## Files Changed/Created

| File | Status |
|---|---|
| `supabase/migrations/0002_init_document_domain.sql` | **NEW** |
| `src/lib/supabase/types.ts` | Extended |
| `src/lib/supabase/schemas.ts` | **NEW** |
| `src/lib/supabase/repositories/documents.ts` | **NEW** |
| `src/lib/supabase/repositories/document_versions.ts` | **NEW** |
| `src/lib/supabase/repositories/processing_jobs.ts` | **NEW** |
| `src/lib/supabase/repositories/ocr_results.ts` | **NEW** |
| `src/lib/supabase/repositories/document_entities.ts` | **NEW** |
| `src/lib/supabase/repositories/processing_logs.ts` | **NEW** |
| `src/lib/supabase/repositories/review_tasks.ts` | **NEW** |
| `src/lib/supabase/repositories/document_relationships.ts` | **NEW** |
| `src/lib/supabase/__tests__/_fakeClient.ts` | Extended |
| `src/lib/supabase/__tests__/documents.test.ts` | **NEW** |
| `src/lib/supabase/__tests__/document_versions.test.ts` | **NEW** |
| `src/lib/supabase/__tests__/processing_jobs.test.ts` | **NEW** |
| `src/lib/supabase/__tests__/ocr_results.test.ts` | **NEW** |
| `src/lib/supabase/__tests__/document_entities.test.ts` | **NEW** |
| `src/lib/supabase/__tests__/processing_logs.test.ts` | **NEW** |
| `src/lib/supabase/__tests__/review_tasks.test.ts` | **NEW** |
| `src/lib/supabase/__tests__/document_relationships.test.ts` | **NEW** |
| `src/lib/supabase/index.ts` | Extended |
| `package.json` | Extended |
| `docs/PHASE-2A.1-SUMMARY.md` | **NEW** |

## What Phase 2A.1 Does NOT Do

- No API routes (Phase 2B)
- No UI components (Phase 2C)
- No business logic in repositories
- No modification to Phase 1 code paths
- No new abstractions beyond the repository pattern established in Phase 1B
