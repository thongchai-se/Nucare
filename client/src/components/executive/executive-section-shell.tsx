import type { ReactNode } from "react";
import { EXECUTIVE_SECTION_CLASS } from "@/lib/executive-ui";

type ExecutiveSectionShellProps = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function ExecutiveSectionShell({
  title,
  subtitle,
  icon,
  action,
  children,
  className = "",
}: ExecutiveSectionShellProps) {
  return (
    <section className={`${EXECUTIVE_SECTION_CLASS} ${className}`}>
      <div className="mb-5 flex items-start justify-between gap-3 sm:mb-6">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 sm:text-lg">
            {icon}
            {title}
          </h3>
          {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
