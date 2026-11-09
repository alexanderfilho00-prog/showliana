"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as db from "./db";
import { addDays, diffDays, timeToMin, todayISO } from "./dates";
import { DEFAULT_CONTEXTS, type Activity, type Backup, type Client, type Context } from "./types";

export type ActivityDraft = Omit<
  Activity,
  "id" | "createdAt" | "updatedAt" | "completedAt" | "status" | "nextCreated"
> & { id?: string };

interface StoreValue {
  ready: boolean;
  activities: Activity[];
  contexts: Context[];
  clients: Client[];
  saveActivity: (draft: ActivityDraft) => Promise<Activity>;
  complete: (id: string) => Promise<Activity | null>;
  reopen: (id: string) => Promise<void>;
  cancel: (id: string) => Promise<void>;
  deleteActivity: (id: string) => Promise<void>;
  saveClient: (c: Omit<Client, "id" | "createdAt"> & { id?: string }) => Promise<Client>;
  deleteClient: (id: string) => Promise<void>;
  saveContext: (c: Omit<Context, "id" | "order"> & { id?: string }) => Promise<Context>;
  deleteContext: (id: string) => Promise<void>;
  exportBackup: () => Backup;
  importBackup: (raw: unknown) => Promise<{ activities: number; clients: number }>;
}

