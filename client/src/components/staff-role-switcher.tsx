"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronsUpDown, ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth.context";
import { getAssignedRoles, getRoleHomePath, roleHomePathMap, roleLabelMap } from "@/lib/roles";
import type { Role } from "@/types/auth";

const getCurrentViewRole = (pathname: string, fallbackRole: Role): Role => {
  const matchedRole = (Object.entries(roleHomePathMap) as Array<[Role, string]>).find(([, homePath]) =>
    pathname.startsWith(homePath)
  )?.[0];

  return matchedRole || fallbackRole;
};

type StaffRoleSwitcherProps = {
  className?: string;
  onRoleSelect?: () => void;
};

export function StaffRoleSwitcher({ className = "", onRoleSelect }: StaffRoleSwitcherProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const availableRoles = useMemo(
    () => getAssignedRoles(user).filter((role) => role !== "STUDENT"),
    [user]
  );

  const currentRole = useMemo(() => {
    if (!user) {
      return null;
    }

    return getCurrentViewRole(pathname, user.role);
  }, [pathname, user]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!user || availableRoles.length < 2 || !currentRole) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
          open
            ? "border-blue-100 bg-blue-50 text-blue-700"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
        }`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className={`flex h-9 w-9 items-center justify-center rounded-full ${open ? "bg-white text-blue-600" : "bg-blue-50 text-blue-600"}`}>
            <ShieldCheck size={18} />
          </span>
          <span className="min-w-0">
            <span className={`block text-[11px] font-semibold uppercase tracking-[0.18em] ${open ? "text-blue-400" : "text-slate-400"}`}>
              Role
            </span>
            <span className="block truncate font-semibold">{roleLabelMap[currentRole]}</span>
          </span>
        </span>
        <ChevronsUpDown size={16} className={open ? "text-blue-500" : "text-slate-400"} />
      </button>

      {open && (
        <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-2">
          {availableRoles.map((role) => {
            const isCurrent = role === currentRole;

            return (
              <Link
                key={role}
                href={getRoleHomePath(role)}
                onClick={() => {
                  setOpen(false);
                  onRoleSelect?.();
                }}
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${
                  isCurrent ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span>{roleLabelMap[role]}</span>
                <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{isCurrent ? "Current" : "Open"}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
