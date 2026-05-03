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
  Lock,
  LogOut,
  Menu,
  Phone,
  X,
} from "lucide-react";
import { facultyEnglishFullName, facultyFullName } from "@/lib/brand";
import { useAuth } from "@/context/auth.context";

export default function StudentProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [studentMobileMenuOpen, setStudentMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuCloseTimerRef = useRef<number | null>(null);

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
    if (!loading && user?.role === "EXECUTIVE") {
      router.replace("/dashboard/executive");
    }
  }, [loading, router, user?.role]);

  useEffect(() => {
    if (!loading && user?.role === "ADVISOR") {
      router.replace("/dashboard/advisor");
    }
  }, [loading, router, user?.role]);

  useEffect(() => {
    if (!loading && user?.role === "STUDENT_DEVELOPMENT") {
      router.replace("/dashboard/student-development");
    }
  }, [loading, router, user?.role]);

  useEffect(() => {
    if (!loading && user?.role === "MENTAL_HEALTH") {
      router.replace("/dashboard/mental-health");
    }
  }, [loading, router, user?.role]);

  useEffect(() => {
    if (!loading && user?.role === "INSTRUCTOR") {
      router.replace("/dashboard/instructor");
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

  const formatStudentIdDisplay = (studentId: string | null | undefined): string => {
    if (!studentId) {
      return "-";
    }

    if (/^\d{9}-\d$/.test(studentId)) {
      return studentId;
    }

    if (/^\d{10}$/.test(studentId)) {
      return `${studentId.slice(0, 9)}-${studentId.slice(9)}`;
    }

    return studentId;
  };

  const closeStudentMobileMenu = () => {
    setStudentMobileMenuOpen(false);
    setProfileMenuOpen(false);
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <span className="loader h-7 w-7  text-blue-600"></span>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const identifier = formatStudentIdDisplay(user.studentId) || user.employeeId || user.email || "-";
  const studyYearLabel = user.studyYear ? `ปีที่ ${user.studyYear}` : "-";
  const sectionLabel = user.section?.trim() || "-";
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
      <nav className="fixed z-50 w-full border-b border-white/70 bg-white/85 backdrop-blur-md transition-all duration-300">
        <div className="mx-auto max-w-[116rem] px-3 sm:px-4 lg:px-5">
          <div className="flex h-16 items-center justify-between sm:h-20">
            <Link href="/dashboard/student" className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white shadow-md shadow-blue-500/30 sm:h-10 sm:w-10">
                <HeartPulse className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex flex-col justify-center">
                <span className="mb-0.5 block text-lg font-bold leading-none text-blue-900 sm:text-xl">
                  Nucare<span className="text-cyan-500">.</span>
                </span>
                <span className="block text-[11px] font-medium leading-none text-slate-500">{facultyFullName}</span>
              </div>
            </Link>

            <div className="hidden items-center gap-4 md:flex">
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
                  <div className="hidden min-w-0 flex-1 text-right lg:block">
                    <p className="text-sm font-bold leading-tight text-blue-900">{user.name}</p>
                    <p className="truncate whitespace-nowrap text-[11px] text-slate-500">{user.studentId ? `รหัสนักศึกษา: ${identifier}` : identifier}</p>
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
                    className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-left ring-1 ring-inset ring-blue-100"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                      <Contact className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-blue-700">ประวัติส่วนตัว</p>
                    </div>
                  </Link>
                  <Link
                    href="/dashboard/change-password"
                    className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-slate-50"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <Lock className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">เปลี่ยนรหัสผ่าน</p>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-1 flex w-full items-center gap-3 rounded-xl border-t border-slate-100 px-3 py-2.5 text-left transition-all hover:bg-red-50/80"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                      <LogOut className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-red-600">ออกจากระบบ</p>
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
              <div>
                <p className="truncate text-base font-bold text-slate-900">{user.name}</p>
                <p className="truncate text-xs font-medium text-slate-500">{user.studentId ? `ID: ${identifier}` : identifier}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/dashboard/student/profile"
                className="flex items-center justify-center gap-2 rounded-[1.05rem] border border-blue-200 bg-blue-50 px-3 py-3 text-sm font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-100"
                onClick={closeStudentMobileMenu}
              >
                <Contact className="h-4.5 w-4.5" />
                โปรไฟล์
              </Link>
              <Link
                href="/dashboard/change-password"
                className="flex items-center justify-center gap-2 rounded-[1.05rem] border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 hover:text-blue-700"
                onClick={closeStudentMobileMenu}
              >
                <Lock className="h-4.5 w-4.5 text-slate-700" />
                เปลี่ยนรหัสผ่าน
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="col-span-2 flex w-full items-center justify-center gap-2 rounded-[1.05rem] border border-red-200 bg-red-50/60 px-3 py-3 text-sm font-semibold text-red-600 shadow-sm transition-colors hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                ออกจากระบบ
              </button>
            </div>
            <Link
              href="/dashboard/student/profile"
              className="hidden items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3 text-base font-semibold text-blue-700"
              onClick={closeStudentMobileMenu}
            >
              <Contact className="h-5 w-5" />
              ประวัติส่วนตัว
            </Link>

            <div className="hidden mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4">
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
                      <p className="text-sm font-medium text-slate-800">{facultyFullName} สาขาพยาบาลศาสตร์บัณฑิต</p>
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">ชั้นปีการศึกษา</p>
                      <p className="text-sm font-medium text-slate-800">{studyYearLabel}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">เซค / กลุ่ม</p>
                      <p className="text-sm font-medium text-slate-800">{sectionLabel}</p>
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

      <footer className="border-t-4 border-cyan-500 bg-blue-900 pb-8 pt-16 text-white">
        <div className="mx-auto max-w-[102rem] px-3 sm:px-4 lg:px-5">
          <div className="mb-12 grid grid-cols-1 gap-10 md:grid-cols-3">
            <div className="col-span-1">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white">
                  <HeartPulse className="h-6 w-6" />
                </div>
                <div className="flex flex-col justify-center">
                  <span className="mb-1 block text-xl font-bold leading-none">Nucare Sys.</span>
                  <span className="block text-[11px] leading-none text-blue-200">{facultyEnglishFullName}</span>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-blue-100">
                พื้นที่ปลอดภัยสำหรับนักศึกษา {facultyFullName}
                <br className="hidden sm:block" />
                เพราะสุขภาพใจของคุณ สำคัญสำหรับเรา
              </p>
            </div>

            <div>
              <h4 className="mb-5 inline-block border-b border-blue-700 pb-2 text-lg font-bold">สำหรับนักศึกษา</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link href="/dashboard/student" className="flex items-center gap-2 text-blue-100 transition-colors hover:text-white">
                    หน้าหลักนักศึกษา
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/student/profile" className="flex items-center gap-2 text-blue-100 transition-colors hover:text-white">
                    ประวัติส่วนตัว
                  </Link>
                </li>
                <li>
                  <Link href="/" className="flex items-center gap-2 text-blue-100 transition-colors hover:text-white">
                    แหล่งความรู้การจัดการความเครียด
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-5 inline-block border-b border-blue-700 pb-2 text-lg font-bold">ติดต่อสอบถาม</h4>
              <ul className="space-y-3 text-sm text-blue-100">
                <li>งานพัฒนานักศึกษา {facultyFullName}</li>
                <li>Nucare@nursing.edu</li>
                <li>02-XXX-XXXX ต่อ 123</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-blue-800 pt-6 text-xs text-blue-300 md:flex-row">
            <p>© 2026 {facultyEnglishFullName}. All rights reserved.</p>
            <div className="flex gap-4">
              <Link href="/privacy" className="transition-colors hover:text-white">
                นโยบายความเป็นส่วนตัว (Privacy)
              </Link>
              <a href="#" className="transition-colors hover:text-white">
                ติดต่อผู้ดูแลระบบ
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
