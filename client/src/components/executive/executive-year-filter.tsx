"use client";

import { Filter } from "lucide-react";
import { YEAR_FILTER_OPTIONS } from "@/lib/executive-ui";
import type { ExecutiveYearFilter } from "@/types/executive";

type ExecutiveYearFilterProps = {
  value: ExecutiveYearFilter;
  onChange: (value: ExecutiveYearFilter) => void;
  className?: string;
  showIcon?: boolean;
};

export function ExecutiveYearFilter({
  value,
  onChange,
  className = "",
  showIcon = true,
}: ExecutiveYearFilterProps) {
  return (
    <div className={`w-full min-w-0 ${className}`}>
      {showIcon ? (
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
          <Filter className="h-3.5 w-3.5" />
          ชั้นปี
        </div>
      ) : null}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {YEAR_FILTER_OPTIONS.map((option) => {
          const isActive = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-bold whitespace-nowrap transition-colors ${
                isActive
                  ? "border-blue-200 bg-blue-50 text-blue-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
