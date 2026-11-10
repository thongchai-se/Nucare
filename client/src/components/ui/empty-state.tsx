"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`px-5 py-8 text-center sm:px-8 sm:py-10 ${className}`}>
      <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 [&_svg]:h-4 [&_svg]:w-4">
        <Icon strokeWidth={2.25} aria-hidden />
      </div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
