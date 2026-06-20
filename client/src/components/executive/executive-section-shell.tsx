import type { ReactNode } from "react";
import { EXECUTIVE_SECTION_CLASS } from "@/lib/executive-ui";

type ExecutiveSectionShellProps = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function ExecutiveSectionShell({
  title,
  subtitle,
  icon,
  children,
  className = "",
}: ExecutiveSectionShellProps) {
  return (
    <section className={`${EXECUTIVE_SECTION_CLASS} ${className}`}>
      <div className="mb-6">
        <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
          {icon}
          {title}
        </h3>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
