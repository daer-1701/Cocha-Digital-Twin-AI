"use client";

import { useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "cocha-motion";

function readReduced() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("motion");
  if (fromUrl === "reduce" || fromUrl === "off") return true;
  if (fromUrl === "on" || fromUrl === "force") return false;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "reduce" || stored === "off") return true;
    if (stored === "on" || stored === "force") return false;
  } catch {
    /* ignore */
  }
  return false;
}

function subscribe(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener("popstate", notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener("popstate", notify);
  };
}

/** Sets html[data-motion] for CSS entrances without Lenis or content WAAPI. */
export function MotionFlag() {
  const reduced = useSyncExternalStore(subscribe, readReduced, () => true);

  useEffect(() => {
    if (reduced) {
      delete document.documentElement.dataset.motion;
      document.documentElement.dataset.motionMode = "reduce";
      return;
    }
    document.documentElement.dataset.motion = "on";
    document.documentElement.dataset.motionMode = "demo";
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        window.localStorage.setItem(STORAGE_KEY, "on");
      }
    } catch {
      /* ignore */
    }
    return () => {
      delete document.documentElement.dataset.motion;
      delete document.documentElement.dataset.motionMode;
    };
  }, [reduced]);

  return null;
}
