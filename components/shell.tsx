"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  FlaskConical,
  House,
  LayoutGrid,
  LogOut,
  Map,
  Menu,
  Route,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { CommandPalette, type PaletteHousehold } from "@/components/command-palette";
import { FeedbackButton } from "@/components/feedback-button";
import { PreviewBanner } from "@/components/preview-banner";
import { ReloadButton } from "@/components/reload-button";
import { VersionBadge } from "@/components/version-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { applyTheme, isThemeId, THEME_KEY } from "@/lib/themes";
import { applyPhotoTheme, clearPhotoTheme, isPhotoThemeColors } from "@/lib/photo-theme";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { logoutAction } from "@/lib/actions";
import { scopeLabel } from "@/lib/constants";
import { useViewingState } from "@/lib/viewing-state";
import { formatMedium } from "@/lib/format";
import type { AppNotificationView, Viewer } from "@/lib/types";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; short?: string; icon: typeof House; adminOnly?: boolean; desktopOnly?: boolean };

/** Full sidebar order (Home first). Mobile More sheet uses the same order. */
const PRIMARY: NavItem[] = [
  { href: "/dashboard", label: "Home", short: "Home", icon: LayoutGrid },
  { href: "/households", label: "Contacts", icon: House },
  { href: "/saved-routes", label: "Routes", icon: Route },
  { href: "/planner", label: "Daily planner", short: "Planner", icon: CalendarDays },
];

