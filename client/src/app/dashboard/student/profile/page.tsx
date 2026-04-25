"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  ChevronDown,
  Contact,
  Edit3,
  GraduationCap,
  HeartPulse,
  Loader2,
  LogOut,
  Menu,
  Phone,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth.context";

export default function StudentProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [studentMobileMenuOpen, setStudentMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (!loading && user?.role === "ADMIN") {
      router.replace("/dashboard/admin");
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

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const closeStudentMobileMenu = () => {
    setStudentMobileMenuOpen(false);
    setProfileMenuOpen(false);
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const identifier = user.studentId || user.employeeId || user.email || "-";
  const userInitials =
    user.name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "NU";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <nav className="fixed z-50 w-full border-b border-slate-100 bg-white transition-all duration-300">
        <div className="mx-auto max-w-[116rem] px-1.5 sm:px-2 lg:px-3">
          <div className="flex h-20 items-center justify-between">
            <Link href="/dashboard/student" className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white shadow-sm">
                <HeartPulse className="h-6 w-6" />
              </div>
              <div className="flex flex-col justify-center">
                <span className="mb-1 block text-xl font-bold leading-none text-blue-900">
                  Nucare<span className="text-2xl leading-none text-cyan-500">.</span>
                </span>
                <span className="block text-[11px] font-medium leading-none text-slate-500">คณะพยาบาลศาสตร์</span>
              </div>
            </Link>

            <div className="hidden items-center gap-4 md:flex" ref={profileMenuRef}>
              <button
                type="button"
                className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-blue-700"
                aria-label="notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-white bg-red-500" />
              </button>

              <div className="h-7 border-l border-slate-200" />

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                  className="flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-slate-50"
                  aria-expanded={profileMenuOpen}
                  aria-haspopup="menu"
                >
                  <div className="hidden text-right lg:block">
                    <p className="text-sm font-bold leading-tight text-blue-900">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.studentId ? `รหัสนักศึกษา: ${identifier}` : identifier}</p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-100 font-bold text-cyan-700">
                    {userInitials}
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                <div
                  className={`absolute right-0 top-full z-50 mt-2 w-52 rounded-lg border border-slate-100 bg-white p-2 shadow-lg transition-all duration-150 ${
                    profileMenuOpen
                      ? "pointer-events-auto visible translate-y-0 opacity-100"
                      : "pointer-events-none invisible -translate-y-1 opacity-0"
                  }`}
                  role="menu"
                >
                  <Link
                    href="/dashboard/student"
                    className="block rounded-md px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-700"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    หน้าหลัก (Dashboard)
                  </Link>
                  <Link
                    href="/dashboard/student/profile"
                    className="block rounded-md bg-slate-50 px-4 py-2 text-sm font-semibold text-blue-700"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    ประวัติส่วนตัว
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-1 flex w-full items-center gap-2 rounded-md px-4 py-2 text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    ออกจากระบบ
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
          <div className="space-y-1 px-4 pt-2">
            <div className="mb-4 flex items-center gap-3 rounded-lg bg-slate-50 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-100 font-bold text-cyan-700">
                {userInitials}
              </div>
              <div>
                <p className="text-sm font-bold text-blue-900">{user.name}</p>
                <p className="text-xs text-slate-500">{user.studentId ? `รหัสนักศึกษา: ${identifier}` : identifier}</p>
              </div>
            </div>

            <Link
              href="/dashboard/student"
              className="block rounded-md px-3 py-3 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-700"
              onClick={closeStudentMobileMenu}
            >
              หน้าหลัก (Dashboard)
            </Link>
            <Link
              href="/dashboard/student/profile"
              className="block rounded-md bg-slate-50 px-3 py-3 text-base font-semibold text-blue-700"
              onClick={closeStudentMobileMenu}
            >
              ประวัติส่วนตัว
            </Link>

            <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-3 font-semibold text-red-600"
              >
                <LogOut className="h-4 w-4" />
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      </nav>

      <section className="px-4 pb-12 pt-28 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-center gap-4">
            <Link
              href="/dashboard/student"
              className="rounded-lg border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-blue-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold text-blue-900 sm:text-3xl">ประวัติส่วนตัว</h1>
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
                <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-5 py-2.5 font-bold text-blue-700 shadow-sm transition-colors hover:bg-blue-50 sm:w-auto">
                  <Edit3 className="h-4 w-4" /> แจ้งแก้ไขข้อมูล
                </button>
              </div>

              <div className="grid grid-cols-1 gap-8 sm:gap-12 md:grid-cols-2">
                <div>
                  <h3 className="mb-5 flex items-center gap-2 text-lg font-bold text-blue-900">
                    <span className="rounded-md bg-blue-100 p-1.5 text-blue-700">
                      <GraduationCap className="h-4 w-4" />
                    </span>
                    ข้อมูลการศึกษา
                  </h3>
                  <div className="space-y-5">
                    <div>
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">คณะ / สาขาวิชา</p>
                      <p className="text-sm font-medium text-slate-800">คณะพยาบาลศาสตร์ สาขาพยาบาลศาสตร์บัณฑิต</p>
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">ชั้นปีการศึกษา</p>
                      <p className="text-sm font-medium text-slate-800">ปีที่ 2</p>
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">อาจารย์ที่ปรึกษา</p>
                      <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
                          ส.ญ
                        </div>
                        <p className="text-sm font-bold text-blue-800">ผศ.ดร. สมหญิง พยาบาล</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="mb-5 flex items-center gap-2 text-lg font-bold text-blue-900">
                    <span className="rounded-md bg-cyan-100 p-1.5 text-cyan-700">
                      <Contact className="h-4 w-4" />
                    </span>
                    ข้อมูลการติดต่อ
                  </h3>
                  <div className="space-y-5">
                    <div>
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">อีเมลมหาวิทยาลัย</p>
                      <p className="text-sm font-medium text-slate-800">{user.email || "-"}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">เบอร์โทรศัพท์มือถือ</p>
                      <p className="text-sm font-medium text-slate-800">-</p>
                    </div>
                    <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                      <p className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-red-500">
                        <AlertCircle className="h-3 w-3" /> ผู้ติดต่อกรณีฉุกเฉิน
                      </p>
                      <p className="mt-1 text-base font-bold text-red-800">
                        นาง สมรัก รักเรียน <span className="text-sm font-normal text-red-600">(มารดา)</span>
                      </p>
                      <p className="mt-1 text-sm font-medium text-red-600">
                        <Phone className="mr-1 inline-block h-3 w-3" /> โทร. 089-999-9999
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
