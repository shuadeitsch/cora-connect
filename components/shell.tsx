"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  House,
  LayoutGrid,
  LogOut,
  Map,
  MessageSquareText,
  Route,
  Search,
  Settings,
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { CommandPalette, type PaletteHousehold } from "@/components/command-palette";
import { ReloadButton } from "@/components/reload-button";
import { VersionBadge } from "@/components/version-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { logoutAction } from "@/lib/actions";
import { scopeLabel } from "@/lib/constants";
import { useViewingState } from "@/lib/viewing-state";
import { formatMedium } from "@/lib/format";
import type { AppNotificationView, Viewer } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRIMARY: { href: string; label: string; short?: string; icon: typeof House; adminOnly?: boolean; desktopOnly?: boolean }[] = [
  { href: "/households", label: "Contacts", icon: House },
  { href: "/map", label: "Map", icon: Map },
  { href: "/saved-routes", label: "Routes", icon: Route },
  { href: "/planner", label: "Daily planner", short: "Planner", icon: CalendarDays },
  { href: "/dashboard", label: "Dashboard", short: "Home", icon: LayoutGrid },
];

/** Sidebar only (phone reaches Settings from the Dashboard's More section). */
const SIDEBAR_EXTRA: typeof PRIMARY = [{ href: "/settings", label: "Settings", icon: Settings, desktopOnly: true }];

