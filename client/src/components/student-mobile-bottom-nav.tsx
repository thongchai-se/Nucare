"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardEdit, Home, MessageSquare, UserRound } from "lucide-react";
import {
  STUDENT_NAV_ADVISOR,
  STUDENT_NAV_ASSESSMENT,
  STUDENT_NAV_HOME,
  STUDENT_NAV_PROFILE,
} from "@/lib/student-chrome";

const studentMobileNavItems = [
  {
    href: "/student",
    icon: Home,
    label: STUDENT_NAV_HOME,
    match: "home",
  },
  {
    href: "/student/assessment",
    icon: ClipboardEdit,
    label: STUDENT_NAV_ASSESSMENT,
    match: "survey",
  },
  {
    href: "/student/advisor",
    icon: MessageSquare,
    label: STUDENT_NAV_ADVISOR,
    match: "consultation",
  },
  {
    href: "/student/profile",
    icon: UserRound,
    label: STUDENT_NAV_PROFILE,
    match: "profile",
  },
] as const;

export function StudentMobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="เมนูหลักนักศึกษาบนมือถือ"
      className="fixed inset-x-0 bottom-0 z-[120] border-t border-slate-200 bg-white/95 px-1.5 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-16px_40px_-28px_rgba(15,23,42,0.7)] backdrop-blur xl:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-0.5">
        {studentMobileNavItems.map((item) => {
          const Icon = item.icon;
          const active =
            (item.match === "home" && pathname === "/student") ||
            (item.match === "survey" && pathname === "/student/assessment") ||
            (item.match === "consultation" && pathname === "/student/advisor") ||
            (item.match === "profile" && pathname === "/student/profile");

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-1 text-[10px] font-bold leading-none transition-colors ${
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-500 hover:bg-slate-50 hover:text-blue-700"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
