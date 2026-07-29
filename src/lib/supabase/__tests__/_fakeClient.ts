/**
 * _fakeClient.ts — in-memory fake Supabase client for repository tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Repository unit tests must run without a real Supabase connection. This file
 * provides a lightweight fake that satisfies the same TypeScript shape as
 * `SupabaseClient<Database>` (via TypedSupabaseClient) so repositories accept
 * it without casts.
 *
 * DESIGN
 * The fake intercepts `.from(tableName)` calls and routes them to a simple
 * in-memory store keyed by table name. Each table holds an array of rows.
 * Supported operations:
 *   - `.insert(values).select().single()`  → append row, return it
 *   - `.insert(values).select()`            → append rows, return them
 *   - `.upsert(values, opts).select().single()` → insert or replace by onConflict key
 *   - `.select().eq(col, val).single()`     → find by column, return one
 *   - `.select().eq(col, val).maybeSingle()` → find by column, return one or null
 *   - `.select().eq(col, val).order(col).limit(n).maybeSingle()` → filtered + ordered
 *
 * The fake intentionally does NOT validate constraints, check types, or enforce
 * uniqueness beyond what the test scenario explicitly sets up. It is a test
 * double, not a database simulator.
 *
 * USAGE
 *   const fake = createFakeSupabaseClient({
 *     vessels: [
 *       { id: "uuid-1", imo: "9074729", name: "Aurelia", mmsi: null, ship_id: null,
 *         created_at: "2026-06-29T00:00:00Z", updated_at: "2026-06-29T00:00:00Z" },
 *     ],
 *   });
 *   const repo = createVesselRepository({ client: fake });
 *
 * HOW IT FITS
 * Tests import this file. The fake's return type is explicitly typed as
 * TypedSupabaseClient so the repositories accept it without coercion.
 */

import type { TypedSupabaseClient } from "../client";

// ── Error type matching PostgrestError shape ───────────────────────────────────

class FakePostgrestError extends Error {
  readonly details: string;
  readonly hint: string;
  readonly code: string;

  constructor(opts: {
    message: string;
    details?: string;
    hint?: string;
    code?: string;
  }) {
    super(opts.message);
    this.name = "PostgrestError";
    this.details = opts.details ?? "";
    this.hint = opts.hint ?? "";
    this.code = opts.code ?? "";
  }
}

// ── Result shape ──────────────────────────────────────────────────────────────

interface FakeResult<T> {
  readonly data: T;
  readonly error: null;
  readonly count: number | null;
  readonly status: number;
  readonly statusText: string;
}

interface FakeErrorResult {
  readonly data: null;
  readonly error: FakePostgrestError;
  readonly count: null;
  readonly status: number;
  readonly statusText: string;
}

type FakeResponse<T> = FakeResult<T> | FakeErrorResult;

function success<T>(data: T): FakeResult<T> {
  return { data, error: null, count: null, status: 200, statusText: "OK" };
}

function failure(
  code: string,
  message: string,
  details = "",
): FakeErrorResult {
  return {
    data: null,
    error: new FakePostgrestError({ code, message, details }),
    count: null,
    status: 400,
    statusText: "Bad Request",
  };
}

// ── Query state machine ─────────────────────────────────────────────────────

type QueryKind = "select" | "insert" | "upsert" | "update" | "delete";

interface QueryState {
  readonly kind: QueryKind;
  readonly table: string;
  values?: unknown;
  onConflict?: string;
  filters: Array<{ column: string; value: unknown }>;
  orderColumn?: string;
  orderAscending?: boolean;
  orderNullsFirst?: boolean;
  limitRows?: number;
  hasSelectChained: boolean;
}

// ── The fake ─────────────────────────────────────────────────────────────────

export interface FakeSupabaseClientOptions {
  /** Seed data keyed by table name. Deep-cloned on creation. */
  readonly tables?: Record<string, readonly unknown[]>;
  /** When set, every query returns this error. */
  readonly globalError?: { code: string; message: string; details?: string };
}

