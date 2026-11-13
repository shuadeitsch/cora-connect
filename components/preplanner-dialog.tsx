"use client";

import { useEffect, useState, useTransition } from "react";
import { usePractice } from "@/components/practice-provider";
import { Notice } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUndoToast } from "@/components/undo-toast";
import { confirmPreplannerVisitAction, savePreplannerEntryAction } from "@/lib/actions";
import { defaultPreplannerProjectId, PREPLANNER_REACHED } from "@/lib/preplanner";
import type { AppData, HouseholdView, PreplannerEntry } from "@/lib/types";

export function PreplannerDialog({
  open,
  households,
  initial,
  data,
  mode = "reached",
  onClose,
}: {
  open: boolean;
  households: HouseholdView[];
  initial?: PreplannerEntry | null;
  data?: AppData;
  mode?: "reached" | "confirm" | "edit";
  onClose: () => void;
}) {
  const announce = useUndoToast();
  const practice = usePractice();
  const projects = data?.projects ?? [];
  const [reachedDate, setReachedDate] = useState("");
  const [reachedTime, setReachedTime] = useState("");
  const [reachedHow, setReachedHow] = useState("phone");
  const [followUpHow, setFollowUpHow] = useState("phone");
  const [requestedDate, setRequestedDate] = useState("");
  const [requestedTime, setRequestedTime] = useState("");
  const [notes, setNotes] = useState("");
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const confirming = mode === "confirm" || (mode === "edit" && initial?.stage === "confirmed");

  useEffect(() => {
    if (!open) return;
    setReachedDate(initial?.reachedDate ?? new Date().toISOString().slice(0, 10));
    setReachedTime((initial?.reachedTime ?? "").slice(0, 5));
    setReachedHow(initial?.reachedHow ?? "phone");
    setFollowUpHow(initial?.followUpHow ?? initial?.reachedHow ?? "phone");
    setRequestedDate(initial?.requestedDate ?? "");
    setRequestedTime((initial?.requestedTime ?? "").slice(0, 5));
    setNotes("");
    setProjectId(initial?.projectId ?? defaultPreplannerProjectId(projects));
    setError("");
  }, [open, initial, projects]);

  const title = confirming && initial
    ? "Confirm visit"
    : initial
      ? "Edit Pre-planner entry"
      : households.length === 1
        ? `Log a reach-out to ${households[0]!.name}`
        : `Log a reach-out to ${households.length} contacts`;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-foreground">{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {confirming
            ? "A confirmed visit needs a date and time. The reach-out history is kept."
            : "Record when and how you reached this contact. A visit date is only needed when you confirm the visit."}
        </p>
        {initial?.notesLog?.length ? (
          <ol className="grid gap-2 rounded-2xl bg-muted/50 p-3 text-sm">
            {initial.notesLog.map((item, index) => (
              <li key={`${item.at}-${index}`}>
                <p className="text-xs text-muted-foreground">
                  {new Date(item.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  {item.by ? ` · ${item.by}` : ""}
                </p>
                <p className="whitespace-pre-wrap text-foreground">{item.text}</p>
              </li>
            ))}
          </ol>
        ) : null}
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!confirming && (!reachedDate || !reachedTime)) {
              setError("Pick when you reached out, including the time.");
              return;
            }
            if (confirming && (!requestedDate || !requestedTime)) {
              setError("Pick the visit date and time.");
              return;
            }
            start(async () => {
              if (practice.active) {
                announce({ ok: true }, "Saved in practice mode");
                onClose();
                return;
              }
              let failed = "";
              if (confirming && initial) {
                const result = await confirmPreplannerVisitAction({
                  id: initial.id,
                  requestedDate,
                  requestedTime,
                  notes,
                });
                if (!result.ok) failed = result.error;
                else announce(result, "Visit confirmed");
              } else if (initial) {
                const result = await savePreplannerEntryAction({
                  id: initial.id,
                  householdId: initial.householdId,
                  reachedDate,
                  reachedTime,
                  reachedHow,
                  followUpHow,
                  requestedDate: requestedDate || undefined,
                  requestedTime: requestedTime || undefined,
                  notes,
                  projectId: projectId || null,
                  stage: initial.stage,
                });
                if (!result.ok) failed = result.error;
                else announce(result, "Pre-planner entry updated");
              } else {
                for (const household of households) {
                  const result = await savePreplannerEntryAction({
                    householdId: household.id,
                    reachedDate,
                    reachedTime,
                    reachedHow,
                    followUpHow,
                    notes,
                    projectId: projectId || null,
                    stage: "reached_out",
                  });
                  if (!result.ok) {
                    failed = result.error;
                    break;
                  }
                }
                if (!failed) announce({ ok: true }, households.length === 1 ? "Added to Reached out" : `Added ${households.length} contacts to Reached out`);
              }
              if (failed) {
                setError(failed);
                return;
              }
              onClose();
            });
          }}
        >
          {!confirming || mode === "edit" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">Reached out — date</span>
                  <Input type="date" required={!confirming} className="h-11" value={reachedDate} onChange={(event) => setReachedDate(event.target.value)} />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">Reached out — time</span>
                  <Input type="time" required={!confirming} className="h-11" value={reachedTime} onChange={(event) => setReachedTime(event.target.value)} />
                </label>
              </div>
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">How they were reached</span>
                <select className="h-11 rounded-xl border border-input bg-card px-3 text-base sm:text-sm" value={reachedHow} onChange={(event) => setReachedHow(event.target.value)} aria-label="How they were reached">
                  {PREPLANNER_REACHED.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Follow up by</span>
                <select className="h-11 rounded-xl border border-input bg-card px-3 text-base sm:text-sm" value={followUpHow} onChange={(event) => setFollowUpHow(event.target.value)} aria-label="Follow-up channel">
                  {PREPLANNER_REACHED.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
              {projects.length ? (
                <label className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">Project</span>
                  <select className="h-11 rounded-xl border border-input bg-card px-3 text-base sm:text-sm" value={projectId} onChange={(event) => setProjectId(event.target.value)} aria-label="Project">
                    {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                  </select>
                </label>
              ) : null}
            </>
          ) : null}
          {confirming ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Visit date</span>
                <Input type="date" required className="h-11" value={requestedDate} onChange={(event) => setRequestedDate(event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Visit time</span>
                <Input type="time" required className="h-11" value={requestedTime} onChange={(event) => setRequestedTime(event.target.value)} />
              </label>
            </div>
          ) : null}
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{initial ? "Add a note" : "Conversation notes"}</span>
            <Textarea className="min-h-24" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="The back-and-forth — what was said, and what you'll follow up with." />
          </label>
          {error ? <Notice>{error}</Notice> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-11 rounded-full" disabled={pending || (!initial && !households.length)}>
              {pending ? "Saving…" : confirming ? "Confirm visit" : initial ? "Save changes" : "Add to Reached out"}
            </Button>
            <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
