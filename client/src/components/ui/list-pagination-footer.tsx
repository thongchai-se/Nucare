"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type ListPaginationFooterProps = {
  total: number;
  rangeStart: number;
  rangeEnd: number;
  currentPage: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** ตารางปกติแสดงสรุปช่วงรายการ — แผงแคบ/ไซด์บาร์ปิดได้ */
  showSummary?: boolean;
  className?: string;
};

const navControlClass =
  "inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:pointer-events-none disabled:text-slate-300";

/**
 * ส่วนท้ายตาราง — สรุปช่วงรายการ (ถ้าเปิด) + ก่อนหน้า / หน้าปัจจุบัน / ถัดไป
 */
export function ListPaginationFooter({
  total,
  rangeStart,
  rangeEnd,
  currentPage,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  showSummary = true,
  className = "",
}: ListPaginationFooterProps) {
  if (total <= 0) {
    return null;
  }

  return (
    <div
      className={`flex flex-col gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:px-5 ${
        showSummary ? "sm:justify-between" : "sm:justify-center"
      } ${className}`}
    >
      {showSummary ? (
        <p className="whitespace-nowrap text-sm tabular-nums text-slate-500">
          แสดง{" "}
          <span className="font-medium text-slate-700">
            {rangeStart}-{rangeEnd}
          </span>{" "}
          จาก <span className="font-medium text-slate-700">{total}</span> รายการ
        </p>
      ) : null}

      <nav
        className="inline-flex w-fit max-w-full shrink-0 items-center gap-0.5 self-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:self-auto"
        aria-label="เปลี่ยนหน้า"
      >
        <button
          type="button"
          disabled={!canGoPrev}
          onClick={onPrev}
          className={navControlClass}
          aria-label="หน้าก่อนหน้า"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          ก่อนหน้า
        </button>

        <span
          className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-[#0057A8] px-2.5 text-sm font-semibold tabular-nums text-white"
          aria-current="page"
          aria-label={`หน้า ${currentPage}`}
        >
          {currentPage}
        </span>

        <button
          type="button"
          disabled={!canGoNext}
          onClick={onNext}
          className={navControlClass}
          aria-label="หน้าถัดไป"
        >
          ถัดไป
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        </button>
      </nav>
    </div>
  );
}
