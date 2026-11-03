/**
 * Inserts one contact as an approved admin and one as an approved shliach
 * through the anon/publishable key, with RLS enabled.
 *
 * The save path does not use INSERT ... RETURNING. A follow-up select checks
 * that the committed row is visible. Set:
 *   RLS_ADMIN_EMAIL, RLS_ADMIN_PASSWORD
 *   RLS_SHLIACH_EMAIL, RLS_SHLIACH_PASSWORD
 * The script reads .env.local for the Supabase URL and anon key.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnv(path: string) {
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index);
    if (!process.env[key]) process.env[key] = trimmed.slice(index + 1);
  }
}

loadEnv(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
const orgId = "c0a00000-0000-4000-8000-000000000001";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} to run the RLS insert test.`);
  return value;
}

async function signIn(email: string, password: string) {
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign in ${email}: ${error.message}`);
  return client;
}

async function insertContact(client: SupabaseClient, label: string, state: string) {
  const id = crypto.randomUUID();
  const name = `RLS ${label} ${id.slice(0, 8)}`;
  const inserted = await client.from("households").insert({
    id,
    org_id: orgId,
    name,
    street: "",
    city: "",
    state,
    zip: "",
    country: "USA",
    notes: "",
    tags: [],
    custom_fields: {},
    shared_with_cora: true,
    owner_id: null,
    visit_reaction: null,
  });
  if (inserted.error) throw new Error(`${label} insert: ${inserted.error.message}`);

  const read = await client.from("households").select("id,name,state,owner_id").eq("id", id).maybeSingle();
  if (read.error) throw new Error(`${label} read: ${read.error.message}`);
  if (!read.data) throw new Error(`${label} read: the new contact is not visible under RLS.`);

  const person = await client.from("people").insert({
    id: crypto.randomUUID(),
    household_id: id,
    name,
    phone: "",
    email: "",
    whatsapp: "",
    sort_order: 0,
  });
  if (person.error) throw new Error(`${label} person: ${person.error.message}`);

  const updated = await client.from("households").update({ notes: "rls check" }).eq("id", id);
  if (updated.error) throw new Error(`${label} update: ${updated.error.message}`);

  const blankVisit = await client.from("visits").insert({
    id: crypto.randomUUID(),
    org_id: orgId,
    household_id: id,
    visit_date: null,
    status: null,
    reaction: null,
    details: "",
  });
  if (blankVisit.error) console.log(`${label} blank visit skipped: ${blankVisit.error.message}`);
  else console.log(`${label} blank visit insert succeeded`);

  const contactVisit = await client.from("contact_visits").insert({
    id: crypto.randomUUID(),
    org_id: orgId,
    household_id: id,
    visited: "",
    reaction: null,
    notes: "",
  });
  if (contactVisit.error) console.log(`${label} contact visit skipped: ${contactVisit.error.message}`);
  else console.log(`${label} contact visit insert succeeded`);

  const removed = await client.from("households").delete().eq("id", id);
  if (removed.error) throw new Error(`${label} delete: ${removed.error.message}`);
  console.log(`${label} insert, person, update, and delete succeeded`);
}

async function main() {
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  const admin = await signIn(required("RLS_ADMIN_EMAIL"), required("RLS_ADMIN_PASSWORD"));
  const shliach = await signIn(required("RLS_SHLIACH_EMAIL"), required("RLS_SHLIACH_PASSWORD"));
  await insertContact(admin, "admin", "");
  await insertContact(shliach, "shliach", "ME");
  await admin.auth.signOut();
  await shliach.auth.signOut();
  console.log("rls insert ok");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
