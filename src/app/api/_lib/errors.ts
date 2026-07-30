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

export const DOCUMENT_NOT_FOUND = "DOCUMENT_NOT_FOUND" as const;
export const MISSING_FILE = "MISSING_FILE" as const;
export const MISSING_TITLE = "MISSING_TITLE" as const;
export const MISSING_DOCUMENT_TYPE = "MISSING_DOCUMENT_TYPE" as const;
export const INVALID_DOCUMENT_TYPE = "INVALID_DOCUMENT_TYPE" as const;
export const FILE_TOO_LARGE = "FILE_TOO_LARGE" as const;
export const FUEL_DELIVERY_NOT_FOUND = "FUEL_DELIVERY_NOT_FOUND" as const;
export const INVALID_EMAIL_PAYLOAD = "INVALID_EMAIL_PAYLOAD" as const;
export const UNSUPPORTED_ATTACHMENT = "UNSUPPORTED_ATTACHMENT" as const;
export const DUPLICATE_ATTACHMENT = "DUPLICATE_ATTACHMENT" as const;
export const WEBHOOK_AUTH_FAILED = "WEBHOOK_AUTH_FAILED" as const;

export type ErrorCode =
  | typeof INVALID_JSON
  | typeof VALIDATION_ERROR
  | typeof IMO_MISMATCH
  | typeof INVALID_IMO
  | typeof VESSEL_NOT_FOUND
  | typeof NOT_FOUND
  | typeof DOCUMENT_NOT_FOUND
  | typeof MISSING_FILE
  | typeof MISSING_TITLE
  | typeof MISSING_DOCUMENT_TYPE
  | typeof INVALID_DOCUMENT_TYPE
  | typeof FILE_TOO_LARGE
  | typeof FUEL_DELIVERY_NOT_FOUND
  | typeof INVALID_EMAIL_PAYLOAD
  | typeof UNSUPPORTED_ATTACHMENT
  | typeof DUPLICATE_ATTACHMENT
  | typeof WEBHOOK_AUTH_FAILED
  | typeof INTEGRITY_ERROR
  | typeof RATE_LIMITED
  | typeof UPSTREAM_ERROR
  | typeof MALFORMED_RESPONSE
  | typeof CONFIGURATION_ERROR
  | typeof REPOSITORY_UNAVAILABLE
  | typeof INTERNAL_ERROR;
