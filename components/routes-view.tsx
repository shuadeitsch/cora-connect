"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, ListChecks, Map as MapIcon, MoreHorizontal, Search } from "lucide-react";
import { CityRouteDialog, PickContactsDialog } from "@/components/create-route";
import { Notice, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { deleteAllRoutesAction, deleteRouteAction } from "@/lib/actions";
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
  const rows = useMemo(
    () => data.routes.filter((route) => route.name.toLowerCase().includes(query.trim().toLowerCase())),
    [data.routes, query],
  );
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safe = Math.min(page, pages);
  const slice = rows.slice((safe - 1) * pageSize, safe * pageSize);

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
              <Button variant="outline" className="rounded-full" onClick={() => setPicking(true)}><ListChecks className="size-4" /> Pick contacts</Button>
              <Button variant="outline" className="rounded-full" onClick={() => setByCity(true)}><Building2 className="size-4" /> New route by city</Button>
            </>
          ) : null}
          {data.viewer.canDeleteRoute && data.routes.length ? (
            <Button
              variant="outline"
              className="rounded-full text-red-600"
              disabled={pending}
              onClick={() => {
                const count = data.routes.length;
                if (!confirm(`Delete all ${count} saved route${count === 1 ? "" : "s"} for everyone? This can't be undone.`)) return;
                start(async () => {
                  const result = await deleteAllRoutesAction();
                  if (!result.ok) setError(result.error);
                  else router.refresh();
                });
              }}
            >
              Delete all
            </Button>
          ) : null}
          </div>
        }
      />
      <CityRouteDialog data={data} open={byCity} onClose={() => setByCity(false)} />
      <PickContactsDialog data={data} open={picking} onClose={() => setPicking(false)} />
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
        </div>
        <div className="hidden md:block">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[11px] tracking-wide text-mutedink uppercase">
              <tr className="border-b">
                <th className="w-10 px-3 py-2"><Checkbox checked={slice.length > 0 && slice.every((row) => selected.includes(row.id))} onCheckedChange={(value) => setSelected(value ? slice.map((row) => row.id) : [])} aria-label="Select page" /></th>
                <th className="px-2 py-2 font-medium">Route name</th>
                <th className="px-2 py-2 font-medium">Project</th>
                <th className="px-2 py-2 font-medium">Creating date</th>
                <th className="px-2 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((route) => (
                <tr key={route.id} className="border-b last:border-0">
                  <td className="px-3 py-2"><Checkbox checked={selected.includes(route.id)} onCheckedChange={(value) => setSelected(value ? [...selected, route.id] : selected.filter((id) => id !== route.id))} aria-label={route.name} /></td>
                  <td className="px-2 py-2">
                    <Link href={`/saved-routes/${route.id}`} className="font-semibold text-foreground hover:text-link">{route.name}</Link>
                    <div className="text-[11px] text-mutedink">{route.stopCount} stops{route.optimized ? " · optimized" : ""}{route.miles != null ? ` · ${route.miles} mi` : ""}</div>
                  </td>
                  <td className="px-2 py-2"><span className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-foreground">{route.projectName}</span></td>
                  <td className="px-2 py-2 text-mutedink">{formatDots(route.createdAt)}</td>
                  <td className="px-2 py-2 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><button type="button" aria-label="Route actions" className="inline-flex size-8 items-center justify-center rounded-full hover:bg-muted"><MoreHorizontal className="size-4" /></button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/saved-routes/${route.id}`)}>Open</DropdownMenuItem>
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
            <Link key={route.id} href={`/saved-routes/${route.id}`} className="block px-3 py-3">
              <p className="font-semibold text-foreground">{route.name}</p>
              <p className="text-xs text-mutedink">{route.stopCount} stops · {route.projectName} · {formatDots(route.createdAt)}</p>
            </Link>
          ))}
        </div>
        {!slice.length ? <p className="px-4 py-10 text-center text-sm text-mutedink">No routes yet.</p> : null}
      </div>
    </div>
  );
}
