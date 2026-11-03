"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Notice } from "@/components/page-header";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ContactFilterControls, ContactStateTabs, cityKey, useContactFilters } from "@/components/contact-filters";
import { buildRouteAction } from "@/lib/actions";
import { stateLabel } from "@/lib/constants";
import type { AppData } from "@/lib/types";
import { cn } from "@/lib/utils";

function suggestedName(data: AppData, ids: string[]) {
  const picked = data.households.filter((household) => ids.includes(household.id));
  const cities = [...new Set(picked.map((household) => household.city.trim()).filter(Boolean))];
  const day = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return cities.length === 1 ? `${cities[0]} route` : `Route ${day}`;
}

/** Name the route, save it (ordered nearest-first), then open it. */
export function NameRouteForm({ data, ids, name: startName, onBack }: { data: AppData; ids: string[]; name?: string; onBack?: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(() => startName ?? suggestedName(data, ids));
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  function fail(message: string) {
    setError(message);
    toast({ title: message, tone: "error" });
  }
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        setError("");
        start(async () => {
          // Stay on this step until the database confirms the route; any failure is shown here and as a toast.
          let result: Awaited<ReturnType<typeof buildRouteAction>>;
          try {
            result = await buildRouteAction({ name, projectId, householdIds: ids });
          } catch {
            fail("The route didn't save. Check your connection, press Reload, and try again.");
            return;
          }
          if (!result?.ok) {
            fail(result?.error || "The route didn't save. Try again.");
            return;
          }
          if (!result.data?.id) {
            fail("The route didn't save. Try again.");
            return;
          }
          toast({ title: `Route saved: ${name.trim()}` });
          router.push(`/saved-routes/${result.data.id}`);
          router.refresh();
        });
      }}
    >
      <p className="text-sm text-muted-foreground">{ids.length} stop{ids.length === 1 ? "" : "s"}, put in order from your start point.</p>
      <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Route name" aria-label="Route name" />
      {data.projects.length ? (
        <select className="h-10 rounded-lg border bg-card px-2 text-sm" value={projectId} onChange={(event) => setProjectId(event.target.value)} aria-label="Project">
          <option value="">Unsorted</option>
          {data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
      ) : null}
      {error ? <Notice>{error}</Notice> : null}
      <div className="flex justify-end gap-2">
        {onBack ? <Button type="button" variant="outline" className="rounded-full" onClick={onBack}>Back</Button> : null}
        <Button type="submit" className="rounded-full" disabled={pending || !ids.length || !name.trim()}>{pending ? "Saving…" : "Save route"}</Button>
      </div>
    </form>
  );
}

export function CreateRouteDialog({ data, ids, open, onClose }: { data: AppData; ids: string[]; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="font-heading text-foreground">New route</DialogTitle></DialogHeader>
        {open ? <NameRouteForm data={data} ids={ids} /> : null}
      </DialogContent>
    </Dialog>
  );
}

/** Pick a city (in the open state tab); the route gets every contact there that shows on the contact list. */
export function CityRouteDialog({ data, open, onClose}: { data: AppData; open: boolean; onClose: () => void }) {
  const ctl = useContactFilters(data, "");
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<{ key: string; label: string; ids: string[] } | null>(null);
  const cities = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; ids: string[] }>();
    for (const household of ctl.beforeCity) {
      const key = `${cityKey(household.city)}|${household.state.trim().toUpperCase()}`;
      const label = `${household.city.trim().replace(/\s+/g, " ") || "No city"}${ctl.filters.state ? "" : household.state ? `, ${household.state.trim()}` : ""}`;
      const group = groups.get(key) ?? { key, label, ids: [] };
      group.ids.push(household.id);
      groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [ctl.beforeCity, ctl.filters.state]);
  const shown = cities.filter((city) => city.label.toLowerCase().includes(search.trim().toLowerCase()));
  const current = chosen;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { setChosen(null); setSearch(""); onClose(); } }}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-foreground">{current ? current.label : "New route by city"}</DialogTitle>
        </DialogHeader>
        {current ? (
          <NameRouteForm key={current.key} data={data} ids={current.ids} name={`${current.label} route`} onBack={() => setChosen(null)} />
        ) : (
          <div className="grid gap-3">
            <ContactStateTabs ctl={ctl} />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search cities" aria-label="Search cities" />
            <ul className="max-h-[50vh] divide-y overflow-auto rounded-xl border">
              {shown.map((city) => (
                <li key={city.key}>
                  <button type="button" className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-muted" onClick={() => setChosen(city)}>
                    <span className="font-medium text-foreground">{city.label}</span>
                    <span className="text-xs text-muted-foreground">{city.ids.length}</span>
                  </button>
                </li>
              ))}
              {!shown.length ? <li className="px-3 py-6 text-center text-sm text-muted-foreground">No contacts{ctl.filters.state ? ` in ${stateLabel(ctl.filters.state)}` : ""}.</li> : null}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Tick contacts from a filtered list, then name and save the route. */
export function PickContactsDialog({ data, open, onClose }: { data: AppData; open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const ctl = useContactFilters(data, query);
  const [picked, setPicked] = useState<string[]>([]);
  const [naming, setNaming] = useState(false);
  const shown = ctl.matched;
  const allShown = shown.length > 0 && shown.every((household) => picked.includes(household.id));
  const toggle = (id: string) => setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { setNaming(false); setPicked([]); setQuery(""); onClose(); } }}>
      <DialogContent className="flex max-h-[92dvh] flex-col sm:max-w-2xl">
        <DialogHeader><DialogTitle className="font-heading text-foreground">{naming ? "New route" : "Pick contacts"}</DialogTitle></DialogHeader>
        {naming ? (
          <NameRouteForm data={data} ids={picked} onBack={() => setNaming(false)} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <ContactStateTabs ctl={ctl} />
              <ContactFilterControls ctl={ctl} />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search contacts" aria-label="Search contacts" className="h-10 w-44 rounded-full" />
            </div>
            <ul className="min-h-40 flex-1 divide-y overflow-auto rounded-xl border">
              {shown.map((household) => {
                const on = picked.includes(household.id);
                return (
                  <li key={household.id}>
                    <label className={cn("flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted", on && "bg-primary/5")}>
                      <input type="checkbox" className="size-4 accent-[#0f766e]" checked={on} onChange={() => toggle(household.id)} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">{household.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{household.address || "No address"}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
              {!shown.length ? <li className="px-3 py-6 text-center text-sm text-muted-foreground">No contacts match.</li> : null}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{picked.length} selected</span>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-full"
                disabled={!shown.length}
                onClick={() => setPicked((current) => allShown
                  ? current.filter((id) => !shown.some((household) => household.id === id))
                  : [...current, ...shown.map((household) => household.id).filter((id) => !current.includes(id))])}
              >
                {allShown ? "Unselect shown" : `Select all shown (${shown.length})`}
              </Button>
              {picked.length ? <Button type="button" variant="outline" className="h-9 rounded-full" onClick={() => setPicked([])}>Clear</Button> : null}
              <Button type="button" className="ml-auto h-9 rounded-full" disabled={!picked.length} onClick={() => setNaming(true)}>Create route</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
