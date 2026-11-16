import { useCallback, useSyncExternalStore } from "react";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "suki-sidebar-collapsed-v1";
const LEGACY_STORAGE_KEY = "tyvera-sidebar-collapsed-v1";

// Same-tab writes do not fire the `storage` event, so toggle notifies subscribers itself.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

// Existing explicit preferences win; new workspaces start with visible labels.
function getSnapshot() {
  const preference = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)
    ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
  return preference !== null && preference !== "0";
}

function getServerSnapshot() {
  return false;
}

export function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      getSnapshot() ? "0" : "1",
    );
    for (const listener of listeners) listener();
  }, []);

  return { collapsed, toggle };
}