const SIDEBAR_EXTRA: NavItem[] = [
  { href: "/team", label: "My Team", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Map and Beta sit under More at the bottom of the desktop sidebar. */
const MORE_ITEMS: NavItem[] = [
  { href: "/map", label: "Map", icon: Map },
  { href: "/beta", label: "Beta", icon: FlaskConical, adminOnly: true },
];

/** A bochur only works with contacts shared with him. */
const BOCHUR_HIDDEN = new Set(["/team", "/beta"]);

/** Bottom bar slots (phones / Chromebooks). Everything else opens from More. */
const PHONE_BAR_HREFS = new Set(["/dashboard", "/households", "/saved-routes", "/planner"]);

function visibleItems(items: NavItem[], canManage: boolean, bochur: boolean) {
  return items.filter((item) => (canManage || !item.adminOnly) && !(bochur && BOCHUR_HIDDEN.has(item.href)));
}

function NavLinks({
  items,
  onNavigate,
  canManage,
  bochur = false,
}: {
  items: NavItem[];
  onNavigate?: () => void;
  canManage: boolean;
  bochur?: boolean;
}) {
  const pathname = usePathname();
  const visible = visibleItems(items, canManage, bochur);
  return (
    <nav className="flex flex-col gap-1 px-3">
      {visible.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        const label = bochur && item.href === "/planner" ? "Daily schedule" : item.label;
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
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function MoreGroup({
  items,
  canManage,
  bochur,
}: {
  items: NavItem[];
  canManage: boolean;
  bochur: boolean;
}) {
  const pathname = usePathname();
  const visible = visibleItems(items, canManage, bochur);
  const [open, setOpen] = useState(() => visible.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)));
  if (!visible.length) return null;
  return (
    <div className="mt-auto border-t border-border/60 px-3 pt-2">
      <button
        type="button"
        className="flex min-h-10 w-full items-center justify-between rounded-2xl px-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase hover:bg-muted"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        More
        <ChevronDown className={cn("size-4 transition", open && "rotate-180")} />
      </button>
      {open ? (
        <nav className="mt-1 flex flex-col gap-1 pb-1">
          {visible.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-2xl px-2.5 text-sm font-medium transition",
                  active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className={cn("flex size-8 items-center justify-center rounded-xl", active ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                  <Icon className="size-4" />
                </span>
                {bochur && item.href === "/planner" ? "Daily schedule" : item.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
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
  const [mobileMore, setMobileMore] = useState(false);
  const mapPage = pathname.startsWith("/map") || pathname === "/saved-routes/new";
  const preview = viewer.preview ?? null;
  // A theme saved on the account follows the person to a new device.
  useEffect(() => {
    if (viewer.themeMatchPhoto && isPhotoThemeColors(viewer.themeColors)) {
      applyPhotoTheme(viewer.themeColors);
      return;
    }
    clearPhotoTheme();
    const local = window.localStorage.getItem(THEME_KEY);
    if (isThemeId(local)) applyTheme(local);
    else if (isThemeId(viewer.theme)) applyTheme(viewer.theme);
  }, [viewer.theme, viewer.themeMatchPhoto, viewer.themeColors]);
  useEffect(() => {
    const root = document.documentElement;
    const url = viewer.backgroundUrl?.trim();
    if (url) {
      root.style.setProperty("--custom-page-bg", `url("${url.replace(/"/g, "%22")}")`);
      root.setAttribute("data-custom-bg", "1");
    } else {
      root.style.removeProperty("--custom-page-bg");
      root.removeAttribute("data-custom-bg");
    }
    return () => {
      root.style.removeProperty("--custom-page-bg");
      root.removeAttribute("data-custom-bg");
    };
  }, [viewer.backgroundUrl]);
  const bochur = viewer.role === "bochur";
  // Real admins (not in preview) manage; preview uses the role's canManage (false).
  const canManage = viewer.canManage && !preview;
  const showAdminChrome = viewer.role === "admin" && !preview;
  const navItems = [...PRIMARY, ...SIDEBAR_EXTRA];
  const fullSidebar = [...PRIMARY, ...SIDEBAR_EXTRA, ...MORE_ITEMS];
  const primary = visibleItems(PRIMARY, canManage || showAdminChrome, bochur).filter((item) => PHONE_BAR_HREFS.has(item.href));
  const moreForPhone = visibleItems(MORE_ITEMS, showAdminChrome || canManage, bochur);
  const mobileMenuItems = visibleItems(fullSidebar, showAdminChrome || canManage, bochur);

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
          <Link href="/dashboard" aria-label="Cora Connect home" className="min-w-0">
            {/* The header mark is the Cora logo file. next/image is not configured for it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/cora-logo.png" alt="Cora" className="h-10 w-auto max-w-[9.5rem] object-contain object-left sm:h-11 sm:max-w-[13rem]" />
          </Link>
          <div className="flex w-fit max-w-full min-w-0 flex-wrap items-center gap-1">
            {showAdminChrome ? <VersionBadge /> : null}
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
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" aria-label="Your account menu" className="inline-flex size-11 items-center justify-center rounded-full hover:bg-muted lg:hidden">
                <Avatar name={viewer.name} src={viewer.avatarUrl} className="size-8 text-[10px]" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-1.5">
              <p className="truncate px-2.5 py-1.5 text-xs text-muted-foreground">{viewer.name}</p>
              {[
                { href: "/settings?tab=account", label: "Settings", icon: Settings },
                ...(bochur ? [] : [{ href: "/team", label: "My Team", icon: Users }]),
              ].map((item) => (
                <Link key={item.href} href={item.href} className="flex min-h-11 items-center gap-2 rounded-xl px-2.5 text-sm text-foreground hover:bg-muted"><item.icon className="size-4" /> {item.label}</Link>
              ))}
              {moreForPhone.length ? (
                <>
                  <p className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">More</p>
                  {moreForPhone.map((item) => (
                    <Link key={item.href} href={item.href} className="flex min-h-11 items-center gap-2 rounded-xl px-2.5 text-sm text-foreground hover:bg-muted"><item.icon className="size-4" /> {item.label}</Link>
                  ))}
                </>
              ) : null}
              <form action={logoutAction}>
                <button type="submit" className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2.5 text-sm text-foreground hover:bg-muted"><LogOut className="size-4" /> Log out</button>
              </form>
            </PopoverContent>
          </Popover>
          <FeedbackButton preview={Boolean(preview)} />
          <form action={logoutAction} className="hidden lg:block">
            <button type="submit" aria-label="Log out" className="inline-flex size-11 items-center justify-center rounded-full text-foreground hover:bg-muted">
              <LogOut className="size-[18px]" />
            </button>
          </form>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="glass mx-3 my-3 hidden w-[220px] shrink-0 flex-col rounded-3xl py-4 lg:flex">
          <Link href="/dashboard" className="mb-3 block w-full px-2">
            {/* The side bar mark is the Cora Connect logo with a clear background (old map photo kept at public/crm-logo.jpeg). next/image is not configured for it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/cora-connect-logo.png" alt="Cora Connect" className="block h-auto w-full object-contain dark:brightness-0 dark:invert" />
          </Link>
          <NavLinks items={navItems} canManage={canManage || showAdminChrome} bochur={bochur} />
          <MoreGroup items={MORE_ITEMS} canManage={showAdminChrome || canManage} bochur={bochur} />
          <Link href="/settings?tab=account" className="mx-3 mt-2 flex items-center gap-2 rounded-2xl px-2 py-2 hover:bg-muted">
            <Avatar name={viewer.name} src={viewer.avatarUrl} className="size-9" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">{viewer.name}</span>
              <span className="block text-[11px] text-muted-foreground">{scopeLabel(viewer.role, viewer.territory, viewingState)}</span>
            </span>
          </Link>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          {preview ? <PreviewBanner role={preview.role} state={preview.state} /> : null}
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
      <nav className="glass fixed inset-x-3 z-40 grid rounded-3xl px-1 py-1 bottom-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden" style={{ gridTemplateColumns: `repeat(${primary.length + 1}, minmax(0, 1fr))` }}>
        {primary.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-medium", active ? "bg-accent text-foreground" : "text-muted-foreground")}>
              <Icon className="size-5" />
              {bochur && item.href === "/planner" ? "Schedule" : (item.short ?? item.label)}
            </Link>
          );
        })}
        <button
          type="button"
          aria-label="More pages"
          className={cn(
            "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-medium",
            mobileMenuItems.some((item) => !PHONE_BAR_HREFS.has(item.href) && (pathname === item.href || pathname.startsWith(`${item.href}/`)))
              ? "bg-accent text-foreground"
              : "text-muted-foreground",
          )}
          onClick={() => setMobileMore(true)}
        >
          <Menu className="size-5" />
          More
        </button>
      </nav>
      <Sheet open={mobileMore} onOpenChange={setMobileMore}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-3xl px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
          <SheetHeader className="pb-2 text-left">
            <SheetTitle className="font-heading text-lg">Menu</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 overflow-y-auto">
            {mobileMenuItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              const label = bochur && item.href === "/planner" ? "Daily schedule" : item.label;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMore(false)}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-2xl px-2.5 text-sm font-medium",
                    active ? "bg-accent text-foreground" : "text-foreground hover:bg-muted",
                  )}
                >
                  <span className={cn("flex size-9 items-center justify-center rounded-xl", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    <Icon className="size-4" />
                  </span>
                  {label}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
      <CommandPalette open={search} onOpenChange={setSearch} households={households} canManage={viewer.canManage && !preview} />
    </div>
  );
}
