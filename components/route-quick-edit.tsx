"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Notice } from "@/components/page-header";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { saveRouteAction } from "@/lib/actions";
import type { AppData, RouteView } from "@/lib/types";

/** Rename a saved route or change its project from the Saved routes list. Stops are kept as they are. */
export function RouteQuickEdit({ data, route, onClose }: { data: AppData; route: RouteView | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(route)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <DialogHeader><DialogTitle className="font-heading text-foreground">Edit route</DialogTitle></DialogHeader>
        {route ? <QuickEditForm key={route.id} data={data} route={route} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function QuickEditForm({ data, route, onClose }: { data: AppData; route: RouteView; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(route.name);
  const [projectId, setProjectId] = useState(route.projectId ?? "");
  const [error, setError] = useState("");
  const [pending, run] = useTransition();
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setError("");
        run(async () => {
          let result: Awaited<ReturnType<typeof saveRouteAction>>;
          try {
            result = await saveRouteAction({ id: route.id, name, projectId, optimized: route.optimized, householdIds: route.stops.map((stop) => stop.householdId) });
          } catch {
            result = { ok: false, error: "The route wasn't saved: the connection dropped. Try again." };
          }
          if (!result.ok) {
            setError(result.error);
            toast({ title: result.error, tone: "error" });
            return;
          }
          toast({ title: `Route saved: ${name.trim()}` });
          router.refresh();
          onClose();
        });
      }}
    >
      <label className="grid gap-1 text-sm font-medium text-foreground">
        Name
        <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} aria-label="Route name" className="max-md:h-11 max-md:text-base" />
      </label>
      <label className="grid gap-1 text-sm font-medium text-foreground">
        Project
        <select className="h-10 rounded-lg border bg-card px-2 text-sm font-normal max-md:h-11 max-md:text-base" value={projectId} onChange={(event) => setProjectId(event.target.value)} aria-label="Project">
          <option value="">Unsorted</option>
          {data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
      </label>
      {error ? <Notice>{error}</Notice> : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link href={`/saved-routes/${route.id}?edit=1`} className="mr-auto text-sm text-link underline underline-offset-2">Edit stops</Link>
        <Button type="button" variant="outline" className="rounded-full max-md:h-11" onClick={onClose} disabled={pending}>Cancel</Button>
        <Button type="submit" className="rounded-full max-md:h-11" disabled={pending || !name.trim()}>{pending ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}
