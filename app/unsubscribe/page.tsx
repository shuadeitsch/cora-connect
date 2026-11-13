import { verifyUnsubscribeToken } from "@/lib/mail-crypto";
import { setPersonEmailOptOut } from "@/lib/supabase/write";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

export const metadata = { title: "Unsubscribe" };

async function confirmUnsubscribe(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  let parsed: { personId: string; email: string } | null = null;
  try {
    parsed = token ? verifyUnsubscribeToken(token) : null;
  } catch {
    parsed = null;
  }
  if (!parsed) redirect("/unsubscribe?done=0");
  await setPersonEmailOptOut(parsed.personId, true);
  redirect("/unsubscribe?done=1");
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; done?: string }>;
}) {
  const params = await searchParams;
  if (params.done === "1") {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="font-heading text-2xl font-semibold text-foreground">You are unsubscribed</h1>
        <p className="mt-2 text-sm text-muted-foreground">You will no longer receive outreach email from this CRM. If this was a mistake, contact the person who emailed you.</p>
      </main>
    );
  }
  if (params.done === "0") {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Unsubscribe from email</h1>
        <p className="mt-2 text-sm text-muted-foreground">This unsubscribe link is not valid or has been changed.</p>
      </main>
    );
  }
  let payload: { personId: string; email: string } | null = null;
  let error = "";
  try {
    payload = params.token ? verifyUnsubscribeToken(params.token) : null;
    if (!payload) error = "This unsubscribe link is not valid or has been changed.";
  } catch {
    error = "Unsubscribe is not available right now.";
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Unsubscribe from email</h1>
      {error ? (
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Stop outreach email to {payload?.email}. You will be skipped on future sends from this CRM.
          </p>
          <form action={confirmUnsubscribe} className="mt-4">
            <input type="hidden" name="token" value={params.token ?? ""} />
            <Button type="submit" className="min-h-11 rounded-full">Unsubscribe</Button>
          </form>
        </>
      )}
    </main>
  );
}
