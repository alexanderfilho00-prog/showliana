"use client";

import { GearSix, Plus } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { addDays, formatLong, formatRelative, greeting, nowParts, timeToMin } from "../lib/dates";
import { itemsOn, sortByTime, useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import type { Activity } from "../lib/types";
import { ActivityRow } from "./ActivityRow";
import { Cat } from "./Cat";

/** Re-render every minute so the greeting, "today" and upcoming list stay true. */
function useClock() {
  const [now, setNow] = useState(() => nowParts());
  useEffect(() => {
    const t = window.setInterval(() => setNow(nowParts()), 30_000);
    const onVis = () => document.visibilityState === "visible" && setNow(nowParts());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return now;
}

export function Today() {
  const { activities } = useStore();
  const { openNew, openSettings } = useUI();
  const now = useClock();
  const today = now.date;

  const { overdue, todayTasks, doneToday, upcoming } = useMemo(() => {
    const tasks = activities.filter((a) => a.kind === "task");
    const overdue = tasks
      .filter((a) => a.status === "open" && a.date && a.date < today)
      .sort((x, y) => (x.date! < y.date! ? -1 : x.date! > y.date! ? 1 : sortByTime(x, y)));
    const todayTasks = tasks.filter((a) => a.status === "open" && a.date === today).sort(sortByTime);
    const doneToday = tasks.filter((a) => a.status === "done" && a.date === today).sort(sortByTime);

    // appointments: what's left of today, then the next 7 days
    const upcoming: { day: string; a: Activity }[] = [];
    for (let i = 0; i < 8; i++) {
      const day = addDays(today, i);
      for (const a of itemsOn(activities, day)) {
        if (a.kind !== "event" || a.status !== "open") continue;
        if (i === 0 && a.endTime && timeToMin(a.endTime) <= now.minutes) continue;
        upcoming.push({ day, a });
      }
    }
    return { overdue, todayTasks, doneToday, upcoming: upcoming.slice(0, 8) };
  }, [activities, today, now.minutes]);

  const empty = !overdue.length && !todayTasks.length && !doneToday.length && !upcoming.length;
  const eventsToday = upcoming.filter((u) => u.day === today).length;

  return (
    <div className="sl-screen sl-today">
      <header className="sl-hello">
        <div className="sl-hello-top">
          <button type="button" className="sl-icon-btn" onClick={openSettings} aria-label="Ajustes e backup">
            <GearSix size={22} weight="light" />
          </button>
        </div>
        <h1 className="sl-greeting">{greeting(now.hour)}, Jú</h1>
        <p className="sl-date">{capitalize(formatLong(today))}</p>
        <div className="sl-hello-rule">
          {!empty && <Cat size={46} className="sl-hello-cat" />}
        </div>
        {!empty && <p className="sl-summary">{summary(todayTasks.length, eventsToday, overdue.length)}</p>}
      </header>

      {empty ? (
        <div className="sl-empty">
          <Cat size={96} sleepy className="sl-empty-cat" />
          <h2 className="sl-empty-title">Seu dia começa aqui</h2>
          <p className="sl-empty-text">Anote uma tarefa ou marque um compromisso para ver tudo nesta página.</p>
          <button type="button" className="sl-btn sl-btn-primary" onClick={() => openNew({ date: today })}>
            <Plus size={18} weight="bold" aria-hidden="true" />
            Nova atividade
          </button>
        </div>
      ) : (
        <>
          {overdue.length > 0 && (
            <section className="sl-section" aria-labelledby="h-overdue">
              <h2 id="h-overdue" className="sl-section-title sl-section-alert">
                Atrasadas <span className="sl-count">{overdue.length}</span>
              </h2>
              <ul className="sl-list">
                {overdue.map((a) => (
                  <ActivityRow key={a.id} a={a} showDate />
                ))}
              </ul>
            </section>
          )}

          <section className="sl-section" aria-labelledby="h-today">
            <h2 id="h-today" className="sl-section-title">
              Tarefas de hoje <span className="sl-count">{todayTasks.length || ""}</span>
            </h2>
            {todayTasks.length || doneToday.length ? (
              <ul className="sl-list">
                {todayTasks.map((a) => (
                  <ActivityRow key={a.id} a={a} />
                ))}
                {doneToday.map((a) => (
                  <ActivityRow key={a.id} a={a} />
                ))}
              </ul>
            ) : (
              <button type="button" className="sl-inline-add" onClick={() => openNew({ date: today })}>
                Nada com prazo para hoje. Adicionar tarefa
              </button>
            )}
          </section>

          <section className="sl-section" aria-labelledby="h-next">
            <h2 id="h-next" className="sl-section-title">
              Próximos compromissos
            </h2>
            {upcoming.length ? (
              <UpcomingList items={upcoming} today={today} />
            ) : (
              <button
                type="button"
                className="sl-inline-add"
                onClick={() => openNew({ kind: "event", date: today })}
              >
                Nenhum compromisso nos próximos 7 dias. Marcar um
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function UpcomingList({ items, today }: { items: { day: string; a: Activity }[]; today: string }) {
  const groups: { day: string; list: Activity[] }[] = [];
  for (const it of items) {
    const g = groups.at(-1);
    if (g && g.day === it.day) g.list.push(it.a);
    else groups.push({ day: it.day, list: [it.a] });
  }
  return (
    <div className="sl-groups">
      {groups.map((g) => (
        <div key={g.day} className="sl-group">
          <h3 className="sl-group-title">{capitalize(formatRelative(g.day, today))}</h3>
          <ul className="sl-list">
            {g.list.map((a) => (
              <ActivityRow key={`${a.id}-${g.day}`} a={a} occurrenceDate={g.day} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function summary(tasks: number, events: number, overdue: number) {
  const parts: string[] = [];
  if (tasks) parts.push(`${tasks} ${tasks === 1 ? "tarefa" : "tarefas"}`);
  if (events) parts.push(`${events} ${events === 1 ? "compromisso" : "compromissos"}`);
  let s = parts.length ? `Hoje você tem ${parts.join(" e ")}.` : "Nada marcado para hoje.";
  if (overdue) s += ` ${overdue} ${overdue === 1 ? "tarefa atrasada espera" : "tarefas atrasadas esperam"} por você.`;
  return s;
}