/**
 * Creates an in-memory fake that satisfies TypedSupabaseClient.
 *
 * The fake supports the subset of the Postgrest query builder API used by our
 * three repositories: insert, upsert, select, eq, order, limit, single,
 * maybeSingle, and chaining select() after mutations.
 */
export function createFakeSupabaseClient(
  opts: FakeSupabaseClientOptions = {},
): TypedSupabaseClient {
  const store: Record<string, unknown[]> = {};
  // Deep-clone seed data so tests can't mutate the original fixtures.
  for (const [table, rows] of Object.entries(opts.tables ?? {})) {
    store[table] = rows.map((row) => ({ ...(row as Record<string, unknown>) }));
  }

  function from(tableName: string): FakeQueryBuilder {
    return new FakeQueryBuilder(store, tableName, opts.globalError);
  }

  // Build a minimal object that matches the SupabaseClient shape our repos use.
  // TypedSupabaseClient is `ReturnType<typeof createSupabaseClient>`, which is
  // SupabaseClient<Database, ...>. Repositories only call `.from()`, so we
  // provide that and cast through the barrel type.
  const fake = { from } as unknown as TypedSupabaseClient;
  return fake;
}

// ── Query builder ────────────────────────────────────────────────────────────

class FakeQueryBuilder {
  private readonly state: QueryState;

  constructor(
    private readonly store: Record<string, unknown[]>,
    tableName: string,
    private readonly globalError?: FakeSupabaseClientOptions["globalError"],
    initialValues?: QueryState,
  ) {
    this.state = {
      ...initialValues,
      // Preserve the caller's kind (insert/upsert) when chaining .select()
      // after a mutation. Only default to "select" when no kind is inherited.
      kind: initialValues?.kind ?? "select",
      table: tableName,
      filters: initialValues?.filters ?? [],
      // Preserve the flag set by the .select() chain method.
      hasSelectChained: initialValues?.hasSelectChained ?? false,
    };
  }

  // ── Mutation entry points (return new builder with different kind) ─────────

  insert(values: unknown): FakeQueryBuilder {
    return new FakeQueryBuilder(this.store, this.state.table, this.globalError, {
      ...this.state,
      kind: "insert",
      values,
    });
  }

  upsert(
    values: unknown,
    options?: { onConflict?: string },
  ): FakeQueryBuilder {
    return new FakeQueryBuilder(this.store, this.state.table, this.globalError, {
      ...this.state,
      kind: "upsert",
      values,
      onConflict: options?.onConflict,
    });
  }

  update(values: unknown): FakeQueryBuilder {
    return new FakeQueryBuilder(this.store, this.state.table, this.globalError, {
      ...this.state,
      kind: "update",
      values,
    });
  }

  // ── Select (can be called as entry point or chained after mutation) ─────────

  select(_columns?: string): FakeQueryBuilder {
    // The columns string (e.g. "*, vessels!inner(imo)") is accepted for API
    // compatibility but the fake returns all columns regardless — the test
    // data already contains whatever the caller needs.
    // Preserve the current kind (mutation or plain select). When chained after
    // insert/upsert the resolveAsArray engine sees hasSelectChained + the
    // mutation kind and returns the affected rows instead of doing a table scan.
    return new FakeQueryBuilder(this.store, this.state.table, this.globalError, {
      ...this.state,
      hasSelectChained: true,
    });
  }

  // ── Filters (all return this) ──────────────────────────────────────────────

  eq(column: string, value: unknown): this {
    // Supabase join syntax uses dotted paths like "vessels.imo". The fake
    // doesn't implement joins — tests seed rows with the joined column directly.
    // Strip the table prefix so "vessels.imo" matches a row property named "imo".
    const dotIdx = column.indexOf(".");
    const resolvedCol = dotIdx >= 0 ? column.substring(dotIdx + 1) : column;
    (this.state.filters as Array<{ column: string; value: unknown }>).push({
      column: resolvedCol,
      value,
    });
    return this;
  }

  // ── Transform (return this) ────────────────────────────────────────────────

  order(
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ): this {
    this.state.orderColumn = column;
    this.state.orderAscending = options?.ascending ?? true;
    this.state.orderNullsFirst = options?.nullsFirst;
    return this;
  }

