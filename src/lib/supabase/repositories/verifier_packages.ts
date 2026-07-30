import { mapError } from "../errors";
import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import type { VerifierPackageRow, VerifierPackageInsert } from "../types";

export interface VerifierPackageRepository {
  findById(id: string): Promise<VerifierPackageRow | null>;
  findByVesselAndYear(vesselId: string, year: number): Promise<ReadonlyArray<VerifierPackageRow>>;
  insert(pkg: VerifierPackageInsert): Promise<VerifierPackageRow>;
  update(id: string, changes: Partial<VerifierPackageInsert>): Promise<VerifierPackageRow>;
  list(limit?: number, offset?: number): Promise<ReadonlyArray<VerifierPackageRow>>;
  delete(id: string): Promise<void>;
}

export interface CreateVerifierPackageRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createVerifierPackageRepository(
  opts: CreateVerifierPackageRepositoryOptions = {},
): VerifierPackageRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async findById(id: string): Promise<VerifierPackageRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("verifier_packages")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return data as VerifierPackageRow | null;
      } catch (e) {
        throw mapError("find verifier package by id", e);
      }
    },

    async findByVesselAndYear(vesselId: string, year: number): Promise<ReadonlyArray<VerifierPackageRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("verifier_packages")
          .select("*")
          .eq("vessel_id", vesselId)
          .eq("reporting_year", year)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as VerifierPackageRow[];
      } catch (e) {
        throw mapError("find verifier packages by vessel and year", e);
      }
    },

    async insert(pkg: VerifierPackageInsert): Promise<VerifierPackageRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("verifier_packages")
          .insert(pkg as any)
          .select()
          .single();
        if (error) throw error;
        return data as VerifierPackageRow;
      } catch (e) {
        throw mapError("insert verifier package", e);
      }
    },

    async update(id: string, changes: Partial<VerifierPackageInsert>): Promise<VerifierPackageRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("verifier_packages")
          .update(changes as any)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as VerifierPackageRow;
      } catch (e) {
        throw mapError("update verifier package", e);
      }
    },

    async list(limit = 50, offset = 0): Promise<ReadonlyArray<VerifierPackageRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("verifier_packages")
          .select("*")
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return (data ?? []) as VerifierPackageRow[];
      } catch (e) {
        throw mapError("list verifier packages", e);
      }
    },

    async delete(id: string): Promise<void> {
      try {
        const client = getClient();
        const { error } = await client
          .from("verifier_packages")
          .delete()
          .eq("id", id);
        if (error) throw error;
      } catch (e) {
        throw mapError("delete verifier package", e);
      }
    },
  };
}
