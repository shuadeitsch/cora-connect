"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Notice, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { logoutAction, saveOrganizationAction } from "@/lib/actions";
import { geocodeAddress } from "@/lib/geo";
import { AccountPassword } from "@/components/account-password";
import type { AppData, OrgInput } from "@/lib/types";

export function SettingsView({ data, initialTab, recovery }: { data: AppData; initialTab: string; recovery: boolean }) {
  const allowed = ["house", "account"];
  const tab = allowed.includes(initialTab) ? initialTab : "house";
  return (
    <div className="p-4 sm:p-6">
      <PageHeader title="Settings" crumb="Settings" />
      {!data.viewer.canManage ? (
        <p className="mb-3 text-sm text-mutedink">Organization settings can be changed by an admin. Your password is on the Account tab.</p>
      ) : null}
      <Tabs key={tab} defaultValue={tab}>
        <TabsList className="mb-4 h-auto flex-wrap bg-card">
          <TabsTrigger value="house">Chabad House</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>
        <TabsContent value="house"><HouseForm data={data} /></TabsContent>
        <TabsContent value="account">
          <AccountPassword name={data.viewer.name} email={data.viewer.email} recovery={recovery} />
          <form action={logoutAction} className="mt-4">
            <Button type="submit" variant="outline" className="min-h-11 rounded-full">Log out</Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const HOUSE_STATES = ["Maine", "New Hampshire", "Wisconsin"];
const STATE_CODES: Record<string, string> = { ME: "Maine", NH: "New Hampshire", WI: "Wisconsin" };

/** Read the stored name into the new one-field form. Unknown old text maps to Cora (admin) or his state. */
function houseValue(stored: string, admin: boolean, states: string[]) {
  const text = stored.trim();
  if (text === "Cora") return "Cora";
  const hit = HOUSE_STATES.find((name) => text.toLowerCase() === `chabad of ${name}`.toLowerCase() || text.toLowerCase() === name.toLowerCase());
  if (hit) return `Chabad of ${hit}`;
  const mine = states.map((code) => STATE_CODES[code.toUpperCase()] ?? HOUSE_STATES.find((name) => name.toLowerCase() === code.toLowerCase())).find(Boolean);
  if (!admin && mine) return `Chabad of ${mine}`;
  return admin ? "Cora" : `Chabad of ${HOUSE_STATES[0]}`;
}

function HouseForm({ data }: { data: AppData }) {
  const router = useRouter();
  const org = data.org;
  const admin = data.viewer.role === "admin";
  const [form, setForm] = useState<OrgInput>({
    name: org.name,
    // One field now: "Chabad of <state>" (or "Cora"). The old Organization name stays stored as is.
    chabadHouseName: houseValue(org.chabadHouseName, admin, data.viewer.territory.map((row) => row.state)),
    street: org.street,
    city: org.city,
    state: org.state,
    zip: org.zip,
    country: org.country,
    defaultState: org.defaultState,
    startLat: org.startLat?.toString() ?? "",
    startLng: org.startLng?.toString() ?? "",
    useHouseAsStart: org.startLat != null && org.lat != null && org.startLat === org.lat && org.startLng === org.lng,
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const house = form.chabadHouseName === "Cora" ? "Cora" : HOUSE_STATES.find((name) => form.chabadHouseName === `Chabad of ${name}`) ?? (admin ? "Cora" : HOUSE_STATES[0]);

  function set<K extends keyof OrgInput>(key: K, value: OrgInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className="grid max-w-2xl gap-3 panel rounded-3xl p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError("");
        setMessage("");
        start(async () => {
          const result = await saveOrganizationAction(form);
          if (!result.ok) setError(result.error);
          else {
            setMessage("Chabad House and start point saved.");
            router.refresh();
          }
        });
      }}
    >
      <label className="grid gap-1 text-sm">
        <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Chabad House</span>
        <span className="flex items-center gap-2">
          {house !== "Cora" ? <span className="font-medium text-foreground">Chabad of</span> : null}
          <select aria-label="Chabad House state" className="h-10 rounded-lg border border-input bg-card px-3 text-sm" value={house} onChange={(event) => set("chabadHouseName", event.target.value === "Cora" ? "Cora" : `Chabad of ${event.target.value}`)}>
            {admin ? <option value="Cora">Cora (all states)</option> : null}
            {HOUSE_STATES.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </span>
      </label>
      <label className="grid gap-1 text-sm"><span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Street</span><Input value={form.street} onChange={(event) => set("street", event.target.value)} /></label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm"><span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">City</span><Input value={form.city} onChange={(event) => set("city", event.target.value)} /></label>
        <label className="grid gap-1 text-sm"><span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">State</span><Input value={form.state} onChange={(event) => set("state", event.target.value)} /></label>
        <label className="grid gap-1 text-sm"><span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">ZIP</span><Input value={form.zip} onChange={(event) => set("zip", event.target.value)} /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm"><span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Country</span><Input value={form.country} onChange={(event) => set("country", event.target.value)} /></label>
        <label className="grid gap-1 text-sm"><span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Map starting state</span><Input value={form.defaultState} onChange={(event) => set("defaultState", event.target.value)} placeholder="Optional" /></label>
      </div>
      <label className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-2 text-sm">
        Use the Chabad House as the route start point
        <Switch checked={form.useHouseAsStart} onCheckedChange={(checked) => set("useHouseAsStart", checked)} />
      </label>
      {form.useHouseAsStart ? null : (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm"><span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Start latitude</span><Input value={form.startLat} onChange={(event) => set("startLat", event.target.value)} /></label>
          <label className="grid gap-1 text-sm"><span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Start longitude</span><Input value={form.startLng} onChange={(event) => set("startLng", event.target.value)} /></label>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          onClick={() => {
            const point = geocodeAddress(form.city, form.state, form.street);
            if (!point) {
              setError("That city is outside the built-in rural gazetteer. Enter coordinates directly.");
              return;
            }
            set("startLat", String(point.lat));
            set("startLng", String(point.lng));
            set("useHouseAsStart", false);
            setError("");
            setMessage("Filled the start point from the address. Save to keep it.");
          }}
        >
          Look up coordinates
        </Button>
        <Button type="submit" className="rounded-full" disabled={pending || !data.viewer.canManage}>{pending ? "Saving…" : "Save house"}</Button>
      </div>
      {error ? <Notice>{error}</Notice> : null}
      {message ? <Notice tone="ok">{message}</Notice> : null}
    </form>
  );
}
