"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardEdit,
  HeartPulse,
  MessageSquare,
  UserRound,
} from "lucide-react";

const studentMobileNavItems = [
  {
    href: "/dashboard/student",
    icon: HeartPulse,
    label: "หน้าหลัก",
    match: "home",
  },
  {
    href: "/dashboard/student/assessment",
    icon: ClipboardEdit,
    label: "ประเมิน",
    match: "survey",
  },
  {
    href: "/dashboard/student/advisor",
    icon: MessageSquare,
    label: "ที่ปรึกษา",
    match: "consultation",
  },
  {
    href: "/dashboard/student/profile",
    icon: UserRound,
    label: "โปรไฟล์",
    match: "profile",
  },
] as const;

export function StudentMobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="เมนูหลักนักศึกษาบนมือถือ"
      className="fixed inset-x-0 bottom-0 z-[120] border-t border-slate-200 bg-white/95 px-2 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-16px_40px_-28px_rgba(15,23,42,0.7)] backdrop-blur xl:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
        {studentMobileNavItems.map((item) => {
          const Icon = item.icon;
          const active =
            (item.match === "home" && pathname === "/dashboard/student") ||
            (item.match === "survey" && pathname === "/dashboard/student/assessment") ||
            (item.match === "consultation" && pathname === "/dashboard/student/advisor") ||
            (item.match === "profile" && pathname === "/dashboard/student/profile") ||
            (item.match === "profile" && pathname === "/dashboard/change-password");

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[10px] font-bold leading-none transition-colors ${
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
