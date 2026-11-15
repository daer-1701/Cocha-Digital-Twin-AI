"use client";

import { useSyncExternalStore } from "react";

/**
 * Pathname without next/navigation's usePathname().
 * Next 16.4 + React 19.3 instruments usePathname with conditional React.use()
 * in development and can warn: "This library called use() to suspend...".
 */
function subscribe(onStoreChange: () => void) {
  const notify = () => onStoreChange();
  window.addEventListener("popstate", notify);
  const { pushState, replaceState } = window.history;
  window.history.pushState = function (...args) {
    const result = pushState.apply(this, args as Parameters<typeof pushState>);
    notify();
    return result;
  };
  window.history.replaceState = function (...args) {
    const result = replaceState.apply(
      this,
      args as Parameters<typeof replaceState>,
    );
    notify();
    return result;
  };
  return () => {
    window.removeEventListener("popstate", notify);
    window.history.pushState = pushState;
    window.history.replaceState = replaceState;
  };
}

function getSnapshot() {
  return window.location.pathname;
}

function getServerSnapshot() {
  return "";
}

export function useCurrentPathname() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
