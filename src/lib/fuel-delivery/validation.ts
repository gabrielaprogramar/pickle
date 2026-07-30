import type { FuelDeliveryRow, DocumentRow, VoyageRow } from "@/lib/supabase/types";
import { getFuelEmissionInfo } from "./emission-factors";
import { normalizePortName } from "./normalization";

/**
 * Result of a single cross-document validation check.
 */
export interface ValidationCheck {
  readonly field: string;
  readonly passed: boolean;
  readonly severity: "error" | "warning" | "info";
  readonly message: string;
  readonly delivery_id?: string;
}

/**
 * Validate that the fuel type reported on a BDN matches a known
 * standard type with emission factors.
 */
export function validateFuelTypeExists(delivery: FuelDeliveryRow): ValidationCheck {
  const info = getFuelEmissionInfo(delivery.fuel_type);
  return {
    field: "fuel_type",
    passed: info.display_name !== "Unknown",
    severity: "error",
    message: info.display_name !== "Unknown"
      ? `Fuel type "${delivery.fuel_type}" resolved to ${info.display_name}`
      : `Fuel type "${delivery.fuel_type}" is not recognised. No emission factors available.`,
    delivery_id: delivery.id,
  };
}

/**
 * Validate that the sulphur content is within expected range for
 * the fuel type and ECA compliance.
 */
export function validateSulphurContent(delivery: FuelDeliveryRow): ValidationCheck {
  const { sulphur_content_pct } = delivery;
  if (sulphur_content_pct == null) {
    return {
      field: "sulphur_content_pct",
      passed: false,
      severity: "warning",
      message: "Sulphur content not reported on BDN. Cannot verify ECA compliance.",
      delivery_id: delivery.id,
    };
  }

  const isEcaCompliant = sulphur_content_pct <= 0.5;
  return {
    field: "sulphur_content_pct",
    passed: true,
    severity: isEcaCompliant ? "info" : "warning",
    message: isEcaCompliant
      ? `Sulphur content ${sulphur_content_pct}% is within ECA limit (≤0.5%).`
      : `Sulphur content ${sulphur_content_pct}% exceeds ECA limit (0.5%). Fuel may only be used outside ECA zones.`,
    delivery_id: delivery.id,
  };
}

/**
 * Validate that the delivery quantity is reasonable (>0 and <5000 MT,
 * which is the typical maximum for a single bunker delivery).
 */
export function validateDeliveryQuantity(delivery: FuelDeliveryRow): ValidationCheck {
  const { quantity_mt } = delivery;
  if (quantity_mt <= 0) {
    return {
      field: "quantity_mt",
      passed: false,
      severity: "error",
      message: `Delivery quantity ${quantity_mt} MT must be positive.`,
      delivery_id: delivery.id,
    };
  }
  if (quantity_mt > 5000) {
    return {
      field: "quantity_mt",
      passed: false,
      severity: "warning",
      message: `Delivery quantity ${quantity_mt} MT is unusually large (>5000 MT). Please verify.`,
      delivery_id: delivery.id,
    };
  }
  return {
    field: "quantity_mt",
    passed: true,
    severity: "info",
    message: `Delivery quantity ${quantity_mt} MT is within expected range.`,
    delivery_id: delivery.id,
  };
}

/**
 * Validate that the delivery port is not empty and looks reasonable.
 */
export function validateDeliveryPort(delivery: FuelDeliveryRow): ValidationCheck {
  if (!delivery.delivery_port || delivery.delivery_port.trim().length === 0) {
    return {
      field: "delivery_port",
      passed: false,
      severity: "error",
      message: "Delivery port is missing.",
      delivery_id: delivery.id,
    };
  }
  return {
    field: "delivery_port",
    passed: true,
    severity: "info",
    message: `Delivery port "${delivery.delivery_port}" captured.`,
    delivery_id: delivery.id,
  };
}

/**
 * Check that the BDN document has the expected document type ("bdn").
 */
export function validateBdnDocumentType(document: DocumentRow): ValidationCheck {
  return {
    field: "document_type",
    passed: document.document_type === "bdn",
    severity: "error",
    message: document.document_type === "bdn"
      ? "Document type is BDN."
      : `Document type is "${document.document_type}", expected "bdn".`,
  };
}

/**
 * Run all validation checks against a fuel delivery.
 */
export function validateFuelDelivery(
  delivery: FuelDeliveryRow,
): ValidationCheck[] {
  return [
    validateFuelTypeExists(delivery),
    validateSulphurContent(delivery),
    validateDeliveryQuantity(delivery),
    validateDeliveryPort(delivery),
  ];
}

/**
 * Validate that a reconciled voyage's port matches the delivery port.
 */
export function validateReconciliationPortMatch(
  delivery: FuelDeliveryRow,
  voyage: VoyageRow,
): ValidationCheck {
  const dPort = normalizePortName(delivery.delivery_port);
  const depPort = normalizePortName(voyage.departure_port_name);
  const arrPort = normalizePortName(voyage.arrival_port_name);

  const matches = dPort === depPort || dPort === arrPort;
  return {
    field: "reconciliation_port",
    passed: matches,
    severity: matches ? "info" : "warning",
    message: matches
      ? `Delivery port "${delivery.delivery_port}" matches voyage route.`
      : `Delivery port "${delivery.delivery_port}" does not match "${voyage.departure_port_name}" or "${voyage.arrival_port_name}".`,
    delivery_id: delivery.id,
  };
}
