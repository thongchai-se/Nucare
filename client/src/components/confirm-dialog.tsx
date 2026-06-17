"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, X } from "lucide-react";

type ConfirmDialogProps = {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  placement?: "viewport" | "admin-content";
  title: string;
};

export function ConfirmDialog({
  cancelLabel = "ยกเลิก",
  confirmLabel = "ยืนยัน",
  description,
  loading = false,
  onCancel,
  onConfirm,
  open,
  title,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <>
      <div
        className={`fixed inset-0 bg-slate-950/45 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        style={{ inset: 0, position: "fixed", zIndex: 10000 }}
        onClick={() => {
          if (!loading) {
            onCancel();
          }
        }}
      />

      <div
        className={`fixed inset-0 grid place-items-center overflow-y-auto overscroll-contain p-3 sm:p-4 ${
          open ? "" : "pointer-events-none"
        }`}
        style={{ inset: 0, position: "fixed", zIndex: 10001 }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          className={`flex min-h-0 max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_-28px_rgba(15,23,42,0.45)] transition-all duration-200 sm:max-h-[calc(100dvh-2rem)] ${
            open ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0"
          }`}
        >
          <div className="min-h-0 overflow-y-auto border-b border-slate-100 bg-slate-50/70 px-5 py-5 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 id="confirm-dialog-title" className="text-lg font-black text-slate-900">
                    {title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="close confirm dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-col-reverse items-center justify-center gap-3 bg-white px-5 py-5 sm:flex-row sm:px-6">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[112px] sm:w-auto"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-200/60 transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70 sm:min-w-[112px] sm:w-auto"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
