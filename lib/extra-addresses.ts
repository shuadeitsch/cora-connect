import { fullAddress } from "@/lib/format";
import { normalizeState } from "@/lib/constants";

/** A second (or third) address on a contact, e.g. a winter home or a business. */
export type ExtraAddress = {
  street: string;
  city: string;
  state: string;
  zip: string;
  label: string;
};

export function blankExtraAddress(state = ""): ExtraAddress {
  return { street: "", city: "", state, zip: "", label: "" };
}

export function parseExtraAddresses(raw: unknown): ExtraAddress[] {
  if (!Array.isArray(raw)) return [];
  const out: ExtraAddress[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const address: ExtraAddress = {
      street: String(row.street ?? "").trim(),
      city: String(row.city ?? "").trim(),
      state: String(row.state ?? "").trim(),
      zip: String(row.zip ?? "").trim(),
      label: String(row.label ?? "").trim(),
    };
    if (!address.street && !address.city && !address.state && !address.zip && !address.label) continue;
    out.push(address);
  }
  return out;
}

export function addressKey(parts: { street?: string; city?: string; state?: string; zip?: string }) {
  const street = (parts.street ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  const city = (parts.city ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const state = normalizeState(parts.state ?? "").toLowerCase();
  const zip = (parts.zip ?? "").replace(/\D/g, "").slice(0, 5);
  return [street, city, state, zip].join("|");
}

export function sameAddress(
  a: { street?: string; city?: string; state?: string; zip?: string },
  b: { street?: string; city?: string; state?: string; zip?: string },
) {
  const left = addressKey(a);
  const right = addressKey(b);
  return Boolean(left.replace(/\|/g, "")) && left === right;
}

export function formatExtraAddress(address: ExtraAddress) {
  return fullAddress(address);
}

export function extraAddressSearchText(addresses: ExtraAddress[] | undefined) {
  return (addresses ?? []).map((address) => `${address.label} ${formatExtraAddress(address)}`).join(" ");
}

/** Append an address if it is not already the main address or in the list. */
export function appendUniqueAddress(
  extras: ExtraAddress[] | undefined,
  incoming: ExtraAddress,
  main?: { street?: string; city?: string; state?: string; zip?: string },
): ExtraAddress[] {
  const current = parseExtraAddresses(extras ?? []);
  if (!incoming.street && !incoming.city) return current;
  if (main && sameAddress(incoming, main)) return current;
  if (current.some((item) => sameAddress(item, incoming))) return current;
  return [...current, { ...incoming, street: incoming.street.trim(), city: incoming.city.trim(), state: incoming.state.trim(), zip: incoming.zip.trim(), label: incoming.label.trim() }];
}