/** A bochur has no Dashboard, so his few extra pages sit in the bar itself. */
const BOCHUR_EXTRA: typeof PRIMARY = [
  { href: "/reports", label: "Reports", icon: ClipboardList },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** A bochur only works with contacts shared with him. */
const BOCHUR_HIDDEN = new Set(["/planner", "/team", "/dashboard"]);


function NavLinks({
  items,
  onNavigate,
  canManage,
  bochur = false,
}: {
  items: { href: string; label: string; icon: typeof House; adminOnly?: boolean }[];
  onNavigate?: () => void;
  canManage: boolean;
  bochur?: boolean;
}) {
  const pathname = usePathname();
  const visible = items.filter((item) => (canManage || !item.adminOnly) && !(bochur && BOCHUR_HIDDEN.has(item.href)));
  return (
    <nav className="flex flex-col gap-1 px-3">
      {visible.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-2xl px-2.5 text-sm font-medium transition active:scale-[0.99]",
              active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span className={cn("flex size-8 items-center justify-center rounded-xl", active ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              <Icon className="size-4" />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Shell({
  viewer,
  households,
  children,
}: {
  viewer: Viewer;
  /** Still passed by the layout; the bell is gone from the toolbar. */
  notifications?: AppNotificationView[];
  households: PaletteHousehold[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const viewingState = useViewingState();
  const [search, setSearch] = useState(false);
  const mapPage = pathname.startsWith("/map") || pathname === "/saved-routes/new";
  const bochur = viewer.role === "bochur";
  const navItems = bochur ? [...PRIMARY, ...BOCHUR_EXTRA] : [...PRIMARY, ...SIDEBAR_EXTRA];
  const primary = navItems.filter((item) => (viewer.canManage || !item.adminOnly) && !item.desktopOnly && !(bochur && BOCHUR_HIDDEN.has(item.href)));

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearch((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="safe-page app-frame flex flex-col">
      <header className="glass z-30 mx-2 mt-2 flex min-h-14 shrink-0 items-center justify-between gap-2 rounded-2xl px-2 py-1 sm:mx-3 sm:px-3">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 pl-1">
          <Link href="/households" aria-label="Cora Connect home" className="min-w-0">
            {/* The header mark is the Cora logo file. next/image is not configured for it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/cora-logo.png" alt="Cora" className="h-10 w-auto max-w-[9.5rem] object-contain object-left sm:h-11 sm:max-w-[13rem]" />
          </Link>
          <div className="flex w-full min-w-0 flex-wrap items-center gap-1">
            {viewer.role === "admin" ? <VersionBadge className="min-w-0 flex-1" /> : null}
            <ReloadButton />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSearch(true)}
          className="mx-3 hidden h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-border/80 bg-background/50 px-3 text-sm text-muted-foreground transition hover:bg-muted md:flex md:max-w-md"
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Search contacts</span>
          <kbd className="rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">⌘K</kbd>
        </button>
        <div className="ml-auto flex items-center">
          <button type="button" aria-label="Search" className="inline-flex size-11 items-center justify-center rounded-full text-foreground hover:bg-muted md:hidden" onClick={() => setSearch(true)}>
            <Search className="size-[18px]" />
          </button>
          <ThemeToggle />
          <Link href="/settings?tab=account" aria-label="Your account" className="inline-flex size-11 items-center justify-center rounded-full hover:bg-muted lg:hidden">
            <Avatar name={viewer.name} src={viewer.avatarUrl} className="size-8 text-[10px]" />
          </Link>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Feedback"
                title="Feedback"
                className="inline-flex size-11 items-center justify-center rounded-full text-foreground hover:bg-muted"
              >
                <MessageSquareText className="size-[18px]" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(18rem,calc(100vw-1.5rem))]">
              <p className="font-heading text-sm font-semibold text-foreground">Send feedback</p>
              <div className="mt-3 flex flex-col gap-1 text-sm">
                <a className="flex min-h-11 items-center gap-2 rounded-xl px-2 hover:bg-muted" href="tel:+13477701863">
                  <span className="text-primary">Call 347-770-1863</span>
                </a>
              </div>
            </PopoverContent>
          </Popover>
          <form action={logoutAction} className="hidden lg:block">
            <button type="submit" aria-label="Log out" className="inline-flex size-11 items-center justify-center rounded-full text-foreground hover:bg-muted">
              <LogOut className="size-[18px]" />
            </button>
          </form>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="glass mx-3 my-3 hidden w-[220px] shrink-0 flex-col rounded-3xl py-4 lg:flex">
          <Link href="/households" className="mb-3 block w-full px-2">
            {/* The side bar mark is the Cora Connect logo with a clear background (old map photo kept at public/crm-logo.jpeg). next/image is not configured for it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/cora-connect-logo.png" alt="Cora Connect" className="block h-auto w-full object-contain dark:brightness-0 dark:invert" />
          </Link>
          <NavLinks items={navItems} canManage={viewer.canManage} bochur={bochur} />
          <Link href="/settings?tab=account" className="mx-3 mt-auto flex items-center gap-2 rounded-2xl px-2 py-2 hover:bg-muted">
            <Avatar name={viewer.name} src={viewer.avatarUrl} className="size-9" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">{viewer.name}</span>
              <span className="block text-[11px] text-muted-foreground">{scopeLabel(viewer.role, viewer.territory, viewingState)}</span>
            </span>
          </Link>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          {viewer.expired ? (
            <div className="mx-3 mt-3 rounded-2xl bg-amber-100 px-4 py-2 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
              Your access expired{viewer.expiresAt ? ` on ${formatMedium(viewer.expiresAt)}` : ""}. You can review records, and editing is turned off.
            </div>
          ) : null}
          <main className={cn("min-h-0 flex-1", mapPage ? "overflow-hidden" : "overflow-auto")}>
            {mapPage ? children : (
              // Padding lives on an inner block: some browsers drop a scroll container's own bottom padding.
              // Room = bottom bar (~4.25rem) + its gap above the safe area + a little breathing space.
              <div className="pb-[calc(5.5rem+max(0.75rem,env(safe-area-inset-bottom)))] lg:pb-4">{children}</div>
            )}
          </main>
        </div>
      </div>
      <nav className="glass fixed inset-x-3 z-40 grid rounded-3xl px-1 py-1 bottom-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden" style={{ gridTemplateColumns: `repeat(${primary.length}, minmax(0, 1fr))` }}>
        {primary.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-medium", active ? "bg-accent text-foreground" : "text-muted-foreground")}>
              <Icon className="size-5" />
              {item.short ?? item.label}
            </Link>
          );
        })}
      </nav>
      <CommandPalette open={search} onOpenChange={setSearch} households={households} canManage={viewer.canManage} />
    </div>
  );
}
