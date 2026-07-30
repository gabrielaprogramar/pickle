import type {
  BdnExtractedData,
} from "@/lib/ocr/types";
import type { BdnToFuelDeliveryInput } from "./types";
import { normalizeFuelType } from "./normalization";

/**
 * Map a BDN OCR extraction result to a fuel delivery insert payload.
 * This is the bridge between the OCR layer and the fuel delivery domain.
 *
 * Every delivery created through this function has full provenance:
 * the document_id and ocr_result_id link back to the source BDN.
 */
export function mapBdnToFuelDelivery(
  bdnData: BdnExtractedData,
  documentId: string,
  vesselId: string,
  ocrResultId?: string,
  aiExtractionId?: string,
): BdnToFuelDeliveryInput {
  const normalizedFuelType = normalizeFuelType(bdnData.fuelType);

  return {
    document_id: documentId,
    ocr_result_id: ocrResultId,
    ai_extraction_id: aiExtractionId,
    vessel_id: vesselId,
    supplier: bdnData.supplier,
    delivery_port: bdnData.port,
    delivery_date: bdnData.deliveryDate,
    fuel_type: normalizedFuelType,
    quantity_mt: bdnData.quantityTonnes,
    density_kgm3: bdnData.densityKgM3,
    sulphur_content_pct: bdnData.sulphurContentPct,
    bdn_reference: bdnData.bdnReference,
  };
}

/**
 * Convert a BdnToFuelDeliveryInput to the DB insert type.
 * Adds default values for fields the DB manages automatically.
 */
export function toFuelDeliveryInsert(
  input: BdnToFuelDeliveryInput,
): {
  document_id: string;
  ocr_result_id?: string | null;
  ai_extraction_id?: string | null;
  vessel_id: string;
  supplier: string;
  delivery_port: string;
  delivery_date: string;
  fuel_type: string;
  quantity_mt: number;
  density_kgm3: number | null;
  sulphur_content_pct: number | null;
  bdn_reference: string | null;
  status: string;
} {
  return {
    document_id: input.document_id,
    ocr_result_id: input.ocr_result_id ?? null,
    ai_extraction_id: input.ai_extraction_id ?? null,
    vessel_id: input.vessel_id,
    supplier: input.supplier,
    delivery_port: input.delivery_port,
    delivery_date: input.delivery_date,
    fuel_type: input.fuel_type,
    quantity_mt: input.quantity_mt,
    density_kgm3: input.density_kgm3 ?? null,
    sulphur_content_pct: input.sulphur_content_pct ?? null,
    bdn_reference: input.bdn_reference ?? null,
    status: "pending",
  };
}
