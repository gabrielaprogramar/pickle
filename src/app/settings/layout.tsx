"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { ROUTES } from "@/constants/routes";
import { PageHeader } from "@/components/page-header";

const SETTINGS_SECTIONS: readonly { label: string; href: string }[] = [
  { label: "General", href: ROUTES.settings },
  { label: "Organization", href: ROUTES.settingsOrganization },
  { label: "Users", href: ROUTES.settingsUsers },
  { label: "Appearance", href: ROUTES.settingsAppearance },
  { label: "Notifications", href: ROUTES.settingsNotifications },
  { label: "Integrations", href: ROUTES.settingsIntegrations },
];

export default function SettingsLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-4">
      <PageHeader
        label="Platform Configuration"
        title="Settings"
        description="Workspace configuration, membership and integrations"
      />
      <div className="flex gap-6">
        <aside className="w-44 shrink-0">
          <nav className="flex flex-col gap-0.5 sticky top-0">
            {SETTINGS_SECTIONS.map((section) => {
              const active =
                section.href === ROUTES.settings
                  ? pathname === ROUTES.settings
                  : pathname.startsWith(section.href);
              return (
                <Link
                  key={section.href}
                  href={section.href}
                  className={cn(
                    "rounded-md px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors duration-200",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  {section.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
