"use client";

import { CaretLeft, CaretRight, Plus } from "@phosphor-icons/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  addMonths,
  dayOfMonth,
  formatDayMonth,
  formatLong,
  formatMonthYear,
  formatTime,
  formatWeekdayShort,
  minToTime,
  nowParts,
  startOfMonth,
  startOfWeek,
  timeToMin,
  todayISO,
} from "../lib/dates";
import { itemsOn, useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import type { Activity } from "../lib/types";
import { ActivityRow } from "./ActivityRow";
import { capitalize } from "./Today";

type Mode = "day" | "week" | "month";
const MODES: { id: Mode; label: string }[] = [
  { id: "day", label: "Dia" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mês" },
];
const HOUR = 56; // px per hour in the day grid

function readMode(): Mode {
  try {
    const m = localStorage.getItem("sl-agenda-mode");
    if (m === "day" || m === "week" || m === "month") return m;
  } catch {}
  return "day";
}

export function Agenda() {
  const today = todayISO();
  // Rendered only on the client (after the local database loads), so reading
  // localStorage in the initializer is safe.
  const [mode, setModeState] = useState<Mode>(readMode);
  const [cursor, setCursor] = useState(today);
  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem("sl-agenda-mode", m);
    } catch {}
  };

  const step = (dir: 1 | -1) => {
    if (mode === "day") setCursor((c) => addDays(c, dir));
    else if (mode === "week") setCursor((c) => addDays(c, 7 * dir));
    else setCursor((c) => addMonths(c, dir));
  };

  const label =
    mode === "day"
      ? capitalize(formatLong(cursor))
      : mode === "week"
        ? weekLabel(startOfWeek(cursor))
        : capitalize(formatMonthYear(cursor));

  const isCurrent =
    mode === "day"
      ? cursor === today
      : mode === "week"
        ? startOfWeek(cursor) === startOfWeek(today)
        : startOfMonth(cursor) === startOfMonth(today);

  return (
    <div className="sl-screen sl-agenda">
      <div className="sl-agenda-top">
        <header className="sl-head">
          <h1 className="sl-title">Agenda</h1>
          <button
            type="button"
            className="sl-btn sl-btn-outline sl-btn-small"
            onClick={() => setCursor(today)}
            aria-pressed={isCurrent}
          >
            Hoje
          </button>
        </header>
        <div className="sl-seg" role="tablist" aria-label="Modo da agenda">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              className="sl-seg-item"
              onClick={() => {
                setMode(m.id);
                document.querySelector(".sl-main")?.scrollTo({ top: 0 });
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="sl-agenda-bar">
        <div className="sl-nav">
          <button type="button" className="sl-icon-btn" onClick={() => step(-1)} aria-label="Anterior">
            <CaretLeft size={22} weight="light" />
          </button>
          <p className="sl-nav-label" aria-live="polite">
            {label}
          </p>
          <button type="button" className="sl-icon-btn" onClick={() => step(1)} aria-label="Próximo">
            <CaretRight size={22} weight="light" />
          </button>
        </div>
        {mode === "day" && <WeekStrip cursor={cursor} today={today} onPick={setCursor} />}
      </div>

      {mode === "day" && <DayView day={cursor} today={today} />}
      {mode === "week" && <WeekView start={startOfWeek(cursor)} today={today} />}
      {mode === "month" && <MonthView cursor={cursor} today={today} onPick={setCursor} />}
    </div>
  );
}

function weekLabel(start: string) {
  const end = addDays(start, 6);
  return `${formatDayMonth(start)} a ${formatDayMonth(end)}`;
}

function WeekStrip({ cursor, today, onPick }: { cursor: string; today: string; onPick: (d: string) => void }) {
  const { activities } = useStore();
  const start = startOfWeek(cursor);
  return (
    <div className="sl-strip" role="group" aria-label="Dias da semana">
      {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => {
        const n = itemsOn(activities, d).filter((a) => a.status === "open").length;
        return (
          <button
            key={d}
            type="button"
            className="sl-strip-day"
            aria-pressed={d === cursor}
            data-today={d === today || undefined}
            onClick={() => onPick(d)}
            aria-label={`${formatLong(d)}${n ? `, ${n} ${n === 1 ? "item" : "itens"}` : ""}`}
          >
            <span className="sl-strip-wd">{formatWeekdayShort(d).slice(0, 3)}</span>
            <span className="sl-strip-n">{dayOfMonth(d)}</span>
            <span className="sl-strip-mark" data-on={n > 0 || undefined} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Day ---------------- */

interface Placed {
  a: Activity;
  start: number;
  end: number;
  col: number;
  cols: number;
}

function layout(items: Activity[]): Placed[] {
  const timed = items
    .filter((a) => a.time)
    .map((a) => {
      const start = timeToMin(a.time!);
      const end = a.kind === "event" && a.endTime ? Math.max(start + 20, timeToMin(a.endTime)) : start + 30;
      return { a, start, end, col: 0, cols: 1 };
    })
    .sort((x, y) => x.start - y.start || y.end - x.end);

  // cluster overlapping items, then give each one the first free column
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((p) => p.col + 1));
    cluster.forEach((p) => (p.cols = cols));
    cluster = [];
  };
  for (const p of timed) {
    if (p.start >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    const used = new Set(cluster.filter((q) => q.end > p.start).map((q) => q.col));
    let c = 0;
    while (used.has(c)) c++;
    p.col = c;
    cluster.push(p);
    clusterEnd = Math.max(clusterEnd, p.end);
  }
  flush();
  return timed;
}

function DayView({ day, today }: { day: string; today: string }) {
  const { activities, contexts } = useStore();
  const { openNew, openEdit } = useUI();
  const items = useMemo(() => itemsOn(activities, day), [activities, day]);
  const untimed = items.filter((a) => !a.time);
  const placed = useMemo(() => layout(items), [items]);
  const gridRef = useRef<HTMLDivElement>(null);
  const [nowMin, setNowMin] = useState(() => nowParts().minutes);

  useEffect(() => {
    const t = window.setInterval(() => setNowMin(nowParts().minutes), 60_000);
    return () => window.clearInterval(t);
  }, []);

  // bring the useful part of the day into view
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const first = placed[0]?.start;
    const target = day === today ? Math.max(0, nowMin - 90) : first !== undefined ? Math.max(0, first - 60) : 7 * 60;
    const scroller = grid.closest(".sl-main") as HTMLElement | null;
    if (!scroller) return;
    const top = grid.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    const bar = document.querySelector(".sl-agenda-bar") as HTMLElement | null;
    scroller.scrollTo({ top: top + (target / 60) * HOUR - (bar?.offsetHeight ?? 0) - 8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  return (
    <div className="sl-day">
      <section className="sl-allday" aria-label="Sem horário">
        <h2 className="sl-allday-title">Sem horário</h2>
        {untimed.length ? (
          <ul className="sl-list sl-list-tight">
            {untimed.map((a) => (
              <ActivityRow key={a.id} a={a} occurrenceDate={day} />
            ))}
          </ul>
        ) : (
          <button type="button" className="sl-inline-add" onClick={() => openNew({ kind: "task", date: day })}>
            Adicionar tarefa para este dia
          </button>
        )}
      </section>

      <div className="sl-grid" ref={gridRef} style={{ height: 24 * HOUR }}>
        {Array.from({ length: 24 }, (_, h) => (
          <button
            key={h}
            type="button"
            className="sl-slot"
            style={{ top: h * HOUR, height: HOUR }}
            aria-label={`Novo compromisso às ${h}h`}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const half = e.clientY - r.top > r.height / 2 && e.detail > 0 ? 30 : 0;
              const start = h * 60 + half;
              openNew({ kind: "event", date: day, time: minToTime(start), endTime: minToTime(start + 60) });
            }}
          >
            <span className="sl-slot-label">{h === 0 ? "" : `${h}h`}</span>
          </button>
        ))}
        {day === today && (
          <div className="sl-now" style={{ top: (nowMin / 60) * HOUR }} aria-hidden="true">
            <span>{formatTime(minToTime(nowMin))}</span>
          </div>
        )}
        {placed.map((p) => {
          const ctx = contexts.find((c) => c.id === p.a.contextId);
          const h = Math.max(24, ((p.end - p.start) / 60) * HOUR - 2);
          return (
            <button
              key={p.a.id}
              type="button"
              className="sl-block"
              data-kind={p.a.kind}
              data-status={p.a.status}
              style={
                {
                  top: (p.start / 60) * HOUR + 1,
                  height: h,
                  left: `calc(var(--sl-gutter) + (100% - var(--sl-gutter)) * ${p.col / p.cols})`,
                  width: `calc((100% - var(--sl-gutter)) / ${p.cols} - 4px)`,
                  "--c": ctx?.color ?? "var(--sl-ink-2)",
                } as React.CSSProperties
              }
              onClick={() => openEdit(p.a)}
            >
              <span className="sl-block-title">
                {p.a.kind === "task" && <span className="sl-sr">Tarefa: </span>}
                {p.a.title}
              </span>
              {h >= 40 && (
                <span className="sl-block-time">
                  {formatTime(p.a.time!)}
                  {p.a.endTime ? ` às ${formatTime(p.a.endTime)}` : ""}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Week ---------------- */

function WeekView({ start, today }: { start: string; today: string }) {
  const { activities } = useStore();
  const { openNew } = useUI();
  return (
    <div className="sl-week">
      {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => {
        const items = itemsOn(activities, d);
        const untimed = items.filter((a) => !a.time);
        const timed = items.filter((a) => a.time);
        return (
          <section key={d} className="sl-week-day" data-today={d === today || undefined} aria-label={formatLong(d)}>
            <button
              type="button"
              className="sl-week-date"
              onClick={() => openNew({ date: d })}
              aria-label={`Nova atividade em ${formatLong(d)}`}
            >
              <span className="sl-week-n">{dayOfMonth(d)}</span>
              <span className="sl-week-wd">{formatWeekdayShort(d)}</span>
            </button>
            <div className="sl-week-items">
              {items.length === 0 ? (
                <button type="button" className="sl-week-free" onClick={() => openNew({ date: d })}>
                  Livre
                </button>
              ) : (
                <>
                  {untimed.length > 0 && (
                    <>
                      {timed.length > 0 && <p className="sl-mini-label">Sem horário</p>}
                      <ul className="sl-list sl-list-tight">
                        {untimed.map((a) => (
                          <ActivityRow key={a.id} a={a} occurrenceDate={d} />
                        ))}
                      </ul>
                    </>
                  )}
                  {timed.length > 0 && (
                    <ul className="sl-list sl-list-tight">
                      {timed.map((a) => (
                        <ActivityRow key={a.id} a={a} occurrenceDate={d} />
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ---------------- Month ---------------- */

function MonthView({ cursor, today, onPick }: { cursor: string; today: string; onPick: (d: string) => void }) {
  const { activities } = useStore();
  const { openNew } = useUI();
  const first = startOfMonth(cursor);
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const month = first.slice(0, 7);
  const weeks = days[35].slice(0, 7) === month ? 6 : 5;
  const visible = days.slice(0, weeks * 7);
  const selected = cursor;
  const items = itemsOn(activities, selected);
  const untimed = items.filter((a) => !a.time);
  const timed = items.filter((a) => a.time);

  return (
    <div className="sl-month">
      <div className="sl-month-grid" role="grid" aria-label={formatMonthYear(cursor)}>
        <div className="sl-month-head" role="row">
          {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((w) => (
            <span key={w} role="columnheader" className="sl-month-wd">
              {w}
            </span>
          ))}
        </div>
        {Array.from({ length: weeks }, (_, w) => (
          <div key={w} role="row" className="sl-month-row">
            {visible.slice(w * 7, w * 7 + 7).map((d) => {
              const list = itemsOn(activities, d).filter((a) => a.status !== "canceled");
              const outside = d.slice(0, 7) !== month;
              return (
                <button
                  key={d}
                  role="gridcell"
                  type="button"
                  className="sl-month-cell"
                  aria-selected={d === selected}
                  data-today={d === today || undefined}
                  data-outside={outside || undefined}
                  onClick={() => (d === selected ? openNew({ date: d }) : onPick(d))}
                  aria-label={`${formatLong(d)}${list.length ? `, ${list.length} ${list.length === 1 ? "item" : "itens"}` : ""}${d === selected ? ". Toque para adicionar" : ""}`}
                >
                  <span className="sl-month-n">{dayOfMonth(d)}</span>
                  <span className="sl-month-marks" aria-hidden="true">
                    {list.slice(0, 3).map((a) => (
                      <span key={a.id} data-kind={a.kind} data-done={a.status === "done" || undefined} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <section className="sl-month-day" aria-label={formatLong(selected)}>
        <div className="sl-month-day-head">
          <h2 className="sl-section-title">{capitalize(formatLong(selected))}</h2>
          <button
            type="button"
            className="sl-btn sl-btn-outline sl-btn-small"
            onClick={() => openNew({ date: selected })}
          >
            <Plus size={16} weight="bold" aria-hidden="true" />
            Adicionar
          </button>
        </div>
        {items.length === 0 ? (
          <p className="sl-muted">Dia livre. Toque na data de novo ou em Adicionar para criar uma atividade.</p>
        ) : (
          <>
            {untimed.length > 0 && (
              <>
                <p className="sl-mini-label">Sem horário</p>
                <ul className="sl-list sl-list-tight">
                  {untimed.map((a) => (
                    <ActivityRow key={a.id} a={a} occurrenceDate={selected} />
                  ))}
                </ul>
              </>
            )}
            {timed.length > 0 && (
              <>
                {untimed.length > 0 && <p className="sl-mini-label">Com horário</p>}
                <ul className="sl-list sl-list-tight">
                  {timed.map((a) => (
                    <ActivityRow key={a.id} a={a} occurrenceDate={selected} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
