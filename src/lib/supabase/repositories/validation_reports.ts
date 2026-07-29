import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";

export interface ValidationReportRow {
  readonly id: string;
  readonly document_id: string;
  readonly extraction_id: string | null;
  readonly status: string;
  readonly score: number;
  readonly rule_results: unknown[];
  readonly passed_count: number;
  readonly failed_count: number;
  readonly error_count: number;
  readonly warning_count: number;
  readonly blocking_issues: string[];
  readonly recommended_review: string[];
  readonly ready_for_review: boolean;
  readonly validator_version: string;
  readonly latency_ms: number | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ValidationReportInsert {
  readonly document_id: string;
  readonly extraction_id?: string | null;
  readonly status?: string;
  readonly score?: number;
  readonly rule_results?: unknown[];
  readonly passed_count?: number;
  readonly failed_count?: number;
  readonly error_count?: number;
  readonly warning_count?: number;
  readonly blocking_issues?: string[];
  readonly recommended_review?: string[];
  readonly ready_for_review?: boolean;
  readonly validator_version?: string;
  readonly latency_ms?: number | null;
}

export interface ValidationReportRepository {
  insert(input: ValidationReportInsert): Promise<ValidationReportRow>;
  findById(id: string): Promise<ValidationReportRow | null>;
  listByDocumentId(documentId: string): Promise<ValidationReportRow[]>;
  findLatestByDocumentId(documentId: string): Promise<ValidationReportRow | null>;
}

export interface CreateValidationReportRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createValidationReportRepository(
  opts: CreateValidationReportRepositoryOptions = {},
): ValidationReportRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async insert(input: ValidationReportInsert): Promise<ValidationReportRow> {
      try {
        const client = getClient();
        const payload = {
          document_id: input.document_id,
          extraction_id: input.extraction_id ?? null,
          status: input.status ?? "pending",
          score: input.score ?? 0,
          rule_results: input.rule_results ?? [],
          passed_count: input.passed_count ?? 0,
          failed_count: input.failed_count ?? 0,
          error_count: input.error_count ?? 0,
          warning_count: input.warning_count ?? 0,
          blocking_issues: input.blocking_issues ?? [],
          recommended_review: input.recommended_review ?? [],
          ready_for_review: input.ready_for_review ?? false,
          validator_version: input.validator_version ?? "1.0.0",
          latency_ms: input.latency_ms ?? null,
        };

        const { data, error } = await client
          .from("validation_reports")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        return data as ValidationReportRow;
      } catch (e) {
        throw mapError("insert validation report", e);
      }
    },

    async findById(id: string): Promise<ValidationReportRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("validation_reports")
          .select()
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        return (data as ValidationReportRow | null) ?? null;
      } catch (e) {
        throw mapError("find validation report by id", e);
      }
    },

    async listByDocumentId(documentId: string): Promise<ValidationReportRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("validation_reports")
          .select()
          .eq("document_id", documentId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data as ValidationReportRow[]) ?? [];
      } catch (e) {
        throw mapError("list validation reports by document", e);
      }
    },

    async findLatestByDocumentId(
      documentId: string,
    ): Promise<ValidationReportRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("validation_reports")
          .select()
          .eq("document_id", documentId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        return (data as ValidationReportRow | null) ?? null;
      } catch (e) {
        throw mapError("find latest validation report", e);
      }
    },
  };
}
