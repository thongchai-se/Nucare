"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, Contact, Lock, LogOut, Menu, X } from "lucide-react";
import { AppBrand } from "@/components/app-brand";
import { ChangePasswordForm } from "@/components/change-password-form";
import { StudentMobileBottomNav } from "@/components/student-mobile-bottom-nav";
import { getInitials } from "@/components/change-password/shared";
import { facultyFullName } from "@/lib/brand";
import {
  STUDENT_LOGOUT_LABEL,
  STUDENT_NAV_PROFILE,
} from "@/lib/student-chrome";
import type { User } from "@/types/auth";

export function StudentProfileStyledChangePasswordView({
  user,
  homePath,
  identifier,
  onLogout,
}: {
  homePath: string;
  identifier: string;
  onLogout: () => Promise<void>;
  user: User;
}) {
  const [studentMobileMenuOpen, setStudentMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuCloseTimerRef = useRef<number | null>(null);
  const userInitials = getInitials(user.name, "NU");

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

  const closeStudentMobileMenu = () => {
    setStudentMobileMenuOpen(false);
    setProfileMenuOpen(false);
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <nav className="fixed z-50 w-full border-b border-white/70 bg-white/85 backdrop-blur-md transition-all duration-300">
        <div className="mx-auto max-w-[116rem] px-3 sm:px-4 lg:px-5">
          <div className="flex h-16 items-center justify-between sm:h-20">
            <Link href={homePath} className="flex items-center gap-2.5 sm:gap-3">
              <AppBrand subtitle={facultyFullName} />
            </Link>

            <div className="hidden items-center gap-3 md:flex">
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
                    <p className="truncate whitespace-nowrap text-sm font-bold leading-tight text-blue-900" title={user.name}>{user.name}</p>
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
                    href="/change-password"
                    className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-left ring-1 ring-inset ring-blue-100"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                      <Lock className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-blue-700">เปลี่ยนรหัสผ่าน</p>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      void onLogout();
                    }}
                    className="mt-1 flex w-full items-center gap-3 rounded-xl border-t border-slate-100 px-3 py-2.5 text-left transition-all hover:bg-red-50/80"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                      <LogOut className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-red-600">{STUDENT_LOGOUT_LABEL}</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center md:hidden">
              <button
                type="button"
                onClick={() => setStudentMobileMenuOpen((prev) => !prev)}
                className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-50 hover:text-blue-700"
                aria-label="toggle mobile menu"
              >
                {studentMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        <div
          className={`overflow-hidden border-t border-slate-100 bg-white transition-all duration-300 md:hidden ${
            studentMobileMenuOpen ? "max-h-[420px] pb-4" : "max-h-0"
          }`}
        >
          <div className="space-y-3 px-4 py-3">
            <div className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-100 font-bold text-cyan-700">
                {userInitials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-slate-900">{user.name}</p>
                <p className="truncate text-xs font-medium text-slate-500">{user.studentId ? `รหัสนักศึกษา: ${identifier}` : identifier}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/student/profile"
                className="flex items-center justify-center gap-2 rounded-[1.05rem] border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 hover:text-blue-700"
                onClick={closeStudentMobileMenu}
              >
                <Contact className="h-4 w-4 text-slate-700" />
                {STUDENT_NAV_PROFILE}
              </Link>
              <Link
                href="/change-password"
                className="flex items-center justify-center gap-2 rounded-[1.05rem] border border-blue-200 bg-blue-50 px-3 py-3 text-sm font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-100"
                onClick={closeStudentMobileMenu}
              >
                <Lock className="h-4 w-4" />
                เปลี่ยนรหัสผ่าน
              </Link>
              <button
                type="button"
                onClick={() => {
                  closeStudentMobileMenu();
                  void onLogout();
                }}
                className="col-span-2 flex w-full items-center justify-center gap-2 rounded-[1.05rem] border border-red-200 bg-red-50/60 px-3 py-3 text-sm font-semibold text-red-600 shadow-sm transition-colors hover:bg-red-50"
              >
                <LogOut size={18} /> {STUDENT_LOGOUT_LABEL}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <section className="px-4 pb-28 pt-28 sm:px-6 md:pb-12 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-center gap-4">
            <Link
              href="/student"
              className="rounded-lg border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-blue-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold text-blue-900 sm:text-3xl">เปลี่ยนรหัสผ่าน</h1>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="relative h-32 bg-gradient-to-r from-blue-700 to-cyan-500 sm:h-48">
              <div className="absolute -bottom-12 left-6 h-24 w-24 rounded-full bg-white p-1.5 shadow-md sm:-bottom-16 sm:left-10 sm:h-32 sm:w-32">
                <div className="flex h-full w-full items-center justify-center rounded-full border border-cyan-200 bg-cyan-100 text-3xl font-bold text-cyan-700 sm:text-4xl">
                  {userInitials}
                </div>
              </div>
            </div>

            <div className="px-6 pb-8 pt-16 sm:px-10 sm:pb-12 sm:pt-20">
              <div className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-100 pb-8 sm:flex-row sm:items-start">
                <div>
                  <h2 className="mb-1 text-2xl font-bold text-slate-800 sm:text-3xl">{user.name}</h2>
                  <p className="font-medium text-slate-500">{user.studentId ? `รหัสนักศึกษา: ${identifier}` : identifier}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-8 sm:gap-12 md:grid-cols-2">
                <div>
                  <h3 className="mb-5 flex items-center gap-2 text-lg font-bold text-blue-900">
                    <span className="rounded-md bg-blue-100 p-1.5 text-blue-700">
                      <Lock className="h-4 w-4" />
                    </span>
                    ความปลอดภัยของบัญชี
                  </h3>
                  <div className="space-y-5">
                    <div>
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">รหัสผ่านเริ่มต้น</p>
                      <p className="text-sm font-medium text-slate-800">
                        หากบัญชีของคุณเริ่มด้วย <span className="font-bold text-blue-700">Nu</span> ตามด้วยรหัสนักศึกษา
                        ควรเปลี่ยนทันทีหลังเข้าสู่ระบบครั้งแรก
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">คำแนะนำ</p>
                      <p className="text-sm font-medium text-slate-800">
                        ใช้รหัสผ่านใหม่ที่ยาวอย่างน้อย 8 ตัวอักษร และไม่ซ้ำกับรหัสผ่านเดิมเพื่อให้บัญชีปลอดภัยขึ้น
                      </p>
                    </div>
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                      <p className="text-sm font-medium leading-6 text-blue-900">
                        หลังเปลี่ยนรหัสผ่านสำเร็จ ระบบจะอัปเดตการเข้าใช้งานของคุณให้อัตโนมัติ และใช้รหัสใหม่สำหรับการเข้าสู่ระบบครั้งถัดไป
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <ChangePasswordForm
                    cancelHref="/student/profile"
                    description="อัปเดตรหัสผ่านของบัญชีนักศึกษาในระบบ NuCare ได้จากหน้านี้โดยตรง"
                    onSuccessRedirect={homePath}
                    title="เปลี่ยนรหัสผ่าน"
                    tone="student"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <StudentMobileBottomNav />
    </main>
  );
}
