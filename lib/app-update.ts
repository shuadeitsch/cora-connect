/** Fields inside a real form. Search boxes and list filters sit outside forms, so typing there does not count as unsaved input. */
export function shouldTrackField(tagName: string, type: string, inForm: boolean): boolean {
  if (!inForm) return false;
  const tag = tagName.toLowerCase();
  if (tag === "textarea" || tag === "select") return true;
  if (tag !== "input") return false;
  const kind = (type || "text").toLowerCase();
  return kind !== "button" && kind !== "submit" && kind !== "reset" && kind !== "hidden" && kind !== "search" && kind !== "image";
}

/** A deployed build id that differs from the one baked into this page. */
export function isRemoteUpdate(localBuild: string, remoteBuild: string | null | undefined): boolean {
  if (!remoteBuild || !localBuild || localBuild === "dev") return false;
  return remoteBuild !== localBuild;
}

let unsaved = false;

export function markUnsaved() {
  unsaved = true;
}

export function clearUnsaved() {
  unsaved = false;
}

export function hasUnsavedEdits() {
  return unsaved;
}

export const UNSAVED_RELOAD_WARNING = "You have unsaved changes. Reload and discard them?";

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function activateUpdatedWorker(registration: ServiceWorkerRegistration) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const worker = registration.waiting || registration.installing;
    if (!worker) return;
    if (worker.state === "installed" || worker.state === "activated") {
      worker.postMessage({ type: "SKIP_WAITING" });
      await Promise.race([
        new Promise<void>((resolve) => {
          navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
        }),
        wait(1200),
      ]);
      return;
    }
    await wait(100);
  }
}

/** Check the service worker, drop stale caches, then reload this page from the network. */
export async function refreshInstalledApp() {
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.update().catch(() => undefined);
      await activateUpdatedWorker(registration);
    }
  }
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
  const href = window.location.href;
  await fetch(href, { cache: "reload", credentials: "same-origin" }).catch(() => undefined);
  window.location.reload();
}
