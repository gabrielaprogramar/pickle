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

type FilterOp = "eq" | "gte" | "lte" | "gt" | "lt";

interface QueryFilter {
  readonly column: string;
  readonly value: unknown;
  readonly op: FilterOp;
}

interface QueryState {
  readonly kind: QueryKind;
  readonly table: string;
  values?: unknown;
  onConflict?: string;
  filters: Array<QueryFilter>;
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
    (this.state.filters as QueryFilter[]).push({
      column: resolvedCol,
      value,
      op: "eq",
    });
    return this;
  }

  is(column: string, value: unknown): this {
    const dotIdx = column.indexOf(".");
    const resolvedCol = dotIdx >= 0 ? column.substring(dotIdx + 1) : column;
    (this.state.filters as QueryFilter[]).push({
      column: resolvedCol,
      value,
      op: "eq",
    });
    return this;
  }

  gte(column: string, value: unknown): this {
    return this.addRangeFilter(column, value, "gte");
  }

  lte(column: string, value: unknown): this {
    return this.addRangeFilter(column, value, "lte");
  }

  gt(column: string, value: unknown): this {
    return this.addRangeFilter(column, value, "gt");
  }

  lt(column: string, value: unknown): this {
    return this.addRangeFilter(column, value, "lt");
  }

  private addRangeFilter(column: string, value: unknown, op: FilterOp): this {
    const dotIdx = column.indexOf(".");
    const resolvedCol = dotIdx >= 0 ? column.substring(dotIdx + 1) : column;
    (this.state.filters as QueryFilter[]).push({ column: resolvedCol, value, op });
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
            if (!this.matchesFilter(row[filter.column], filter)) {
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

        return successWithCount(matched, matched.length);
      }

      case "select": {
        let rows = [...tableRows];

        for (const filter of this.state.filters) {
          rows = rows.filter((r) => {
            const rowVal = (r as Record<string, unknown>)[filter.column];
            return this.matchesFilter(rowVal, filter);
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

  private matchesFilter(
    rowVal: unknown,
    filter: QueryFilter,
  ): boolean {
    switch (filter.op) {
      case "gte":
        return typeof rowVal === "string" && typeof filter.value === "string"
          ? rowVal >= filter.value
          : false;
      case "lte":
        return typeof rowVal === "string" && typeof filter.value === "string"
          ? rowVal <= filter.value
          : false;
      case "gt":
        return typeof rowVal === "string" && typeof filter.value === "string"
          ? rowVal > filter.value
          : false;
      case "lt":
        return typeof rowVal === "string" && typeof filter.value === "string"
          ? rowVal < filter.value
          : false;
      case "eq":
      default:
        return rowVal === filter.value;
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
      if (row.gross_tonnage === undefined) row.gross_tonnage = null;
      if (row.flag === undefined) row.flag = null;
      if (row.vessel_type === undefined) row.vessel_type = null;
      if (row.vessel_category === undefined) row.vessel_category = null;
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

    if (this.state.table === "regulatory_rules") {
      if (row.version === undefined) row.version = 1;
      if (row.is_active === undefined) row.is_active = true;
      if (row.effective_until === undefined) row.effective_until = null;
      if (row.parameters === undefined) row.parameters = {};
      if (row.rule_text === undefined) row.rule_text = null;
      if (row.source_reference === undefined) row.source_reference = null;
      if (row.updated_at === undefined) row.updated_at = row.created_at;
    }

    if (this.state.table === "regulation_applicability") {
      if (row.is_decision_final === undefined) row.is_decision_final = false;
      if (row.rule_effective_until === undefined) row.rule_effective_until = null;
      if (row.basis === undefined) row.basis = {};
      if (row.notes === undefined) row.notes = null;
      if (row.updated_at === undefined) row.updated_at = row.created_at;
    }

    if (this.state.table === "voyage_consumption") {
      if (row.voyage_id === undefined) row.voyage_id = null;
      if (row.source_record_ids === undefined) row.source_record_ids = [];
      if (row.traceability === undefined) row.traceability = {};
      if (row.notes === undefined) row.notes = null;
      if (row.updated_at === undefined) row.updated_at = row.created_at;
    }

    if (this.state.table === "certificate_registry") {
      if (row.document_id === undefined) row.document_id = null;
      if (row.certificate_number === undefined) row.certificate_number = null;
      if (row.issuing_authority === undefined) row.issuing_authority = null;
      if (row.class_society === undefined) row.class_society = null;
      if (row.issue_date === undefined) row.issue_date = null;
      if (row.expiry_date === undefined) row.expiry_date = null;
      if (row.validation_status === undefined) row.validation_status = "pending";
      if (row.review_status === undefined) row.review_status = "NOT_REQUIRED";
      if (row.review_required === undefined) row.review_required = false;
      if (row.blocking === undefined) row.blocking = false;
      if (row.reason_code === undefined) row.reason_code = null;
      if (row.confidence === undefined) row.confidence = null;
      if (row.notes === undefined) row.notes = null;
      if (row.version === undefined) row.version = 1;
      if (row.supersedes_id === undefined) row.supersedes_id = null;
      if (row.is_current === undefined) row.is_current = true;
      if (row.updated_at === undefined) row.updated_at = row.created_at;
    }

    if (this.state.table === "certificate_registry_events") {
      if (row.previous_status === undefined) row.previous_status = null;
      if (row.new_status === undefined) row.new_status = null;
      if (row.reason_code === undefined) row.reason_code = null;
      if (row.details === undefined) row.details = null;
      if (row.dedup_key === undefined) row.dedup_key = null;
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
      if (row.reason_code === undefined) row.reason_code = null;
      if (row.updated_at === undefined) {
        row.updated_at = row.created_at;
      }
    }
    if (this.state.table === "ocr_quality_scores") {
      if (row.confidence_distribution === undefined) row.confidence_distribution = {};
      if (row.issues === undefined) row.issues = [];
      if (row.missing_mandatory_fields === undefined) row.missing_mandatory_fields = [];
    }
    if (this.state.table === "noon_reports") {
      if (row.vessel_name === undefined) row.vessel_name = null;
      if (row.position_latitude === undefined) row.position_latitude = null;
      if (row.position_longitude === undefined) row.position_longitude = null;
      if (row.speed_knots === undefined) row.speed_knots = null;
      if (row.course_degrees === undefined) row.course_degrees = null;
      if (row.distance_to_go_nm === undefined) row.distance_to_go_nm = null;
      if (row.fuel_consumption_tonnes === undefined) row.fuel_consumption_tonnes = null;
      if (row.fuel_robs_tonnes === undefined) row.fuel_robs_tonnes = null;
      if (row.engine_rpm === undefined) row.engine_rpm = null;
      if (row.sea_state === undefined) row.sea_state = null;
      if (row.wind_speed_knots === undefined) row.wind_speed_knots = null;
      if (row.wind_direction === undefined) row.wind_direction = null;
      if (row.summary === undefined) row.summary = null;
      if (row.warnings === undefined) row.warnings = [];
      if (row.confidence === undefined) row.confidence = 0;
      if (row.source === undefined) row.source = "ai_extraction";
      if (row.source_document_id === undefined) row.source_document_id = null;
      if (row.review_state === undefined) row.review_state = null;
      if (row.is_blocked === undefined) row.is_blocked = false;
      if (row.analysis === undefined) row.analysis = null;
      if (row.findings === undefined) row.findings = [];
      if (row.fuel_correlation === undefined) row.fuel_correlation = null;
      if (row.voyage_correlation === undefined) row.voyage_correlation = null;
      if (row.fueleu_operational === undefined) row.fueleu_operational = null;
      if (row.ets_operational === undefined) row.ets_operational = null;
      if (row.evaluated_at === undefined) row.evaluated_at = null;
      if (row.evaluation_version === undefined) row.evaluation_version = null;
      if (row.dedup_key === undefined) row.dedup_key = null;
      if (row.updated_at === undefined) {
        row.updated_at = row.created_at;
      }
    }
    if (this.state.table === "ocr_review_suggestions") {
      if (row.status === undefined) row.status = "open";
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

    if (this.state.table === "audit_log") {
      if (row.actor_id === undefined) row.actor_id = null;
      if (row.actor_email === undefined) row.actor_email = null;
      if (row.entity_id === undefined) row.entity_id = null;
      if (row.before_data === undefined) row.before_data = {};
      if (row.after_data === undefined) row.after_data = {};
      if (row.source === undefined) row.source = "app";
      if (row.correlation_id === undefined) row.correlation_id = null;
      if (row.recorded_at === undefined) row.recorded_at = new Date().toISOString();
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

    if (this.state.table === "fuel_eu_records") {
      if (row.status === undefined) row.status = "draft";
      if (row.penalty_exposure_estimate === undefined) row.penalty_exposure_estimate = null;
      if (row.penalty_formula_version === undefined) row.penalty_formula_version = null;
      if (row.iscc_missing_details === undefined) row.iscc_missing_details = null;
      if (row.updated_at === undefined) row.updated_at = row.created_at;
    }

    if (this.state.table === "eu_ets_records") {
      if (row.gt === undefined) row.gt = null;
      if (row.eua_price_eur === undefined) row.eua_price_eur = null;
      if (row.estimated_cost_eur === undefined) row.estimated_cost_eur = null;
      if (row.surrender_deadline === undefined) row.surrender_deadline = null;
      if (row.surrender_status === undefined) row.surrender_status = null;
      if (row.mrv_deadline === undefined) row.mrv_deadline = null;
      if (row.mrv_deadline_status === undefined) row.mrv_deadline_status = null;
      if (row.calculation_details === undefined) row.calculation_details = {};
      if (row.updated_at === undefined) row.updated_at = row.created_at;
    }

    if (this.state.table === "mrv_reports") {
      if (row.status === undefined) row.status = "draft";
      if (row.completeness_status === undefined) row.completeness_status = "BLOCKED";
      if (row.completeness_checks === undefined) row.completeness_checks = [];
      if (row.blocking_issues === undefined) row.blocking_issues = [];
      if (row.warnings === undefined) row.warnings = [];
      if (row.checklist_status === undefined) row.checklist_status = null;
      if (row.checklist_details === undefined) row.checklist_details = null;
      if (row.export_format === undefined) row.export_format = null;
      if (row.export_generated_at === undefined) row.export_generated_at = null;
      if (row.export_content_hash === undefined) row.export_content_hash = null;
      if (row.export_file_path === undefined) row.export_file_path = null;
      if (row.report_data === undefined) row.report_data = {};
      if (row.monitoring_plan_version === undefined) row.monitoring_plan_version = null;
      if (row.ets_record_id === undefined) row.ets_record_id = null;
      if (row.updated_at === undefined) row.updated_at = row.created_at;
    }

    if (this.state.table === "organizations") {
      if (row.company_logo_url === undefined) row.company_logo_url = null;
      if (row.country === undefined) row.country = null;
      if (row.imo_company_number === undefined) row.imo_company_number = null;
      if (row.address === undefined) row.address = null;
      if (row.billing_email === undefined) row.billing_email = null;
      if (row.support_email === undefined) row.support_email = null;
      if (row.updated_at === undefined) row.updated_at = row.created_at;
    }
    if (this.state.table === "user_roles") {
      if (row.description === undefined) row.description = null;
      if (row.permissions === undefined) row.permissions = [];
      if (row.rank === undefined) row.rank = 0;
    }
    if (this.state.table === "organization_users") {
      if (row.avatar_url === undefined) row.avatar_url = null;
      if (row.status === undefined) row.status = "active";
      if (row.last_login_at === undefined) row.last_login_at = null;
      if (row.updated_at === undefined) row.updated_at = row.created_at;
    }
    if (this.state.table === "organization_settings") {
      if (row.default_timezone === undefined) row.default_timezone = "UTC";
      if (row.default_reporting_year === undefined) row.default_reporting_year = new Date().getUTCFullYear();
      if (row.language === undefined) row.language = "en";
      if (row.appearance === undefined) {
        row.appearance = {
          theme: "dark",
          accent: "teal",
          sidebarDensity: "compact",
          tableDensity: "compact",
          gridView: "list",
        };
      }
      if (row.notification_preferences === undefined) {
        row.notification_preferences = {
          emails: true,
          complianceAlerts: true,
          certificateExpiry: true,
          fuelAlerts: true,
          noonReport: true,
          assistantDigests: true,
          systemAnnouncements: true,
        };
      }
      if (row.updated_at === undefined) row.updated_at = row.created_at;
    }
    if (this.state.table === "organization_invites") {
      if (row.full_name === undefined) row.full_name = null;
      if (row.status === undefined) row.status = "pending";
      if (row.accepted_at === undefined) row.accepted_at = null;
      if (row.resend_count === undefined) row.resend_count = 0;
      if (row.last_sent_at === undefined) row.last_sent_at = null;
      if (row.updated_at === undefined) row.updated_at = row.created_at;
    }
    if (this.state.table === "integration_credentials") {
      if (row.status === undefined) row.status = "NOT_CONFIGURED";
      if (row.encrypted_config === undefined) row.encrypted_config = {};
      if (row.configured_at === undefined) row.configured_at = null;
      if (row.updated_at === undefined) row.updated_at = row.created_at;
    }
    if (this.state.table === "auth_tokens") {
      if (row.organization_id === undefined) row.organization_id = null;
      if (row.user_id === undefined) row.user_id = null;
      if (row.revoked_at === undefined) row.revoked_at = null;
    }

    return row;
  }
}
