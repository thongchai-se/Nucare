"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  ClipboardEdit,
  Contact,
  HeartPulse,
  Home,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  X,
} from "lucide-react";
import { facultyFullName } from "@/lib/brand";
import { StudentCreditFooter } from "@/components/student-credit-footer";
import { StudentMobileBottomNav } from "@/components/student-mobile-bottom-nav";
import { useAuth } from "@/context/auth.context";
import type { Role, User } from "@/types/auth";
import { formatStudentIdDisplay, getUserInitials } from "@/lib/student-dashboard";

type StudentAppPage = "home" | "assessment" | "advisor" | "profile";

type StudentPageShellContext = {
  identifier: string;
  user: User;
  userInitials: string;
};

type StudentPageShellProps = {
  activePage: StudentAppPage;
  children: (context: StudentPageShellContext) => ReactNode;
  contentClassName?: string;
};

const roleRedirects: Partial<Record<Role, string>> = {
  ADMIN: "/dashboard/admin",
  ADVISOR: "/dashboard/advisor",
  EXECUTIVE: "/dashboard/executive",
  INSTRUCTOR: "/dashboard/instructor",
  MENTAL_HEALTH: "/dashboard/mental-health",
  STUDENT_DEVELOPMENT: "/dashboard/student-development",
};

const studentShellNavItems: Array<{
  href: string;
  icon: typeof Home;
  id: StudentAppPage;
  label: string;
}> = [
  {
    href: "/dashboard/student",
    icon: Home,
    id: "home",
    label: "หน้าหลัก",
  },
  {
    href: "/dashboard/student/assessment",
    icon: ClipboardEdit,
    id: "assessment",
    label: "ประเมิน",
  },
  {
    href: "/dashboard/student/advisor",
    icon: MessageSquare,
    id: "advisor",
    label: "ที่ปรึกษา",
  },
  {
    href: "/dashboard/student/profile",
    icon: Contact,
    id: "profile",
    label: "โปรไฟล์",
  },
];

