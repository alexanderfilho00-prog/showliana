"use client";

import { CaretDown, XCircle } from "@phosphor-icons/react";
import { useId, useRef, useState } from "react";
import { addDays, minToTime, nowParts, timeToMin, todayISO, formatDayMonth } from "../lib/dates";
import { useStore } from "../lib/store";
import type { Prefill } from "../lib/ui";
import { PRIORITY_LABEL, type Activity, type Kind, type Priority } from "../lib/types";
import { Confirm, Sheet } from "./Sheet";

interface FormState {
  kind: Kind;
  title: string;
  contextId: string | null;
  clientId: string | null;
  date: string;
  time: string;
  endTime: string;
  description: string;
  priority: Priority;
  repeatWeekly: boolean;
}

type Errors = Partial<Record<"title" | "date" | "time" | "endTime", string>>;

function nextHalfHour() {
  const m = nowParts().minutes;
  return Math.min(22 * 60 + 30, Math.ceil((m + 1) / 30) * 30);
}

function initialState(edit: Activity | null, prefill: Prefill | null, fallbackContext: string | null): FormState {
  if (edit) {
    return {
      kind: edit.kind,
      title: edit.title,
      contextId: edit.contextId,
      clientId: edit.clientId,
      date: edit.date ?? "",
      time: edit.time ?? "",
      endTime: edit.endTime ?? "",
      description: edit.description,
      priority: edit.priority,
      repeatWeekly: edit.repeatWeekly,
    };
  }
  const p = prefill ?? {};
  const kind = p.kind ?? "task";
  const start = p.time ?? null;
  return {
    kind,
    title: "",
    contextId: p.contextId ?? fallbackContext,
    clientId: p.clientId ?? null,
    date: p.date ?? "",
    time: start ?? "",
    endTime: p.endTime ?? (start ? minToTime(timeToMin(start) + 60) : ""),
    description: "",
    priority: "media",
    repeatWeekly: false,
  };
}

