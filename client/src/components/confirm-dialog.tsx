"use client";

import { useId } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { AppDialogShell } from "@/components/ui/app-dialog-shell";
import { ConfirmSubmitLabel } from "@/components/ui/confirm-submit-label";
import {
  UI_DIALOG_CANCEL,
  UI_DIALOG_CLOSE,
  UI_DIALOG_DANGER,
  UI_DIALOG_PRIMARY,
} from "@/lib/ui-classes";

type ConfirmDialogProps = {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  placement?: "viewport" | "admin-content";
  /** danger = ลบ/ปิดถาวร (แดง), primary = ยืนยันทั่วไป (ฟ้า) */
  tone?: "danger" | "primary";
  title: string;
};

/** กล่องยืนยันร่วม — จัดชั้น icon → หัวข้อ → รายละเอียด → ปุ่ม */
export function ConfirmDialog({
  cancelLabel = "ยกเลิก",
  confirmLabel = "ยืนยัน",
  description,
  loading = false,
  onCancel,
  onConfirm,
  open,
  tone = "danger",
  title,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  if (!open) {
    return null;
  }

  const isDanger = tone === "danger";

  return (
    <AppDialogShell
      labelledBy={titleId}
      describedBy={descriptionId}
      panelClassName="max-w-md"
      zIndexClassName="z-[10001]"
      onBackdropClick={loading ? undefined : onCancel}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-white ${
          isDanger ? "from-red-50" : "from-sky-50"
        }`}
      />

      <button
        type="button"
        onClick={onCancel}
        disabled={loading}
        className={UI_DIALOG_CLOSE}
        aria-label="ปิด"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>

      <div className="relative px-6 pb-6 pt-8 sm:px-8 sm:pb-7 sm:pt-9">
        <div className="flex flex-col items-center text-center">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white ${
              isDanger
                ? "bg-red-600 shadow-[0_10px_20px_-8px_rgba(220,38,38,0.45)]"
                : "bg-[#0057A8] shadow-[0_10px_20px_-8px_rgba(0,87,168,0.4)]"
            }`}
            aria-hidden
          >
            <AlertTriangle className="h-6 w-6" strokeWidth={2.25} />
          </div>

          <h2
            id={titleId}
            className="mt-5 max-w-[20rem] text-lg font-bold leading-snug tracking-tight text-slate-900 sm:text-xl"
          >
            {title}
          </h2>
          <p id={descriptionId} className="mt-3 max-w-[22rem] text-sm leading-6 text-slate-600">
            {description}
          </p>
        </div>

        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row-reverse sm:justify-center">
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={isDanger ? UI_DIALOG_DANGER : UI_DIALOG_PRIMARY}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {confirmLabel}
              </>
            ) : tone === "primary" ? (
              <ConfirmSubmitLabel>{confirmLabel}</ConfirmSubmitLabel>
            ) : (
              confirmLabel
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className={`${UI_DIALOG_CANCEL} sm:min-w-[7rem]`}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </AppDialogShell>
  );
}
