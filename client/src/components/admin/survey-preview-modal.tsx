"use client";

import { useEffect } from "react";
import { AlertCircle, Eye, X } from "lucide-react";
import { StaffModalOverlay } from "@/components/ui/staff-modal-overlay";
import type { SurveyAdminPreview } from "@/types/survey";

type SurveyPreviewModalProps = {
  open: boolean;
  loading: boolean;
  error: string;
  preview: SurveyAdminPreview | null;
  onClose: () => void;
};

type PreviewQuestion = SurveyAdminPreview["questions"][number];

const MAX_SCALE_BUTTONS = 11;

/** แสดงตัวควบคุมคำตอบแบบอ่านอย่างเดียวตามชนิดคำถาม เหมือนที่นักศึกษาจะเห็น (กดตอบไม่ได้) */
function PreviewAnswerField({ question }: { question: PreviewQuestion }) {
  const fieldClass =
    "w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-400";

  switch (question.type) {
    case "TEXT":
      return <input type="text" disabled placeholder="พิมพ์คำตอบ" className={fieldClass} aria-label="ช่องคำตอบ" />;
    case "TEXTAREA":
      return <textarea disabled rows={3} placeholder="พิมพ์คำตอบ" className={fieldClass} aria-label="ช่องคำตอบ" />;
    case "NUMBER":
      return <input type="number" disabled placeholder="ตัวเลข" className={fieldClass} aria-label="ช่องคำตอบ" />;
    case "DATE":
      return <input type="date" disabled className={fieldClass} aria-label="ช่องคำตอบ" />;
    case "SINGLE_CHOICE":
    case "MULTIPLE_CHOICE": {
      const inputType = question.type === "SINGLE_CHOICE" ? "radio" : "checkbox";
      return (
        <ul className="space-y-2">
          {question.options.map((option) => (
            <li key={option.value}>
              <label className="flex cursor-not-allowed items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                <input type={inputType} disabled className="h-4 w-4 border-slate-300" />
                {option.label}
              </label>
            </li>
          ))}
        </ul>
      );
    }
    case "SCALE": {
      const min = question.minValue ?? 1;
      const max = question.maxValue ?? 5;
      const count = max - min + 1;
      if (count < 2 || count > MAX_SCALE_BUTTONS) {
        return (
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
            <span>{min}</span>
            <input type="range" disabled min={min} max={max} className="w-full" aria-label="ระดับคะแนน" />
            <span>{max}</span>
          </div>
        );
      }
      return (
        <div className="flex flex-wrap gap-2" aria-label="ระดับคะแนน">
          {Array.from({ length: count }, (_, index) => min + index).map((value) => (
            <span
              key={value}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-400"
            >
              {value}
            </span>
          ))}
        </div>
      );
    }
    default:
      return null;
  }
}

/**
 * Modal พรีวิวแบบสอบถามมุมมองนักศึกษา (อ่านอย่างเดียว ไม่บันทึกคำตอบ);
 * ปิดได้จากปุ่ม X, ปุ่มปิดด้านล่าง หรือกด Escape
 */
export function SurveyPreviewModal({ open, loading, error, preview, onClose }: SurveyPreviewModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const orderedQuestions = preview ? [...preview.questions].sort((a, b) => a.order - b.order) : [];

  return (
    <StaffModalOverlay panelClassName="max-w-2xl">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="พรีวิวแบบสอบถามมุมมองนักศึกษา"
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-blue-700">
              <Eye className="h-3.5 w-3.5" />
              พรีวิวมุมมองนักศึกษา
            </p>
            <h3 className="mt-1 truncate text-lg font-bold text-slate-900">
              {preview?.title || "แบบสอบถาม"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              อ่านอย่างเดียว ไม่บันทึกคำตอบ — แสดงตามที่บันทึกล่าสุด และไม่แสดงคะแนนของตัวเลือก
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="ปิดพรีวิว"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-5">
          {loading ? (
            <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 text-sm font-medium text-slate-500">
              <span className="loader h-7 w-7 text-blue-600" aria-hidden="true" />
              กำลังโหลดพรีวิว
            </div>
          ) : error ? (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-sm font-semibold text-red-700">{error}</p>
            </div>
          ) : preview ? (
            <div className="space-y-4">
              {preview.description ? (
                <p className="whitespace-pre-line rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
                  {preview.description}
                </p>
              ) : null}
              {orderedQuestions.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
                  ยังไม่มีคำถามที่บันทึกไว้
                </p>
              ) : (
                orderedQuestions.map((question, index) => (
                  <section key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm font-bold leading-6 text-slate-900">
                      {index + 1}. {question.prompt}
                      {question.isRequired ? <span className="ml-1 text-red-500">*</span> : null}
                    </p>
                    {question.description ? (
                      <p className="mt-1 text-xs leading-5 text-slate-500">{question.description}</p>
                    ) : null}
                    <div className="mt-3">
                      <PreviewAnswerField question={question} />
                    </div>
                  </section>
                ))
              )}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end border-t border-slate-100 p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            ปิด
          </button>
        </div>
      </div>
    </StaffModalOverlay>
  );
}
