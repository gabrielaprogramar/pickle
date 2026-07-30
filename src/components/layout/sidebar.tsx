"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  NAVIGATION,
  isNavActive,
  type NavItem,
  type NavSection,
} from "@/constants/navigation";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";

function SidebarNavItem({
  item,
  collapsed,
  pathname,
}: {
  readonly item: NavItem;
  readonly collapsed: boolean;
  readonly pathname: string;
}) {
  const active = isNavActive(item.href, pathname);
  const disabled = item.disabled;

  const link = (
    <Link
      href={disabled ? "#" : item.href}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
        active && !disabled
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : disabled
            ? "text-muted-foreground/50 cursor-not-allowed"
            : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        collapsed && "justify-center px-0",
      )}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : undefined}
      onClick={(e) => disabled && e.preventDefault()}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && disabled && (
        <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/40 font-normal">
          Soon
        </span>
      )}
    </Link>
  );

  if (collapsed || disabled) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {disabled ? `${item.label} — Coming Soon` : item.label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return link;
}

function SidebarNavSection({
  section,
  collapsed,
  pathname,
}: {
  readonly section: NavSection;
  readonly collapsed: boolean;
  readonly pathname: string;
}) {
  return (
    <div className="space-y-0.5">
      {!collapsed && (
        <p className="px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
          {section.title}
        </p>
      )}
      {collapsed && <Separator className="my-2" />}
      {section.items.map((item) => (
        <SidebarNavItem
          key={item.href}
          item={item}
          collapsed={collapsed}
          pathname={pathname}
        />
      ))}
    </div>
  );
}

function SidebarContent({
  collapsed,
  pathname,
  onToggle,
}: {
  readonly collapsed: boolean;
  readonly pathname: string;
  readonly onToggle: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex h-11 items-center border-b border-sidebar-border px-3",
          collapsed && "justify-center px-2",
        )}
      >
        <Link
          href="/"
          className="flex items-center text-sidebar-foreground hover:text-sidebar-foreground"
        >
          <Image
            src="/logo.png"
            alt="Poseidon Ledger"
            width={collapsed ? 22 : 150}
            height={collapsed ? 22 : 26}
            className="shrink-0"
            priority
          />
        </Link>
      </div>

      <ScrollArea className="flex-1 px-2 py-2">
        <nav className="flex flex-col gap-2">
          {NAVIGATION.map((section) => (
            <SidebarNavSection
              key={section.title}
              section={section}
              collapsed={collapsed}
              pathname={pathname}
            />
          ))}
        </nav>
      </ScrollArea>

      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="w-full justify-center text-muted-foreground hover:text-sidebar-foreground"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4" />
              <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.1em]">
                Collapse
              </span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-56 p-0 bg-sidebar text-sidebar-foreground"
          >
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContent
              collapsed={false}
              pathname={pathname}
              onToggle={() => {}}
            />
          </SheetContent>
        </Sheet>
      </div>

      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200",
          collapsed ? "w-14" : "w-48",
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          pathname={pathname}
          onToggle={() => setCollapsed((c) => !c)}
        />
      </aside>
    </>
  );
}
