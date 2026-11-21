"use client";

import { useId } from "react";
import { AlertTriangle, Archive, CheckCircle2, Download, Loader2, Trash2, X } from "lucide-react";
import { AppDialogShell } from "@/components/ui/app-dialog-shell";
import {
  UI_DIALOG_CANCEL,
  UI_DIALOG_CLOSE,
  UI_DIALOG_DANGER,
} from "@/lib/ui-classes";

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

/** กล่องยืนยันลบแบบสอบถาม — สำรองข้อมูลก่อนลบเมื่อมีคำตอบ */
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
  const titleId = useId();
  const descriptionId = useId();

  if (!open) {
    return null;
  }

  const hasResponses = responseCount > 0;
  const isBackupRequired = hasResponses && !hasDownloaded;
  const canDelete = !hasResponses || hasDownloaded;

  return (
    <AppDialogShell
      labelledBy={titleId}
      describedBy={descriptionId}
      panelClassName="max-w-md"
      zIndexClassName="z-[10001]"
      onBackdropClick={deleting ? undefined : onCancel}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-white ${
          isBackupRequired ? "from-amber-50" : "from-red-50"
        }`}
      />

      <button
        type="button"
        onClick={onCancel}
        disabled={deleting}
        className={UI_DIALOG_CLOSE}
        aria-label="ปิด"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>

      <div className="relative min-h-0 flex-1 overflow-y-auto px-6 pb-2 pt-8 sm:px-8 sm:pt-9">
        <div className="flex flex-col items-center text-center">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white ${
              isBackupRequired
                ? "bg-amber-500 shadow-[0_10px_20px_-8px_rgba(245,158,11,0.5)]"
                : "bg-red-600 shadow-[0_10px_20px_-8px_rgba(220,38,38,0.45)]"
            }`}
            aria-hidden
          >
            {isBackupRequired ? (
              <Download className="h-6 w-6" strokeWidth={2.25} />
            ) : (
              <AlertTriangle className="h-6 w-6" strokeWidth={2.25} />
            )}
          </div>

          <h2
            id={titleId}
            className="mt-5 max-w-[20rem] text-lg font-bold leading-snug tracking-tight text-slate-900 sm:text-xl"
          >
            {isBackupRequired ? "ต้องสำรองข้อมูลก่อนลบ" : "ลบแบบสอบถาม"}
          </h2>
          <p className="mt-2 max-w-[22rem] text-sm font-semibold text-slate-800">{surveyTitle}</p>
          <p id={descriptionId} className="mt-2 max-w-[22rem] text-sm leading-6 text-slate-600">
            {isBackupRequired
              ? `มี ${responseCount.toLocaleString()} คำตอบ — ดาวน์โหลดก่อนเพื่อกันข้อมูลหาย`
              : hasResponses
                ? `ดาวน์โหลดแล้ว — คำตอบ ${responseCount.toLocaleString()} รายการจะถูกลบถาวร`
                : "ยังไม่มีคำตอบ การลบนี้ย้อนกลับไม่ได้"}
          </p>
        </div>

        {isBackupRequired ? (
          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={onDownload}
              disabled={deleting}
              className="flex w-full items-center gap-3 rounded-xl border border-[#0057A8]/20 bg-[#0057A8]/5 px-4 py-3.5 text-sm font-semibold text-[#0057A8] transition-colors hover:bg-[#0057A8]/10 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Download className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">
                ดาวน์โหลด CSV ({responseCount.toLocaleString()} รายการ)
              </span>
            </button>
            <p className="text-center text-xs font-medium text-amber-700">
              ดาวน์โหลดก่อน จึงจะเปิดปุ่มลบได้
            </p>
          </div>
        ) : hasResponses && hasDownloaded ? (
          <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-700">ดาวน์โหลดเรียบร้อยแล้ว</span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-2.5 px-6 pb-6 pt-4 sm:flex-row sm:flex-wrap sm:justify-center sm:px-8 sm:pb-7">
        <button
          type="button"
          onClick={onCancel}
          disabled={deleting}
          className={`${UI_DIALOG_CANCEL} sm:min-w-[7rem]`}
        >
          ยกเลิก
        </button>

        {isBackupRequired ? (
          <button
            type="button"
            onClick={onArchive}
            disabled={deleting}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
            เก็บถาวรแทน
          </button>
        ) : null}

        <button
          type="button"
          onClick={onDelete}
          disabled={!canDelete || deleting}
          className={
            canDelete
              ? UI_DIALOG_DANGER
              : "inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 text-sm font-semibold text-slate-400 sm:w-auto"
          }
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {isBackupRequired ? "ลบ" : "ลบแบบสอบถาม"}
        </button>
      </div>
    </AppDialogShell>
  );
}
