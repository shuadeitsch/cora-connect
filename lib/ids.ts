export function stableId(n: number): string {
  return `c0a00000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

export function newId(): string {
  return crypto.randomUUID();
}
