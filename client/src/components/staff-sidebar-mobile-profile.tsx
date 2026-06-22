"use client";

type StaffSidebarMobileProfileProps = {
  roleLabel: string;
  subtitle?: string;
  userName: string;
};

export function StaffSidebarMobileProfile({ roleLabel, subtitle, userName }: StaffSidebarMobileProfileProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:hidden">
      <p className="text-sm font-bold text-slate-800">{userName}</p>
      <p className="mt-1 text-xs text-slate-500">{roleLabel}</p>
      {subtitle ? <p className="mt-2 text-xs font-medium text-slate-500">{subtitle}</p> : null}
    </div>
  );
}
