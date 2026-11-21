"use client";

import { useEffect, useId, useState } from "react";
import { Loader2, X } from "lucide-react";
import { AppDialogShell } from "@/components/ui/app-dialog-shell";
import { ConfirmSubmitLabel } from "@/components/ui/confirm-submit-label";
import {
  UI_DIALOG_CANCEL,
  UI_DIALOG_CLOSE,
  UI_DIALOG_PRIMARY,
} from "@/lib/ui-classes";

type PromptDialogOption = {
  value: string;
  label: string;
};

type PromptDialogProps = {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  loading?: boolean;
  maxLength?: number;
  multiline?: boolean;
  onCancel: () => void;
  onConfirm: (value: string) => void;
  open: boolean;
  optional?: boolean;
  /** ถ้ามี จะแสดงเป็น dropdown แทนช่องพิมพ์ */
  options?: PromptDialogOption[];
  placeholder?: string;
  selectPlaceholder?: string;
  title: string;
};

/** กล่องถามข้อความหรือเลือกจากรายการในแอป — แทน window.prompt */
export function PromptDialog({
  cancelLabel = "ยกเลิก",
  confirmLabel = "ยืนยัน",
  description,
  loading = false,
  maxLength = 500,
  multiline = true,
  onCancel,
  onConfirm,
  open,
  optional = false,
  options,
  placeholder,
  selectPlaceholder = "เลือกเหตุผล",
  title,
}: PromptDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const fieldId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const useSelect = Boolean(options && options.length > 0);

  useEffect(() => {
    if (!open) {
      return;
    }
    setValue("");
    setError(null);
  }, [open]);

  if (!open) {
    return null;
  }

  const submit = () => {
    const trimmed = value.trim();
    if (!optional && !trimmed) {
      setError(useSelect ? "กรุณาเลือกเหตุผลก่อนยืนยัน" : "กรุณากรอกข้อมูลก่อนยืนยัน");
      return;
    }
    onConfirm(trimmed);
  };

  return (
    <AppDialogShell
      labelledBy={titleId}
      describedBy={descriptionId}
      panelClassName="max-w-md"
      zIndexClassName="z-[10001]"
      onBackdropClick={loading ? undefined : onCancel}
    >
      <button
        type="button"
        onClick={onCancel}
        disabled={loading}
        className={UI_DIALOG_CLOSE}
        aria-label="ปิดกล่องโต้ตอบ"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>

      <div className="relative min-h-0 flex-1 overflow-y-auto px-6 pb-2 pt-8 sm:px-8 sm:pt-9">
        <h2
          id={titleId}
          className="pr-8 text-lg font-bold leading-snug tracking-tight text-slate-900 sm:text-xl"
        >
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-600">
          {description}
        </p>

        <div className="mt-5 space-y-2">
          <label htmlFor={fieldId} className="text-xs font-semibold text-slate-600">
            {useSelect
              ? optional
                ? "เหตุผล (ไม่บังคับ)"
                : "เหตุผล"
              : optional
                ? "รายละเอียด (ไม่บังคับ)"
                : "รายละเอียด"}
          </label>
          {useSelect ? (
            <select
              id={fieldId}
              value={value}
              disabled={loading}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) {
                  setError(null);
                }
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition-shadow focus:border-[#0057A8]/40 focus:ring-4 focus:ring-[#0057A8]/10 disabled:opacity-60"
            >
              <option value="">{selectPlaceholder}</option>
              {options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : multiline ? (
            <textarea
              id={fieldId}
              rows={4}
              value={value}
              maxLength={maxLength}
              disabled={loading}
              placeholder={placeholder}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) {
                  setError(null);
                }
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition-shadow focus:border-[#0057A8]/40 focus:ring-4 focus:ring-[#0057A8]/10 disabled:opacity-60"
            />
          ) : (
            <input
              id={fieldId}
              type="text"
              value={value}
              maxLength={maxLength}
              disabled={loading}
              placeholder={placeholder}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) {
                  setError(null);
                }
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition-shadow focus:border-[#0057A8]/40 focus:ring-4 focus:ring-[#0057A8]/10 disabled:opacity-60"
            />
          )}
          {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2.5 px-6 pb-6 pt-4 sm:flex-row sm:justify-center sm:px-8 sm:pb-7">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className={`${UI_DIALOG_CANCEL} sm:min-w-[7rem]`}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className={UI_DIALOG_PRIMARY}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {confirmLabel}
            </>
          ) : (
            <ConfirmSubmitLabel>{confirmLabel}</ConfirmSubmitLabel>
          )}
        </button>
      </div>
    </AppDialogShell>
  );
}
