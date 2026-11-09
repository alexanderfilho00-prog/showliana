"use client";

import { X } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";

/**
 * Bottom sheet. Slides up from the bottom edge, keeps its footer above the
 * iOS keyboard by following visualViewport, and closes on Esc / backdrop.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  labelledBy,
  size = "tall",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  labelledBy?: string;
  size?: "tall" | "auto";
}) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const autoId = useId();
  const titleId = labelledBy ?? `sheet-${autoId}`;

  // Mount as soon as it opens (state adjusted during render), animate in on the
  // next frame, and unmount once the closing transition has finished.
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open) {
      restoreRef.current = document.activeElement as HTMLElement | null;
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(r);
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const r = requestAnimationFrame(() => setShown(false));
    const t = window.setTimeout(() => setMounted(false), reduce ? 0 : 260);
    restoreRef.current?.focus?.({ preventScroll: true });
    return () => {
      cancelAnimationFrame(r);
      window.clearTimeout(t);
    };
  }, [open]);

  // focus the panel once visible
  useEffect(() => {
    if (shown) panelRef.current?.focus({ preventScroll: true });
  }, [shown]);

  // keyboard-aware sizing
  useEffect(() => {
    if (!mounted) return;
    const vv = window.visualViewport;
    const root = document.documentElement;
    const update = () => {
      if (!vv) return;
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty("--sl-kb", `${Math.round(kb)}px`);
      root.style.setProperty("--sl-vvh", `${Math.round(vv.height)}px`);
    };
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    document.body.classList.add("sl-lock");
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      root.style.removeProperty("--sl-kb");
      root.style.removeProperty("--sl-vvh");
      document.body.classList.remove("sl-lock");
    };
  }, [mounted]);

  // keep a focused field visible above the keyboard
  useEffect(() => {
    if (!mounted) return;
    const panel = panelRef.current;
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (!el.matches("input, textarea, select")) return;
      window.setTimeout(() => el.scrollIntoView({ block: "nearest" }), 280);
    };
    panel?.addEventListener("focusin", onFocus);
    return () => panel?.removeEventListener("focusin", onFocus);
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div className="sl-sheet-layer" data-shown={shown || undefined}>
      <div className="sl-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="sl-sheet"
        data-size={size}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
          if (e.key === "Tab") trapFocus(e, panelRef.current);
        }}
      >
        <div className="sl-sheet-grip" aria-hidden="true" />
        <div className="sl-sheet-head">
          <h2 id={titleId} className="sl-sheet-title">
            {title}
          </h2>
          <button type="button" className="sl-icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={22} weight="light" />
          </button>
        </div>
        <div className="sl-sheet-body">{children}</div>
        {footer && <div className="sl-sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

function trapFocus(e: React.KeyboardEvent, root: HTMLElement | null) {
  if (!root) return;
  const items = root.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/** Small confirmation dialog, used before anything destructive. */
export function Confirm({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  cancelLabel = "Manter",
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className="sl-confirm-layer" role="presentation" onClick={onCancel}>
      <div
        className="sl-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sl-confirm-title"
        aria-describedby={body ? "sl-confirm-body" : undefined}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
      >
        <h2 id="sl-confirm-title" className="sl-confirm-title">
          {title}
        </h2>
        {body && (
          <p id="sl-confirm-body" className="sl-confirm-body">
            {body}
          </p>
        )}
        <div className="sl-confirm-actions">
          <button ref={ref} type="button" className="sl-btn sl-btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="sl-btn sl-btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
