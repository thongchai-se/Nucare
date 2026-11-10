"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { ConfirmSubmitLabel } from "@/components/ui/confirm-submit-label";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

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
  const fieldId = useId();
  const [mounted, setMounted] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const useSelect = Boolean(options && options.length > 0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    setValue("");
    setError(null);
  }, [open]);

  useBodyScrollLock(open);

  if (!mounted || !open) {
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

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-slate-950/45 transition-opacity duration-200"
        style={{ inset: 0, position: "fixed", zIndex: 10000 }}
        onClick={() => {
          if (!loading) {
            onCancel();
          }
        }}
      />

      <div
        className="fixed inset-0 flex items-center justify-center overflow-hidden p-3 sm:p-4"
        style={{ inset: 0, position: "fixed", zIndex: 10001 }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="prompt-dialog-title"
          className="flex min-h-0 max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_-28px_rgba(15,23,42,0.45)] sm:max-h-[calc(100dvh-2rem)]"
        >
          <div className="min-h-0 overflow-y-auto border-b border-slate-100 bg-slate-50/70 px-5 py-5 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="prompt-dialog-title" className="text-lg font-black text-slate-900">
                  {title}
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
              </div>
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="ปิดกล่องโต้ตอบ"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <label htmlFor={fieldId} className="text-xs font-bold text-slate-600">
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
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
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
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
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
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                />
              )}
              {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
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
              onClick={submit}
              disabled={loading}
              className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#0057A8] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-200/60 transition-colors hover:bg-[#00468a] disabled:cursor-not-allowed disabled:opacity-70 sm:min-w-[112px] sm:w-auto"
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
        </div>
      </div>
    </>,
    document.body
  );
}
