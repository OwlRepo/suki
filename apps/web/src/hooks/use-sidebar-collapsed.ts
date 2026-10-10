import { useCallback, useSyncExternalStore } from "react";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "tyvera-sidebar-collapsed-v1";

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

// Collapsed unless the user expanded it ("0"), matching the server-rendered default.
function getSnapshot() {
  return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) !== "0";
}

function getServerSnapshot() {
  return true;
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