export function ActivitySheet({
  open,
  edit,
  prefill,
  onClose,
  onSaved,
}: {
  open: boolean;
  edit: Activity | null;
  prefill: Prefill | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const { contexts, clients, saveActivity, complete, reopen, cancel, deleteActivity } = useStore();
  const [f, setF] = useState<FormState>(() => initialState(edit, prefill, contexts[0]?.id ?? null));
  const [errors, setErrors] = useState<Errors>({});
  // The parent remounts this component (via `key`) for every opening, so the
  // initial state below is always fresh.
  const [more, setMore] = useState(
    () => !!edit && (!!edit.description || edit.priority !== "media" || edit.repeatWeekly),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const formId = useId();

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF((s) => ({ ...s, [k]: v }));
    if (k in errors) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const switchKind = (kind: Kind) => {
    setF((s) => {
      if (kind === "event") {
        const start = s.time || minToTime(nextHalfHour());
        return {
          ...s,
          kind,
          date: s.date || todayISO(),
          time: start,
          endTime: s.endTime || minToTime(timeToMin(start) + 60),
        };
      }
      return { ...s, kind };
    });
    setErrors({});
  };

  function validate(): Errors {
    const e: Errors = {};
    if (!f.title.trim()) e.title = "Dê um título para a atividade.";
    if (f.kind === "event") {
      if (!f.date) e.date = "Escolha a data do compromisso.";
      if (!f.time) e.time = "Informe o início.";
      if (!f.endTime) e.endTime = "Informe o fim.";
      else if (f.time && timeToMin(f.endTime) <= timeToMin(f.time))
        e.endTime = "O fim precisa ser depois do início.";
    } else if (f.time && !f.date) {
      e.date = "Para usar horário, escolha também o prazo.";
    }
    return e;
  }

  async function submit(ev?: React.FormEvent) {
    ev?.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      if (e.title) titleRef.current?.focus();
      return;
    }
    await saveActivity({
      id: edit?.id,
      kind: f.kind,
      title: f.title,
      contextId: f.contextId,
      clientId: f.clientId,
      date: f.date || null,
      time: f.time || null,
      endTime: f.kind === "event" ? f.endTime || null : null,
      description: f.description.trim(),
      priority: f.priority,
      repeatWeekly: f.repeatWeekly,
    });
    const noun = f.kind === "task" ? "Tarefa" : "Compromisso";
    onSaved(edit ? `${noun} atualizad${f.kind === "task" ? "a" : "o"}` : `${noun} salv${f.kind === "task" ? "a" : "o"}`);
    onClose();
  }

  const isTask = f.kind === "task";
  const noun = isTask ? "tarefa" : "compromisso";
  const today = todayISO();

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={edit ? (isTask ? "Editar tarefa" : "Editar compromisso") : "Nova atividade"}
        footer={
          <>
            <button type="button" className="sl-btn sl-btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" form={formId} className="sl-btn sl-btn-primary">
              Salvar
            </button>
          </>
        }
      >
        <form id={formId} className="sl-form" onSubmit={submit} noValidate>
          {!edit && (
            <div className="sl-seg" role="radiogroup" aria-label="Tipo de atividade">
              {(["task", "event"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={f.kind === k}
                  className="sl-seg-item"
                  onClick={() => switchKind(k)}
                >
                  {k === "task" ? "Tarefa" : "Compromisso"}
                </button>
              ))}
            </div>
          )}

          <Field label="Título" error={errors.title} htmlFor={`${formId}-title`}>
            <input
              ref={titleRef}
              id={`${formId}-title`}
              className="sl-input"
              value={f.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder={isTask ? "Ex.: Revisar apresentação" : "Ex.: Reunião de alinhamento"}
              enterKeyHint="done"
              autoComplete="off"
              aria-invalid={!!errors.title}
            />
          </Field>

          {isTask ? (
            <div className="sl-grid2">
              <Field label="Prazo (opcional)" error={errors.date} htmlFor={`${formId}-date`}>
                <ClearableInput
                  id={`${formId}-date`}
                  type="date"
                  value={f.date}
                  onChange={(v) => set("date", v)}
                  clearLabel="Remover prazo"
                  invalid={!!errors.date}
                />
              </Field>
              <Field label="Horário (opcional)" htmlFor={`${formId}-time`}>
                <ClearableInput
                  id={`${formId}-time`}
                  type="time"
                  value={f.time}
                  onChange={(v) => set("time", v)}
                  clearLabel="Remover horário"
                />
              </Field>
            </div>
          ) : (
            <>
              <Field label="Data" error={errors.date} htmlFor={`${formId}-date`}>
                <input
                  id={`${formId}-date`}
                  type="date"
                  className="sl-input"
                  value={f.date}
                  onChange={(e) => set("date", e.target.value)}
                  aria-invalid={!!errors.date}
                  required
                />
              </Field>
              <div className="sl-grid2">
                <Field label="Início" error={errors.time} htmlFor={`${formId}-start`}>
                  <input
                    id={`${formId}-start`}
                    type="time"
                    className="sl-input"
                    value={f.time}
                    onChange={(e) => {
                      const v = e.target.value;
                      setF((s) => {
                        // keep the duration when moving the start
                        const dur =
                          s.time && s.endTime ? Math.max(15, timeToMin(s.endTime) - timeToMin(s.time)) : 60;
                        return { ...s, time: v, endTime: v ? minToTime(timeToMin(v) + dur) : s.endTime };
                      });
                      setErrors((er) => ({ ...er, time: undefined, endTime: undefined }));
                    }}
                    aria-invalid={!!errors.time}
                    required
                  />
                </Field>
                <Field label="Fim" error={errors.endTime} htmlFor={`${formId}-end`}>
                  <input
                    id={`${formId}-end`}
                    type="time"
                    className="sl-input"
                    value={f.endTime}
                    onChange={(e) => set("endTime", e.target.value)}
                    aria-invalid={!!errors.endTime}
                    required
                  />
                </Field>
              </div>
            </>
          )}

          {isTask && !f.date && (
            <div className="sl-quick" aria-label="Atalhos de prazo">
              <button type="button" className="sl-chip" onClick={() => set("date", today)}>
                Hoje
              </button>
              <button type="button" className="sl-chip" onClick={() => set("date", addDays(today, 1))}>
                Amanhã
              </button>
              <button type="button" className="sl-chip" onClick={() => set("date", addDays(today, 7))}>
                Em uma semana
              </button>
            </div>
          )}

          <fieldset className="sl-fieldset">
            <legend className="sl-label">Contexto</legend>
            <div className="sl-chips" role="radiogroup" aria-label="Contexto">
              {contexts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={f.contextId === c.id}
                  className="sl-chip"
                  onClick={() => set("contextId", f.contextId === c.id ? null : c.id)}
                >
                  <span className="sl-tick" style={{ background: c.color }} aria-hidden="true" />
                  {c.name}
                </button>
              ))}
            </div>
          </fieldset>

          <Field label="Cliente (opcional)" htmlFor={`${formId}-client`}>
            <div className="sl-select">
              <select
                id={`${formId}-client`}
                className="sl-input"
                value={f.clientId ?? ""}
                onChange={(e) => set("clientId", e.target.value || null)}
              >
                <option value="">Nenhum</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <CaretDown size={18} weight="light" aria-hidden="true" />
            </div>
          </Field>

          <button
            type="button"
            className="sl-disclosure"
            aria-expanded={more}
            aria-controls={`${formId}-more`}
            onClick={() => setMore((m) => !m)}
          >
            Mais opções
            <CaretDown size={18} weight="light" aria-hidden="true" />
          </button>

          {more && (
            <div id={`${formId}-more`} className="sl-more">
              <Field label="Descrição" htmlFor={`${formId}-desc`}>
                <textarea
                  id={`${formId}-desc`}
                  className="sl-input sl-textarea"
                  rows={3}
                  value={f.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Detalhes, links, referências"
                />
              </Field>
              <fieldset className="sl-fieldset">
                <legend className="sl-label">Prioridade</legend>
                <div className="sl-seg sl-seg-small" role="radiogroup" aria-label="Prioridade">
                  {(["baixa", "media", "alta"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={f.priority === p}
                      className="sl-seg-item"
                      onClick={() => set("priority", p)}
                    >
                      {PRIORITY_LABEL[p]}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="sl-switch-row">
                <span>
                  Repetir toda semana
                  <small>
                    {isTask
                      ? "Ao concluir, a próxima é criada para 7 dias depois."
                      : "Aparece na agenda no mesmo dia da semana."}
                  </small>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  className="sl-switch"
                  checked={f.repeatWeekly}
                  onChange={(e) => set("repeatWeekly", e.target.checked)}
                />
              </label>
            </div>
          )}

          {edit && (
            <div className="sl-actions" aria-label={`Ações da ${noun}`}>
              {edit.kind === "task" && edit.status === "open" && (
                <button
                  type="button"
                  className="sl-btn sl-btn-outline"
                  onClick={async () => {
                    const next = await complete(edit.id);
                    onSaved(next ? `Tarefa concluída. A próxima fica para ${formatDayMonth(next.date!)}` : "Tarefa concluída");
                    onClose();
                  }}
                >
                  Concluir tarefa
                </button>
              )}
              {edit.status !== "open" && (
                <button
                  type="button"
                  className="sl-btn sl-btn-outline"
                  onClick={async () => {
                    await reopen(edit.id);
                    onSaved(isTask ? "Tarefa reaberta" : "Compromisso reaberto");
                    onClose();
                  }}
                >
                  Reabrir
                </button>
              )}
              {edit.status === "open" && (
                <button
                  type="button"
                  className="sl-btn sl-btn-outline"
                  onClick={async () => {
                    await cancel(edit.id);
                    onSaved(isTask ? "Tarefa cancelada" : "Compromisso cancelado");
                    onClose();
                  }}
                >
                  {isTask ? "Cancelar tarefa" : "Cancelar compromisso"}
                </button>
              )}
              <button type="button" className="sl-btn sl-btn-text-danger" onClick={() => setConfirmDelete(true)}>
                Excluir
              </button>
            </div>
          )}
          {/* lets the keyboard "Ir" key submit */}
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      </Sheet>
      <Confirm
        open={confirmDelete}
        title={isTask ? "Excluir esta tarefa?" : "Excluir este compromisso?"}
        body={isTask ? "A tarefa sai de todas as telas e não pode ser recuperada." : "O compromisso sai de todas as telas e não pode ser recuperado."}
        confirmLabel="Excluir"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (!edit) return;
          setConfirmDelete(false);
          await deleteActivity(edit.id);
          onSaved(isTask ? "Tarefa excluída" : "Compromisso excluído");
          onClose();
        }}
      />
    </>
  );
}

export function Field({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="sl-field" data-invalid={error ? "" : undefined}>
      <label className="sl-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error && (
        <p className="sl-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function ClearableInput({
  id,
  type,
  value,
  onChange,
  clearLabel,
  invalid,
}: {
  id: string;
  type: "date" | "time";
  value: string;
  onChange: (v: string) => void;
  clearLabel: string;
  invalid?: boolean;
}) {
  return (
    <div className="sl-clearable" data-empty={!value || undefined}>
      <input
        id={id}
        type={type}
        className="sl-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
      />
      {value && (
        <button type="button" className="sl-clear" onClick={() => onChange("")} aria-label={clearLabel}>
          <XCircle size={20} weight="light" />
        </button>
      )}
    </div>
  );
}
