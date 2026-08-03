"use client";

import { useState } from "react";
import { useSettings } from "@/hooks/use-settings";
import { SaveBar, SettingsCard, TextField } from "@/components/settings/settings-ui";
import { Skeleton } from "@/components/ui/skeleton";

export default function OrganizationSettingsPage() {
  const { bundle, isLoading, updateOrganization } = useSettings();

  const [name, setName] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [imo, setImo] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [billingEmail, setBillingEmail] = useState<string | null>(null);
  const [supportEmail, setSupportEmail] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (isLoading || !bundle) {
    return <Skeleton className="h-96 w-full" />;
  }

  const org = bundle.organization;
  const v = {
    name: name ?? org.name,
    country: country ?? org.country ?? "",
    imo: imo ?? org.imoCompanyNumber ?? "",
    address: address ?? org.address ?? "",
    billing: billingEmail ?? org.billingEmail ?? "",
    support: supportEmail ?? org.supportEmail ?? "",
    logo: logo ?? org.companyLogoUrl ?? "",
  };

  const dirty =
    v.name !== org.name ||
    v.country !== (org.country ?? "") ||
    v.imo !== (org.imoCompanyNumber ?? "") ||
    v.address !== (org.address ?? "") ||
    v.billing !== (org.billingEmail ?? "") ||
    v.support !== (org.supportEmail ?? "") ||
    v.logo !== (org.companyLogoUrl ?? "");

  async function onSave() {
    setSaving(true);
    setSaved(false);
    const patch: Record<string, string> = {};
    if (v.name !== org.name) patch.name = v.name;
    if (v.country !== (org.country ?? "")) patch.country = v.country;
    if (v.imo !== (org.imoCompanyNumber ?? "")) patch.imoCompanyNumber = v.imo;
    if (v.address !== (org.address ?? "")) patch.address = v.address;
    if (v.billing !== (org.billingEmail ?? "")) patch.billingEmail = v.billing;
    if (v.support !== (org.supportEmail ?? "")) patch.supportEmail = v.support;
    if (v.logo !== (org.companyLogoUrl ?? "")) patch.companyLogoUrl = v.logo;
    await updateOrganization(patch);
    setSaving(false);
    setSaved(true);
    setName(null);
    setCountry(null);
    setImo(null);
    setAddress(null);
    setBillingEmail(null);
    setSupportEmail(null);
    setLogo(null);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-2xl">
      <SettingsCard
        title="Organization"
        description="Legal and contact details for your company"
        footer={
          <SaveBar dirty={dirty} saving={saving} saved={saved} onSave={onSave} />
        }
      >
        <div className="space-y-3">
          <TextField label="Company name" value={v.name} onChange={setName} />
          <TextField
            label="Country"
            value={v.country}
            onChange={setCountry}
            placeholder="e.g. Greece"
          />
          <TextField
            label="IMO company number"
            value={v.imo}
            onChange={(x) => setImo(x.replace(/[^0-9]/g, "").slice(0, 7))}
            placeholder="1234567"
          />
          <TextField
            label="Address"
            value={v.address}
            onChange={setAddress}
            placeholder="Head office address"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              label="Billing email"
              value={v.billing}
              onChange={setBillingEmail}
              placeholder="billing@company.com"
            />
            <TextField
              label="Support email"
              value={v.support}
              onChange={setSupportEmail}
              placeholder="support@company.com"
            />
          </div>
          <TextField
            label="Company logo URL"
            value={v.logo}
            onChange={setLogo}
            placeholder="https://…"
          />
        </div>
      </SettingsCard>
    </div>
  );
}
