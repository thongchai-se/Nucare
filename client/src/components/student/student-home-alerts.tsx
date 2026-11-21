"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { ClipboardEdit, X } from "lucide-react";
import { AppDialogShell } from "@/components/ui/app-dialog-shell";
import type { PendingSurveyForPopup } from "@/lib/student-home-alerts";
import {
  UI_DIALOG_CLOSE,
  UI_DIALOG_PRIMARY,
  UI_DIALOG_SECONDARY,
} from "@/lib/ui-classes";

type StudentAssessmentReminderPopupProps = {
  pendingSurveys: PendingSurveyForPopup[];
  onClose: () => void;
};

/**
 * ป๊อปอัปเตือนทำแบบประเมิน — แสดงรายการที่ค้างทำ (รองรับหลายแบบ)
 * ปิดได้เฉพาะรอบนี้ ขึ้นใหม่เมื่อเข้าหน้า/เข้าระบบอีกครั้ง ถ้ายังค้างทำ
 */
export function StudentAssessmentReminderPopup({
  pendingSurveys,
  onClose,
}: StudentAssessmentReminderPopupProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const count = pendingSurveys.length;
  const heading =
    count > 1 ? `มีแบบประเมินรอทำ ${count} รายการ` : "โปรดทำแบบประเมินในระบบ";

  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previous?.focus({ preventScroll: true });
    };
  }, [onClose]);

  return (
    <AppDialogShell
      labelledBy={titleId}
      describedBy={descriptionId}
      panelClassName="max-w-md"
      onBackdropClick={onClose}
    >
      <div ref={panelRef} tabIndex={-1} className="outline-none">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-amber-50 to-white" />

        <button type="button" onClick={onClose} className={UI_DIALOG_CLOSE} aria-label="ปิด">
          <X className="h-4 w-4" strokeWidth={2} />
        </button>

        <div className="relative px-6 pb-6 pt-8 sm:px-8 sm:pb-7 sm:pt-9">
          <div className="flex flex-col items-center text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-[0_10px_20px_-8px_rgba(245,158,11,0.55)]"
              aria-hidden
            >
              <ClipboardEdit className="h-6 w-6" strokeWidth={2.25} />
            </div>

            <h2
              id={titleId}
              className="mt-5 max-w-[20rem] text-lg font-bold leading-snug tracking-tight text-slate-900 sm:text-xl"
            >
              {heading}
            </h2>

            <p id={descriptionId} className="mt-3 max-w-[22rem] text-sm leading-6 text-slate-600">
              {count > 1
                ? "ยังมีแบบประเมินค้างทำ เลือกรายการด้านล่างหรือไปหน้ารวมแบบประเมิน"
                : "มีแบบประเมินที่เปิดรับคำตอบอยู่ กรุณาทำให้ครบ"}
            </p>
          </div>

          <ul className="mt-5 max-h-48 space-y-2 overflow-y-auto text-left">
            {pendingSurveys.map((survey) => (
              <li
                key={`${survey.id}-${survey.waveLabel ?? "wave"}`}
                className="rounded-xl border border-amber-100 bg-amber-50/70 px-3.5 py-3"
              >
                <p className="text-sm font-semibold text-slate-900">{survey.title}</p>
                {survey.waveLabel ? (
                  <p className="mt-0.5 text-xs text-slate-600">รอบ {survey.waveLabel}</p>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-col gap-2.5">
            <Link
              href="/student/assessment"
              onClick={onClose}
              className={`${UI_DIALOG_PRIMARY} w-full`}
            >
              <ClipboardEdit className="h-4 w-4" strokeWidth={2.25} />
              {count > 1 ? "ไปหน้ารวมแบบประเมิน" : "ไปทำแบบประเมิน"}
            </Link>
            <button type="button" onClick={onClose} className={`${UI_DIALOG_SECONDARY} w-full`}>
              ไว้ทีหลัง
            </button>
          </div>
        </div>
      </div>
    </AppDialogShell>
  );
}
