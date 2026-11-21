"use client";

import type { RiskInsightCard } from "./types";

const toneMeta: Record<
  RiskInsightCard["status"],
  { shell: string; label: string; number: string }
> = {
  กลุ่มปกติ: {
    shell: "border-emerald-200/80 bg-emerald-50/50",
    label: "text-emerald-800",
    number: "text-emerald-900",
  },
  กลุ่มเสี่ยงปานกลาง: {
    shell: "border-amber-200/80 bg-amber-50/50",
    label: "text-amber-800",
    number: "text-amber-950",
  },
  กลุ่มเสี่ยงสูง: {
    shell: "border-red-200/80 bg-red-50/50",
    label: "text-red-800",
    number: "text-red-950",
  },
};

type RiskSummaryCardsProps = {
  items: RiskInsightCard[];
};

/** การ์ดสรุปกลุ่มเสี่ยง — ชื่อกลุ่ม + จำนวนเท่านั้น */
export function RiskSummaryCards({ items }: RiskSummaryCardsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => {
        const meta = toneMeta[item.status];
        return (
          <li key={item.id} className={`rounded-xl border px-4 py-4 ${meta.shell}`}>
            <p className={`text-xs font-semibold ${meta.label}`}>
              {item.status.replace(/^กลุ่ม/, "")}
            </p>
            <p className={`mt-2 text-3xl font-bold tabular-nums tracking-tight ${meta.number}`}>
              {item.registered}
              <span className="ml-1 text-sm font-semibold opacity-70">คน</span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
