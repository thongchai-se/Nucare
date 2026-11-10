"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Archive, CheckCircle2, Download, Loader2, Trash2, X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

export type DeleteSurveyDialogProps = {
  deleting: boolean;
  hasDownloaded: boolean;
  onArchive: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onDownload: () => void;
  open: boolean;
  responseCount: number;
  surveyTitle: string;
};

export function DeleteSurveyDialog({
  deleting,
  hasDownloaded,
  onArchive,
  onCancel,
  onDelete,
  onDownload,
  open,
  responseCount,
  surveyTitle,
}: DeleteSurveyDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useBodyScrollLock(open);

  if (!mounted || !open) return null;

  const hasResponses = responseCount > 0;
  const isBackupRequired = hasResponses && !hasDownloaded;
  const canDelete = !hasResponses || hasDownloaded;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/45 transition-opacity duration-200"
        style={{ position: "fixed", inset: 0, zIndex: 10000 }}
        onClick={() => {
          if (!deleting) onCancel();
        }}
      />

      {/* Dialog wrapper */}
      <div
        className="fixed inset-0 flex items-center justify-center overflow-hidden p-3 sm:p-4"
        style={{ position: "fixed", inset: 0, zIndex: 10001 }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-survey-dialog-title"
          className="flex min-h-0 max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_-28px_rgba(15,23,42,0.45)] sm:max-h-[calc(100dvh-2rem)]"
        >
          {/* Header */}
          <div
            className="min-h-0 overflow-y-auto border-b border-slate-100 px-5 py-5 sm:px-6"
            style={{
              background: isBackupRequired
                ? "rgba(255, 251, 235, 0.8)"
                : "rgba(248, 250, 252, 0.7)",
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
                    isBackupRequired
                      ? "border-amber-200 bg-amber-50 text-amber-600"
                      : "border-red-100 bg-red-50 text-red-600"
                  }`}
                >
                  {isBackupRequired ? (
                    <Download className="h-5 w-5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5" />
                  )}
                </div>

                <div>
                  <h3
                    id="delete-survey-dialog-title"
                    className="text-lg font-black text-slate-900"
                  >
                    {isBackupRequired ? "ต้องสำรองข้อมูลก่อนลบ" : "ลบแบบสอบถาม"}
                  </h3>
                  <p className="mt-0.5 line-clamp-2 max-w-xs text-sm font-semibold text-slate-700">
                    {surveyTitle}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {isBackupRequired
                      ? `มี ${responseCount.toLocaleString()} คำตอบ — ดาวน์โหลดข้อมูลก่อนเพื่อป้องกันการสูญเสียข้อมูล`
                      : hasResponses
                        ? `ดาวน์โหลดข้อมูลแล้ว — การลบนี้ไม่สามารถย้อนกลับได้ คำตอบ ${responseCount.toLocaleString()} รายการจะถูกลบถาวร`
                        : "ยังไม่มีคำตอบจากนักศึกษา การดำเนินการนี้ไม่สามารถย้อนกลับได้"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onCancel}
                disabled={deleting}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="ปิด"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          {isBackupRequired ? (
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={onDownload}
                disabled={deleting}
                className="flex w-full items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3.5 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Download className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">
                  ดาวน์โหลดข้อมูล CSV ({responseCount.toLocaleString()} รายการ)
                </span>
              </button>
              <p className="mt-2.5 text-xs font-medium text-amber-700">
                กดดาวน์โหลดก่อน จึงจะเปิดใช้งานปุ่มลบได้
              </p>
            </div>
          ) : hasResponses && hasDownloaded ? (
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <span className="text-sm font-bold text-emerald-700">
                  ดาวน์โหลดข้อมูลเรียบร้อยแล้ว
                </span>
              </div>
            </div>
          ) : null}

          {/* Footer */}
          <div className="flex flex-col-reverse items-center justify-end gap-2.5 bg-white px-5 py-5 sm:flex-row sm:gap-3 sm:px-6">
            <button
              type="button"
              onClick={onCancel}
              disabled={deleting}
              className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              ยกเลิก
            </button>

            {isBackupRequired ? (
              <button
                type="button"
                onClick={onArchive}
                disabled={deleting}
                className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Archive className="h-4 w-4" />
                )}
                เก็บถาวรแทน
              </button>
            ) : null}

            <button
              type="button"
              onClick={onDelete}
              disabled={!canDelete || deleting}
              className={`inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition-colors sm:w-auto ${
                canDelete
                  ? "bg-red-600 text-white shadow-lg shadow-red-200/60 hover:bg-red-700 disabled:opacity-70"
                  : "cursor-not-allowed bg-slate-200 text-slate-400"
              }`}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {isBackupRequired ? "ลบ" : "ลบแบบสอบถาม"}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
