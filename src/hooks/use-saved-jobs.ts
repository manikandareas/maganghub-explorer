"use client";

import { useMemo, useSyncExternalStore } from "react";

const KEY = "maganghub:saved:v1";
const EVENT = "maganghub:saved-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT, callback);
  };
}
function read() {
  try { return localStorage.getItem(KEY) ?? "[]"; } catch { return "[]"; }
}
const serverSnapshot = () => "[]";

export function useSavedJobs() {
  const snapshot = useSyncExternalStore(subscribe, read, serverSnapshot);
  const ids = useMemo<string[]>(() => {
    try {
      const parsed: unknown = JSON.parse(snapshot);
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string" && /^[\da-f-]{36}$/i.test(id)).slice(0, 200) : [];
    } catch { return []; }
  }, [snapshot]);

  function toggle(id: string) {
    try {
      const current = JSON.parse(read()) as unknown;
      const valid: string[] = Array.isArray(current) ? current.filter((item): item is string => typeof item === "string") : [];
      const next = valid.includes(id) ? valid.filter(item => item !== id) : [...valid, id].slice(-200);
      localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT));
      return true;
    } catch { return false; }
  }
  return { ids, toggle };
}
