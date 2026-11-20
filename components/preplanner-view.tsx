"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PreplannerDialog } from "@/components/preplanner-dialog";
import { usePractice } from "@/components/practice-provider";
import { Button } from "@/components/ui/button";
import { useUndoToast } from "@/components/undo-toast";
import { deletePreplannerEntriesAction, deletePreplannerEntryAction } from "@/lib/actions";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { preplannerSortKey, preplannerWhen, reachedHowLabel } from "@/lib/preplanner";
import { MessageInbox } from "@/components/message-inbox";
import { PreplannerMessageDialog } from "@/components/preplanner-message-dialog";
import { useGmailSyncOnOpen } from "@/components/gmail-inbox-sync";
import type { AppData, HouseholdView, PreplannerEntry, PreplannerStage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { sameState, stateLabel } from "@/lib/constants";

const STATE_KEY = "cora-preplanner-state";

export function PreplannerView({ data }: { data: AppData }) {
  const announce = useUndoToast();
  const practice = usePractice();
  const [tab, setTab] = useState<PreplannerStage | "inbox">("reached_out");
  const [editing, setEditing] = useState<PreplannerEntry | null>(null);
  const [confirming, setConfirming] = useState<PreplannerEntry | null>(null);
  const [messaging, setMessaging] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [pending, start] = useTransition();
  const canChange = data.viewer.canEdit || data.viewer.canLogVisit;
  const canMessage = data.viewer.canOutreach || data.viewer.canEdit;
  useGmailSyncOnOpen(!data.viewer.preview && !data.viewer.sandbox);
  const byId = useMemo(() => new Map(data.households.map((household) => [household.id, household])), [data.households]);
  const allEntries = data.preplannerEntries ?? [];
  const isAdmin = data.viewer.role === "admin";
  const stateOptions = useMemo(() => {
    const set = new Set<string>();
    for (const entry of allEntries) {
      const st = stateLabel(byId.get(entry.householdId)?.state || "");
      if (st) set.add(st);
    }
    for (const house of data.households) {
      const st = stateLabel(house.state || "");
      if (st && isAdmin) set.add(st);
    }
    return [...set].sort();
  }, [allEntries, byId, data.households, isAdmin]);
  const [stateFilter, setStateFilter] = useState("");
  useEffect(() => {
    try { setStateFilter(window.localStorage.getItem(STATE_KEY) ?? ""); } catch { /* ignore */ }
  }, []);
  const activeState = isAdmin && stateFilter && stateOptions.includes(stateFilter) ? stateFilter : "";
  function chooseState(value: string) {
    setStateFilter(value);
    setChecked({});
    try { window.localStorage.setItem(STATE_KEY, value); } catch { /* ignore */ }
  }
  const entries = activeState ? allEntries.filter((entry) => sameState(byId.get(entry.householdId)?.state || "", activeState)) : allEntries;
  const reached = entries.filter((entry) => entry.stage !== "confirmed");
  const confirmed = entries.filter((entry) => entry.stage === "confirmed");
  const shown = (tab === "confirmed" ? confirmed : reached)
    .slice()
    .sort((a, b) => {
      if (tab === "confirmed") {
        return preplannerSortKey(a.requestedDate, a.requestedTime).localeCompare(preplannerSortKey(b.requestedDate, b.requestedTime)) || a.createdAt.localeCompare(b.createdAt);
      }
      return preplannerSortKey(a.reachedDate, a.reachedTime).localeCompare(preplannerSortKey(b.reachedDate, b.reachedTime)) || a.createdAt.localeCompare(b.createdAt);
    });

  const checkedIds = shown.filter((entry) => checked[entry.id]).map((entry) => entry.id);
  const allChecked = shown.length > 0 && checkedIds.length === shown.length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Pre-planner"
        crumb="Pre-planner"
        description="Log every contact you reached, then confirm a visit when a date and time are set. Confirmed visits also show up on that day in the Daily planner."
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div className="inline-flex max-w-full flex-wrap gap-1 rounded-full border bg-card p-1" role="tablist" aria-label="Pre-planner stages">
        <button type="button" role="tab" aria-selected={tab === "reached_out"} className={cn("h-10 rounded-full px-3.5 text-sm font-medium", tab === "reached_out" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted")} onClick={() => setTab("reached_out")}>
          Reached out ({reached.length})
        </button>
        <button type="button" role="tab" aria-selected={tab === "confirmed"} className={cn("h-10 rounded-full px-3.5 text-sm font-medium", tab === "confirmed" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted")} onClick={() => setTab("confirmed")}>
          Confirmed visits ({confirmed.length})
        </button>
        <button type="button" role="tab" aria-selected={tab === "inbox"} className={cn("h-10 rounded-full px-3.5 text-sm font-medium", tab === "inbox" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted")} onClick={() => setTab("inbox")}>
          Inbox{(data.unreadMessageCount ?? 0) ? ` (${data.unreadMessageCount})` : ""}
        </button>
      </div>
      {tab !== "inbox" && isAdmin && stateOptions.length > 1 ? (
        <label className="flex w-full items-center gap-2 text-sm sm:w-auto">
          <span className="text-muted-foreground">State</span>
          <select
            className="h-11 min-w-0 flex-1 rounded-xl border bg-card px-3 text-sm sm:flex-none"
            value={activeState}
            onChange={(event) => chooseState(event.target.value)}
            aria-label="Filter the Pre-planner by state"
          >
            <option value="">All states</option>
            {stateOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
      ) : null}
      {tab !== "inbox" && canMessage ? (
        <Button type="button" className="min-h-11 rounded-full" onClick={() => setMessaging(true)}>
          Message
        </Button>
      ) : null}
      </div>
      {tab === "inbox" ? (
        <div className="panel rounded-3xl p-4">
          <MessageInbox data={data} />
        </div>
      ) : !shown.length ? (

        <p className="panel rounded-3xl px-4 py-10 text-center text-sm text-muted-foreground">
          {tab === "confirmed"
            ? "No confirmed visits yet. Open a Reached-out entry and choose Confirm visit when a date and time are set."
            : "Nothing in Reached out yet. Open a contact and choose Pre-planner after you reach them."}
        </p>
      ) : (
        <>
        {canChange ? (
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border bg-card px-3 py-2 text-sm">
            <label className="inline-flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                className="size-5"
                checked={allChecked}
                onChange={(event) => setChecked(event.target.checked ? Object.fromEntries(shown.map((entry) => [entry.id, true])) : {})}
              />
              <span>Select all ({shown.length})</span>
            </label>
            <span className="text-muted-foreground">{checkedIds.length} selected</span>
            {checkedIds.length ? (
              <Button type="button" variant="outline" className="ml-auto min-h-11 rounded-full text-red-600" disabled={pending} onClick={() => setBulkConfirm(true)}>
                <Trash2 className="size-4" /> Remove {checkedIds.length} from pre-planner
              </Button>
            ) : null}
          </div>
        ) : null}
        <ul className="grid gap-2">
          {shown.map((entry) => {
            const household = byId.get(entry.householdId);
            const projectName = data.projects.find((project) => project.id === entry.projectId)?.name;
            return (
              <li key={entry.id} className="panel rounded-2xl p-3">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                  {canChange ? (
                    <input
                      type="checkbox"
                      aria-label={`Select ${household?.name ?? "entry"}`}
                      className="mt-0.5 size-5 shrink-0"
                      checked={Boolean(checked[entry.id])}
                      onChange={(event) => setChecked((current) => ({ ...current, [entry.id]: event.target.checked }))}
                    />
                  ) : null}
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="font-heading text-base font-semibold leading-tight text-foreground [overflow-wrap:anywhere]">
                      {household ? <Link href={`/households?focus=${household.id}`} className="hover:text-primary">{household.name}</Link> : "Contact no longer on your list"}
                    </p>
                    {entry.reachedDate ? (
                      <p className="mt-0.5 text-[13px] leading-snug text-foreground">Reached {preplannerWhen(entry.reachedDate, entry.reachedTime)}</p>
                    ) : null}
                    <p className="text-[13px] leading-snug text-muted-foreground">
                      Reached by {reachedHowLabel(entry.reachedHow)}
                      {entry.repliedAt ? <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200">Replied</span> : null}
                      {entry.followUpHow ? ` · Follow up by ${reachedHowLabel(entry.followUpHow)}` : ""}
                    </p>
                    {entry.stage === "confirmed" && entry.requestedDate ? (
                      <p className="text-[13px] leading-snug text-foreground">Visit {preplannerWhen(entry.requestedDate, entry.requestedTime)}</p>
                    ) : null}
                    {projectName ? <p className="text-[13px] leading-snug text-muted-foreground">{projectName}</p> : null}
                    {household?.address ? <p className="truncate text-[13px] leading-snug text-muted-foreground">{household.address}</p> : null}
                    {entry.notesLog?.length ? (
                      <ol className="mt-1 grid gap-1">
                        {entry.notesLog.map((item, index) => (
                          <li key={`${item.at}-${index}`} className="text-[13px] leading-snug [overflow-wrap:anywhere]">
                            <span className="text-xs text-muted-foreground">
                              {new Date(item.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                              {item.by ? ` · ${item.by}` : ""}
                              {": "}
                            </span>
                            <span className="whitespace-pre-wrap text-foreground">{item.text}</span>
                          </li>
                        ))}
                      </ol>
                    ) : entry.notes ? (
                      <p className="mt-1 whitespace-pre-wrap text-[13px] leading-snug text-foreground [overflow-wrap:anywhere]">{entry.notes}</p>
                    ) : null}
                    {entry.scheduledAt ? (
                      <p className="mt-1 inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">Scheduled</p>
                    ) : null}
                  </div>
                  {canChange ? (
                    <div className="flex flex-wrap gap-1.5">
                      {entry.stage !== "confirmed" ? (
                        <Button type="button" className="min-h-11 rounded-full" onClick={() => setConfirming(entry)} disabled={pending}>
                          Confirm visit
                        </Button>
                      ) : null}
                      <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={() => setEditing(entry)} disabled={pending}>
                        <Pencil className="size-4" /> Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 rounded-full text-red-600"
                        disabled={pending}
                        onClick={() => {
                          if (!confirm("Remove this from the Pre-planner?")) return;
                          start(async () => {
                            if (practice.active) {
                              announce({ ok: true }, "Removed in practice mode");
                              return;
                            }
                            const result = await deletePreplannerEntryAction(entry.id);
                            announce(result, "Removed from the Pre-planner");
                          });
                        }}
                      >
                        <Trash2 className="size-4" /> Remove
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        </>
      )}
      <Dialog open={bulkConfirm} onOpenChange={setBulkConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove {checkedIds.length} from the Pre-planner?</DialogTitle>
            <DialogDescription>
              This only takes them off the Pre-planner list. The contacts stay in the CRM with all their details and visit history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={() => setBulkConfirm(false)}>Cancel</Button>
            <Button
              type="button"
              className="min-h-11 rounded-full bg-red-600 text-white hover:bg-red-700"
              disabled={pending || !checkedIds.length}
              onClick={() => start(async () => {
                if (practice.active) {
                  announce({ ok: true }, "Removed in practice mode");
                } else {
                  const result = await deletePreplannerEntriesAction(checkedIds);
                  announce(result, `Removed ${checkedIds.length} from the Pre-planner`);
                  if (!result.ok) return;
                }
                setChecked({});
                setBulkConfirm(false);
              })}
            >
              Remove {checkedIds.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PreplannerDialog
        open={Boolean(editing)}
        households={editing ? ([byId.get(editing.householdId)].filter(Boolean) as HouseholdView[]) : []}
        initial={editing}
        data={data}
        mode="edit"
        onClose={() => setEditing(null)}
      />
      <PreplannerDialog
        open={Boolean(confirming)}
        households={confirming ? ([byId.get(confirming.householdId)].filter(Boolean) as HouseholdView[]) : []}
        initial={confirming}
        data={data}
        mode="confirm"
        onClose={() => setConfirming(null)}
      />
      <PreplannerMessageDialog
        open={messaging}
        data={data}
        entries={shown}
        initialState={activeState || undefined}
        onClose={() => setMessaging(false)}
      />
    </div>
  );
}
