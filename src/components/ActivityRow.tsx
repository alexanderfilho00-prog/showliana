"use client";

import { ArrowsClockwise } from "@phosphor-icons/react";
import { useState } from "react";
import { formatRelative, formatTime, todayISO } from "../lib/dates";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import { formatDayMonth } from "../lib/dates";
import type { Activity } from "../lib/types";

/**
 * One line of the agenda. Tasks get a round check on the left; appointments
 * get their time range in that same column, so the eye scans one edge.
 */
export function ActivityRow({
  a,
  showDate = false,
  occurrenceDate,
}: {
  a: Activity;
  showDate?: boolean;
  occurrenceDate?: string;
}) {
  const { contexts, clients, complete, reopen } = useStore();
  const { openEdit, toast } = useUI();
  const [leaving, setLeaving] = useState(false);
  const ctx = contexts.find((c) => c.id === a.contextId);
  const client = clients.find((c) => c.id === a.clientId);
  const today = todayISO();
  const date = occurrenceDate ?? a.date;
  const overdue = a.kind === "task" && a.status === "open" && !!a.date && a.date < today;
  const done = a.status === "done" || leaving;

  async function toggle() {
    if (a.status === "done") {
      await reopen(a.id);
      toast("Tarefa reaberta");
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setLeaving(true);
    await new Promise((r) => setTimeout(r, reduce ? 0 : 420));
    const next = await complete(a.id);
    setLeaving(false);
    toast(next ? `Tarefa concluída. A próxima fica para ${formatDayMonth(next.date!)}` : "Tarefa concluída");
  }

  const meta: React.ReactNode[] = [];
  if (showDate && date) meta.push(<span key="d" className={overdue ? "sl-overdue" : undefined}>{formatRelative(date, today)}</span>);
  if (a.kind === "task" && a.time) meta.push(<span key="t">{formatTime(a.time)}</span>);
  if (ctx)
    meta.push(
      <span key="c" className="sl-ctx">
        <span className="sl-tick" style={{ background: ctx.color }} aria-hidden="true" />
        {ctx.name}
      </span>,
    );
  if (client) meta.push(<span key="cl">{client.name}</span>);

  return (
    <li className="sl-row" data-status={a.status} data-done={done || undefined} data-leaving={leaving || undefined}>
      {a.kind === "task" ? (
        a.status === "canceled" ? (
          <span className="sl-lead sl-lead-muted" aria-hidden="true">
            <span className="sl-check" data-canceled="" />
          </span>
        ) : (
          <button
            type="button"
            className="sl-lead"
            onClick={toggle}
            aria-label={a.status === "done" ? `Reabrir: ${a.title}` : `Concluir: ${a.title}`}
            aria-pressed={a.status === "done"}
          >
            <span className="sl-check" data-checked={done || undefined} data-priority={a.priority}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6.5 12.5l3.6 3.6 7.4-8" />
              </svg>
            </span>
          </button>
        )
      ) : (
        <span className="sl-lead sl-when" aria-hidden="true">
          <span>{a.time ? formatTime(a.time) : ""}</span>
          <span className="sl-when-end">{a.endTime ? formatTime(a.endTime) : ""}</span>
        </span>
      )}
      <button type="button" className="sl-row-main" onClick={() => openEdit(a)}>
        <span className="sl-row-title">
          {a.kind === "event" && (
            <span className="sl-sr">
              Compromisso {a.time ? `das ${formatTime(a.time)} às ${formatTime(a.endTime ?? a.time)}` : ""}:{" "}
            </span>
          )}
          {a.title}
          {a.priority === "alta" && a.status === "open" && <span className="sl-flag">Alta</span>}
        </span>
        {(meta.length > 0 || a.repeatWeekly) && (
          <span className="sl-row-meta">
            {meta}
            {a.repeatWeekly && (
              <span className="sl-repeat">
                <ArrowsClockwise size={13} weight="light" aria-hidden="true" />
                semanal
              </span>
            )}
          </span>
        )}
      </button>
    </li>
  );
}
