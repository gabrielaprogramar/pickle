export const INVALID_JSON = "INVALID_JSON" as const;
export const VALIDATION_ERROR = "VALIDATION_ERROR" as const;
export const IMO_MISMATCH = "IMO_MISMATCH" as const;
export const INVALID_IMO = "INVALID_IMO" as const;
export const VESSEL_NOT_FOUND = "VESSEL_NOT_FOUND" as const;
export const NOT_FOUND = "NOT_FOUND" as const;
export const INTEGRITY_ERROR = "INTEGRITY_ERROR" as const;
export const RATE_LIMITED = "RATE_LIMITED" as const;
export const UPSTREAM_ERROR = "UPSTREAM_ERROR" as const;
export const MALFORMED_RESPONSE = "MALFORMED_RESPONSE" as const;
export const CONFIGURATION_ERROR = "CONFIGURATION_ERROR" as const;
export const REPOSITORY_UNAVAILABLE = "REPOSITORY_UNAVAILABLE" as const;
export const INTERNAL_ERROR = "INTERNAL_ERROR" as const;

export type ErrorCode =
  | typeof INVALID_JSON
  | typeof VALIDATION_ERROR
  | typeof IMO_MISMATCH
  | typeof INVALID_IMO
  | typeof VESSEL_NOT_FOUND
  | typeof NOT_FOUND
  | typeof INTEGRITY_ERROR
  | typeof RATE_LIMITED
  | typeof UPSTREAM_ERROR
  | typeof MALFORMED_RESPONSE
  | typeof CONFIGURATION_ERROR
  | typeof REPOSITORY_UNAVAILABLE
  | typeof INTERNAL_ERROR;
