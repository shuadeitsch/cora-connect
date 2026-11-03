"use client";

import { useSyncExternalStore } from "react";

/**
 * The state tab open on the Contacts page, so the side bar can say "Maine" while Maine is showing.
 * null means no page is choosing a state right now; "" means All states.
 */
let viewing: string | null = null;
const listeners = new Set<() => void>();

export function setViewingState(state: string | null) {
  if (viewing === state) return;
  viewing = state;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useViewingState(): string | null {
  return useSyncExternalStore(subscribe, () => viewing, () => null);
}
