"use client";

import type { ReactNode } from "react";
import { Filter } from "lucide-react";

type FilterSummaryChipProps = {
  label: string;
  value: number;
  selected?: boolean;
  onClick: () => void;
  /** compact = แคปซูลแนวนอน (ของฉัน/ทั้งหมด) · card = การ์ดนับสถานะ */
  density?: "card" | "compact";
  /** ไอคอนนำ — ค่าว่างใช้ Filter */
  icon?: ReactNode;
  /** ซ่อนไอคอนเมื่อไม่ต้องการ */
  hideIcon?: boolean;
  className?: string;
};

/** ชิปกรองสถานะแบบเดียวกันทั้งพอร์ทัล (รอ/กำลัง/ปิด) — มีไอคอนกรองเป็นค่าเริ่มต้น */
export function FilterSummaryChip({
  label,
  value,
  selected = false,
  onClick,
  density = "card",
  icon,
  hideIcon = false,
  className = "",
}: FilterSummaryChipProps) {
  const leading = hideIcon ? null : icon ?? <Filter className="h-3.5 w-3.5 shrink-0" aria-hidden />;

  if (density === "compact") {
    return (
      <button
        type="button"
        role="tab"
        aria-selected={selected}
        onClick={onClick}
        className={`inline-flex min-w-0 items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0057A8]/30 sm:gap-1.5 sm:px-3 sm:text-sm ${
          selected
            ? "bg-[#0057A8] text-white shadow-sm"
            : "bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-slate-900"
        } ${className}`}
      >
        {leading}
        <span className="truncate">{label}</span>
        <span
          className={`inline-flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums sm:text-xs ${
            selected ? "bg-white text-[#0057A8]" : "bg-slate-100 text-slate-800"
          }`}
        >
          {value}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`rounded-xl border px-3.5 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0057A8]/30 ${
        selected
          ? "border-[#0057A8]/30 bg-[#0057A8]/5 shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      } ${className}`}
    >
      <p className="flex items-center gap-1.5 text-[11px] font-semibold leading-4 text-slate-500">
        {leading}
        {label}
      </p>
      <p
        className={`mt-0.5 text-xl font-bold tabular-nums leading-none ${
          selected ? "text-[#0057A8]" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </button>
  );
}