  limit(rows: number): this {
    this.state.limitRows = rows;
    return this;
  }

  // ── Terminal: resolves the query against the in-memory store ─────────────────

  single(): PromiseLike<FakeResponse<unknown>> {
    return this.execute(true);
  }

  maybeSingle(): PromiseLike<FakeResponse<unknown | null>> {
    return this.execute(false);
  }

  // ── PromiseLike: allow `await client.from(...).select()` ───────────────────

  then<TResult1, TResult2>(
    onfulfilled?:
      | ((value: FakeResponse<unknown[]>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null,
  ): PromiseLike<TResult1 | TResult2> {
    // Resolves as a multi-row select result.
    const resultPromise = this.resolveAsArray();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onFulfilledDefault = (v: any) => v as any;
    return resultPromise.then(onfulfilled ?? onFulfilledDefault, onrejected);
  }

  // ── Internal execution engine ─────────────────────────────────────────────

  private execute(exactlyOne: boolean): PromiseLike<FakeResponse<unknown>> {
    const resultPromise = this.resolveAsArray();
    return {
      then<TResult1, TResult2>(
        onfulfilled?:
          | ((value: FakeResponse<unknown>) => TResult1 | PromiseLike<TResult1>)
          | null,
        onrejected?:
          | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
          | null,
      ): PromiseLike<TResult1 | TResult2> {
        // Flatten: resolve the array, pick the single/maybeSingle row, then
        // apply the caller's onfulfilled in one step — avoids the double-then
        // type mismatch.
        const mapped = resultPromise.then((arrayResult) => {
          // If the underlying query already returned an error, propagate it
          // directly — don't wrap it in a PGRST116 cardinality error.
          if (arrayResult.error) {
            return arrayResult as FakeResponse<unknown>;
          }

          const rows = arrayResult.data;

          if (exactlyOne) {
            if (!rows || rows.length !== 1) {
              return failure(
                "PGRST116",
                `Results contain ${rows?.length ?? 0} rows, exactly one expected`,
              ) as FakeResponse<unknown>;
            }
            return success(rows[0]!) as FakeResponse<unknown>;
          }

          // maybeSingle
          if (!rows || rows.length === 0) {
            return success(null) as FakeResponse<unknown>;
          }
          if (rows.length > 1) {
            return failure(
              "PGRST116",
              `Results contain ${rows.length} rows, expected at most one`,
            ) as FakeResponse<unknown>;
          }
          return success(rows[0]!) as FakeResponse<unknown>;
        });

        // Now mapped is Promise<FakeResponse<unknown>> — compatible with onfulfilled.
        return mapped.then(onfulfilled ?? ((v) => v as TResult1), onrejected);
      },
    };
  }

  private async resolveAsArray(): Promise<FakeResponse<unknown[]>> {
    // Global error override: return failure for every query.
    if (this.globalError) {
      return failure(
        this.globalError.code,
        this.globalError.message,
        this.globalError.details,
      );
    }

    // Ensure the table exists in the store so inserts persist correctly.
    if (!this.store[this.state.table]) {
      this.store[this.state.table] = [];
    }
    const tableRows = this.store[this.state.table]!;

    switch (this.state.kind) {
      case "insert":
      case "upsert": {
        const input = this.state.values;
        // Support single or batch inserts.
        const inputs = Array.isArray(input) ? input : [input];
        const inserted: unknown[] = [];

        for (const raw of inputs) {
          if (this.state.kind === "upsert" && this.state.onConflict) {
            // Upsert: find existing row matching the conflict column, replace or insert.
            const conflictCol = this.state.onConflict;
            const conflictVal = (raw as Record<string, unknown>)[conflictCol];
            const existingIdx = tableRows.findIndex(
              (r) =>
                (r as Record<string, unknown>)[conflictCol] === conflictVal,
            );

            if (existingIdx >= 0) {
              // ON CONFLICT DO UPDATE: merge new values over existing row,
              // preserving id/created_at. Then update updated_at.
              const existing = tableRows[existingIdx] as Record<string, unknown>;
              const row = this.buildRow(
                { ...existing, ...raw },
                true,
              );
              tableRows[existingIdx] = row;
              inserted.push(row);
            } else {
              // No conflict: plain insert with server defaults.
              const row = this.buildRow(raw, false);
              tableRows.push(row);
              inserted.push(row);
            }
          } else {
            // Plain insert
            const row = this.buildRow(raw, false);
            tableRows.push(row);
            inserted.push(row);
          }
        }

        return success(inserted);
      }

      case "update": {
        const updateValues = this.state.values as Record<string, unknown>;
        const matched: unknown[] = [];

        for (let i = 0; i < tableRows.length; i++) {
          const row = tableRows[i] as Record<string, unknown>;
          let matches = true;
          for (const filter of this.state.filters) {
            if (row[filter.column] !== filter.value) {
              matches = false;
              break;
            }
          }
          if (matches) {
            const updated = { ...row, ...updateValues };
            tableRows[i] = updated;
            matched.push(updated);
          }
        }

        return success(matched);
      }

      case "select": {
        let rows = [...tableRows];

        // Apply filters
        for (const filter of this.state.filters) {
          rows = rows.filter((r) => {
            const rowVal = (r as Record<string, unknown>)[filter.column];
            return rowVal === filter.value;
          });
        }

        // Apply ordering
        if (this.state.orderColumn) {
          const col = this.state.orderColumn;
          const asc = this.state.orderAscending ?? true;
          rows.sort((a, b) => {
            const aVal = (a as Record<string, unknown>)[col];
            const bVal = (b as Record<string, unknown>)[col];
            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;
            const cmp = String(aVal).localeCompare(String(bVal));
            return asc ? cmp : -cmp;
          });
        }

        // Apply limit
        if (this.state.limitRows !== undefined) {
          rows = rows.slice(0, this.state.limitRows);
        }

        return success(rows);
      }

      default:
        return success(tableRows);
    }
  }

  /**
   * Build a full row by merging the input with server-defaulted columns.
   * If `isUpdate` is true, the existing id/created_at are already in the
   * merged input (caller spreads existing row before calling buildRow).
   *
   * Missing nullable columns are set to null so the returned row matches
   * what Supabase would produce (every column is present, not undefined).
   */
  private buildRow(
    input: unknown,
    isUpdate: boolean,
  ): Record<string, unknown> {
    const row = { ...(input as Record<string, unknown>) };

    // Server-managed defaults
    if (!row.id) row.id = crypto.randomUUID();
    if (!row.created_at) row.created_at = new Date().toISOString();

    // Table-specific nullable column defaults.
    // In real PostgREST every column is present (NULL, not absent). The fake
    // must match so that `row.mmsi === null` works (not `=== undefined`).
    if (this.state.table === "vessels") {
      if (row.mmsi === undefined) row.mmsi = null;
      if (row.ship_id === undefined) row.ship_id = null;
      if (row.updated_at === undefined) {
        row.updated_at = isUpdate
          ? new Date().toISOString()
          : row.created_at;
      }
    }
    if (this.state.table === "ais_positions") {
      if (row.sog === undefined) row.sog = null;
      if (row.cog === undefined) row.cog = null;
      if (row.heading === undefined) row.heading = null;
      if (row.nav_status === undefined) row.nav_status = null;
    }
    if (this.state.table === "voyages") {
      if (row.departure_port_id === undefined) row.departure_port_id = null;
      if (row.departure_time === undefined) row.departure_time = null;
      if (row.arrival_port_id === undefined) row.arrival_port_id = null;
      if (row.arrival_time === undefined) row.arrival_time = null;
      if (row.distance_nm === undefined) row.distance_nm = null;
    }

    // ── Document domain tables (Phase 2A.1) ─────────────────────────────────

    if (this.state.table === "documents") {
      if (row.vessel_id === undefined) row.vessel_id = null;
      if (row.status === undefined) row.status = "uploaded";
      if (row.file_size === undefined) row.file_size = null;
      if (row.metadata === undefined) row.metadata = null;
      if (row.updated_at === undefined) {
        row.updated_at = row.created_at;
      }
    }
    if (this.state.table === "document_versions") {
      if (row.file_size === undefined) row.file_size = null;
      if (row.uploaded_by === undefined) row.uploaded_by = null;
      if (row.upload_note === undefined) row.upload_note = null;
    }
    if (this.state.table === "processing_jobs") {
      if (row.document_version_id === undefined) row.document_version_id = null;
      if (row.status === undefined) row.status = "pending";
      if (row.started_at === undefined) row.started_at = null;
      if (row.completed_at === undefined) row.completed_at = null;
      if (row.error_message === undefined) row.error_message = null;
      if (row.result === undefined) row.result = null;
    }
    if (this.state.table === "ocr_results") {
      if (row.extracted_data === undefined) row.extracted_data = null;
      if (row.confidence === undefined) row.confidence = null;
    }
    if (this.state.table === "document_entities") {
      if (row.ocr_result_id === undefined) row.ocr_result_id = null;
      if (row.confidence === undefined) row.confidence = null;
      if (row.start_offset === undefined) row.start_offset = null;
      if (row.end_offset === undefined) row.end_offset = null;
      if (row.metadata === undefined) row.metadata = null;
    }
    if (this.state.table === "processing_logs") {
      if (row.details === undefined) row.details = null;
    }
    if (this.state.table === "review_tasks") {
      if (row.assigned_to === undefined) row.assigned_to = null;
      if (row.status === undefined) row.status = "pending";
      if (row.priority === undefined) row.priority = "normal";
      if (row.due_at === undefined) row.due_at = null;
      if (row.completed_at === undefined) row.completed_at = null;
      if (row.review_note === undefined) row.review_note = null;
      if (row.updated_at === undefined) {
        row.updated_at = row.created_at;
      }
    }
    if (this.state.table === "document_relationships") {
      if (row.metadata === undefined) row.metadata = null;
    }

    // ── AI Extraction table (Phase 2A.3) ──────────────────────────────────

    if (this.state.table === "ai_extractions") {
      if (row.ocr_result_id === undefined) row.ocr_result_id = null;
      if (row.status === undefined) row.status = "pending";
      if (row.confidence === undefined) row.confidence = null;
      if (row.summary === undefined) row.summary = null;
      if (row.fields === undefined) row.fields = {};
      if (row.warnings === undefined) row.warnings = [];
      if (row.missing_fields === undefined) row.missing_fields = [];
      if (row.provider === undefined) row.provider = "mock";
      if (row.model === undefined) row.model = "mock";
      if (row.prompt_tokens === undefined) row.prompt_tokens = null;
      if (row.completion_tokens === undefined) row.completion_tokens = null;
      if (row.total_tokens === undefined) row.total_tokens = null;
      if (row.latency_ms === undefined) row.latency_ms = null;
      if (row.error_message === undefined) row.error_message = null;
      if (row.updated_at === undefined) {
        row.updated_at = row.created_at;
      }
    }

    // ── Validation Report table (Phase 2A.4) ─────────────────────────────

    if (this.state.table === "validation_reports") {
      if (row.extraction_id === undefined) row.extraction_id = null;
      if (row.status === undefined) row.status = "pending";
      if (row.score === undefined) row.score = 0;
      if (row.rule_results === undefined) row.rule_results = [];
      if (row.passed_count === undefined) row.passed_count = 0;
      if (row.failed_count === undefined) row.failed_count = 0;
      if (row.error_count === undefined) row.error_count = 0;
      if (row.warning_count === undefined) row.warning_count = 0;
      if (row.blocking_issues === undefined) row.blocking_issues = [];
      if (row.recommended_review === undefined) row.recommended_review = [];
      if (row.ready_for_review === undefined) row.ready_for_review = false;
      if (row.validator_version === undefined) row.validator_version = "1.0.0";
      if (row.latency_ms === undefined) row.latency_ms = null;
      if (row.updated_at === undefined) {
        row.updated_at = row.created_at;
      }
    }

    return row;
  }
}
