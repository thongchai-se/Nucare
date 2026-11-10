"use client";

import type { ReactNode } from "react";

export type PageHeaderProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  leading?: ReactNode;
  stats?: Array<{ label: string; value: ReactNode }>;
  /** Home keeps a taller welcome; other pages stay compact. */
  size?: "welcome" | "compact";
};

export function PageHeader({
  title,
  description,
  actions,
  leading,
  stats,
  size = "compact",
}: PageHeaderProps) {
  const isWelcome = size === "welcome";

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)]">
      <div
        className={`bg-[linear-gradient(135deg,#ffffff_0%,#f3f8fc_48%,#eef5fb_100%)] ${
          isWelcome ? "px-5 py-6 sm:px-7 sm:py-8 lg:px-8" : "px-5 py-5 sm:px-6 sm:py-6"
        }`}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-3xl">
            {leading ? <div className="mb-4">{leading}</div> : null}
            <h1
              className={`font-display font-semibold leading-tight tracking-tight text-slate-950 ${
                isWelcome ? "text-3xl sm:text-4xl" : "text-2xl sm:text-[1.75rem]"
              }`}
            >
              {title}
            </h1>
            <p
              className={`mt-2 max-w-2xl leading-6 text-slate-600 ${
                isWelcome ? "text-sm sm:text-base" : "text-sm"
              }`}
            >
              {description}
            </p>
            {actions ? <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">{actions}</div> : null}
          </div>

          {stats && stats.length > 0 ? (
            <dl className="grid w-full shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:w-auto lg:min-w-[20rem] lg:grid-cols-2">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-slate-200/70 bg-white/90 px-3.5 py-3 shadow-[0_8px_20px_-18px_rgba(15,23,42,0.45)]"
                >
                  <dt className="text-xs font-medium text-slate-500">{stat.label}</dt>
                  <dd className="mt-1 truncate text-lg font-semibold tabular-nums text-slate-950">{stat.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
    </section>
  );
}
