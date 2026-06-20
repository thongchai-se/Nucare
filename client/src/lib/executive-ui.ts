import type { ExecutiveYearFilter } from "@/types/executive";
import { STUDY_YEAR_OPTIONS } from "@/lib/study-year";

export const EXECUTIVE_CARD_CLASS =
  "rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5";

export const EXECUTIVE_SECTION_CLASS =
  "rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-7";

export const EXECUTIVE_STAT_LABEL_CLASS =
  "text-[11px] font-black uppercase tracking-[0.16em] text-slate-400";

export const EXECUTIVE_HERO_CLASS =
  "overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm";

export const YEAR_FILTER_OPTIONS: Array<{ value: ExecutiveYearFilter; label: string }> = [
  { value: "ALL", label: "ทุกชั้นปี" },
  ...STUDY_YEAR_OPTIONS.map((year) => ({
    value: String(year) as ExecutiveYearFilter,
    label: `ชั้นปีที่ ${year}`,
  })),
];

export const COMMON_ISSUE_BAR_CLASSES = [
  "bg-gradient-to-r from-indigo-500 to-violet-500",
  "bg-gradient-to-r from-blue-500 to-cyan-500",
  "bg-gradient-to-r from-violet-500 to-purple-500",
  "bg-gradient-to-r from-amber-500 to-orange-500",
  "bg-gradient-to-r from-emerald-500 to-teal-500",
] as const;
