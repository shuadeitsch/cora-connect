import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { redirectIfSignedIn } from "@/lib/auth";

export const metadata = { title: "Reset password" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await redirectIfSignedIn();
  const params = await searchParams;
  return <ForgotPasswordForm errorCode={params.error ?? ""} />;
}
