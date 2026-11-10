import type { ReactNode } from "react";
import { EXECUTIVE_CARD_CLASS, EXECUTIVE_STAT_LABEL_CLASS } from "@/lib/executive-ui";

type ExecutiveStatCardProps = {
  label: string;
  value: ReactNode;
  description: string;
  icon: ReactNode;
  iconClassName?: string;
  badge?: ReactNode;
  footnote?: string;
  valueClassName?: string;
};

export function ExecutiveStatCard({
  label,
  value,
  description,
  icon,
  iconClassName = "bg-[#278ACA]/10 text-[#0057A8]",
  badge,
  footnote,
  valueClassName = "text-slate-950",
}: ExecutiveStatCardProps) {
  return (
    <div className={EXECUTIVE_CARD_CLASS}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}>{icon}</div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      <p className={EXECUTIVE_STAT_LABEL_CLASS}>{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold tabular-nums tracking-tight sm:text-[1.75rem] ${valueClassName}`}>
        {value}
      </p>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      {footnote ? <p className="mt-1 text-[11px] leading-5 text-slate-500">{footnote}</p> : null}
    </div>
  );
}
