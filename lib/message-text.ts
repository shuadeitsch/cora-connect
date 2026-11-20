/** Tidy an email body for a chat bubble: hide quoted reply history and signature noise. Safe for client and server. */

const QUOTE_START: RegExp[] = [
  /^on .{5,200}wrote:\s*$/i,
  /^on .{5,120}$/i, // "On Mon, Nov 2, 2026 at 3:14 PM Someone <a@b.c>" wrapped before "wrote:"
  /^-{2,}\s*original message\s*-{2,}\s*$/i,
  /^-{2,}\s*forwarded message\s*-{2,}\s*$/i,
  /^_{5,}\s*$/,
  /^from:\s.+/i,
  /^de:\s.+/i,
];

const SIGNATURE_START: RegExp[] = [
  /^--\s*$/,
  /^sent from my (iphone|ipad|android|galaxy|phone|mobile|samsung).*$/i,
  /^get outlook for (ios|android).*$/i,
  /^sent from (mail|outlook|yahoo mail).*$/i,
];

export type CleanedBody = { main: string; trimmed: boolean };

export function cleanEmailBody(body: string): CleanedBody {
  const text = (body ?? "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n");
  let cut = lines.length;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith(">")) { cut = i; break; }
    if (SIGNATURE_START.some((re) => re.test(line))) { cut = i; break; }
    if (QUOTE_START.some((re) => re.test(line))) {
      // "On ... wrote:" can wrap over two lines; "From:" only counts when a Sent/Date/To line follows.
      const next = lines.slice(i + 1, i + 5).join("\n");
      if (/^(from|de):/i.test(line) && !/^(sent|date|to|subject|cc):/im.test(next)) continue;
      if (/^on .{5,120}$/i.test(line) && !/wrote:\s*$/i.test(line) && !/wrote:\s*$/i.test(`${line} ${lines[i + 1] ?? ""}`.trim())) continue;
      cut = i;
      break;
    }
  }
  const main = lines.slice(0, cut).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!main) return { main: text.trim(), trimmed: false }; // never hide everything
  return { main, trimmed: main !== text.trim() };
}

/** One tidy line for a list preview. */
export function previewLine(value: string): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}
