/**
 * repositories/certificates.ts — certificate & statutory document registry persistence
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Wraps `certificate_registry` (versioned records) and
 * `certificate_registry_events` (append-only audit trail).
 * CRUD + deterministic date queries ONLY — no status derivation, no business
 * rules. The domain status engine in `src/lib/certificates/` owns status logic.
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type {
  CertificateRegistryEventInsert as CertificateRegistryEventInsertType,
  CertificateRegistryEventRow as CertificateRegistryEventRowType,
  CertificateRegistryInsert as CertificateRegistryInsertType,
  CertificateRegistryRow as CertificateRegistryRowType,
} from "../types";

export type CertificateRow = CertificateRegistryRowType;
export type CertificateInsert = CertificateRegistryInsertType;
export type CertificateEventRow = CertificateRegistryEventRowType;
export type CertificateEventInsert = CertificateRegistryEventInsertType;

export interface FindCertificatesOptions {
  readonly onlyCurrent?: boolean;
  readonly status?: string;
  readonly certificateType?: string;
}

export interface CertificateRepository {
  findById(id: string): Promise<CertificateRow | null>;
  findByVesselId(vesselId: string, opts?: FindCertificatesOptions): Promise<CertificateRow[]>;
  findByVesselAndType(vesselId: string, certificateType: string): Promise<CertificateRow | null>;
  findExpiringWithinDays(vesselId: string, withinDays: number, now: string): Promise<CertificateRow[]>;
  findExpired(vesselId: string, now: string): Promise<CertificateRow[]>;
  insert(input: CertificateInsert): Promise<CertificateRow>;
  update(id: string, patch: Partial<CertificateInsert>): Promise<CertificateRow>;
  findEventsByVesselId(vesselId: string, limit?: number): Promise<CertificateEventRow[]>;
  findEventsByCertificateId(certificateId: string, limit?: number): Promise<CertificateEventRow[]>;
  insertEvent(input: CertificateEventInsert): Promise<CertificateEventRow>;
}

export interface CreateCertificateRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createCertificateRepository(
  opts: CreateCertificateRepositoryOptions = {},
): CertificateRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  async function findById(id: string): Promise<CertificateRow | null> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("certificate_registry")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw mapError("findById", error);
      return (data ?? null) as unknown as CertificateRow | null;
    } catch (e) {
      throw mapError("findById", e);
    }
  }

  async function findByVesselId(
    vesselId: string,
    opts: FindCertificatesOptions = {},
  ): Promise<CertificateRow[]> {
    try {
      const client = getClient();
      let query = client.from("certificate_registry").select("*").eq("vessel_id", vesselId);
      if (opts.onlyCurrent) {
        query = query.eq("is_current", true);
      }
      if (opts.status) {
        query = query.eq("status", opts.status);
      }
      if (opts.certificateType) {
        query = query.eq("certificate_type", opts.certificateType);
      }
      const { data, error } = await query.order("created_at", { ascending: true });
      if (error) throw mapError("findByVesselId", error);
      return (data ?? []) as unknown as CertificateRow[];
    } catch (e) {
      throw mapError("findByVesselId", e);
    }
  }

  async function findByVesselAndType(
    vesselId: string,
    certificateType: string,
  ): Promise<CertificateRow | null> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("certificate_registry")
        .select("*")
        .eq("vessel_id", vesselId)
        .eq("certificate_type", certificateType)
        .eq("is_current", true)
        .maybeSingle();
      if (error) throw mapError("findByVesselAndType", error);
      return (data ?? null) as unknown as CertificateRow | null;
    } catch (e) {
      throw mapError("findByVesselAndType", e);
    }
  }

  async function findExpiringWithinDays(
    vesselId: string,
    withinDays: number,
    now: string,
  ): Promise<CertificateRow[]> {
    try {
      const client = getClient();
      const upper = new Date(new Date(now).getTime() + withinDays * 86_400_000).toISOString();
      const { data, error } = await client
        .from("certificate_registry")
        .select("*")
        .eq("vessel_id", vesselId)
        .eq("is_current", true)
        .gte("expiry_date", now.slice(0, 10))
        .lte("expiry_date", upper.slice(0, 10));
      if (error) throw mapError("findExpiringWithinDays", error);
      return (data ?? []) as unknown as CertificateRow[];
    } catch (e) {
      throw mapError("findExpiringWithinDays", e);
    }
  }

  async function findExpired(vesselId: string, now: string): Promise<CertificateRow[]> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("certificate_registry")
        .select("*")
        .eq("vessel_id", vesselId)
        .eq("is_current", true)
        .lt("expiry_date", now.slice(0, 10));
      if (error) throw mapError("findExpired", error);
      return (data ?? []) as unknown as CertificateRow[];
    } catch (e) {
      throw mapError("findExpired", e);
    }
  }

  async function insert(input: CertificateInsert): Promise<CertificateRow> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("certificate_registry")
        .insert(input)
        .select()
        .single();
      if (error) throw mapError("insert", error);
      return data as unknown as CertificateRow;
    } catch (e) {
      throw mapError("insert", e);
    }
  }

  async function update(id: string, patch: Partial<CertificateInsert>): Promise<CertificateRow> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("certificate_registry")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw mapError("update", error);
      return data as unknown as CertificateRow;
    } catch (e) {
      throw mapError("update", e);
    }
  }

  async function findEventsByVesselId(
    vesselId: string,
    max: number = 50,
  ): Promise<CertificateEventRow[]> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("certificate_registry_events")
        .select("*")
        .eq("vessel_id", vesselId)
        .order("event_ts", { ascending: false })
        .limit(max);
      if (error) throw mapError("findEventsByVesselId", error);
      return (data ?? []) as unknown as CertificateEventRow[];
    } catch (e) {
      throw mapError("findEventsByVesselId", e);
    }
  }

  async function findEventsByCertificateId(
    certificateId: string,
    max: number = 50,
  ): Promise<CertificateEventRow[]> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("certificate_registry_events")
        .select("*")
        .eq("certificate_id", certificateId)
        .order("event_ts", { ascending: false })
        .limit(max);
      if (error) throw mapError("findEventsByCertificateId", error);
      return (data ?? []) as unknown as CertificateEventRow[];
    } catch (e) {
      throw mapError("findEventsByCertificateId", e);
    }
  }

  async function insertEvent(input: CertificateEventInsert): Promise<CertificateEventRow> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("certificate_registry_events")
        .insert(input)
        .select()
        .single();
      if (error) throw mapError("insertEvent", error);
      return data as unknown as CertificateEventRow;
    } catch (e) {
      throw mapError("insertEvent", e);
    }
  }

  return {
    findById,
    findByVesselId,
    findByVesselAndType,
    findExpiringWithinDays,
    findExpired,
    insert,
    update,
    findEventsByVesselId,
    findEventsByCertificateId,
    insertEvent,
  };
}
