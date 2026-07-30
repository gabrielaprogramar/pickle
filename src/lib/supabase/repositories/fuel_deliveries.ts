import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type {
  FuelDeliveryInsert,
  FuelDeliveryRow,
  FuelTypeRow,
  ReconciliationLogInsert,
  ReconciliationLogRow,
} from "../types";

export interface FuelDeliveryRepository {
  insert(input: FuelDeliveryInsert): Promise<FuelDeliveryRow>;
  findById(id: string): Promise<FuelDeliveryRow | null>;
  findByDocumentId(documentId: string): Promise<FuelDeliveryRow[]>;
  findByVesselId(vesselId: string): Promise<FuelDeliveryRow[]>;
  findByVoyageId(voyageId: string): Promise<FuelDeliveryRow[]>;
  listAll(): Promise<FuelDeliveryRow[]>;
  updateStatus(id: string, status: string): Promise<FuelDeliveryRow>;
  reconcile(id: string, voyageId: string): Promise<FuelDeliveryRow>;
  unreconcile(id: string): Promise<FuelDeliveryRow>;
  /** Insert a reconciliation audit log entry. */
  insertLogEntry(entry: ReconciliationLogInsert): Promise<ReconciliationLogRow>;
  /** Get all reconciliation log entries for a fuel delivery. */
  getLogEntries(fuelDeliveryId: string): Promise<ReconciliationLogRow[]>;
}

export interface FuelTypeRepository {
  findById(id: string): Promise<FuelTypeRow | null>;
  listAll(): Promise<FuelTypeRow[]>;
}

export interface CreateFuelDeliveryRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createFuelDeliveryRepository(
  opts: CreateFuelDeliveryRepositoryOptions = {},
): FuelDeliveryRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async insert(input: FuelDeliveryInsert): Promise<FuelDeliveryRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("fuel_deliveries")
          .insert(input)
          .select()
          .single();

        if (error) throw error;
        return data as FuelDeliveryRow;
      } catch (e) {
        throw mapError("insert fuel delivery", e);
      }
    },

    async findById(id: string): Promise<FuelDeliveryRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("fuel_deliveries")
          .select()
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        return (data as FuelDeliveryRow | null) ?? null;
      } catch (e) {
        throw mapError("find fuel delivery by id", e);
      }
    },

    async findByDocumentId(documentId: string): Promise<FuelDeliveryRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("fuel_deliveries")
          .select()
          .eq("document_id", documentId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data as FuelDeliveryRow[]) ?? [];
      } catch (e) {
        throw mapError("find fuel deliveries by document", e);
      }
    },

    async findByVesselId(vesselId: string): Promise<FuelDeliveryRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("fuel_deliveries")
          .select()
          .eq("vessel_id", vesselId)
          .order("delivery_date", { ascending: false });

        if (error) throw error;
        return (data as FuelDeliveryRow[]) ?? [];
      } catch (e) {
        throw mapError("find fuel deliveries by vessel", e);
      }
    },

    async findByVoyageId(voyageId: string): Promise<FuelDeliveryRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("fuel_deliveries")
          .select()
          .eq("reconciled_voyage_id", voyageId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data as FuelDeliveryRow[]) ?? [];
      } catch (e) {
        throw mapError("find fuel deliveries by voyage", e);
      }
    },

    async listAll(): Promise<FuelDeliveryRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("fuel_deliveries")
          .select()
          .order("delivery_date", { ascending: false });

        if (error) throw error;
        return (data as FuelDeliveryRow[]) ?? [];
      } catch (e) {
        throw mapError("list fuel deliveries", e);
      }
    },

    async updateStatus(id: string, status: string): Promise<FuelDeliveryRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("fuel_deliveries")
          .update({ status })
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;
        return data as FuelDeliveryRow;
      } catch (e) {
        throw mapError("update fuel delivery status", e);
      }
    },

    async reconcile(id: string, voyageId: string): Promise<FuelDeliveryRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("fuel_deliveries")
          .update({
            status: "reconciled",
            reconciled_voyage_id: voyageId,
            reconciled_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;
        return data as FuelDeliveryRow;
      } catch (e) {
        throw mapError("reconcile fuel delivery", e);
      }
    },

    async unreconcile(id: string): Promise<FuelDeliveryRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("fuel_deliveries")
          .update({
            status: "verified",
            reconciled_voyage_id: null,
            reconciled_at: null,
          })
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;
        return data as FuelDeliveryRow;
      } catch (e) {
        throw mapError("unreconcile fuel delivery", e);
      }
    },

    async insertLogEntry(entry: ReconciliationLogInsert): Promise<ReconciliationLogRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("reconciliation_log")
          .insert(entry)
          .select()
          .single();

        if (error) throw error;
        return data as ReconciliationLogRow;
      } catch (e) {
        throw mapError("insert reconciliation log", e);
      }
    },

    async getLogEntries(fuelDeliveryId: string): Promise<ReconciliationLogRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("reconciliation_log")
          .select()
          .eq("fuel_delivery_id", fuelDeliveryId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data as ReconciliationLogRow[]) ?? [];
      } catch (e) {
        throw mapError("get reconciliation log", e);
      }
    },
  };
}

export function createFuelTypeRepository(
  opts: CreateFuelDeliveryRepositoryOptions = {},
): FuelTypeRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async findById(id: string): Promise<FuelTypeRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("fuel_types")
          .select()
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        return (data as FuelTypeRow | null) ?? null;
      } catch (e) {
        throw mapError("find fuel type by id", e);
      }
    },

    async listAll(): Promise<FuelTypeRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("fuel_types")
          .select()
          .order("id", { ascending: true });

        if (error) throw error;
        return (data as FuelTypeRow[]) ?? [];
      } catch (e) {
        throw mapError("list fuel types", e);
      }
    },
  };
}
