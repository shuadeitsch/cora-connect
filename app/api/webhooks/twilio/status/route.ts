import { handleTwilioStatus } from "@/lib/twilio-webhook";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return handleTwilioStatus(req);
}
