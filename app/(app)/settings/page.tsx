import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SettingsView } from "@/components/settings-view";
import { PASSWORD_RECOVERY_COOKIE } from "@/lib/auth";
import { getAppData } from "@/lib/session";
import { twilioEnvConfigured } from "@/lib/twilio-status";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const data = await getAppData();
  if (!data) redirect("/login");
  const params = await searchParams;
  const recovery = (await cookies()).get(PASSWORD_RECOVERY_COOKIE)?.value === "1";
  return <SettingsView data={data} initialTab={params.tab ?? "house"} recovery={recovery} twilioConnected={twilioEnvConfigured()} />;
}
