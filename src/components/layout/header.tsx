"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/constants/routes";

const ROUTE_LABELS: Record<string, string> = {
  fleet: "Fleet",
  voyages: "Voyages",
  ais: "AIS",
  marinetraffic: "MarineTraffic",
  documents: "Documents",
  ocr: "OCR",
  compliance: "Compliance",
  dnv: "DNV",
  analytics: "Analytics",
  settings: "Settings",
  "compliance-assistant": "Compliance Assistant",
};

export function AppHeader() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = ROUTE_LABELS[seg] ?? seg;
    return { label, href };
  });

  return (
    <header className="flex h-11 items-center gap-3 border-b border-border bg-card px-4">
      <nav className="hidden md:flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        <Link
          href={ROUTES.dashboard}
          className="hover:text-primary transition-colors"
        >
          Dashboard
        </Link>
        {crumbs.map((crumb) => (
          <span key={crumb.href} className="flex items-center gap-1.5">
            <ChevronRight className="h-3 w-3" />
            <Link
              href={crumb.href}
              className="hover:text-primary transition-colors"
            >
              {crumb.label}
            </Link>
          </span>
        ))}
      </nav>

      <nav className="flex md:hidden items-center gap-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        <span className="text-foreground font-medium">
          {crumbs.length > 0 ? crumbs[crumbs.length - 1]!.label : "Dashboard"}
        </span>
      </nav>

      <div className="flex-1" />

      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground"
        disabled
      >
        <span className="inline-block h-2 w-2 rounded-full bg-warning" />
        <span>Demo Organization</span>
      </Button>

      <Separator orientation="vertical" className="h-5" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-2 px-2">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">
                OP
              </AvatarFallback>
            </Avatar>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground hidden lg:inline">
              Operator
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuLabel className="text-xs">Operator</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled className="text-xs">
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem disabled className="text-xs">
            Preferences
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled className="text-xs">
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
