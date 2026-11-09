"use client";

import { DownloadSimple, UploadSimple } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { todayISO } from "../lib/dates";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import type { Backup } from "../lib/types";
import { Confirm, Sheet } from "./Sheet";

export function Settings({
  open,
  onClose,
  onShowDedication,
}: {
  open: boolean;
  onClose: () => void;
  onShowDedication: () => void;
}) {
  const { exportBackup, importBackup, activities, clients } = useStore();
  const { toast } = useUI();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [error, setError] = useState("");

  async function doExport() {
    const data = JSON.stringify(exportBackup(), null, 2);
    const name = `showliana-backup-${todayISO()}.json`;
    const file = new File([data], name, { type: "application/json" });
    // On iPhone the share sheet is the friendliest way to save to Arquivos.
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (/iPhone|iPad/.test(navigator.userAgent) && nav.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
        toast("Backup exportado");
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast("Backup exportado");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    setError("");
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text());
      if (parsed?.app !== "showliana") throw new Error("Este arquivo não é um backup do Showliana.");
      setPending(parsed);
    } catch (err) {
      setError(err instanceof SyntaxError ? "Não foi possível ler o arquivo. Escolha um .json exportado pelo Showliana." : (err as Error).message);
    }
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Ajustes" size="auto">
        <div className="sl-form">
          <section className="sl-settings-block" aria-labelledby="h-backup">
            <h3 id="h-backup" className="sl-settings-title">
              Backup
            </h3>
            <p className="sl-muted">
              Seus dados ficam guardados só neste aparelho. Exporte um backup de vez em quando e guarde no Arquivos
              ou no iCloud Drive.
            </p>
            <p className="sl-muted">
              Agora: {activities.length} {activities.length === 1 ? "atividade" : "atividades"} e {clients.length}{" "}
              {clients.length === 1 ? "cliente" : "clientes"}.
            </p>
            <div className="sl-stack">
              <button type="button" className="sl-btn sl-btn-outline sl-btn-block" onClick={doExport}>
                <DownloadSimple size={18} weight="light" aria-hidden="true" />
                Exportar backup
              </button>
              <button type="button" className="sl-btn sl-btn-outline sl-btn-block" onClick={() => fileRef.current?.click()}>
                <UploadSimple size={18} weight="light" aria-hidden="true" />
                Importar backup
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={onFile}
                data-testid="import-input"
              />
              {error && (
                <p className="sl-error" role="alert">
                  {error}
                </p>
              )}
            </div>
          </section>
          <section className="sl-settings-block" aria-labelledby="h-about">
            <h3 id="h-about" className="sl-settings-title">
              Sobre
            </h3>
            <p className="sl-muted">Showliana, a agenda da Jú. Feita pelo Alex.</p>
            <button type="button" className="sl-link" onClick={onShowDedication}>
              Ver a dedicatória
            </button>
          </section>
        </div>
      </Sheet>
      <Confirm
        open={!!pending}
        title="Substituir os dados deste aparelho?"
        body={
          pending
            ? `O backup tem ${pending.activities.length} atividades e ${pending.clients.length} clientes. Tudo o que está no app agora será trocado por ele.`
            : undefined
        }
        confirmLabel="Substituir"
        cancelLabel="Cancelar"
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          const b = pending;
          setPending(null);
          try {
            const r = await importBackup(b);
            toast(`Backup importado: ${r.activities} atividades`);
            onClose();
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      />
    </>
  );
}
