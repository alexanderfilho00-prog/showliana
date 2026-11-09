"use client";

import { MagnifyingGlass, Plus, XCircle } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { todayISO } from "../lib/dates";
import { sortByTime, useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import type { Activity, Status } from "../lib/types";
import { ActivityRow } from "./ActivityRow";
import { Cat } from "./Cat";

const TABS: { id: Status; label: string }[] = [
  { id: "open", label: "Abertas" },
  { id: "done", label: "Concluídas" },
  { id: "canceled", label: "Canceladas" },
];

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function Tasks() {
  const { activities, contexts } = useStore();
  const { openNew } = useUI();
  const [tab, setTab] = useState<Status>("open");
  const [query, setQuery] = useState("");
  const [ctx, setCtx] = useState<string | "all">("all");
  const today = todayISO();

  const tasks = useMemo(() => activities.filter((a) => a.kind === "task"), [activities]);
  const counts = useMemo(() => {
    const c = { open: 0, done: 0, canceled: 0 } as Record<Status, number>;
    for (const t of tasks) c[t.status]++;
    return c;
  }, [tasks]);

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    return tasks.filter(
      (t) => t.status === tab && (ctx === "all" || t.contextId === ctx) && (!q || norm(t.title).includes(q)),
    );
  }, [tasks, tab, ctx, query]);

  const groups = useMemo(() => {
    if (tab !== "open") {
      const sorted = [...filtered].sort((a, b) => (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt));
      return [{ id: "all", title: "", list: sorted }];
    }
    const byDate = (a: Activity, b: Activity) =>
      a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : sortByTime(a, b);
    const g = [
      { id: "late", title: "Atrasadas", list: filtered.filter((t) => t.date && t.date < today).sort(byDate) },
      { id: "today", title: "Hoje", list: filtered.filter((t) => t.date === today).sort(byDate) },
      { id: "next", title: "Próximas", list: filtered.filter((t) => t.date && t.date > today).sort(byDate) },
      { id: "none", title: "Sem prazo", list: filtered.filter((t) => !t.date).sort((a, b) => b.createdAt - a.createdAt) },
    ];
    return g.filter((x) => x.list.length);
  }, [filtered, tab, today]);

  const filtering = query.trim() !== "" || ctx !== "all";

  return (
    <div className="sl-screen">
      <header className="sl-head">
        <h1 className="sl-title">Tarefas</h1>
      </header>

      <div className="sl-toolbar">
        <label className="sl-search">
          <MagnifyingGlass size={20} weight="light" aria-hidden="true" />
          <span className="sl-sr">Buscar por título</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título"
            enterKeyHint="search"
            autoComplete="off"
          />
          {query && (
            <button type="button" className="sl-clear" onClick={() => setQuery("")} aria-label="Limpar busca">
              <XCircle size={20} weight="light" />
            </button>
          )}
        </label>

        <div className="sl-chips sl-chips-scroll" role="radiogroup" aria-label="Filtrar por contexto">
          <button type="button" role="radio" aria-checked={ctx === "all"} className="sl-chip" onClick={() => setCtx("all")}>
            Todos
          </button>
          {contexts.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={ctx === c.id}
              className="sl-chip"
              onClick={() => setCtx(c.id)}
            >
              <span className="sl-tick" style={{ background: c.color }} aria-hidden="true" />
              {c.name}
            </button>
          ))}
        </div>

        <div className="sl-tabs" role="tablist" aria-label="Situação">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className="sl-tabs-item"
              onClick={() => setTab(t.id)}
            >
              {t.label}
              <span className="sl-count">{counts[t.id] || ""}</span>
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)!.label}>
        {groups.length ? (
          groups.map((g) => (
            <section key={g.id} className="sl-section" aria-label={g.title || undefined}>
              {g.title && (
                <h2 className={`sl-section-title${g.id === "late" ? " sl-section-alert" : ""}`}>
                  {g.title} <span className="sl-count">{g.list.length}</span>
                </h2>
              )}
              <ul className="sl-list">
                {g.list.map((a) => (
                  <ActivityRow key={a.id} a={a} showDate={g.id !== "today"} />
                ))}
              </ul>
            </section>
          ))
        ) : (
          <div className="sl-empty sl-empty-compact">
            <Cat size={72} sleepy className="sl-empty-cat" />
            <h2 className="sl-empty-title">{emptyTitle(tab, filtering)}</h2>
            {filtering ? (
              <button
                type="button"
                className="sl-btn sl-btn-outline"
                onClick={() => {
                  setQuery("");
                  setCtx("all");
                }}
              >
                Limpar filtros
              </button>
            ) : (
              tab === "open" && (
                <button type="button" className="sl-btn sl-btn-primary" onClick={() => openNew({ kind: "task" })}>
                  <Plus size={18} weight="bold" aria-hidden="true" />
                  Nova tarefa
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function emptyTitle(tab: Status, filtering: boolean) {
  if (filtering) return "Nenhuma tarefa com esse filtro";
  if (tab === "open") return "Nenhuma tarefa em aberto";
  if (tab === "done") return "As tarefas concluídas aparecem aqui";
  return "Nenhuma tarefa cancelada";
}
