"use client";

import { useMemo, useState, useTransition } from "react";
import { Notice } from "@/components/page-header";
import { useUndoToast } from "@/components/undo-toast";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  IMPORT_AI_PROMPT,
  IMPORT_FIELDS,
  IMPORT_TEMPLATE_CSV,
  canonicalImportMap,
  guessImportMap,
  mapContacts,
  parseCsv,
  type ImportField,
} from "@/lib/csv";
import { CONTACT_PROJECTS } from "@/lib/constants";
import { importContactsAction } from "@/lib/actions";
import { planImport } from "@/lib/import-plan";
import type { AppData } from "@/lib/types";

const selectClass = "h-10 w-full rounded-xl border border-input bg-card px-3 text-sm";

export function ImportContacts({ open, data, onClose }: { open: boolean; data: AppData; onClose: () => void }) {
  const toast = useToast();
  const announce = useUndoToast();
  const [text, setText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<ImportField, string>>(() => guessImportMap([]));
  const [canonical, setCanonical] = useState(false);
  const [visitedFallback, setVisitedFallback] = useState("");
  const [shared, setShared] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const [savedCounts, setSavedCounts] = useState("");
  const [pending, start] = useTransition();
  const shliach = data.viewer.role === "shliach";

  const rows = useMemo(() => {
    if (!text || !headers.length) return [];
    return mapContacts(text, mapping).contacts;
  }, [text, headers.length, mapping]);

  const plan = useMemo(() => {
    if (!rows.length) return null;
    const existing = data.households.map((household) => ({
      id: household.id,
      name: household.name,
      phone: household.people[0]?.phone ?? "",
      email: household.people[0]?.email ?? "",
      street: household.street,
      city: household.city,
      visited: household.contactVisits.map((visit) => visit.visited).filter(Boolean),
    }));
    return planImport(rows, existing, {
      territory: shliach ? data.viewer.territory : [],
      fallbackVisited: visitedFallback,
    });
  }, [rows, data.households, data.viewer.territory, shliach, visitedFallback]);

  async function loadFile(file: File) {
    const lower = file.name.toLowerCase();
    let next = "";
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheet = book.Sheets[book.SheetNames[0] ?? ""];
      next = sheet ? XLSX.utils.sheet_to_csv(sheet) : "";
    } else {
      next = await file.text();
    }
    const table = parseCsv(next);
    const head = (table[0] ?? []).map((header) => header.trim()).filter(Boolean);
    const exact = canonicalImportMap(head);
    setText(next);
    setHeaders(head);
    setCanonical(Boolean(exact));
    setMapping(exact ?? guessImportMap(head));
    setError(next.trim() ? "" : "That file had no rows.");
    setSummary("");
    setSavedCounts("");
  }

  function downloadTemplate() {
    const blob = new Blob([`\uFEFF${IMPORT_TEMPLATE_CSV}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cora-contacts-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(IMPORT_AI_PROMPT);
      toast({ title: "Instructions copied" });
    } catch {
      toast({ title: "Select the instructions and copy them", tone: "error" });
    }
  }

  const equation = plan ? `${plan.rowsRead} rows read = ${plan.created} contacts created + ${plan.visitsMerged} visits merged` : "";

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-foreground">Import contacts</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Every spreadsheet row is imported. One row is one visit. A row is merged onto a contact only when the name matches and the phone or email matches, and Visited is different. Every other row becomes its own contact.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={downloadTemplate}>Download template</Button>
          <Button type="button" variant="outline" className="rounded-full" onClick={() => void copyPrompt()}>Copy AI instructions</Button>
        </div>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-2xl border bg-muted/40 p-3 text-xs text-foreground">{IMPORT_AI_PROMPT}</pre>
        <input
          type="file"
          accept=".csv,text/csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="text-sm"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void loadFile(file);
          }}
        />
        {canonical ? (
          <p className="text-sm text-foreground">This file matches the Cora contact template. Column matching is skipped.</p>
        ) : null}
        {headers.length && !canonical ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {IMPORT_FIELDS.map((field) => (
              <label key={field.key} className="grid gap-1 text-sm">
                <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{field.label}</span>
                <select
                  className={selectClass}
                  value={mapping[field.key]}
                  onChange={(event) => setMapping({ ...mapping, [field.key]: event.target.value })}
                >
                  <option value="">Skip</option>
                  {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                </select>
              </label>
            ))}
          </div>
        ) : null}
        <label className="grid gap-1 text-sm">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Visited when the row leaves it blank</span>
          <select className={selectClass} value={visitedFallback} onChange={(event) => setVisitedFallback(event.target.value)}>
            <option value="">Unsorted</option>
            {CONTACT_PROJECTS.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        {shliach ? (
          <label className="flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm">
            <span>
              <span className="block font-medium text-foreground">Share with Cora</span>
              <span className="text-xs text-muted-foreground">Used when a row does not say yes or no. Shared contacts also show on the Cora overview.</span>
            </span>
            <input type="checkbox" className="size-5 accent-primary" checked={shared} onChange={(event) => setShared(event.target.checked)} />
          </label>
        ) : null}
        {savedCounts ? (
          <p className="text-sm text-foreground">{savedCounts}</p>
        ) : plan ? (
          <p className="text-sm text-foreground">
            {equation}. {plan.possible} possible duplicate{plan.possible === 1 ? "" : "s"}.
          </p>
        ) : null}
        {plan && !savedCounts ? (
          <div>
            <div className="max-h-48 overflow-auto rounded-2xl border">
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] tracking-wide text-muted-foreground uppercase">
                  <tr className="border-b">
                    {["Name", "Phone", "Visited", "Plan"].map((label) => <th key={label} className="px-2 py-2 font-medium">{label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {plan.contacts.slice(0, 12).map((contact) => (
                    <tr key={contact.id} className="border-b last:border-0">
                      <td className="px-2 py-1.5">{contact.name}</td>
                      <td className="px-2 py-1.5">{contact.phone || "—"}</td>
                      <td className="px-2 py-1.5">{contact.visits.map((visit) => visit.visited).filter(Boolean).join(", ") || "—"}</td>
                      <td className="px-2 py-1.5">
                        {contact.existingId
                          ? "Extra visit"
                          : contact.possibleDuplicate
                            ? contact.duplicateReason || "Possible duplicate"
                            : "New contact"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {error ? <Notice>{error}</Notice> : null}
        {summary ? <Notice tone="ok">{summary}</Notice> : null}
        <div className="flex justify-end">
          <Button
            className="rounded-full"
            disabled={pending || !plan?.rowsRead}
            onClick={() => {
              setError("");
              start(async () => {
                const result = await importContactsAction({
                  visitedFallback,
                  ownerId: "",
                  sharedWithCora: shliach ? shared : true,
                  rows,
                });
                if (!result.ok) {
                  setError(result.error);
                  toast({ title: result.error, tone: "error" });
                  return;
                }
                const dataResult = result.data;
                const line = dataResult
                  ? `${dataResult.rowsRead} rows read = ${dataResult.created} contacts created + ${dataResult.visitsMerged} visits merged. ${dataResult.possible} possible duplicate${dataResult.possible === 1 ? "" : "s"}.`
                  : "Import finished.";
                const extra = [
                  ...(dataResult?.errors ?? []),
                  ...(dataResult?.warnings ?? []),
                ].slice(0, 4).join(" ");
                setSavedCounts(line);
                setSummary(extra);
                announce(result, "Undo import");
              });
            }}
          >
            {pending ? "Importing…" : "Import all rows"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
