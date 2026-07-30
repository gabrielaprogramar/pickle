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

function successWithCount<T>(data: T, count: number): FakeResult<T> {
  return { data, error: null, count, status: 200, statusText: "OK" };
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

type QueryKind = "select" | "insert" | "upsert" | "update" | "delete";

interface SelectOptions {
  head?: boolean;
  count?: "exact" | "planned" | "estimated";
}

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
  rangeFrom?: number;
  rangeTo?: number;
  hasSelectChained: boolean;
  selectOptions?: SelectOptions;
}

export interface FakeSupabaseClientOptions {
  readonly tables?: Record<string, readonly unknown[]>;
  readonly globalError?: { code: string; message: string; details?: string };
}

import type { TypedSupabaseClient } from "./client";

export function createFakeSupabaseClient(
  opts: FakeSupabaseClientOptions = {},
): TypedSupabaseClient {
  const store: Record<string, unknown[]> = {};
  for (const [table, rows] of Object.entries(opts.tables ?? {})) {
    store[table] = rows.map((row) => ({ ...(row as Record<string, unknown>) }));
  }

  function from(tableName: string): FakeQueryBuilder {
    return new FakeQueryBuilder(store, tableName, opts.globalError);
  }

  return { from } as unknown as TypedSupabaseClient;
}

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
      kind: initialValues?.kind ?? "select",
      table: tableName,
      filters: initialValues?.filters ?? [],
      hasSelectChained: initialValues?.hasSelectChained ?? false,
    };
  }

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

  select(_columns?: string, options?: SelectOptions): FakeQueryBuilder {
    return new FakeQueryBuilder(this.store, this.state.table, this.globalError, {
      ...this.state,
      hasSelectChained: true,
      selectOptions: options,
    });
  }

  eq(column: string, value: unknown): this {
    const dotIdx = column.indexOf(".");
    const resolvedCol = dotIdx >= 0 ? column.substring(dotIdx + 1) : column;
    (this.state.filters as Array<{ column: string; value: unknown }>).push({
      column: resolvedCol,
      value,
    });
    return this;
  }

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

  range(from: number, to: number): this {
    this.state.rangeFrom = from;
    this.state.rangeTo = to;
    return this;
  }

  single(): PromiseLike<FakeResponse<unknown>> {
    return this.execute(true);
  }

  maybeSingle(): PromiseLike<FakeResponse<unknown | null>> {
    return this.execute(false);
  }

  then<TResult1, TResult2>(
    onfulfilled?:
      | ((value: FakeResponse<unknown[]>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null,
  ): PromiseLike<TResult1 | TResult2> {
    const resultPromise = this.resolveAsArray();
    const onFulfilledDefault = (v: unknown) => v as TResult1;
    return resultPromise.then(onfulfilled ?? onFulfilledDefault, onrejected);
  }

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
        const mapped = resultPromise.then((arrayResult) => {
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

        return mapped.then(onfulfilled ?? ((v) => v as TResult1), onrejected);
      },
    };
  }

  private async resolveAsArray(): Promise<FakeResponse<unknown[]>> {
    if (this.globalError) {
      return failure(
        this.globalError.code,
        this.globalError.message,
        this.globalError.details,
      );
    }

    if (!this.store[this.state.table]) {
      this.store[this.state.table] = [];
    }
    const tableRows = this.store[this.state.table]!;

    switch (this.state.kind) {
      case "insert":
      case "upsert": {
        const input = this.state.values;
        const inputs = Array.isArray(input) ? input : [input];
        const inserted: unknown[] = [];

        for (const raw of inputs) {
          if (this.state.kind === "upsert" && this.state.onConflict) {
            const conflictCol = this.state.onConflict;
            const conflictVal = (raw as Record<string, unknown>)[conflictCol];
            const existingIdx = tableRows.findIndex(
              (r) =>
                (r as Record<string, unknown>)[conflictCol] === conflictVal,
            );

            if (existingIdx >= 0) {
              const existing = tableRows[existingIdx] as Record<string, unknown>;
              const row = this.buildRow(
                { ...existing, ...raw },
                true,
              );
              tableRows[existingIdx] = row;
              inserted.push(row);
            } else {
              const row = this.buildRow(raw, false);
              tableRows.push(row);
              inserted.push(row);
            }
          } else {
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

        for (const filter of this.state.filters) {
          rows = rows.filter((r) => {
            const rowVal = (r as Record<string, unknown>)[filter.column];
            return rowVal === filter.value;
          });
        }

        const totalBeforeRange = rows.length;

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

        if (this.state.rangeFrom !== undefined && this.state.rangeTo !== undefined) {
          rows = rows.slice(this.state.rangeFrom, this.state.rangeTo + 1);
        } else if (this.state.limitRows !== undefined) {
          rows = rows.slice(0, this.state.limitRows);
        }

        const opts = this.state.selectOptions;
        if (opts?.head) {
          return successWithCount([] as unknown[], totalBeforeRange);
        }

        if (opts?.count === "exact") {
          return successWithCount(rows, totalBeforeRange);
        }

        return success(rows);
      }

      default:
        return success(tableRows);
    }
  }

  private buildRow(
    input: unknown,
    isUpdate: boolean,
  ): Record<string, unknown> {
    const row = { ...(input as Record<string, unknown>) };

    if (!row.id) row.id = crypto.randomUUID();
    if (!row.created_at) row.created_at = new Date().toISOString();

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

    if (this.state.table === "review_audit_log") {
      if (row.field_name === undefined) row.field_name = null;
      if (row.previous_value === undefined) row.previous_value = null;
      if (row.new_value === undefined) row.new_value = null;
      if (row.notes === undefined) row.notes = null;
    }

    if (this.state.table === "fuel_deliveries") {
      if (row.ocr_result_id === undefined) row.ocr_result_id = null;
      if (row.ai_extraction_id === undefined) row.ai_extraction_id = null;
      if (row.density_kgm3 === undefined) row.density_kgm3 = null;
      if (row.sulphur_content_pct === undefined) row.sulphur_content_pct = null;
      if (row.bdn_reference === undefined) row.bdn_reference = null;
      if (row.status === undefined) row.status = "pending";
      if (row.reconciled_voyage_id === undefined) row.reconciled_voyage_id = null;
      if (row.reconciled_at === undefined) row.reconciled_at = null;
      if (row.notes === undefined) row.notes = null;
      if (row.updated_at === undefined) {
        row.updated_at = row.created_at;
      }
    }

    if (this.state.table === "fuel_types") {
      if (row.description === undefined) row.description = null;
      if (row.sox_factor === undefined) row.sox_factor = 0;
      if (row.pm_factor === undefined) row.pm_factor = 0;
      if (row.density_default === undefined) row.density_default = null;
      if (row.is_drop_in === undefined) row.is_drop_in = true;
    }

    if (this.state.table === "reconciliation_log") {
      if (row.voyage_id === undefined) row.voyage_id = null;
      if (row.match_confidence === undefined) row.match_confidence = null;
      if (row.matched_by === undefined) row.matched_by = "system";
      if (row.details === undefined) row.details = null;
    }

    return row;
  }
}