export function StudentPageShell({
  activePage,
  children,
  contentClassName = "mx-auto max-w-7xl space-y-6",
}: StudentPageShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuCloseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (!loading && user?.role && user.role !== "STUDENT") {
      router.replace(roleRedirects[user.role] || "/dashboard");
    }
  }, [loading, router, user?.role]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (profileMenuCloseTimerRef.current !== null) {
        window.clearTimeout(profileMenuCloseTimerRef.current);
      }
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const openProfileMenu = () => {
    if (profileMenuCloseTimerRef.current !== null) {
      window.clearTimeout(profileMenuCloseTimerRef.current);
      profileMenuCloseTimerRef.current = null;
    }

    setProfileMenuOpen(true);
  };

  const closeProfileMenuWithDelay = () => {
    if (profileMenuCloseTimerRef.current !== null) {
      window.clearTimeout(profileMenuCloseTimerRef.current);
    }

    profileMenuCloseTimerRef.current = window.setTimeout(() => {
      setProfileMenuOpen(false);
      profileMenuCloseTimerRef.current = null;
    }, 180);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <span className="loader h-7 w-7 text-blue-600"></span>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const identifier = formatStudentIdDisplay(user.studentId) || user.employeeId || user.email || "-";
  const userInitials = getUserInitials(user.name);

  return (
    <main className="flex min-h-screen flex-col bg-slate-50 text-slate-800">
      <nav className="fixed z-50 w-full border-b border-white/70 bg-white/90 backdrop-blur-md transition-all duration-300">
        <div className="mx-auto max-w-[116rem] px-3 sm:px-4 lg:px-5">
          <div className="flex h-16 items-center justify-between gap-4 sm:h-20">
            <Link href="/dashboard/student" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white shadow-md shadow-blue-500/30 sm:h-10 sm:w-10">
                <HeartPulse className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0">
                <span className="mb-0.5 block text-lg font-bold leading-none text-blue-900 sm:text-xl">
                  Nucare<span className="text-cyan-500">.</span>
                </span>
                <span className="block max-w-[11rem] truncate text-[11px] font-medium leading-none text-slate-500 sm:max-w-[18rem]">
                  {facultyFullName}
                </span>
              </div>
            </Link>

            <div className="hidden min-w-0 flex-1 items-center justify-center xl:flex">
              <div className="grid grid-cols-4 gap-1 rounded-2xl border border-slate-200 bg-slate-100/70 p-1">
                {studentShellNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = item.id === activePage || pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition-colors ${
                        active
                          ? "bg-white text-blue-700 shadow-sm"
                          : "text-slate-500 hover:bg-white/70 hover:text-blue-700"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="hidden items-center gap-4 xl:flex">
              <button
                type="button"
                className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-blue-700"
                aria-label="notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-white bg-red-500" />
              </button>

              <div className="h-7 border-l border-slate-200" />

              <div
                className="relative w-[15.5rem]"
                ref={profileMenuRef}
                onMouseEnter={openProfileMenu}
                onMouseLeave={closeProfileMenuWithDelay}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (profileMenuCloseTimerRef.current !== null) {
                      window.clearTimeout(profileMenuCloseTimerRef.current);
                      profileMenuCloseTimerRef.current = null;
                    }

                    setProfileMenuOpen((prev) => !prev);
                  }}
                  onFocus={openProfileMenu}
                  className={`flex w-full items-center justify-between gap-2.5 border border-slate-200 bg-white px-3 py-1.5 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50/90 ${
                    profileMenuOpen ? "rounded-b-none rounded-t-[1.35rem] border-b-transparent" : "rounded-[1.35rem]"
                  }`}
                  aria-expanded={profileMenuOpen}
                  aria-haspopup="menu"
                >
                  <div className="hidden min-w-0 flex-1 overflow-hidden text-right lg:block">
                    <p className="truncate whitespace-nowrap text-sm font-bold leading-tight text-blue-900" title={user.name}>
                      {user.name}
                    </p>
                    <p className="truncate whitespace-nowrap text-[11px] text-slate-500">
                      {user.studentId ? `รหัสนักศึกษา: ${identifier}` : identifier}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-100 font-bold text-cyan-700">
                    {userInitials}
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                <div
                  className={`absolute inset-x-0 top-[calc(100%-1px)] z-50 origin-top overflow-hidden rounded-b-[1.35rem] border border-slate-200/90 border-t-0 bg-white p-1.5 shadow-[0_20px_36px_-28px_rgba(15,23,42,0.32)] transition-all duration-200 ${
                    profileMenuOpen
                      ? "pointer-events-auto visible translate-y-0 scale-100 opacity-100"
                      : "pointer-events-none invisible -translate-y-2 scale-95 opacity-0"
                  }`}
                  role="menu"
                >
                  <Link
                    href="/dashboard/student/profile"
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-slate-50"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <Contact className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">โปรไฟล์และข้อมูลส่วนตัว</p>
                  </Link>
                  <Link
                    href="/dashboard/student/profile#security"
                    className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-slate-50"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <Lock className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">เปลี่ยนรหัสผ่าน</p>
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-1 flex w-full items-center gap-3 rounded-xl border-t border-slate-100 px-3 py-2.5 text-left transition-all hover:bg-red-50/80"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                      <LogOut className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-semibold text-red-600">ออกจากระบบ</p>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center xl:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-50 hover:text-blue-700"
                aria-label="toggle mobile menu"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        <div
          className={`overflow-hidden border-t border-slate-100 bg-white transition-all duration-300 xl:hidden ${
            mobileMenuOpen ? "max-h-[32rem] pb-4" : "max-h-0"
          }`}
        >
          <div className="space-y-3 px-4 py-3">
            <div className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-100 font-bold text-cyan-700">
                {userInitials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-slate-900">{user.name}</p>
                <p className="truncate text-xs font-medium text-slate-500">
                  {user.studentId ? `รหัสนักศึกษา: ${identifier}` : identifier}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {studentShellNavItems.map((item) => {
                const Icon = item.icon;
                const active = item.id === activePage;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center justify-center gap-2 rounded-[1.05rem] border px-3 py-3 text-sm font-semibold shadow-sm transition-colors ${
                      active
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 hover:text-blue-700"
                    }`}
                    onClick={closeMobileMenu}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
              <Link
                href="/dashboard/student/profile#security"
                className="flex items-center justify-center gap-2 rounded-[1.05rem] border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 hover:text-blue-700"
                onClick={closeMobileMenu}
              >
                <Lock className="h-4 w-4" />
                รหัสผ่าน
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-[1.05rem] border border-red-200 bg-red-50/60 px-3 py-3 text-sm font-semibold text-red-600 shadow-sm transition-colors hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      </nav>

      <section className="flex-1 px-4 pb-28 pt-28 sm:px-6 lg:px-8 xl:pb-12">
        <div className={contentClassName}>{children({ identifier, user, userInitials })}</div>
      </section>

      <StudentCreditFooter />
      <StudentMobileBottomNav />
    </main>
  );
}
