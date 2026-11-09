"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { officialTags } from "@/lib/contact-tags";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export type PaletteHousehold = {
  id: string;
  name: string;
  city: string;
  state: string;
  tags?: string[];
  notes?: { label: string; notes: string }[];
};

const PAGES = [
  { href: "/dashboard", label: "Home", hint: "Overview" },
  { href: "/households", label: "Contacts", hint: "People" },
  { href: "/map", label: "Map", hint: "Pins and routes" },
  { href: "/saved-routes", label: "Saved routes", hint: "Driving order" },
  { href: "/team", label: "My Team", hint: "Team, invites & approvals" },
  { href: "/settings", label: "Settings", hint: "House and account" },
  { href: "/settings?tab=account", label: "Account", hint: "Password" },
];

export function CommandPalette({
  open,
  onOpenChange,
  households,
  canManage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  households: PaletteHousehold[];
  canManage: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  void canManage;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pages = PAGES.filter((page) => !q || `${page.label} ${page.hint}`.toLowerCase().includes(q))
      .map((page) => ({ ...page, kind: "Page" as const }));
    const homes = households
      .filter((household) => {
        const noteText = (household.notes ?? []).map((note) => `${note.label} ${note.notes}`).join(" ");
        const tagText = (household.tags ?? []).join(" ");
        return !q || `${household.name} ${household.city} ${household.state} ${tagText} ${noteText}`.toLowerCase().includes(q);
      })
      .slice(0, 8)
      .map((household) => {
        const tagLabel = officialTags(household.tags ?? []).join(", ");
        const noteHit = (household.notes ?? []).find((note) => q && `${note.label} ${note.notes}`.toLowerCase().includes(q));
        const snippet = noteHit ? (noteHit.notes.length > 80 ? `${noteHit.notes.slice(0, 80)}…` : noteHit.notes) : "";
        const place = noteHit ? `${noteHit.label} — ${snippet}` : `${household.city}, ${household.state}`;
        return {
          href: `/households?focus=${household.id}`,
          label: household.name,
          hint: [tagLabel, place].filter(Boolean).join(" · "),
          kind: "Household" as const,
        };
      });
    return [...pages, ...homes].slice(0, 12);
  }, [query, households]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const frame = window.requestAnimationFrame(() => input.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-3 pt-[12vh]" role="presentation">
      <button type="button" aria-label="Close search" className="overlay-scrim absolute inset-0 bg-black/40" onClick={() => onOpenChange(false)} />
      <div role="dialog" aria-label="Search Cora" className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-popover shadow-lg">
        <div className="flex items-center gap-2 border-b border-border/70 px-4">
          <Search className="size-4 text-muted-foreground" />
          <input
            ref={input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages and contacts"
            className="h-12 w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
            onKeyDown={(event) => {
              if (event.key === "Escape") onOpenChange(false);
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((index) => Math.min(results.length - 1, index + 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((index) => Math.max(0, index - 1));
              }
              if (event.key === "Enter" && results[active]) go(results[active].href);
            }}
          />
        </div>
        <ul className="max-h-80 overflow-auto p-2">
          {results.length ? results.map((item, index) => (
            <li key={`${item.kind}-${item.href}-${item.label}`}>
              <button
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => go(item.href)}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left ${index === active ? "bg-accent text-accent-foreground" : "text-foreground"}`}
              >
                <span>
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="block text-xs text-muted-foreground">{item.hint}</span>
                </span>
                <span className="text-[11px] tracking-wide text-muted-foreground uppercase">{item.kind}</span>
              </button>
            </li>
          )) : (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">Nothing matches that.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
