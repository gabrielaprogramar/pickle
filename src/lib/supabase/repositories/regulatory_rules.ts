/**
 * repositories/regulatory_rules.ts — centralised, versioned, effective-dated
 * regulatory rule store
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Part 1 removes hardcoded regulatory thresholds (EU ETS GT-only scope, no FuelEU
 * gate) from the engines. Applicability and scope now read rules from a
 * centralised `regulatory_rules` table that is versioned and effective-dated.
 * This repository is the single read path for those rules.
 *
 * All methods throw RepositoryError subclasses via mapError() — never raw
 * PostgREST errors. Callers branch with `instanceof`.
 */

import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import type {
  RegulatoryRuleInsert,
  RegulatoryRuleRow,
} from "../types";
import { mapError } from "../errors";

export interface RegulatoryRuleRepository {
  /** List every rule version for a regulation and rule_key, newest first. */
  findByKey(
    regulation: string,
    ruleKey: string,
  ): Promise<RegulatoryRuleRow[]>;
  /** The effective rule version for a key as of a date. Null if none governs. */
  findEffective(
    regulation: string,
    ruleKey: string,
    asOfDate: string,
  ): Promise<RegulatoryRuleRow | null>;
  /** All active rules for a regulation as of a date (used to evaluate scope). */
  findActiveForRegulation(
    regulation: string,
    asOfDate: string,
  ): Promise<RegulatoryRuleRow[]>;
  /** Insert a new rule version. */
  insert(input: RegulatoryRuleInsert): Promise<RegulatoryRuleRow>;
}

export interface CreateRegulatoryRuleRepositoryOptions {
  /** Inject a client (tests). Defaults to the process singleton. */
  readonly client?: TypedSupabaseClient;
}

export function createRegulatoryRuleRepository(
  opts: CreateRegulatoryRuleRepositoryOptions = {},
): RegulatoryRuleRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  async function findByKey(
    regulation: string,
    ruleKey: string,
  ): Promise<RegulatoryRuleRow[]> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("regulatory_rules")
        .select("*")
        .eq("regulation", regulation)
        .eq("rule_key", ruleKey)
        .order("version", { ascending: false });
      if (error) throw error;
      return (data as RegulatoryRuleRow[]) ?? [];
    } catch (e) {
      throw mapError("find regulatory rules by key", e);
    }
  }

  async function findEffective(
    regulation: string,
    ruleKey: string,
    asOfDate: string,
  ): Promise<RegulatoryRuleRow | null> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("regulatory_rules")
        .select("*")
        .eq("regulation", regulation)
        .eq("rule_key", ruleKey)
        .eq("is_active", true)
        .lte("effective_from", asOfDate)
        .or(`effective_until.is.null,effective_until.gte.${asOfDate}`)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as RegulatoryRuleRow | null) ?? null;
    } catch (e) {
      throw mapError("find effective regulatory rule", e);
    }
  }

  async function findActiveForRegulation(
    regulation: string,
    asOfDate: string,
  ): Promise<RegulatoryRuleRow[]> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("regulatory_rules")
        .select("*")
        .eq("regulation", regulation)
        .eq("is_active", true)
        .lte("effective_from", asOfDate)
        .or(`effective_until.is.null,effective_until.gte.${asOfDate}`)
        .order("rule_key")
        .order("version", { ascending: false });
      if (error) throw error;
      return (data as RegulatoryRuleRow[]) ?? [];
    } catch (e) {
      throw mapError("find active regulatory rules", e);
    }
  }

  async function insert(input: RegulatoryRuleInsert): Promise<RegulatoryRuleRow> {
    try {
      const client = getClient();
      const { data, error } = await client
        .from("regulatory_rules")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as RegulatoryRuleRow;
    } catch (e) {
      throw mapError("insert regulatory rule", e);
    }
  }

  return { findByKey, findEffective, findActiveForRegulation, insert };
}
