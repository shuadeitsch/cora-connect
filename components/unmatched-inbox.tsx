"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUndoToast } from "@/components/undo-toast";
import {
  attachUnmatchedAction,
  createFromUnmatchedAction,
  dismissUnmatchedAction,
  listUnmatchedAction,
  searchContactsAction,
  type ContactSearchHit,
} from "@/lib/actions";
import { channelTypeLabel } from "@/lib/messaging";
import type { AppData } from "@/lib/types";
import type { UnmatchedItem } from "@/lib/unmatched";

export function useUnmatchedCount(enabled: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void listUnmatchedAction().then((result) => {
      if (live && result.ok) setCount(result.data?.length ?? 0);
    });
    return () => {
      live = false;
    };
  }, [enabled]);
  return [count, setCount] as const;
}

export function UnmatchedInbox({ data, onCount }: { data: AppData; onCount: (count: number) => void }) {
  const announce = useUndoToast();
  const [items, setItems] = useState<UnmatchedItem[] | null>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState("");
  const [mode, setMode] = useState<"attach" | "create">("attach");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ContactSearchHit[]>([]);
  const [pick, setPick] = useState<ContactSearchHit | null>(null);
  const [addInfo, setAddInfo] = useState(true);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState(data.projects?.[0]?.id ?? "");
  const [state, setState] = useState("Maine");
  const [city, setCity] = useState("");
  const [pending, start] = useTransition();

  async function reload() {
    const result = await listUnmatchedAction();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setItems(result.data ?? []);
    onCount(result.data?.length ?? 0);
  }

  useEffect(() => {
    void reload();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- load once

  useEffect(() => {
    if (mode !== "attach" || query.trim().length < 2) {
      setHits([]);
      return;
    }
    let live = true;
    const timer = window.setTimeout(() => {
      void searchContactsAction(query).then((rows) => {
        if (live) setHits(rows);
      });
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [query, mode]);

  function open(item: UnmatchedItem, next: "attach" | "create") {
    setOpenId(item.id);
    setMode(next);
    setQuery("");
    setHits([]);
    setPick(null);
    setName(item.senderName);
    setError("");
  }

  function finish(result: { ok: boolean; error?: string; warning?: string }, okText: string) {
    announce(result.ok ? { ok: true } : { ok: false, error: result.error ?? "Could not save." }, result.warning ? `${okText} ${result.warning}` : okText);
    if (!result.ok) {
      setError(result.error ?? "Could not save.");
      return;
    }
    setOpenId("");
    void reload();
  }

  if (items === null) return <p className="text-sm text-muted-foreground">{error || "Loading…"}</p>;
  if (!items.length) return <p className="text-sm text-muted-foreground">No unknown senders. Messages from numbers or emails that match no contact will show up here.</p>;

  return (
    <ul className="grid min-w-0 gap-3">
      {error ? <li className="text-sm text-red-600">{error}</li> : null}
      {items.map((item) => (
        <li key={item.id} className="min-w-0 rounded-2xl border bg-card p-3">
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="min-w-0 font-medium text-foreground [overflow-wrap:anywhere]">
              {item.address || "Hidden sender"}
              {item.senderName ? <span className="font-normal text-muted-foreground"> · {item.senderName}</span> : null}
            </p>
            <p className="text-xs text-muted-foreground">
              {channelTypeLabel(item.channelType as never)} · {new Date(item.receivedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
          {item.subject ? <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">{item.subject}</p> : null}
          <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl bg-muted px-3 py-2 text-sm [overflow-wrap:anywhere]">{item.body}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="min-h-11 rounded-full" disabled={pending} onClick={() => open(item, "attach")}>Attach to contact</Button>
            <Button type="button" variant="outline" className="min-h-11 rounded-full" disabled={pending} onClick={() => open(item, "create")}>Create new contact</Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-full"
              disabled={pending}
              onClick={() => start(async () => finish(await dismissUnmatchedAction(item.id), "Dismissed."))}
            >
              Dismiss
            </Button>
          </div>
          {openId === item.id ? (
            <div className="mt-3 grid gap-2 rounded-xl border p-3">
              {mode === "attach" ? (
                <>
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search contacts by name, phone or email" aria-label="Search contacts" />
                  {pick ? (
                    <p className="text-sm">Attach to <span className="font-medium">{pick.name}</span>{pick.city ? ` (${pick.city})` : ""}</p>
                  ) : (
                    <ul className="grid max-h-48 gap-1 overflow-y-auto">
                      {hits.map((hit) => (
                        <li key={`${hit.id}-${hit.field}`}>
                          <button type="button" className="min-h-11 w-full min-w-0 rounded-xl px-3 py-1.5 text-left text-sm hover:bg-muted" onClick={() => setPick(hit)}>
                            <span className="font-medium">{hit.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">{[hit.city, hit.state].filter(Boolean).join(", ")}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="size-5" checked={addInfo} onChange={(event) => setAddInfo(event.target.checked)} />
                    Also save {item.address} on this contact
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="min-h-11 rounded-full"
                      disabled={pending || !pick}
                      onClick={() => start(async () => { if (pick) finish(await attachUnmatchedAction({ id: item.id, householdId: pick.id, addToContact: addInfo }), "Attached to the contact."); })}
                    >
                      {pending ? "Saving…" : "Attach"}
                    </Button>
                    {pick ? <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={() => setPick(null)}>Change</Button> : null}
                    <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={() => setOpenId("")}>Cancel</Button>
                  </div>
                </>
              ) : (
                <>
                  <label className="grid gap-1 text-sm">
                    <span className="text-muted-foreground">Name (required)</span>
                    <Input value={name} onChange={(event) => setName(event.target.value)} />
                  </label>
                  <p className="text-xs text-muted-foreground">{item.address} will be saved as their {channelTypeLabel(item.channelType as never).toLowerCase().includes("mail") ? "email" : "phone"}.</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="grid gap-1 text-sm">
                      <span className="text-muted-foreground">Project</span>
                      <select className="h-11 rounded-xl border bg-card px-3 text-sm" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                        {(data.projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="text-muted-foreground">State</span>
                      <Input value={state} onChange={(event) => setState(event.target.value)} />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="text-muted-foreground">City</span>
                      <Input value={city} onChange={(event) => setCity(event.target.value)} />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="min-h-11 rounded-full"
                      disabled={pending || !name.trim()}
                      onClick={() => start(async () => finish(await createFromUnmatchedAction({ id: item.id, name, projectId, state, city }), "Contact created and message attached."))}
                    >
                      {pending ? "Saving…" : "Create contact"}
                    </Button>
                    <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={() => setOpenId("")}>Cancel</Button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
