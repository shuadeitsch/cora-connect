"use client";

import { usePractice } from "@/components/practice-provider";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Notice, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { logoutAction, saveOrganizationAction } from "@/lib/actions";
import { saveShliachPrefsAction } from "@/lib/shliach-prefs-actions";
import { AccountPassword } from "@/components/account-password";
import { AvatarPicker } from "@/components/avatar-picker";
import { ThemePicker } from "@/components/theme-picker";
import { TeamView } from "@/components/team-view";
import { TwilioSettingsCard } from "@/components/twilio-settings-card";
import { EmailTemplatesCard } from "@/components/email-templates-card";
import type { AppData, OrgInput } from "@/lib/types";

function AccountSection({ data, recovery, twilioConnected = false }: { data: AppData; recovery: boolean; twilioConnected?: boolean }) {
  return (
    <>
      <AccountPassword name={data.viewer.name} email={data.viewer.email} recovery={recovery} />
      <AvatarPicker name={data.viewer.name} url={data.viewer.avatarUrl} />
      <ThemePicker saved={data.viewer.theme} backgroundUrl={data.viewer.backgroundUrl ?? null} themeMatchPhoto={Boolean(data.viewer.themeMatchPhoto)} themeColors={data.viewer.themeColors ?? null} />
      {data.viewer.role === "shliach" ? <ShliachPrefsForm data={data} /> : null}
      {data.viewer.role === "admin" || data.viewer.role === "shliach" ? <TwilioSettingsCard connected={twilioConnected} /> : null}
      <form action={logoutAction} className="mt-4">
        <Button type="submit" variant="outline" className="min-h-11 rounded-full">Log out</Button>
      </form>
    </>
  );
}

export function SettingsView({ data, initialTab, recovery, twilioConnected = false }: { data: AppData; initialTab: string; recovery: boolean; twilioConnected?: boolean }) {
  const bochur = data.viewer.role === "bochur";
  const shliach = data.viewer.role === "shliach";
  // Bochur: Account only (name, picture, theme, password). No Chabad house / org settings.
  if (bochur) {
    return (
      <div className="p-4 sm:p-6">
        <PageHeader title="Settings" crumb="Settings" description="Your account: name, picture, theme, and password." />
        <AccountSection data={data} recovery={recovery} twilioConnected={twilioConnected} />
      </div>
    );
  }
  // Shliach: My Team lives here (not in the sidebar). Admins keep /team.
  const allowed = shliach ? ["house", "account", "team"] : data.viewer.canManage ? ["house", "account", "templates"] : ["house", "account"];
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
          {data.viewer.canManage ? <TabsTrigger value="templates">Email templates</TabsTrigger> : null}
          {shliach ? <TabsTrigger value="team">My Team</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="house"><HouseForm data={data} /></TabsContent>
        <TabsContent value="account">
          <AccountSection data={data} recovery={recovery} twilioConnected={twilioConnected} />
        </TabsContent>
        {data.viewer.canManage ? (
          <TabsContent value="templates">
            <EmailTemplatesCard templates={data.outreachTemplates} canManage={data.viewer.canManage} />
          </TabsContent>
        ) : null}
        {shliach ? (
          <TabsContent value="team">
            <TeamView data={data} startInvite={false} embedded />
          </TabsContent>
        ) : null}
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
            setMessage("Chabad House saved.");
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
      <label className="grid gap-1 text-sm"><span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Country</span><Input value={form.country} onChange={(event) => set("country", event.target.value)} /></label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="rounded-full" disabled={pending || !data.viewer.canManage}>{pending ? "Saving…" : "Save house"}</Button>
      </div>
      {error ? <Notice>{error}</Notice> : null}
      {message ? <Notice tone="ok">{message}</Notice> : null}
    </form>
  );
}


function ShliachPrefsForm({ data }: { data: AppData }) {
  const router = useRouter();
  const practice = usePractice();
  const live = practice.mergeData(data);
  const [pending, start] = useTransition();
  const [shareNew, setShareNew] = useState(Boolean(live.viewer.shareNewWithBochurim));
  const [editPlanner, setEditPlanner] = useState(Boolean(live.viewer.bochurimEditPlanner));
  const [seePlanner, setSeePlanner] = useState(live.viewer.bochurimSeePlannerDefault !== false);
  const [message, setMessage] = useState("");
  const preview = Boolean(data.viewer.preview);
  return (
    <form
      className="panel mt-4 space-y-3 rounded-3xl p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage("");
        if (practice.active) {
          practice.setPref("shareNewWithBochurim", shareNew);
          practice.setPref("bochurimEditPlanner", editPlanner);
          practice.setPref("bochurimSeePlannerDefault", seePlanner);
          setMessage("Saved in practice mode.");
          return;
        }
        start(async () => {
          const result = await saveShliachPrefsAction({ shareNewWithBochurim: shareNew, bochurimEditPlanner: editPlanner, bochurimSeePlannerDefault: seePlanner });
          if (!result.ok) setMessage(result.error);
          else { setMessage("Saved."); router.refresh(); }
        });
      }}
    >
      <h2 className="font-heading text-lg font-semibold text-foreground">Bochurim</h2>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 size-4" checked={shareNew} disabled={pending} onChange={(e) => {
          const next = e.target.checked;
          setShareNew(next);
          if (practice.active) practice.setPref("shareNewWithBochurim", next);
        }} />
        <span>
          <span className="block">Share new contacts with bochurim by default</span>
          <span className="text-xs text-muted-foreground">New contacts start shared. You can change each one on the contact.</span>
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 size-4" checked={seePlanner} disabled={pending} onChange={(e) => setSeePlanner(e.target.checked)} />
        <span>
          <span className="block">Bochurim can see the planner</span>
          <span className="text-xs text-muted-foreground">Sets every existing day and the default for new days. You can still change a day on the planner.</span>
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 size-4" checked={editPlanner} disabled={pending} onChange={(e) => setEditPlanner(e.target.checked)} />
        <span>
          <span className="block">Bochurim can edit the planner</span>
          <span className="text-xs text-muted-foreground">Sets every existing day and the default for new days. You can still change a day on the planner.</span>
        </span>
      </label>
      {message ? <Notice tone={message.startsWith("Saved") ? "ok" : "error"}>{message}</Notice> : null}
      <Button type="submit" className="rounded-full" disabled={pending}>{pending ? "Saving…" : preview ? "Save (practice)" : "Save"}</Button>
    </form>
  );
}
