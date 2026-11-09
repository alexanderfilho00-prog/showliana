"use client";

import { AddressBook, CalendarBlank, CheckSquare, House, Plus } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as db from "../lib/db";
import { StoreProvider, useStore } from "../lib/store";
import { UICtx, type Prefill, type UIValue } from "../lib/ui";
import type { Activity } from "../lib/types";
import { ActivitySheet } from "./ActivitySheet";
import { Agenda } from "./Agenda";
import { Cat } from "./Cat";
import { Clients } from "./Clients";
import { Settings } from "./Settings";
import { Tasks } from "./Tasks";
import { Today } from "./Today";

type Tab = "hoje" | "tarefas" | "agenda" | "clientes";
const TABS: { id: Tab; label: string; Icon: typeof House }[] = [
  { id: "hoje", label: "Hoje", Icon: House },
  { id: "tarefas", label: "Tarefas", Icon: CheckSquare },
  { id: "agenda", label: "Agenda", Icon: CalendarBlank },
  { id: "clientes", label: "Clientes", Icon: AddressBook },
];

export default function ShowlianaApp() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const { ready } = useStore();
  const [tab, setTab] = useState<Tab>("hoje");
  const [sheet, setSheet] = useState<{ open: boolean; edit: Activity | null; prefill: Prefill | null; seq: number }>({
    open: false,
    edit: null,
    prefill: null,
    seq: 0,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ id: number; text: string } | null>(null);
  const [dedication, setDedication] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // first-open dedication
  useEffect(() => {
    let seenLocal = false;
    try {
      seenLocal = localStorage.getItem("sl-dedication-seen") === "1";
    } catch {}
    if (seenLocal) return;
    db.getMeta<boolean>("dedicationSeen")
      .then((seen) => !seen && setDedication(true))
      .catch(() => {});
  }, []);

  // service worker for offline use (production builds only)
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(async () => {
        const reg = await navigator.serviceWorker.ready;
        // cache everything this page already loaded, so the next open works offline
        const urls = performance
          .getEntriesByType("resource")
          .map((e) => e.name)
          .filter((u) => u.startsWith(location.origin));
        reg.active?.postMessage({ type: "cache-urls", urls: [location.pathname, ...urls] });
      })
      .catch(() => {});
  }, []);

  const toast = useCallback((text: string) => setToastMsg({ id: Date.now(), text }), []);
  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 2800);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  const ui = useMemo<UIValue>(
    () => ({
      openNew: (prefill) => setSheet((s) => ({ open: true, edit: null, prefill: prefill ?? null, seq: s.seq + 1 })),
      openEdit: (a) => setSheet((s) => ({ open: true, edit: a, prefill: null, seq: s.seq + 1 })),
      toast,
      openSettings: () => setSettingsOpen(true),
    }),
    [toast],
  );

  const go = (t: Tab) => {
    if (t === tab) mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setTab(t);
  };

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  return (
    <UICtx.Provider value={ui}>
      <div className="sl-app">
        <main ref={mainRef} className="sl-main" aria-busy={!ready}>
          {!ready ? (
            <div className="sl-loading" aria-label="Carregando">
              <Cat size={56} sleepy />
            </div>
          ) : tab === "hoje" ? (
            <Today />
          ) : tab === "tarefas" ? (
            <Tasks />
          ) : tab === "agenda" ? (
            <Agenda />
          ) : (
            <Clients />
          )}
        </main>

        <nav className="sl-tabbar" aria-label="Navegação principal">
          {TABS.slice(0, 2).map((t) => (
            <TabButton key={t.id} {...t} active={tab === t.id} onClick={() => go(t.id)} />
          ))}
          <div className="sl-fab-slot">
            <button
              type="button"
              className="sl-fab"
              aria-label="Nova atividade"
              onClick={() => ui.openNew()}
            >
              <Plus size={26} weight="regular" />
            </button>
          </div>
          {TABS.slice(2).map((t) => (
            <TabButton key={t.id} {...t} active={tab === t.id} onClick={() => go(t.id)} />
          ))}
        </nav>

        <div className="sl-toast-zone" aria-live="polite" role="status">
          {toastMsg && (
            <div key={toastMsg.id} className="sl-toast">
              {toastMsg.text}
            </div>
          )}
        </div>

        <ActivitySheet
          key={sheet.seq}
          open={sheet.open}
          edit={sheet.edit}
          prefill={sheet.prefill}
          onClose={() => setSheet((s) => ({ ...s, open: false }))}
          onSaved={toast}
        />
        <Settings
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onShowDedication={() => {
            setSettingsOpen(false);
            setDedication(true);
          }}
        />
        {dedication && (
          <Dedication
            onClose={() => {
              setDedication(false);
              // localStorage is written synchronously, so a quick reload can't bring it back
              try {
                localStorage.setItem("sl-dedication-seen", "1");
              } catch {}
              db.setMeta("dedicationSeen", true).catch(() => {});
            }}
          />
        )}
      </div>
    </UICtx.Provider>
  );
}

function TabButton({
  label,
  Icon,
  active,
  onClick,
}: {
  label: string;
  Icon: typeof House;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="sl-tab" aria-current={active ? "page" : undefined} onClick={onClick}>
      <span className="sl-tab-icon">
        <Icon size={24} weight={active ? "regular" : "light"} aria-hidden="true" />
      </span>
      <span className="sl-tab-label">{label}</span>
    </button>
  );
}

function Dedication({ onClose }: { onClose: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => btn.current?.focus(), []);
  return (
    <div className="sl-dedication" role="dialog" aria-modal="true" aria-labelledby="sl-ded-text">
      <div className="sl-dedication-card" onKeyDown={(e) => e.key === "Escape" && onClose()}>
        <Cat size={88} className="sl-dedication-cat" />
        <p id="sl-ded-text" className="sl-dedication-text">
          Pra Jú, com carinho.
          <span className="sl-dedication-sign">— Alex</span>
        </p>
        <button ref={btn} type="button" className="sl-btn sl-btn-primary" onClick={onClose}>
          Abrir minha agenda
        </button>
      </div>
    </div>
  );
}
