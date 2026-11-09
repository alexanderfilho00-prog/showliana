"use client";

import { createContext, useContext } from "react";
import type { Activity, Kind } from "./types";

export interface Prefill {
  kind?: Kind;
  date?: string | null;
  time?: string | null;
  endTime?: string | null;
  clientId?: string | null;
  contextId?: string | null;
}

export interface UIValue {
  openNew: (prefill?: Prefill) => void;
  openEdit: (a: Activity) => void;
  toast: (msg: string) => void;
  openSettings: () => void;
}

export const UICtx = createContext<UIValue | null>(null);

export function useUI() {
  const v = useContext(UICtx);
  if (!v) throw new Error("useUI outside provider");
  return v;
}
