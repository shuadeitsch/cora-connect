import { headers } from "next/headers";

export const dynamic = "force-dynamic";

// One tiny AI Gateway probe per server instance (cached 10 min), so we can see whether
// OIDC auth + the free monthly credit work on this deployment. Returns no secrets.
let cached: { at: number; body: Record<string, unknown> } | null = null;

export async function GET() {
  if (cached && Date.now() - cached.at < 10 * 60_000) return Response.json({ ...cached.body, cached: true }, { headers: { "Cache-Control": "no-store" } });
  const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || (await headers()).get("x-vercel-oidc-token");
  const auth = process.env.AI_GATEWAY_API_KEY ? "api-key" : token ? "oidc" : "none";
  let body: Record<string, unknown> = { auth };
  if (token) {
    try {
      const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash-lite", max_tokens: 3, messages: [{ role: "user", content: "Reply OK" }] }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: { type?: string; message?: string } };
      body = { auth, status: res.status, ok: res.ok, type: json.error?.type ?? null, message: json.error?.message?.slice(0, 200) ?? null };
    } catch (error) {
      body = { auth, ok: false, message: String(error).slice(0, 200) };
    }
  }
  cached = { at: Date.now(), body };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
