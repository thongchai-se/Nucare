"use client";

type ListPaginationFooterProps = {
  total: number;
  rangeStart: number;
  rangeEnd: number;
  currentPage: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
};

/** ส่วนท้ายรายการแบบ admin — แสดงช่วงรายการและปุ่มก่อนหน้า/ถัดไป */
export function ListPaginationFooter({
  total,
  rangeStart,
  rangeEnd,
  currentPage,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  className = "",
}: ListPaginationFooterProps) {
  if (total <= 0) {
    return null;
  }

  return (
    <div
      className={`flex flex-col gap-3 border-t border-slate-200 bg-slate-50/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 ${className}`}
    >
      <span className="text-sm tabular-nums text-slate-500">
        แสดง <span className="font-medium text-slate-800">{rangeStart}</span>-
        <span className="font-medium text-slate-800">{rangeEnd}</span> จาก
        <span className="font-medium text-slate-800"> {total}</span> รายการ
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={!canGoPrev}
          onClick={onPrev}
          className="min-w-[82px] rounded border border-slate-200 bg-white px-3 py-1 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          ก่อนหน้า
        </button>
        <button
          type="button"
          className="min-w-[42px] rounded border border-slate-200 bg-slate-900 px-3 py-1 text-center font-medium tabular-nums text-white"
        >
          {currentPage}
        </button>
        <button
          type="button"
          disabled={!canGoNext}
          onClick={onNext}
          className="min-w-[82px] rounded border border-slate-200 bg-white px-3 py-1 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          ถัดไป
        </button>
      </div>
    </div>
  );
}
