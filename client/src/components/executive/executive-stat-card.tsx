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
  iconClassName = "border-blue-100 bg-blue-50 text-blue-600",
  badge,
  footnote,
  valueClassName = "text-slate-900",
}: ExecutiveStatCardProps) {
  return (
    <div className={EXECUTIVE_CARD_CLASS}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${iconClassName}`}
        >
          {icon}
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      <p className={EXECUTIVE_STAT_LABEL_CLASS}>{label}</p>
      <p className={`mt-2 text-2xl font-black sm:text-3xl ${valueClassName}`}>{value}</p>
      <p className="mt-1 text-sm font-bold text-slate-700">{description}</p>
      {footnote ? <p className="mt-1 text-[11px] leading-5 text-slate-500">{footnote}</p> : null}
    </div>
  );
}
