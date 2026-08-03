/**
 * errors.ts — typed errors for the settings service
 */

export class SettingsError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class OrganizationNotFoundError extends SettingsError {
  constructor(message = "Organization not found") {
    super(message, "ORGANIZATION_NOT_FOUND");
  }
}

export class UserNotFoundError extends SettingsError {
  constructor(message = "User not found") {
    super(message, "USER_NOT_FOUND");
  }
}

export class InviteNotFoundError extends SettingsError {
  constructor(message = "Invitation not found") {
    super(message, "INVITE_NOT_FOUND");
  }
}

export class InviteConflictError extends SettingsError {
  constructor(message = "A pending invitation already exists for this email") {
    super(message, "INVITE_CONFLICT");
  }
}

export class CannotDeactivateLastOwnerError extends SettingsError {
  constructor(message = "The organization must keep at least one active Owner") {
    super(message, "LAST_OWNER");
  }
}

export class CannotDemoteSelfError extends SettingsError {
  constructor(message = "You cannot change your own role or status") {
    super(message, "SELF_CHANGE");
  }
}

export class InvalidIntegrationError extends SettingsError {
  constructor(message = "Unknown integration provider") {
    super(message, "INVALID_INTEGRATION");
  }
}
