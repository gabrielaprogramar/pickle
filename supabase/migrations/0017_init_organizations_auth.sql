-- 0017_init_organizations_auth.sql
-- Product Foundation persistence (Phase 4.5): multi-user SaaS shell.
-- ─────────────────────────────────────────────────────────────────────────────
-- Seven tables:
--   organizations           — one row per customer tenant.
--   user_roles              — deterministic role catalog (permissions JSONB).
--   organization_users      — members of an organization (role, status).
--   organization_settings   — one row per org: general + appearance +
--                             notification preferences (JSONB).
--   organization_invites    — pending/cancelled invitations (mock email flow).
--   integration_credentials — per-org integration config; stored "encrypted"
--                             for the mock seam, NEVER used to reach providers.
--   auth_tokens             — mock session + password-reset tokens.
--
-- Design notes:
--   • deny-by-default RLS on every table (service-role only, like all tables).
--   • touch_updated_at() trigger from migration 0001 reused for updated_at.
--   • Every email-scoped uniqueness is per-organization: a user may exist in
--     more than one tenant, and an email can be re-invited after cancellation.
--   • Roles are seeded so the app works out of the box without a bootstrap
--     script; permissions arrays mirror src/lib/roles/catalog.ts.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. ORGANIZATIONS ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organizations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  company_logo_url     TEXT,
  country              TEXT,
  imo_company_number   TEXT,
  address              TEXT,
  billing_email        TEXT,
  support_email        TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT organizations_name_nonempty CHECK (length(trim(name)) > 0),
  CONSTRAINT organizations_imo_format CHECK (
    imo_company_number IS NULL OR imo_company_number ~ '^[0-9]{7}$'
  )
);

CREATE TRIGGER organizations_touch_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- 2. USER ROLES (deterministic catalog) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_roles (
  code         TEXT PRIMARY KEY,
  label        TEXT NOT NULL,
  description  TEXT,
  permissions  JSONB NOT NULL DEFAULT '[]'::jsonb,
  rank         INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT user_roles_label_nonempty CHECK (length(trim(label)) > 0),
  CONSTRAINT user_roles_rank_non_negative CHECK (rank >= 0)
);

INSERT INTO user_roles (code, label, description, permissions, rank) VALUES
  ('owner', 'Owner', 'Full control of the organization, its data, users and integrations.',
   '["org.manage","org.view","users.manage","users.invite","users.view","settings.general","settings.integrations","settings.about","fleet.view","voyages.view","ais.view","documents.view","review.view","assistant.use","compliance.view","analytics.view","noon.view"]', 50),
  ('administrator', 'Administrator', 'Manages settings, users, invites and integrations across the workspace.',
   '["org.manage","org.view","users.manage","users.invite","users.view","settings.general","settings.integrations","settings.about","fleet.view","voyages.view","ais.view","documents.view","review.view","assistant.use","compliance.view","analytics.view","noon.view"]', 40),
  ('compliance_manager', 'Compliance Manager', 'Owns compliance deliverables and reviews.',
   '["org.view","users.view","settings.about","fleet.view","documents.view","review.view","compliance.view","noon.view"]', 30),
  ('fleet_manager', 'Fleet Manager', 'Operates the fleet day-to-day: positions, voyages, documents and noon reports.',
   '["org.view","users.view","settings.about","fleet.view","voyages.view","ais.view","documents.view","noon.view","assistant.use"]', 20),
  ('viewer', 'Viewer', 'Read-only access to operational and compliance data.',
   '["org.view","settings.about","fleet.view","voyages.view","ais.view","documents.view","review.view","noon.view","compliance.view"]', 10)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- 3. ORGANIZATION USERS ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email            TEXT NOT NULL,
  full_name        TEXT NOT NULL,
  avatar_url       TEXT,
  password_hash    TEXT NOT NULL,
  role             TEXT NOT NULL REFERENCES user_roles(code),
  status           TEXT NOT NULL DEFAULT 'active',
  last_login_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT organization_users_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT organization_users_full_name_nonempty CHECK (length(trim(full_name)) > 0),
  CONSTRAINT organization_users_status_check CHECK (status IN ('active', 'inactive')),
  CONSTRAINT organization_users_org_email_unique UNIQUE (organization_id, email)
);

CREATE TRIGGER organization_users_touch_updated_at
  BEFORE UPDATE ON organization_users
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

