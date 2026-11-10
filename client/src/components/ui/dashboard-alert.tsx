"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type DashboardAlertTone = "amber" | "rose" | "red" | "emerald" | "blue";

type DashboardAlertProps = {
  tone?: DashboardAlertTone;
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
};

/** พื้นการ์ดกลาง + ไอคอนทึบ — ไม่ให้สีพื้นอ่อนตัดกับแบดจ์/ปุ่ม */
const toneClasses: Record<
  DashboardAlertTone,
  { shell: string; icon: string; title: string; description: string }
> = {
  amber: {
    shell: "border-slate-200 bg-white",
    icon: "bg-amber-600 text-white",
    title: "text-slate-900",
    description: "text-slate-600",
  },
  rose: {
    shell: "border-slate-200 bg-white",
    icon: "bg-rose-600 text-white",
    title: "text-slate-900",
    description: "text-slate-600",
  },
  red: {
    shell: "border-slate-200 bg-white",
    icon: "bg-red-600 text-white",
    title: "text-slate-900",
    description: "text-slate-600",
  },
  emerald: {
    shell: "border-slate-200 bg-white",
    icon: "bg-emerald-600 text-white",
    title: "text-slate-900",
    description: "text-slate-600",
  },
  blue: {
    shell: "border-slate-200 bg-white",
    icon: "bg-[#0057A8] text-white",
    title: "text-slate-900",
    description: "text-slate-600",
  },
};

export function DashboardAlert({
  tone = "amber",
  icon: Icon,
  title,
  description,
  action,
}: DashboardAlertProps) {
  const classes = toneClasses[tone];

  return (
    <div
      className={`flex flex-col justify-between gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:p-5 ${classes.shell}`}
      role="status"
    >
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${classes.icon}`}
          aria-hidden
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${classes.title}`}>{title}</p>
          <p className={`mt-0.5 text-sm leading-6 ${classes.description}`}>{description}</p>
        </div>
      </div>
      {action ? <div className="shrink-0 sm:pl-2">{action}</div> : null}
    </div>
  );
}
