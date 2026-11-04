"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, CalendarRange, ListChecks, Map as MapIcon, MoreHorizontal, Pencil, Search, Trash2 } from "lucide-react";
import { RouteCities } from "@/components/route-cities";
import { RouteQuickEdit } from "@/components/route-quick-edit";
import { CityRouteDialog, PickContactsDialog } from "@/components/create-route";
import { Notice, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { deleteRouteAction, deleteRoutesAction } from "@/lib/actions";
import { formatDots } from "@/lib/format";
import type { AppData } from "@/lib/types";

export function RoutesView({ data }: { data: AppData }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [byCity, setByCity] = useState(false);
  const [picking, setPicking] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = data.routes.find((route) => route.id === editingId) ?? null;
  const canEdit = data.viewer.canCreateRoute;
  const rows = useMemo(
    () => data.routes.filter((route) => route.name.toLowerCase().includes(query.trim().toLowerCase())),
    [data.routes, query],
  );
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safe = Math.min(page, pages);
  const slice = rows.slice((safe - 1) * pageSize, safe * pageSize);

  const [selecting, setSelecting] = useState(false);
  const chosen = data.routes.filter((route) => selected.includes(route.id));
  function toggle(id: string, on: boolean) {
    setSelected((list) => (on ? [...new Set([...list, id])] : list.filter((item) => item !== id)));
  }
  function removeSelected() {
    if (!chosen.length) return;
    const names = chosen.map((route) => `• ${route.name}`).join("\n");
    if (!confirm(`Delete ${chosen.length} route${chosen.length === 1 ? "" : "s"}? This can't be undone.\n\n${names}`)) return;
    start(async () => {
      const result = await deleteRoutesAction(chosen.map((route) => route.id));
      if (!result.ok) setError(result.error);
      else { setSelected([]); setSelecting(false); router.refresh(); }
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this route?")) return;
    start(async () => {
      const result = await deleteRouteAction(id);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Saved routes"
        crumb="Saved routes"
        action={
          <div className="flex flex-wrap justify-end gap-2">
          {data.viewer.canCreateRoute ? (
            <>
              <Button className="rounded-full" onClick={() => router.push("/saved-routes/new")}><MapIcon className="size-4" /> Build on map</Button>
              <Button className="rounded-full" onClick={() => setPicking(true)}><ListChecks className="size-4" /> Pick contacts</Button>
              <Button className="rounded-full" onClick={() => setByCity(true)}><Building2 className="size-4" /> New route by city</Button>
              <Button className="rounded-full" onClick={() => router.push("/saved-routes/plan")}><CalendarRange className="size-4" /> Plan a trip</Button>
            </>
          ) : null}
          </div>
        }
      />
      <CityRouteDialog data={data} open={byCity} onClose={() => setByCity(false)} />
      <PickContactsDialog data={data} open={picking} onClose={() => setPicking(false)} />
      <RouteQuickEdit data={data} route={editing} onClose={() => setEditingId(null)} />
      {error ? <div className="mb-3"><Notice>{error}</Notice></div> : null}
      <div className="panel overflow-hidden rounded-3xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
          <div className="relative">
            <Search className="absolute top-2.5 left-2.5 size-4 text-mutedink" />
            <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search name" className="w-56 pl-8" />
          </div>
          <p className="text-xs text-mutedink">
            Showing
            <select className="mx-1 rounded-md border px-1 py-0.5" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
              {[10, 25, 50].map((size) => <option key={size}>{size}</option>)}
            </select>
            of {rows.length} entries
          </p>
          {data.viewer.canDeleteRoute && data.routes.length ? (
            <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
              <Button type="button" variant="outline" className="min-h-10 rounded-full md:hidden" onClick={() => { setSelecting(!selecting); if (selecting) setSelected([]); }}>{selecting ? "Done" : "Select"}</Button>
              {chosen.length ? (
                <Button type="button" variant="outline" className="min-h-10 rounded-full border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300" disabled={pending} onClick={removeSelected}><Trash2 className="size-4" /> Delete selected ({chosen.length})</Button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="hidden md:block">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[11px] tracking-wide text-mutedink uppercase">
              <tr className="border-b">
                {data.viewer.canDeleteRoute ? <th className="w-10 px-3 py-2"><span className="sr-only">Select</span></th> : null}
                <th className="px-2 py-2 font-medium">Route name</th>
                <th className="px-2 py-2 font-medium">Project</th>
                <th className="px-2 py-2 font-medium">Creating date</th>
                <th className="px-2 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((route) => (
                <tr key={route.id} className="border-b last:border-0">
                  {data.viewer.canDeleteRoute ? <td className="px-3 py-2"><Checkbox checked={selected.includes(route.id)} onCheckedChange={(value) => toggle(route.id, Boolean(value))} aria-label={`Select ${route.name}`} /></td> : null}
                  <td className="px-2 py-2">
                    <Link href={`/saved-routes/${route.id}`} className="font-semibold text-foreground hover:text-link">{route.name}</Link>
                    <div className="text-[11px] text-mutedink">{route.stopCount} stops{route.optimized ? " · optimized" : ""}{route.miles != null ? ` · ${route.miles} mi` : ""}</div>
                    <RouteCities stops={route.stops} />
                  </td>
                  <td className="px-2 py-2"><span className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-foreground">{route.projectName}</span></td>
                  <td className="px-2 py-2 text-mutedink">{formatDots(route.createdAt)}</td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    {canEdit ? (
                      <button type="button" aria-label={`Edit ${route.name}`} title="Edit" className="inline-flex size-8 items-center justify-center rounded-full text-primary hover:bg-muted" onClick={() => setEditingId(route.id)}><Pencil className="size-4" /></button>
                    ) : null}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><button type="button" aria-label="Route actions" className="inline-flex size-8 items-center justify-center rounded-full hover:bg-muted"><MoreHorizontal className="size-4" /></button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/saved-routes/${route.id}`)}>Open</DropdownMenuItem>
                        {canEdit ? <DropdownMenuItem onClick={() => setEditingId(route.id)}>Edit name or project</DropdownMenuItem> : null}
                        {canEdit ? <DropdownMenuItem onClick={() => router.push(`/saved-routes/${route.id}?edit=1`)}>Edit stops</DropdownMenuItem> : null}
                        {data.viewer.canDeleteRoute ? <DropdownMenuItem onClick={() => remove(route.id)}>Delete</DropdownMenuItem> : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="divide-y md:hidden">
          {slice.map((route) => (
            <div key={route.id} className="flex items-center gap-2 px-3 py-2">
              {selecting ? <Checkbox className="size-5" checked={selected.includes(route.id)} onCheckedChange={(value) => toggle(route.id, Boolean(value))} aria-label={`Select ${route.name}`} /> : null}
              <div className="min-w-0 flex-1 py-1">
                <Link href={`/saved-routes/${route.id}`} className="block">
                  <p className="font-semibold text-foreground">{route.name}</p>
                  <p className="text-xs text-mutedink">{route.stopCount} stops · {route.projectName} · {formatDots(route.createdAt)}</p>
                </Link>
                <RouteCities stops={route.stops} />
              </div>
              {canEdit ? (
                <button type="button" aria-label={`Edit ${route.name}`} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-primary hover:bg-muted" onClick={() => setEditingId(route.id)}><Pencil className="size-5" /></button>
              ) : null}
            </div>
          ))}
        </div>
        {!slice.length ? <p className="px-4 py-10 text-center text-sm text-mutedink">No routes yet.</p> : null}
      </div>
    </div>
  );
}
