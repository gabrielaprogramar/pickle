/**
 * catalog.ts — deterministic role + permission catalog (Phase 4.5)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The single source of truth for what every role can and cannot do. Mirrors
 * the `user_roles` table seeded by migration 0017 (permissions JSONB arrays).
 *
 * Design rules:
 *   • Permission codes are stable strings — treat them as a public API. Never
 *     reuse a code for two meanings; never delete a code, only deprecate.
 *   • `can()` is the ONLY enforcement entry point. Everything else (UI hiding,
 *     API guards) derives from these two helpers.
 */

export const PERMISSIONS = {
  /** View the workspace (always implied for an active member). */
  org_view: "org.view",
  /** Edit the organization profile (name, logo, address, emails). */
  org_manage: "org.manage",
  /** View the member list. */
  users_view: "users.view",
  /** Invite / cancel / resend invitations. */
  users_invite: "users.invite",
  /** Change member roles and status. */
  users_manage: "users.manage",
  /** Edit general, appearance and notification settings. */
  settings_general: "settings.general",
  /** Configure (store) integration credentials. */
  settings_integrations: "settings.integrations",
  /** Read the About panel (versions, build info). */
  settings_about: "settings.about",
  fleet_view: "fleet.view",
  voyages_view: "voyages.view",
  ais_view: "ais.view",
  documents_view: "documents.view",
  review_view: "review.view",
  compliance_view: "compliance.view",
  analytics_view: "analytics.view",
  assistant_use: "assistant.use",
  noon_view: "noon.view",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type RoleCode =
  | "owner"
  | "administrator"
  | "compliance_manager"
  | "fleet_manager"
  | "viewer";

export interface RoleDefinition {
  readonly code: RoleCode;
  readonly label: string;
  readonly description: string;
  readonly permissions: readonly PermissionCode[];
  /** Higher rank wins on role-change gates (only an equal-or-higher rank may reassign). */
  readonly rank: number;
}

const ALL_MODULE_READS: readonly PermissionCode[] = [
  PERMISSIONS.fleet_view,
  PERMISSIONS.voyages_view,
  PERMISSIONS.ais_view,
  PERMISSIONS.documents_view,
  PERMISSIONS.review_view,
  PERMISSIONS.compliance_view,
  PERMISSIONS.analytics_view,
  PERMISSIONS.assistant_use,
  PERMISSIONS.noon_view,
];

export const ROLES: readonly RoleDefinition[] = [
  {
    code: "owner",
    label: "Owner",
    description: "Full control of the organization, its data, users and integrations.",
    rank: 50,
    permissions: [
      ...ALL_MODULE_READS,
      PERMISSIONS.org_view,
      PERMISSIONS.org_manage,
      PERMISSIONS.users_view,
      PERMISSIONS.users_invite,
      PERMISSIONS.users_manage,
      PERMISSIONS.settings_general,
      PERMISSIONS.settings_integrations,
      PERMISSIONS.settings_about,
    ],
  },
  {
    code: "administrator",
    label: "Administrator",
    description: "Manages settings, users, invites and integrations across the workspace.",
    rank: 40,
    permissions: [
      ...ALL_MODULE_READS,
      PERMISSIONS.org_view,
      PERMISSIONS.org_manage,
      PERMISSIONS.users_view,
      PERMISSIONS.users_invite,
      PERMISSIONS.users_manage,
      PERMISSIONS.settings_general,
      PERMISSIONS.settings_integrations,
      PERMISSIONS.settings_about,
    ],
  },
  {
    code: "compliance_manager",
    label: "Compliance Manager",
    description: "Owns compliance deliverables and reviews.",
    rank: 30,
    permissions: [
      PERMISSIONS.fleet_view,
      PERMISSIONS.documents_view,
      PERMISSIONS.review_view,
      PERMISSIONS.compliance_view,
      PERMISSIONS.noon_view,
      PERMISSIONS.org_view,
      PERMISSIONS.users_view,
      PERMISSIONS.settings_about,
    ],
  },
  {
    code: "fleet_manager",
    label: "Fleet Manager",
    description: "Operates the fleet day-to-day: positions, voyages, documents and noon reports.",
    rank: 20,
    permissions: [
      PERMISSIONS.fleet_view,
      PERMISSIONS.voyages_view,
      PERMISSIONS.ais_view,
      PERMISSIONS.documents_view,
      PERMISSIONS.noon_view,
      PERMISSIONS.assistant_use,
      PERMISSIONS.org_view,
      PERMISSIONS.users_view,
      PERMISSIONS.settings_about,
    ],
  },
  {
    code: "viewer",
    label: "Viewer",
    description: "Read-only access to operational and compliance data.",
    rank: 10,
    permissions: [
      PERMISSIONS.fleet_view,
      PERMISSIONS.voyages_view,
      PERMISSIONS.ais_view,
      PERMISSIONS.documents_view,
      PERMISSIONS.review_view,
      PERMISSIONS.compliance_view,
      PERMISSIONS.noon_view,
      PERMISSIONS.org_view,
      PERMISSIONS.settings_about,
    ],
  },
];

const ROLE_INDEX: Readonly<Record<RoleCode, RoleDefinition>> = ROLES.reduce(
  (acc, role) => {
    acc[role.code] = role;
    return acc;
  },
  {} as Record<RoleCode, RoleDefinition>,
);

/** Returns the role definition, or null when the code is unknown. */
export function getRole(code: string): RoleDefinition | null {
  return ROLE_INDEX[code as RoleCode] ?? null;
}

/** True when `role` has the given permission. Unknown roles can do nothing. */
export function can(role: string | null | undefined, permission: PermissionCode): boolean {
  const def = role ? getRole(role) : null;
  return def !== null && def.permissions.includes(permission);
}

/** True when `actor` may reassign or deactivate a user holding `target`. */
export function mayManageUser(actor: string, target: string): boolean {
  const actorRole = getRole(actor);
  const targetRole = getRole(target);
  if (actorRole === null || targetRole === null) return false;
  return actorRole.rank > targetRole.rank;
}

export function isRoleCode(value: string): value is RoleCode {
  return getRole(value) !== null;
}

export function roleLabel(code: string): string {
  return getRole(code)?.label ?? code;
}

/** Permissions available to a role, sorted by catalog order. */
export function permissionsFor(role: string | null): readonly PermissionCode[] {
  return getRole(role ?? "")?.permissions ?? [];
}
