export function todayIso(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function formatDots(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${m}.${d}.${y}`;
}

export function formatMedium(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatLongDate(d = new Date()): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function weekStart(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  const day = dt.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  dt.setUTCDate(dt.getUTCDate() - diff);
  return dt.toISOString().slice(0, 10);
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function fullAddress(parts: {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}): string {
  const cityLine = [parts.city, parts.state].filter(Boolean).join(", ");
  const withZip = [cityLine, parts.zip].filter(Boolean).join(" ");
  return [parts.street, withZip, parts.country && parts.country !== "USA" ? parts.country : ""]
    .filter(Boolean)
    .join(", ");
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function whatsAppHref(phone: string): string {
  let d = digitsOnly(phone);
  if (d.length === 10) d = `1${d}`;
  return `https://wa.me/${d}`;
}

export function mapsHref(lat: number | null, lng: number | null, address: string): string {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function telHref(phone: string): string {
  return `tel:${digitsOnly(phone)}`;
}

export function smsHref(phone: string): string {
  return `sms:${digitsOnly(phone)}`;
}

export interface MapLinks {
  google: string;
  apple: string;
  waze: string;
}

// One address, three map apps. Coordinates win when the contact has them.
export function mapLinks(lat: number | null, lng: number | null, address: string): MapLinks {
  const q = encodeURIComponent(address.trim());
  if (lat != null && lng != null) {
    const ll = `${lat},${lng}`;
    return {
      google: `https://www.google.com/maps/search/?api=1&query=${ll}`,
      apple: `https://maps.apple.com/?ll=${ll}${q ? `&q=${q}` : ""}`,
      waze: `https://waze.com/ul?ll=${ll}&navigate=yes`,
    };
  }
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${q}`,
    apple: `https://maps.apple.com/?q=${q}`,
    waze: `https://waze.com/ul?q=${q}&navigate=yes`,
  };
}
