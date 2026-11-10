"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { UI_CARD } from "@/lib/ui-classes";

export type DashboardPanelProps = {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
};

export function DashboardPanel({
  title,
  description,
  icon: Icon,
  action,
  children,
  className = "",
  bodyClassName = "",
  flush = false,
}: DashboardPanelProps) {
  const showHeader = Boolean(title || description || action || Icon);

  return (
    <section className={`${UI_CARD} ${className}`}>
      {showHeader ? (
        <div
          className={`flex items-start justify-between gap-3 border-b border-slate-100 ${
            flush ? "px-5 py-4 sm:px-6" : "px-5 py-4 sm:px-6 sm:py-5"
          }`}
        >
          <div className="min-w-0">
            {title ? (
              <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                {Icon ? <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden /> : null}
                {title}
              </h3>
            ) : null}
            {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={bodyClassName || (flush ? "" : "p-5 sm:p-6")}>{children}</div>
    </section>
  );
}
