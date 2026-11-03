"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  ClipboardList,
  House,
  LayoutGrid,
  LogOut,
  Map,
  MoreHorizontal,
  Phone,
  Route,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { CommandPalette, type PaletteHousehold } from "@/components/command-palette";
import { ReloadButton } from "@/components/reload-button";
import { VersionBadge } from "@/components/version-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { logoutAction, readNotificationsAction } from "@/lib/actions";
import { scopeLabel } from "@/lib/constants";
import { formatMedium } from "@/lib/format";
import type { AppNotificationView, Viewer } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRIMARY: { href: string; label: string; icon: typeof House; adminOnly?: boolean }[] = [
  { href: "/households", label: "Contacts", icon: House },
  { href: "/users", label: "Users", icon: ShieldCheck, adminOnly: true },
];

const MORE_NAV: { href: string; label: string; icon: typeof House; adminOnly?: boolean }[] = [
  { href: "/map", label: "Map", icon: Map },
  { href: "/saved-routes", label: "Routes", icon: Route },
  { href: "/reports", label: "Reports", icon: ClipboardList },
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/team", label: "My Team", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLinks({
  items,
  onNavigate,
  canManage,
}: {
  items: { href: string; label: string; icon: typeof House; adminOnly?: boolean }[];
  onNavigate?: () => void;
  canManage: boolean;
}) {
  const pathname = usePathname();
  const visible = items.filter((item) => canManage || !item.adminOnly);
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
  notifications,
  households,
  children,
}: {
  viewer: Viewer;
  notifications: AppNotificationView[];
  households: PaletteHousehold[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const [search, setSearch] = useState(false);
  const unread = notifications.filter((note) => !note.read).length;
  const mapPage = pathname.startsWith("/map");
  const primary = PRIMARY.filter((item) => viewer.canManage || !item.adminOnly);

  useEffect(() => {
    setMore(false);
  }, [pathname]);

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
            <VersionBadge className="min-w-0 flex-1" />
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
              <button type="button" aria-label="Contact the desk" className="inline-flex size-11 items-center justify-center rounded-full text-foreground hover:bg-muted">
                <Phone className="size-[18px]" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
              <p className="font-heading text-sm font-semibold text-foreground">Project desk</p>
              <p className="mt-1 text-sm text-muted-foreground">Questions about a route or a contact.</p>
              <div className="mt-3 flex flex-col gap-1 text-sm">
                <a className="text-primary" href="tel:4065550199">(406) 555-0199</a>
                <a className="text-primary" href="mailto:desk@ruralchabad.example">desk@ruralchabad.example</a>
              </div>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
                className="relative inline-flex size-11 items-center justify-center rounded-full text-foreground hover:bg-muted"
                onClick={() => {
                  if (unread) void readNotificationsAction();
                }}
              >
                <Bell className="size-[18px]" />
                {unread ? (
                  <span className="absolute top-1.5 right-1.5 min-w-4 rounded-full bg-[#e11d48] px-1 text-center text-[10px] leading-4 font-semibold text-white">
                    {unread}
                  </span>
                ) : null}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="border-b px-3 py-2 font-heading text-sm font-semibold text-foreground">Notifications</div>
              <div className="max-h-80 overflow-auto">
                {notifications.length ? (
                  notifications.map((note) => (
                    <div key={note.id} className="border-b px-3 py-2 last:border-0">
                      <p className="text-sm font-medium text-foreground">{note.title}</p>
                      <p className="text-xs text-muted-foreground">{note.body}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{formatMedium(note.createdAt)}</p>
                    </div>
                  ))
                ) : (
                  <p className="px-3 py-6 text-sm text-muted-foreground">You&apos;re caught up.</p>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <Link href="/settings" aria-label="Settings" className="hidden size-11 items-center justify-center rounded-full text-foreground hover:bg-muted lg:inline-flex">
            <Settings className="size-[18px]" />
          </Link>
          <form action={logoutAction} className="hidden lg:block">
            <button type="submit" aria-label="Log out" className="inline-flex size-11 items-center justify-center rounded-full text-foreground hover:bg-muted">
              <LogOut className="size-[18px]" />
            </button>
          </form>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="glass mx-3 my-3 hidden w-[220px] shrink-0 flex-col rounded-3xl py-4 lg:flex">
          <Link href="/households" className="mb-3 block px-4">
            {/* The side bar mark is the Cora Connect logo photo. next/image is not configured for it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/crm-logo.jpeg" alt="Cora Connect" className="h-12 w-auto max-w-[11.5rem] object-contain object-left" />
          </Link>
          <NavLinks items={PRIMARY} canManage={viewer.canManage} />
          <p className="mt-4 px-5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">More</p>
          <NavLinks items={MORE_NAV} canManage={viewer.canManage} />
          <Link href="/settings?tab=account" className="mx-3 mt-auto flex items-center gap-2 rounded-2xl px-2 py-2 hover:bg-muted">
            <Avatar name={viewer.name} className="size-9" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">{viewer.name}</span>
              <span className="block text-[11px] text-muted-foreground">{scopeLabel(viewer.role, viewer.territory)}</span>
            </span>
          </Link>
        </aside>
        <Sheet open={more} onOpenChange={setMore}>
          <SheetContent side="bottom" className="rounded-t-3xl pb-6">
            <SheetTitle className="sr-only">More</SheetTitle>
            <div className="px-2 pt-2">
              <NavLinks items={[...PRIMARY, ...MORE_NAV]} canManage={viewer.canManage} onNavigate={() => setMore(false)} />
              <form action={logoutAction} className="px-3 pt-2">
                <button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-2xl px-2.5 text-sm font-medium text-muted-foreground hover:bg-muted">
                  <span className="flex size-8 items-center justify-center rounded-xl"><LogOut className="size-4" /></span>
                  Log out
                </button>
              </form>
            </div>
          </SheetContent>
        </Sheet>
        <div className="flex min-w-0 flex-1 flex-col">
          {viewer.expired ? (
            <div className="mx-3 mt-3 rounded-2xl bg-amber-100 px-4 py-2 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
              Your access expired{viewer.expiresAt ? ` on ${formatMedium(viewer.expiresAt)}` : ""}. You can review records, and editing is turned off.
            </div>
          ) : null}
          <main className={cn("min-h-0 flex-1", mapPage ? "overflow-hidden" : "overflow-auto pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-4")}>{children}</main>
        </div>
      </div>
      <nav className="glass fixed inset-x-3 z-40 grid rounded-3xl px-1 py-1 bottom-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden" style={{ gridTemplateColumns: `repeat(${primary.length + 1}, minmax(0, 1fr))` }}>
        {primary.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-medium", active ? "bg-accent text-foreground" : "text-muted-foreground")}>
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
        <button type="button" onClick={() => setMore(true)} className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-medium text-muted-foreground">
          <MoreHorizontal className="size-5" />
          More
        </button>
      </nav>
      <CommandPalette open={search} onOpenChange={setSearch} households={households} canManage={viewer.canManage} />
    </div>
  );
}
