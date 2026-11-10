import type { ExecutiveYearFilter } from "@/types/executive";
import { STUDY_YEAR_OPTIONS } from "@/lib/study-year";
import { UI_CARD, UI_SECTION_LABEL } from "@/lib/ui-classes";

export const EXECUTIVE_CARD_CLASS = `${UI_CARD} p-4 sm:p-5`;

export const EXECUTIVE_SECTION_CLASS = `${UI_CARD} p-5 sm:p-6 lg:p-7`;

export const EXECUTIVE_STAT_LABEL_CLASS = UI_SECTION_LABEL;

export const EXECUTIVE_HERO_CLASS = UI_CARD;

export const YEAR_FILTER_OPTIONS: Array<{ value: ExecutiveYearFilter; label: string }> = [
  { value: "ALL", label: "ทุกชั้นปี" },
  ...STUDY_YEAR_OPTIONS.map((year) => ({
    value: String(year) as ExecutiveYearFilter,
    label: `ชั้นปีที่ ${year}`,
  })),
];

export const COMMON_ISSUE_BAR_CLASSES = [
  "bg-[#0057A8]",
  "bg-[#278ACA]",
  "bg-slate-500",
  "bg-amber-500",
  "bg-emerald-600",
] as const;
