/**
 * organization_settings.test.ts — supabase OrganizationSettingsRepository tests (Phase 4.5)
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createOrganizationSettingsRepository } from "../repositories/organization_settings";

const NOW = "2026-08-01T12:00:00.000Z";
const ORG_ID = "org-1";

describe("OrganizationSettingsRepository — upsert", () => {
  it("creates a settings row with defaults on first upsert", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createOrganizationSettingsRepository({ client: fake });

    const row = await repo.upsertByOrganizationId(ORG_ID, { organization_id: ORG_ID });

    expect(row.id).toBeTruthy();
    expect(row.default_timezone).toBe("UTC");
    expect(row.default_reporting_year).toBe(new Date().getUTCFullYear());
    expect(row.language).toBe("en");
    expect(row.appearance).toBeTruthy();
    expect(row.notification_preferences).toBeTruthy();
  });

  it("updates the existing row on conflict (onConflict organization_id)", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        organization_settings: [
          {
            id: "settings-1",
            organization_id: ORG_ID,
            default_timezone: "UTC",
            default_reporting_year: 2026,
            language: "en",
            appearance: {},
            notification_preferences: {},
            created_at: NOW,
            updated_at: NOW,
          },
        ],
      },
    });
    const repo = createOrganizationSettingsRepository({ client: fake });

    const row = await repo.upsertByOrganizationId(ORG_ID, {
      organization_id: ORG_ID,
      default_timezone: "Europe/Athens",
    });

    expect(row.default_timezone).toBe("Europe/Athens");
    expect(row.id).toBe("settings-1");

    const found = await repo.findByOrganizationId(ORG_ID);
    expect(found!.default_timezone).toBe("Europe/Athens");
  });
});

describe("OrganizationSettingsRepository — lookups", () => {
  it("returns null when no settings row exists", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createOrganizationSettingsRepository({ client: fake });
    expect(await repo.findByOrganizationId(ORG_ID)).toBeNull();
  });
});

run();
