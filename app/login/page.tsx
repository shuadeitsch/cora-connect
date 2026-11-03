import { LoginForm } from "@/components/login-form";
import { redirectIfSignedIn } from "@/lib/auth";
import { googleAuthEnabled } from "@/lib/site";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await redirectIfSignedIn();
  const params = await searchParams;
  return <LoginForm google={googleAuthEnabled()} errorCode={params.error ?? ""} />;
}
