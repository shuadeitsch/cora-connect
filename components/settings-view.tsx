"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Notice, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  deleteCategoryAction,
  deleteFieldAction,
  deleteProjectAction,
  saveCategoryAction,
  saveFieldAction,
  saveOrganizationAction,
  saveProjectAction,
} from "@/lib/actions";
import { geocodeAddress } from "@/lib/geo";
import { AccountPassword } from "@/components/account-password";
import type { AppData, CategoryKind, FieldType, OrgInput } from "@/lib/types";

const field = "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm";

export function SettingsView({ data, initialTab, recovery }: { data: AppData; initialTab: string; recovery: boolean }) {
  const allowed = ["house", "categories", "projects", "fields", "account"];
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
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="fields">Custom fields</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>
        <TabsContent value="house"><HouseForm data={data} /></TabsContent>
        <TabsContent value="categories"><Categories data={data} /></TabsContent>
        <TabsContent value="projects"><Projects data={data} /></TabsContent>
        <TabsContent value="fields"><Fields data={data} /></TabsContent>
        <TabsContent value="account">
          <AccountPassword name={data.viewer.name} email={data.viewer.email} recovery={recovery} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HouseForm({ data }: { data: AppData }) {
  const router = useRouter();
  const org = data.org;
  const [form, setForm] = useState<OrgInput>({
    name: org.name,
    chabadHouseName: org.chabadHouseName,
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
      <label className="grid gap-1 text-sm"><span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Organization</span><Input value={form.name} onChange={(event) => set("name", event.target.value)} /></label>
      <label className="grid gap-1 text-sm"><span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Chabad House name</span><Input value={form.chabadHouseName} onChange={(event) => set("chabadHouseName", event.target.value)} /></label>
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

function Categories({ data }: { data: AppData }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<CategoryKind>("regular");
  const [intervalDays, setIntervalDays] = useState("60");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const regular = data.categories.filter((category) => category.kind === "regular");
  const scheduled = data.categories.filter((category) => category.kind === "scheduled");

  function add(event: FormEvent) {
    event.preventDefault();
    start(async () => {
      const result = await saveCategoryAction({ name, kind, intervalDays });
      if (!result.ok) setError(result.error);
      else {
        setName("");
        setError("");
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this category? Households keep their other data.")) return;
    start(async () => {
      const result = await deleteCategoryAction(id);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CategoryList title="Regular categories" rows={regular.map((category) => ({ id: category.id, label: category.name }))} onDelete={data.viewer.canManage ? remove : undefined} />
      <CategoryList title="Visit schedule" rows={scheduled.map((category) => ({ id: category.id, label: category.intervalDays ? `${category.name} · every ${category.intervalDays} days` : category.name }))} onDelete={data.viewer.canManage ? remove : undefined} />
      {data.viewer.canManage ? (
        <form className="grid gap-2 panel rounded-3xl p-4 lg:col-span-2" onSubmit={add}>
          <h2 className="font-heading text-lg font-semibold text-foreground">Add a category</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Honey cake" required />
            <select className={field} value={kind} onChange={(event) => setKind(event.target.value as CategoryKind)}>
              <option value="regular">Regular</option>
              <option value="scheduled">Scheduled</option>
            </select>
            {kind === "scheduled" ? <Input value={intervalDays} onChange={(event) => setIntervalDays(event.target.value)} type="number" min={1} placeholder="Days between visits" /> : <span />}
          </div>
          {error ? <Notice>{error}</Notice> : null}
          <Button type="submit" className="w-fit rounded-full" disabled={pending}>{pending ? "Saving…" : "Add category"}</Button>
        </form>
      ) : null}
    </div>
  );
}

function CategoryList({ title, rows, onDelete }: { title: string; rows: { id: string; label: string }[]; onDelete?: (id: string) => void }) {
  return (
    <section className="panel rounded-3xl p-4">
      <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
      <ul className="mt-2 divide-y">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <span>{row.label}</span>
            {onDelete ? <button type="button" className="text-xs text-red-600" onClick={() => onDelete(row.id)}>Delete</button> : null}
          </li>
        ))}
        {!rows.length ? <li className="py-4 text-sm text-mutedink">None yet.</li> : null}
      </ul>
    </section>
  );
}

function Projects({ data }: { data: AppData }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <section className="max-w-xl panel rounded-3xl p-4">
      <h2 className="font-heading text-lg font-semibold text-foreground">Projects</h2>
      <p className="text-sm text-mutedink">Group households and routes, for example a summer visitation or a campus list.</p>
      <ul className="mt-3 divide-y">
        {data.projects.map((project) => (
          <li key={project.id} className="flex items-center justify-between py-2 text-sm">
            {project.name}
            {data.viewer.canManage ? (
              <button
                type="button"
                className="text-xs text-red-600"
                onClick={() => {
                  if (!confirm(`Delete ${project.name}?`)) return;
                  start(async () => {
                    const result = await deleteProjectAction(project.id);
                    if (!result.ok) setError(result.error);
                    else router.refresh();
                  });
                }}
              >
                Delete
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {data.viewer.canManage ? (
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            start(async () => {
              const result = await saveProjectAction({ name });
              if (!result.ok) setError(result.error);
              else {
                setName("");
                setError("");
                router.refresh();
              }
            });
          }}
        >
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="New project" className="max-w-xs" required />
          <Button type="submit" className="rounded-full" disabled={pending}>Add</Button>
        </form>
      ) : null}
      {error ? <div className="mt-2"><Notice>{error}</Notice></div> : null}
    </section>
  );
}

function Fields({ data }: { data: AppData }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [fieldType, setFieldType] = useState<FieldType>("text");
  const [options, setOptions] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <section className="max-w-xl panel rounded-3xl p-4">
      <h2 className="font-heading text-lg font-semibold text-foreground">Custom fields</h2>
      <p className="text-sm text-mutedink">Extra facts that show up on every household, such as a mezuzah check or a preferred language.</p>
      <ul className="mt-3 divide-y">
        {data.customFields.map((item) => (
          <li key={item.id} className="flex items-center justify-between py-2 text-sm">
            <span>{item.name} <span className="text-mutedink">· {item.fieldType}{item.options.length ? ` (${item.options.join(", ")})` : ""}</span></span>
            {data.viewer.canManage ? (
              <button
                type="button"
                className="text-xs text-red-600"
                onClick={() => {
                  if (!confirm(`Delete ${item.name}?`)) return;
                  start(async () => {
                    const result = await deleteFieldAction(item.id);
                    if (!result.ok) setError(result.error);
                    else router.refresh();
                  });
                }}
              >
                Delete
              </button>
            ) : null}
          </li>
        ))}
        {!data.customFields.length ? <li className="py-3 text-sm text-mutedink">No custom fields yet.</li> : null}
      </ul>
      {data.viewer.canManage ? (
        <form
          className="mt-3 grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            start(async () => {
              const result = await saveFieldAction({ name, fieldType, options });
              if (!result.ok) setError(result.error);
              else {
                setName("");
                setOptions("");
                setError("");
                router.refresh();
              }
            });
          }}
        >
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Field name" required />
          <select className={field} value={fieldType} onChange={(event) => setFieldType(event.target.value as FieldType)}>
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="select">Choices</option>
          </select>
          {fieldType === "select" ? <Input value={options} onChange={(event) => setOptions(event.target.value)} placeholder="Yes, No, Ask again" /> : null}
          {error ? <Notice>{error}</Notice> : null}
          <Button type="submit" className="w-fit rounded-full" disabled={pending}>Add field</Button>
        </form>
      ) : null}
    </section>
  );
}

