import { SignupForm } from "@/components/signup-form";
import { redirectIfSignedIn } from "@/lib/auth";

export const metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  await redirectIfSignedIn();
  const params = await searchParams;
  const email = params.email?.trim().toLowerCase() ?? "";
  const initialEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 200) : "";
  return <SignupForm initialEmail={initialEmail} />;
}
