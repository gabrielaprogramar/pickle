import { z } from "zod";

const imoSchema = z.string().regex(
  /^[0-9]{7}$/,
  "IMO must be exactly 7 digits",
);

export const vesselUpsertSchema = z.object({
  name: z.string().min(1, "Vessel name is required"),
  mmsi: z.string().nullable().optional(),
  ship_id: z.string().nullable().optional(),
  gross_tonnage: z.number().nullable().optional(),
  flag: z
    .string()
    .regex(/^[A-Z]{2,3}$/, "Flag must be ISO 3166-1 alpha-2/3 uppercase")
    .nullable()
    .optional(),
  vessel_type: z
    .enum([
      "cargo",
      "tanker",
      "container",
      "passenger",
      "roro",
      "offshore",
      "tug",
      "fishing",
      "pleasure",
      "other",
      "unknown",
    ])
    .nullable()
    .optional(),
  vessel_category: z
    .enum(["commercial", "private", "fishing", "other", "unknown"])
    .nullable()
    .optional(),
}).strict();

export type VesselUpsertInput = z.infer<typeof vesselUpsertSchema>;

const portSchema = z.object({
  name: z.string().min(1, "Port name is required"),
  id: z.number().nullable(),
});

const portEventSchema = z.object({
  port: portSchema,
  timestamp: z.string().nullable(),
});

const voyageSourceSchema = z.object({
  fetchedAt: z.string().min(1, "fetchedAt is required"),
  mock: z.boolean(),
});

export const voyageInsertSchema = z.object({
  vessel: z.object({
    name: z.string().min(1, "Vessel name is required"),
    imo: imoSchema,
  }),
  departure: portEventSchema,
  arrival: portEventSchema,
  distanceNm: z.number().min(0, "Distance must be non-negative").nullable(),
  source: voyageSourceSchema,
})
.refine(
  (v) => v.departure.timestamp !== null || v.arrival.timestamp !== null,
  { message: "At least one of departure/arrival timestamp is required", path: ["departure", "arrival"] },
)
.refine(
  (v) => {
    if (v.departure.timestamp && v.arrival.timestamp) {
      return v.arrival.timestamp >= v.departure.timestamp;
    }
    return true;
  },
  { message: "Arrival timestamp must not precede departure timestamp", path: ["arrival", "timestamp"] },
)
.strict();

export type VoyageInsertInput = z.infer<typeof voyageInsertSchema>;

export const aisPositionSchema = z.object({
  vessel_id: z.string().min(1, "vessel_id is required"),
  ts: z.string().min(1, "Timestamp is required"),
  latitude: z.number().min(-90).max(90, "Latitude must be between -90 and 90"),
  longitude: z.number().min(-180).max(180, "Longitude must be between -180 and 180"),
  sog: z.number().min(0, "SOG must be non-negative").nullable().optional(),
  cog: z.number().min(0).max(359.99, "COG must be between 0 and 360").nullable().optional(),
  heading: z.number().min(0).max(359.99, "Heading must be between 0 and 360").nullable().optional(),
  nav_status: z.string().nullable().optional(),
}).strict();

export type AisPositionInput = z.infer<typeof aisPositionSchema>;

export const aisPositionBatchSchema = z.object({
  positions: z.array(aisPositionSchema).min(1, "At least one position is required")
    .max(1000, "Batch size limited to 1000 positions"),
}).strict();

export type AisPositionBatchInput = z.infer<typeof aisPositionBatchSchema>;

export const ingestSchema = z.object({
  imo: imoSchema,
}).strict();

export type IngestInput = z.infer<typeof ingestSchema>;

export const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
}).strict();

export type PaginationInput = z.infer<typeof paginationSchema>;

export function zodIssuesToDetails(
  issues: Array<{ path: PropertyKey[]; message: string }>,
): Array<{ path: string; message: string }> {
  return issues.map((i) => ({
    path: i.path.map((p) => String(p)).join(".") || "(root)",
    message: i.message,
  }));
}
