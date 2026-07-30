import { mapError } from "../errors";
import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import type { ReportRow, ReportInsert, ReportType } from "../types";

export interface ComplianceReportRepository {
  findById(id: string): Promise<ReportRow | null>;
  findByVesselAndYear(vesselId: string, year: number): Promise<ReadonlyArray<ReportRow>>;
  listByType(reportType: ReportType): Promise<ReadonlyArray<ReportRow>>;
  listByVessel(vesselId: string): Promise<ReadonlyArray<ReportRow>>;
  insert(report: ReportInsert): Promise<ReportRow>;
  update(id: string, changes: Partial<ReportInsert>): Promise<ReportRow>;
  list(limit?: number, offset?: number): Promise<ReadonlyArray<ReportRow>>;
  delete(id: string): Promise<void>;
}

export interface CreateComplianceReportRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createComplianceReportRepository(
  opts: CreateComplianceReportRepositoryOptions = {},
): ComplianceReportRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async findById(id: string): Promise<ReportRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("compliance_reports")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return data as ReportRow | null;
      } catch (e) {
        throw mapError("find compliance report by id", e);
      }
    },

    async findByVesselAndYear(vesselId: string, year: number): Promise<ReadonlyArray<ReportRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("compliance_reports")
          .select("*")
          .eq("vessel_id", vesselId)
          .eq("reporting_year", year)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as ReportRow[];
      } catch (e) {
        throw mapError("find compliance reports by vessel and year", e);
      }
    },

    async listByType(reportType: ReportType): Promise<ReadonlyArray<ReportRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("compliance_reports")
          .select("*")
          .eq("report_type", reportType)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as ReportRow[];
      } catch (e) {
        throw mapError("list compliance reports by type", e);
      }
    },

    async listByVessel(vesselId: string): Promise<ReadonlyArray<ReportRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("compliance_reports")
          .select("*")
          .eq("vessel_id", vesselId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as ReportRow[];
      } catch (e) {
        throw mapError("list compliance reports by vessel", e);
      }
    },

    async insert(report: ReportInsert): Promise<ReportRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("compliance_reports")
          .insert(report as any)
          .select()
          .single();
        if (error) throw error;
        return data as ReportRow;
      } catch (e) {
        throw mapError("insert compliance report", e);
      }
    },

    async update(id: string, changes: Partial<ReportInsert>): Promise<ReportRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("compliance_reports")
          .update(changes as any)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as ReportRow;
      } catch (e) {
        throw mapError("update compliance report", e);
      }
    },

    async list(limit = 50, offset = 0): Promise<ReadonlyArray<ReportRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("compliance_reports")
          .select("*")
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return (data ?? []) as ReportRow[];
      } catch (e) {
        throw mapError("list compliance reports", e);
      }
    },

    async delete(id: string): Promise<void> {
      try {
        const client = getClient();
        const { error } = await client
          .from("compliance_reports")
          .delete()
          .eq("id", id);
        if (error) throw error;
      } catch (e) {
        throw mapError("delete compliance report", e);
      }
    },
  };
}
