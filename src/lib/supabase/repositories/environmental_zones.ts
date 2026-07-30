import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";

export type EnvironmentalZoneRow = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly category: string;
  readonly geometry_type: string;
  readonly geometry_coordinates: unknown;
  readonly description: string | null;
  readonly regulation_reference: string | null;
  readonly geometry_version: string;
  readonly jurisdiction: string | null;
  readonly effective_from: string;
  readonly effective_until: string | null;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
};

export interface EnvironmentalZoneRepository {
  findAllActive(): Promise<EnvironmentalZoneRow[]>;
  findByCode(code: string): Promise<EnvironmentalZoneRow | null>;
  findByCategory(category: string): Promise<EnvironmentalZoneRow[]>;
}

export interface CreateEnvironmentalZoneRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createEnvironmentalZoneRepository(
  opts: CreateEnvironmentalZoneRepositoryOptions = {},
): EnvironmentalZoneRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  async function findAllActive(): Promise<EnvironmentalZoneRow[]> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("environmental_zones")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw mapError("findAllActive", error);
      return (data ?? []) as unknown as EnvironmentalZoneRow[];
    } catch (e) {
      throw mapError("findAllActive", e);
    }
  }

  async function findByCode(code: string): Promise<EnvironmentalZoneRow | null> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("environmental_zones")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      if (error) throw mapError("findByCode", error);
      return (data ?? null) as unknown as EnvironmentalZoneRow | null;
    } catch (e) {
      throw mapError("findByCode", e);
    }
  }

  async function findByCategory(category: string): Promise<EnvironmentalZoneRow[]> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("environmental_zones")
        .select("*")
        .eq("category", category)
        .eq("is_active", true)
        .order("name");
      if (error) throw mapError("findByCategory", error);
      return (data ?? []) as unknown as EnvironmentalZoneRow[];
    } catch (e) {
      throw mapError("findByCategory", e);
    }
  }

  return { findAllActive, findByCode, findByCategory };
}