ALTER TABLE organization_users ENABLE ROW LEVEL SECURITY;

-- 4. ORGANIZATION SETTINGS ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_settings (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  default_timezone         TEXT NOT NULL DEFAULT 'UTC',
  default_reporting_year   INTEGER NOT NULL DEFAULT 2026,
  language                 TEXT NOT NULL DEFAULT 'en',
  appearance               JSONB NOT NULL DEFAULT '{"theme":"dark","accent":"blue","sidebarDensity":"compact","tableDensity":"compact","gridView":"grid"}'::jsonb,
  notification_preferences JSONB NOT NULL DEFAULT '{"emails":true,"complianceAlerts":true,"certificateExpiry":true,"fuelAlerts":true,"noonReport":true,"assistantDigests":true,"systemAnnouncements":true}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT organization_settings_org_unique UNIQUE (organization_id),
  CONSTRAINT organization_settings_timezone_nonempty CHECK (length(trim(default_timezone)) > 0),
  CONSTRAINT organization_settings_reporting_year_range CHECK (
    default_reporting_year >= 2000 AND default_reporting_year <= 2100
  )
);

CREATE TRIGGER organization_settings_touch_updated_at
  BEFORE UPDATE ON organization_settings
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;

-- 5. ORGANIZATION INVITES ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_invites (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email             TEXT NOT NULL,
  full_name         TEXT,
  role              TEXT NOT NULL REFERENCES user_roles(code),
  status            TEXT NOT NULL DEFAULT 'pending',
  token             TEXT NOT NULL,
  invited_by        UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
  expires_at        TIMESTAMPTZ NOT NULL,
  accepted_at       TIMESTAMPTZ,
  resend_count      INTEGER NOT NULL DEFAULT 0,
  last_sent_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT organization_invites_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT organization_invites_status_check CHECK (status IN ('pending', 'accepted', 'cancelled')),
  CONSTRAINT organization_invites_token_unique UNIQUE (token),
  CONSTRAINT organization_invites_expiry_future CHECK (expires_at > created_at)
);

CREATE TRIGGER organization_invites_touch_updated_at
  BEFORE UPDATE ON organization_invites
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;

-- 6. INTEGRATION CREDENTIALS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS integration_credentials (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
  encrypted_config  JSONB NOT NULL DEFAULT '{}'::jsonb,
  configured_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT integration_credentials_provider_check CHECK (
    provider IN ('marinetraffic', 'google_docai', 'openai', 'resend', 'ais')
  ),
  CONSTRAINT integration_credentials_status_check CHECK (
    status IN ('NOT_CONFIGURED', 'CONFIGURED')
  ),
  CONSTRAINT integration_credentials_org_provider_unique UNIQUE (organization_id, provider)
);

CREATE TRIGGER integration_credentials_touch_updated_at
  BEFORE UPDATE ON integration_credentials
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;

-- 7. AUTH TOKENS (mock sessions + password reset) ────────────────────────────

CREATE TABLE IF NOT EXISTS auth_tokens (
  token           TEXT PRIMARY KEY,
  kind            TEXT NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES organization_users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ,

  CONSTRAINT auth_tokens_kind_check CHECK (kind IN ('session', 'password_reset')),
  CONSTRAINT auth_tokens_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_kind_email ON auth_tokens (kind, email);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_expiry ON auth_tokens (expires_at) WHERE revoked_at IS NULL;

ALTER TABLE auth_tokens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE organizations IS
  'One row per customer tenant in the SaaS shell.';
COMMENT ON TABLE user_roles IS
  'Deterministic role catalog with JSONB permission arrays mirroring src/lib/roles/catalog.ts.';
COMMENT ON TABLE organization_users IS
  'Members of an organization. Emails are unique per organization.';
COMMENT ON TABLE organization_settings IS
  'Per-organization preferences: timezone, reporting year, appearance and notification toggles.';
COMMENT ON TABLE organization_invites IS
  'Pending/cancelled invitations sent through the mock email provider.';
COMMENT ON TABLE integration_credentials IS
  'Per-org integration config. Status is NOT_CONFIGURED until configured; values are stored encrypted but never used to reach providers (Phase 4.5 mock-only).';
COMMENT ON TABLE auth_tokens IS
  'Mock session and password-reset tokens. Real auth (Supabase Auth) lands in a later phase.';
