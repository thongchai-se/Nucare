"use client";

import type { ReactNode } from "react";
import { ExecutiveYearFilter } from "@/components/executive/executive-year-filter";
import type { ExecutiveYearFilter as ExecutiveYearFilterValue } from "@/types/executive";

type ExecutivePageToolbarProps = {
  title: string;
  subtitle?: string;
  bucketLabel?: string;
  yearFilter: ExecutiveYearFilterValue;
  onYearFilterChange: (value: ExecutiveYearFilterValue) => void;
  actions?: ReactNode;
};

export function ExecutivePageToolbar({
  title,
  subtitle,
  bucketLabel,
  yearFilter,
  onYearFilterChange,
  actions,
}: ExecutivePageToolbarProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 sm:text-2xl">{title}</h2>
            {bucketLabel ? (
              <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                {bucketLabel}
              </span>
            ) : null}
          </div>
          {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p> : null}
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[280px] lg:min-w-[320px]">
          <ExecutiveYearFilter value={yearFilter} onChange={onYearFilterChange} showIcon={false} />
          {actions ? <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
