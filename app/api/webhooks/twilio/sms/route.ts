import { handleTwilioWebhook } from "@/lib/twilio-webhook";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return handleTwilioWebhook(req, "sms");
}
