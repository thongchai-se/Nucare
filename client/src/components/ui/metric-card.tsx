"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { UI_CARD } from "@/lib/ui-classes";

export type MetricCardTone = "blue" | "amber" | "rose" | "emerald" | "slate";

type MetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  subtitle?: string;
  onClick?: () => void;
  tone?: MetricCardTone;
  emphasized?: boolean;
};

const toneIconClass: Record<MetricCardTone, string> = {
  blue: "bg-[#0057A8] text-white",
  amber: "bg-amber-600 text-white",
  rose: "bg-rose-600 text-white",
  emerald: "bg-emerald-600 text-white",
  slate: "bg-slate-600 text-white",
};

export function MetricCard({
  icon: Icon,
  label,
  value,
  subtitle,
  onClick,
  tone = "blue",
  emphasized = false,
}: MetricCardProps) {
  const content = (
    <>
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-full ${toneIconClass[tone]}`}>
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-slate-950">{value}</p>
      {subtitle ? <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p> : null}
    </>
  );

  const baseClass = emphasized
    ? `${UI_CARD} border-slate-300 p-4 text-left ring-1 ring-rose-200 sm:p-5`
    : `${UI_CARD} p-4 text-left sm:p-5`;
  const interactiveClass =
    "transition-[border-color,background-color] duration-150 hover:border-slate-300 hover:bg-slate-50/60";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClass} ${interactiveClass} ${emphasized ? "hover:border-slate-400" : ""} focus-visible:outline-offset-2`}
      >
        {content}
      </button>
    );
  }

  return <div className={baseClass}>{content}</div>;
}
