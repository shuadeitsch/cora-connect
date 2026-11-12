"use client";

import { useEffect, useState, useTransition } from "react";
import { usePractice } from "@/components/practice-provider";
import { Notice } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUndoToast } from "@/components/undo-toast";
import { savePreplannerEntryAction } from "@/lib/actions";
import { PREPLANNER_REACHED } from "@/lib/preplanner";
import type { HouseholdView, PreplannerEntry } from "@/lib/types";

export function PreplannerDialog({
  open,
  households,
  initial,
  onClose,
}: {
  open: boolean;
  households: HouseholdView[];
  initial?: PreplannerEntry | null;
  onClose: () => void;
}) {
  const announce = useUndoToast();
  const practice = usePractice();
  const [requestedDate, setRequestedDate] = useState("");
  const [requestedTime, setRequestedTime] = useState("");
  const [reachedHow, setReachedHow] = useState("phone");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    setRequestedDate(initial?.requestedDate ?? "");
    setRequestedTime((initial?.requestedTime ?? "").slice(0, 5));
    setReachedHow(initial?.reachedHow ?? "phone");
    setNotes(initial?.notes ?? "");
    setError("");
  }, [open, initial]);

  const title = initial
    ? "Edit Pre-planner entry"
    : households.length === 1
      ? `Add ${households[0]!.name} to the Pre-planner`
      : `Add ${households.length} contacts to the Pre-planner`;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-foreground">{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Use this when a contact says they are ready for a visit. The date and time are both required.
        </p>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!requestedDate || !requestedTime) {
              setError("Pick the requested date and time.");
              return;
            }
            start(async () => {
              if (practice.active) {
                announce({ ok: true }, households.length > 1 ? "Added in practice mode" : "Added in practice mode");
                onClose();
                return;
              }
              let failed = "";
              if (initial) {
                const result = await savePreplannerEntryAction({
                  id: initial.id,
                  householdId: initial.householdId,
                  requestedDate,
                  requestedTime,
                  reachedHow,
                  notes,
                });
                if (!result.ok) failed = result.error;
                else announce(result, "Pre-planner entry updated");
              } else {
                for (const household of households) {
                  const result = await savePreplannerEntryAction({
                    householdId: household.id,
                    requestedDate,
                    requestedTime,
                    reachedHow,
                    notes,
                  });
                  if (!result.ok) {
                    failed = result.error;
                    break;
                  }
                }
                if (!failed) announce({ ok: true }, households.length === 1 ? "Added to the Pre-planner" : `Added ${households.length} contacts to the Pre-planner`);
              }
              if (failed) {
                setError(failed);
                return;
              }
              onClose();
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Requested date</span>
              <Input type="date" required className="h-11" value={requestedDate} onChange={(event) => setRequestedDate(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Requested time</span>
              <Input type="time" required className="h-11" value={requestedTime} onChange={(event) => setRequestedTime(event.target.value)} />
            </label>
          </div>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">How they reached out</span>
            <select
              className="h-11 rounded-xl border border-input bg-card px-3 text-base sm:text-sm"
              value={reachedHow}
              onChange={(event) => setReachedHow(event.target.value)}
              aria-label="How they reached out"
            >
              {PREPLANNER_REACHED.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Conversation notes</span>
            <Textarea className="min-h-28" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="The back-and-forth — what they asked for, and what you told them." />
          </label>
          {error ? <Notice>{error}</Notice> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-11 rounded-full" disabled={pending || (!initial && !households.length)}>
              {pending ? "Saving…" : initial ? "Save changes" : "Add to Pre-planner"}
            </Button>
            <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
