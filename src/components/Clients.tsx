"use client";

import { CaretLeft, CaretRight, PencilSimple, Plus } from "@phosphor-icons/react";
import { useEffect, useId, useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import { SWATCHES, type Client, type Context } from "../lib/types";
import { Field } from "./ActivitySheet";
import { ActivityRow } from "./ActivityRow";
import { Cat } from "./Cat";
import { Confirm, Sheet } from "./Sheet";

export function Clients() {
  const { clients, contexts, activities } = useStore();
  const { toast } = useUI();
  const [viewing, setViewing] = useState<string | null>(null);
  // `seq` remounts each form on open so its fields start from the record being edited.
  const [clientForm, setClientFormState] = useState<{ open: boolean; edit: Client | null; seq: number }>({ open: false, edit: null, seq: 0 });
  const [ctxForm, setCtxFormState] = useState<{ open: boolean; edit: Context | null; seq: number }>({ open: false, edit: null, seq: 0 });
  const setClientForm = (v: { open: boolean; edit: Client | null }) => setClientFormState((s) => ({ ...v, seq: s.seq + 1 }));
  const setCtxForm = (v: { open: boolean; edit: Context | null }) => setCtxFormState((s) => ({ ...v, seq: s.seq + 1 }));

  const openCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of activities) {
      if (a.status !== "open") continue;
      if (a.clientId) m.set(a.clientId, (m.get(a.clientId) ?? 0) + 1);
      if (a.contextId) m.set(a.contextId, (m.get(a.contextId) ?? 0) + 1);
    }
    return m;
  }, [activities]);

  const current = viewing ? clients.find((c) => c.id === viewing) : null;

  return (
    <>
      {current ? (
        <ClientDetail client={current} onBack={() => setViewing(null)} onEdit={() => setClientForm({ open: true, edit: current })} />
      ) : (
        <div className="sl-screen">
          <header className="sl-head">
            <h1 className="sl-title">Clientes</h1>
            {clients.length > 0 && (
              <button
                type="button"
                className="sl-btn sl-btn-outline sl-btn-small"
                onClick={() => setClientForm({ open: true, edit: null })}
              >
                <Plus size={16} weight="bold" aria-hidden="true" />
                Novo cliente
              </button>
            )}
          </header>

          {clients.length === 0 ? (
            <div className="sl-empty sl-empty-compact">
              <Cat size={72} className="sl-empty-cat" />
              <h2 className="sl-empty-title">Nenhum cliente ainda</h2>
              <p className="sl-empty-text">Cadastre marcas e clientes para ver as atividades de cada um em um só lugar.</p>
              <button type="button" className="sl-btn sl-btn-primary" onClick={() => setClientForm({ open: true, edit: null })}>
                <Plus size={18} weight="bold" aria-hidden="true" />
                Novo cliente
              </button>
            </div>
          ) : (
            <ul className="sl-list sl-nav-list">
              {clients.map((c) => (
                <li key={c.id}>
                  <button type="button" className="sl-nav-row" onClick={() => setViewing(c.id)}>
                    <span className="sl-swatch" style={{ background: c.color }} aria-hidden="true" />
                    <span className="sl-nav-row-text">
                      <span className="sl-nav-row-title">{c.name}</span>
                      <span className="sl-nav-row-meta">{plural(openCount.get(c.id) ?? 0)}</span>
                    </span>
                    <CaretRight size={18} weight="light" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <section className="sl-section sl-contexts" aria-labelledby="h-ctx">
            <div className="sl-section-head">
              <h2 id="h-ctx" className="sl-section-title">
                Contextos
              </h2>
              <button type="button" className="sl-link" onClick={() => setCtxForm({ open: true, edit: null })}>
                Novo contexto
              </button>
            </div>
            <p className="sl-muted">Áreas da sua vida e do trabalho. Toque para renomear ou trocar a cor.</p>
            <ul className="sl-list sl-nav-list">
              {contexts.map((c) => (
                <li key={c.id}>
                  <button type="button" className="sl-nav-row" onClick={() => setCtxForm({ open: true, edit: c })}>
                    <span className="sl-tick sl-tick-tall" style={{ background: c.color }} aria-hidden="true" />
                    <span className="sl-nav-row-text">
                      <span className="sl-nav-row-title">{c.name}</span>
                      <span className="sl-nav-row-meta">{plural(openCount.get(c.id) ?? 0)}</span>
                    </span>
                    <PencilSimple size={18} weight="light" aria-label="Editar" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <ClientSheet
        key={`c${clientForm.seq}`}
        open={clientForm.open}
        edit={clientForm.edit}
        onClose={() => setClientFormState((s) => ({ ...s, open: false }))}
        onSaved={(msg, id) => {
          toast(msg);
          if (id === null) setViewing(null);
        }}
      />
      <ContextSheet
        key={`x${ctxForm.seq}`}
        open={ctxForm.open}
        edit={ctxForm.edit}
        onClose={() => setCtxFormState((s) => ({ ...s, open: false }))}
        onSaved={toast}
      />
    </>
  );
}

const plural = (n: number) => (n === 0 ? "Nada em aberto" : `${n} em aberto`);

function ClientDetail({ client, onBack, onEdit }: { client: Client; onBack: () => void; onEdit: () => void }) {
  const { activities } = useStore();
  const { openNew } = useUI();
  const mine = activities.filter((a) => a.clientId === client.id);
  const open = mine
    .filter((a) => a.status === "open")
    .sort((a, b) => (a.date ?? "9999") < (b.date ?? "9999") ? -1 : (a.date ?? "9999") > (b.date ?? "9999") ? 1 : 0);
  const closed = mine
    .filter((a) => a.status !== "open")
    .sort((a, b) => (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt));

  useEffect(() => {
    document.querySelector(".sl-main")?.scrollTo({ top: 0 });
  }, [client.id]);

  return (
    <div className="sl-screen">
      <div className="sl-back-row">
        <button type="button" className="sl-back" onClick={onBack}>
          <CaretLeft size={20} weight="light" aria-hidden="true" />
          Clientes
        </button>
        <button type="button" className="sl-btn sl-btn-outline sl-btn-small" onClick={onEdit}>
          Editar
        </button>
      </div>
      <header className="sl-client-head">
        <span className="sl-swatch sl-swatch-lg" style={{ background: client.color }} aria-hidden="true" />
        <h1 className="sl-title">{client.name}</h1>
      </header>
      {client.notes && <p className="sl-notes">{client.notes}</p>}

      <button
        type="button"
        className="sl-btn sl-btn-primary sl-btn-block"
        onClick={() => openNew({ clientId: client.id })}
      >
        <Plus size={18} weight="bold" aria-hidden="true" />
        Nova atividade para {client.name}
      </button>

      <section className="sl-section" aria-labelledby="h-c-open">
        <h2 id="h-c-open" className="sl-section-title">
          Em aberto <span className="sl-count">{open.length || ""}</span>
        </h2>
        {open.length ? (
          <ul className="sl-list">
            {open.map((a) => (
              <ActivityRow key={a.id} a={a} showDate />
            ))}
          </ul>
        ) : (
          <p className="sl-muted">Nenhuma atividade em aberto para este cliente.</p>
        )}
      </section>
      {closed.length > 0 && (
        <section className="sl-section" aria-labelledby="h-c-closed">
          <h2 id="h-c-closed" className="sl-section-title">
            Histórico <span className="sl-count">{closed.length}</span>
          </h2>
          <ul className="sl-list">
            {closed.map((a) => (
              <ActivityRow key={a.id} a={a} showDate />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SwatchPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <fieldset className="sl-fieldset">
      <legend className="sl-label">{label}</legend>
      <div className="sl-swatches" role="radiogroup" aria-label={label}>
        {SWATCHES.map((s) => (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={value === s.value}
            aria-label={s.name}
            className="sl-swatch-opt"
            style={{ "--c": s.value } as React.CSSProperties}
            onClick={() => onChange(s.value)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function ClientSheet({
  open,
  edit,
  onClose,
  onSaved,
}: {
  open: boolean;
  edit: Client | null;
  onClose: () => void;
  onSaved: (msg: string, id: string | null) => void;
}) {
  const { saveClient, deleteClient, clients } = useStore();
  const [name, setName] = useState(edit?.name ?? "");
  const [color, setColor] = useState(edit?.color ?? SWATCHES[clients.length % SWATCHES.length].value);
  const [notes, setNotes] = useState(edit?.notes ?? "");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const id = useId();

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!name.trim()) {
      setError("Dê um nome ao cliente.");
      return;
    }
    const c = await saveClient({ id: edit?.id, name, color, notes });
    onSaved(edit ? "Cliente atualizado" : "Cliente salvo", c.id);
    onClose();
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        size="auto"
        title={edit ? "Editar cliente" : "Novo cliente"}
        footer={
          <>
            <button type="button" className="sl-btn sl-btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" form={id} className="sl-btn sl-btn-primary">
              Salvar
            </button>
          </>
        }
      >
        <form id={id} className="sl-form" onSubmit={submit} noValidate>
          <Field label="Nome" error={error} htmlFor={`${id}-name`}>
            <input
              id={`${id}-name`}
              className="sl-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="Marca ou cliente"
              autoComplete="off"
              aria-invalid={!!error}
              enterKeyHint="done"
            />
          </Field>
          <SwatchPicker value={color} onChange={setColor} label="Cor" />
          <Field label="Notas" htmlFor={`${id}-notes`}>
            <textarea
              id={`${id}-notes`}
              className="sl-input sl-textarea"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contato, briefing, combinados"
            />
          </Field>
          {edit && (
            <div className="sl-actions">
              <button type="button" className="sl-btn sl-btn-text-danger" onClick={() => setConfirm(true)}>
                Excluir cliente
              </button>
            </div>
          )}
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      </Sheet>
      <Confirm
        open={confirm}
        title={`Excluir ${edit?.name ?? "cliente"}?`}
        body="As atividades continuam na agenda, só sem cliente."
        confirmLabel="Excluir"
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          if (!edit) return;
          setConfirm(false);
          await deleteClient(edit.id);
          onSaved("Cliente excluído", null);
          onClose();
        }}
      />
    </>
  );
}

function ContextSheet({
  open,
  edit,
  onClose,
  onSaved,
}: {
  open: boolean;
  edit: Context | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const { saveContext, deleteContext, contexts } = useStore();
  const [name, setName] = useState(edit?.name ?? "");
  const [color, setColor] = useState(edit?.color ?? SWATCHES[(contexts.length + 2) % SWATCHES.length].value);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const id = useId();

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!name.trim()) {
      setError("Dê um nome ao contexto.");
      return;
    }
    await saveContext({ id: edit?.id, name, color });
    onSaved(edit ? "Contexto atualizado" : "Contexto salvo");
    onClose();
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        size="auto"
        title={edit ? "Editar contexto" : "Novo contexto"}
        footer={
          <>
            <button type="button" className="sl-btn sl-btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" form={id} className="sl-btn sl-btn-primary">
              Salvar
            </button>
          </>
        }
      >
        <form id={id} className="sl-form" onSubmit={submit} noValidate>
          <Field label="Nome" error={error} htmlFor={`${id}-name`}>
            <input
              id={`${id}-name`}
              className="sl-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              autoComplete="off"
              aria-invalid={!!error}
              enterKeyHint="done"
            />
          </Field>
          <SwatchPicker value={color} onChange={setColor} label="Cor" />
          {edit && contexts.length > 1 && (
            <div className="sl-actions">
              <button type="button" className="sl-btn sl-btn-text-danger" onClick={() => setConfirm(true)}>
                Excluir contexto
              </button>
            </div>
          )}
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      </Sheet>
      <Confirm
        open={confirm}
        title={`Excluir ${edit?.name ?? "contexto"}?`}
        body="As atividades desse contexto continuam salvas, só sem contexto."
        confirmLabel="Excluir"
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          if (!edit) return;
          setConfirm(false);
          await deleteContext(edit.id);
          onSaved("Contexto excluído");
          onClose();
        }}
      />
    </>
  );
}
