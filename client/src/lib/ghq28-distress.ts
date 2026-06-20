import type { Ghq28DistressLevel } from "@/types/executive";

export const ghq28DistressMeta: Record<
  Ghq28DistressLevel,
  { barClassName: string; textClassName: string; label: string }
> = {
  NORMAL: {
    barClassName: "bg-emerald-400",
    textClassName: "text-emerald-600",
    label: "ปกติ (Normal)",
  },
  MILD: {
    barClassName: "bg-sky-400",
    textClassName: "text-sky-600",
    label: "ระดับน้อย (Mild)",
  },
  MODERATE: {
    barClassName: "bg-amber-400",
    textClassName: "text-amber-600",
    label: "ระดับปานกลาง (Moderate)",
  },
  SEVERE: {
    barClassName: "bg-red-500",
    textClassName: "text-red-600",
    label: "ระดับรุนแรง (Severe)",
  },
};

export const ghq28DistressOrder: Ghq28DistressLevel[] = [
  "NORMAL",
  "MILD",
  "MODERATE",
  "SEVERE",
];
