import {
  LayoutDashboard,
  Ship,
  Navigation,
  Radio,
  Anchor,
  FileText,
  ClipboardCheck,
  ScanEye,
  ShieldCheck,
  Building2,
  BarChart3,
  Settings,
  Bot,
  Search,
  LifeBuoy,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { ROUTES } from "./routes";

export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: LucideIcon;
  readonly badge?: string;
  readonly disabled?: boolean;
}

export interface NavSection {
  readonly title: string;
  readonly items: readonly NavItem[];
}

export const NAVIGATION: readonly NavSection[] = [
  {
    title: "Operations",
    items: [
      { label: "Dashboard", href: ROUTES.dashboard, icon: LayoutDashboard },
      { label: "Fleet", href: ROUTES.fleet, icon: Ship },
      { label: "Voyages", href: ROUTES.voyages, icon: Navigation },
      { label: "AIS", href: ROUTES.ais, icon: Radio },
    ],
  },
  {
    title: "Intelligence",
    items: [
      {
        label: "Documents",
        href: ROUTES.documents,
        icon: FileText,
      },
      {
        label: "Review",
        href: ROUTES.review,
        icon: ClipboardCheck,
      },
      {
        label: "Assistant",
        href: ROUTES.assistant,
        icon: Bot,
      },
      {
        label: "Compliance Assistant",
        href: ROUTES.complianceAssistant,
        icon: ShieldCheck,
      },
      {
        label: "Poseidon Search",
        href: ROUTES.poseidonSearch,
        icon: Search,
      },
      {
        label: "Captain",
        href: ROUTES.captainAssistant,
        icon: LifeBuoy,
      },
      {
        label: "Maintenance",
        href: ROUTES.maintenanceAssistant,
        icon: Wrench,
      },
      {
        label: "MarineTraffic",
        href: ROUTES.marinetraffic,
        icon: Anchor,
        disabled: true,
      },
    ],
  },
  {
    title: "Modules",
    items: [
      { label: "OCR", href: ROUTES.ocr, icon: ScanEye, disabled: true },
      {
        label: "Compliance",
        href: ROUTES.compliance,
        icon: ShieldCheck,
        disabled: true,
      },
      { label: "DNV", href: ROUTES.dnv, icon: Building2, disabled: true },
      {
        label: "Analytics",
        href: ROUTES.analytics,
        icon: BarChart3,
        disabled: true,
      },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Settings", href: ROUTES.settings, icon: Settings, disabled: true },
    ],
  },
] as const;

export function isNavActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}