const StoreCtx = createContext<StoreValue | null>(null);

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [contexts, setContexts] = useState<Context[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  // Mirror of `activities` that mutations read synchronously; always updated together.
  const actsRef = useRef<Activity[]>([]);
  const commit = useCallback((fn: (list: Activity[]) => Activity[]) => {
    actsRef.current = fn(actsRef.current);
    setActivities(actsRef.current);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [a, ctx, cl, seeded] = await Promise.all([
        db.getAll<Activity>("activities"),
        db.getAll<Context>("contexts"),
        db.getAll<Client>("clients"),
        db.getMeta<boolean>("seeded"),
      ]);
      let contextsLoaded = ctx;
      if (!seeded && ctx.length === 0) {
        await db.putMany("contexts", DEFAULT_CONTEXTS);
        await db.setMeta("seeded", true);
        contextsLoaded = DEFAULT_CONTEXTS;
      }
      if (!alive) return;
      actsRef.current = a;
      setActivities(a);
      setContexts(contextsLoaded.sort((x, y) => x.order - y.order));
      setClients(cl.sort((x, y) => x.name.localeCompare(y.name, "pt-BR")));
      setReady(true);
      db.requestPersistence();
    })();
    return () => {
      alive = false;
    };
  }, []);

  const upsertLocal = useCallback(
    (a: Activity) =>
      commit((list) => {
        const i = list.findIndex((x) => x.id === a.id);
        if (i === -1) return [...list, a];
        const copy = list.slice();
        copy[i] = a;
        return copy;
      }),
    [commit],
  );

  const saveActivity = useCallback(
    async (draft: ActivityDraft) => {
      const now = Date.now();
      const prev = draft.id ? actsRef.current.find((x) => x.id === draft.id) : undefined;
      const a: Activity = {
        ...(prev ?? {
          status: "open",
          nextCreated: false,
          createdAt: now,
          completedAt: null,
        }),
        ...draft,
        id: draft.id ?? uid(),
        title: draft.title.trim(),
        endTime: draft.kind === "event" ? draft.endTime : null,
        updatedAt: now,
      } as Activity;
      upsertLocal(a);
      await db.put("activities", a);
      return a;
    },
    [upsertLocal],
  );

  const patch = useCallback(
    async (id: string, changes: Partial<Activity>) => {
      const prev = actsRef.current.find((x) => x.id === id);
      if (!prev) return null;
      const a = { ...prev, ...changes, updatedAt: Date.now() };
      upsertLocal(a);
      await db.put("activities", a);
      return a;
    },
    [upsertLocal],
  );

  const complete = useCallback(
    async (id: string) => {
      const prev = actsRef.current.find((x) => x.id === id);
      if (!prev) return null;
      let next: Activity | null = null;
      // A weekly task spawns its next occurrence exactly once, even if it is
      // reopened and completed again later.
      if (prev.repeatWeekly && !prev.nextCreated) {
        const now = Date.now();
        next = {
          ...prev,
          id: uid(),
          date: addDays(prev.date ?? todayISO(), 7),
          status: "open",
          nextCreated: false,
          completedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        upsertLocal(next);
        await db.put("activities", next);
      }
      await patch(id, {
        status: "done",
        completedAt: Date.now(),
        nextCreated: prev.nextCreated || !!next,
      });
      return next;
    },
    [patch, upsertLocal],
  );

  const reopen = useCallback(async (id: string) => {
    await patch(id, { status: "open", completedAt: null });
  }, [patch]);

  const cancel = useCallback(async (id: string) => {
    await patch(id, { status: "canceled", completedAt: null });
  }, [patch]);

  const deleteActivity = useCallback(async (id: string) => {
    commit((l) => l.filter((x) => x.id !== id));
    await db.remove("activities", id);
  }, [commit]);

  const saveClient = useCallback<StoreValue["saveClient"]>(async (c) => {
    const client: Client = {
      createdAt: Date.now(),
      ...c,
      id: c.id ?? uid(),
      name: c.name.trim(),
      notes: c.notes.trim(),
    } as Client;
    setClients((list) => {
      const rest = list.filter((x) => x.id !== client.id);
      return [...rest, client].sort((x, y) => x.name.localeCompare(y.name, "pt-BR"));
    });
    await db.put("clients", client);
    return client;
  }, []);

  const deleteClient = useCallback(async (id: string) => {
    setClients((l) => l.filter((x) => x.id !== id));
    await db.remove("clients", id);
    const touched = actsRef.current
      .filter((a) => a.clientId === id)
      .map((a) => ({ ...a, clientId: null, updatedAt: Date.now() }));
    if (touched.length) {
      commit((l) => l.map((a) => (a.clientId === id ? { ...a, clientId: null } : a)));
      await db.putMany("activities", touched);
    }
  }, [commit]);

  const saveContext = useCallback<StoreValue["saveContext"]>(
    async (c) => {
      const existing = c.id ? contexts.find((x) => x.id === c.id) : undefined;
      const ctx: Context = {
        order: existing?.order ?? contexts.length,
        ...c,
        id: c.id ?? uid(),
        name: c.name.trim(),
      } as Context;
      setContexts((list) =>
        [...list.filter((x) => x.id !== ctx.id), ctx].sort((x, y) => x.order - y.order),
      );
      await db.put("contexts", ctx);
      return ctx;
    },
    [contexts],
  );

  const deleteContext = useCallback(async (id: string) => {
    setContexts((l) => l.filter((x) => x.id !== id));
    await db.remove("contexts", id);
    const touched = actsRef.current
      .filter((a) => a.contextId === id)
      .map((a) => ({ ...a, contextId: null }));
    if (touched.length) {
      commit((l) => l.map((a) => (a.contextId === id ? { ...a, contextId: null } : a)));
      await db.putMany("activities", touched);
    }
  }, [commit]);

  const exportBackup = useCallback(
    (): Backup => ({
      app: "showliana",
      version: 1,
      exportedAt: new Date().toISOString(),
      activities,
      contexts,
      clients,
    }),
    [activities, contexts, clients],
  );

  const importBackup = useCallback(async (raw: unknown) => {
    const b = raw as Partial<Backup>;
    if (
      !b ||
      b.app !== "showliana" ||
      !Array.isArray(b.activities) ||
      !Array.isArray(b.contexts) ||
      !Array.isArray(b.clients)
    ) {
      throw new Error("Este arquivo não é um backup do Showliana.");
    }
    const valid = b.activities.every(
      (a) => a && typeof a.id === "string" && typeof a.title === "string" && (a.kind === "task" || a.kind === "event"),
    );
    if (!valid) throw new Error("O backup tem atividades incompletas. Nada foi alterado.");
    await db.replaceAll({ activities: b.activities, contexts: b.contexts, clients: b.clients });
    commit(() => b.activities!);
    setContexts([...b.contexts].sort((x, y) => x.order - y.order));
    setClients([...b.clients].sort((x, y) => x.name.localeCompare(y.name, "pt-BR")));
    return { activities: b.activities.length, clients: b.clients.length };
  }, [commit]);

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      activities,
      contexts,
      clients,
      saveActivity,
      complete,
      reopen,
      cancel,
      deleteActivity,
      saveClient,
      deleteClient,
      saveContext,
      deleteContext,
      exportBackup,
      importBackup,
    }),
    [ready, activities, contexts, clients, saveActivity, complete, reopen, cancel, deleteActivity, saveClient, deleteClient, saveContext, deleteContext, exportBackup, importBackup],
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const v = useContext(StoreCtx);
  if (!v) throw new Error("useStore outside StoreProvider");
  return v;
}

/* ---------- selectors ---------- */

/** Does this activity appear on the given civil day? Weekly events repeat on the same weekday. */
export function occursOn(a: Activity, day: string) {
  if (a.status === "canceled" || !a.date) return false;
  if (a.date === day) return true;
  if (a.kind === "event" && a.repeatWeekly) {
    const d = diffDays(day, a.date);
    return d > 0 && d % 7 === 0;
  }
  return false;
}

export function sortByTime(a: Activity, b: Activity) {
  const ta = a.time ? timeToMin(a.time) : -1;
  const tb = b.time ? timeToMin(b.time) : -1;
  if (ta !== tb) return ta - tb;
  return a.createdAt - b.createdAt;
}

export function itemsOn(activities: Activity[], day: string) {
  return activities.filter((a) => occursOn(a, day)).sort(sortByTime);
}
