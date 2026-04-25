"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  BookHeart,
  Calendar,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  Check,
  ChevronDown,
  ClipboardEdit,
  FileSpreadsheet,
  HeartPulse,
  Headphones,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  Phone,
  PhoneCall,
  Plus,
  Send,
  ShieldCheck,
  Siren,
  Smile,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth.context";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [studentMobileMenuOpen, setStudentMobileMenuOpen] = useState(false);
  const [assessmentModalOpen, setAssessmentModalOpen] = useState(false);
  const [isSubmittingAssessment, setIsSubmittingAssessment] = useState(false);
  const [showAssessmentToast, setShowAssessmentToast] = useState(false);
  const [showPriorityBanner, setShowPriorityBanner] = useState(true);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    router.prefetch("/dashboard/admin/manage-students");
    router.prefetch("/dashboard/admin/import-students");
  }, [router]);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const isAdmin = user?.role === "ADMIN";

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
  const userInitials = user.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "NU";

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  const closeStudentMobileMenu = () => {
    setStudentMobileMenuOpen(false);
  };

  const handleSubmitAssessment = () => {
    if (isSubmittingAssessment) {
      return;
    }

    setIsSubmittingAssessment(true);

    window.setTimeout(() => {
      setIsSubmittingAssessment(false);
      setAssessmentModalOpen(false);
      setShowAssessmentToast(true);
      setShowPriorityBanner(false);
      window.setTimeout(() => setShowAssessmentToast(false), 4000);
    }, 1400);
  };

  if (isAdmin) {
    return (
      <main className="min-h-screen bg-gray-50 text-gray-800 [scrollbar-gutter:stable]">
        <div
          className={`fixed inset-0 z-40 bg-gray-900/50 transition-opacity duration-300 lg:hidden ${
            sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={toggleSidebar}
        />

        <div className="flex min-h-screen overflow-x-hidden">
          <aside
            className={`fixed inset-y-0 left-0 z-50 flex w-64 transform flex-col bg-gray-900 text-white transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-800 px-5 sm:px-6">
              <h2 className="text-xl font-semibold tracking-wide">Admin Panel</h2>
              <button
                type="button"
                className="text-gray-400 transition-colors hover:text-white lg:hidden"
                onClick={toggleSidebar}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
              <span className="block truncate rounded-lg bg-gray-800 px-4 py-2.5 font-medium text-white">หน้าหลัก</span>
              <Link
                href="/dashboard/admin/manage-students"
                onClick={closeSidebar}
                className="block truncate rounded-lg px-4 py-2.5 text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
              >
                จัดการข้อมูลนักศึกษา
              </Link>
              <Link
                href="/dashboard/admin/import-students"
                onClick={closeSidebar}
                className="block truncate rounded-lg px-4 py-2.5 text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
              >
                นำเข้านักศึกษา (CSV)
              </Link>
            </nav>

            <div className="border-t border-gray-800 p-4">
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-100 transition hover:bg-gray-700"
              >
                <LogOut className="h-4 w-4" />
                ออกจากระบบ
              </button>
            </div>
          </aside>

          <section className="flex min-h-screen w-full flex-1 flex-col lg:w-[calc(100%-16rem)]">
            <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
              <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 md:px-8">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <button
                    type="button"
                    className="text-gray-600 transition-colors hover:text-gray-900 lg:hidden"
                    onClick={toggleSidebar}
                  >
                    <Menu className="h-6 w-6" />
                  </button>
                  <h1 className="truncate text-lg font-medium text-gray-800 sm:text-xl">หน้าหลักผู้ดูแลระบบ</h1>
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600">
                  AD
                </div>
              </div>
            </header>

            <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-4 sm:p-6 md:p-8">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">ผู้ใช้งานปัจจุบัน</h2>
                  <div className="mt-4 space-y-2 text-sm text-gray-700">
                    <p>
                      <span className="font-medium text-gray-900">ชื่อ:</span> {user.name}
                    </p>
                    <p>
                      <span className="font-medium text-gray-900">บทบาท:</span> {user.role}
                    </p>
                    <p className="break-all">
                      <span className="font-medium text-gray-900">Identifier:</span> {identifier}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                  <div className="inline-flex items-center gap-2 rounded-lg bg-white/80 px-3 py-2 text-blue-700">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wide">Protected Route</span>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-blue-900">
                    หน้านี้เป็นพื้นที่ protected สำหรับผู้ใช้งานที่ผ่านการยืนยันตัวตนแล้ว และเป็นศูนย์กลางสำหรับการจัดการข้อมูลนักศึกษา
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm sm:col-span-2 xl:col-span-1">
                  <h2 className="text-base font-semibold text-emerald-900">เครื่องมือผู้ดูแลระบบ</h2>
                  <p className="mt-1 text-sm text-emerald-800">
                    จัดการข้อมูลรายบุคคลและนำเข้ารายชื่อแบบกลุ่มผ่านไฟล์ CSV
                  </p>

                  <div className="mt-4 flex flex-col gap-2">
                    <Link
                      href="/dashboard/admin/manage-students"
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <Users className="h-4 w-4" />
                      จัดการข้อมูลนักศึกษา
                    </Link>
                    <Link
                      href="/dashboard/admin/import-students"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      นำเข้า CSV
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      {showAssessmentToast && (
        <div className="fixed bottom-6 right-6 z-[300] flex translate-y-0 items-center gap-3 rounded-xl border-l-4 border-emerald-500 bg-white px-5 py-4 shadow-xl transition-all duration-300">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Check className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800">ส่งผลประเมินสำเร็จ</h4>
            <p className="mt-0.5 text-xs text-slate-500">ขอบคุณที่ให้เราช่วยดูแลสุขภาพใจของคุณ</p>
          </div>
        </div>
      )}

      <nav className="fixed z-50 w-full border-b border-slate-100 bg-white shadow-sm transition-all duration-300">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between sm:h-20">
            <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white shadow-sm sm:h-10 sm:w-10">
                <HeartPulse className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex flex-col justify-center">
                <span className="mb-1 block text-lg font-bold leading-none text-blue-900 sm:text-xl">
                  Nucare<span className="text-xl leading-none text-cyan-500 sm:text-2xl">.</span>
                </span>
                <span className="hidden text-[10px] font-medium leading-none text-slate-500 sm:block sm:text-[11px]">
                  คณะพยาบาลศาสตร์
                </span>
              </div>
            </Link>

            <div className="hidden items-center space-x-6 lg:space-x-8 md:flex">
              <a href="#" className="border-b-2 border-blue-700 py-2 font-bold text-blue-700 transition-colors">
                หน้าหลัก (Dashboard)
              </a>
              <a href="#assessment" className="font-medium text-slate-600 transition-colors hover:text-blue-700">
                แบบประเมิน
              </a>
              <a href="#appointments" className="font-medium text-slate-600 transition-colors hover:text-blue-700">
                นัดหมาย
              </a>

              <div className="mx-2 h-6 border-l border-slate-200" />

              <div className="group relative flex cursor-pointer items-center gap-4">
                <button className="relative p-2 text-slate-400 transition-colors hover:text-blue-700" type="button">
                  <Bell className="h-5 w-5" />
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-white bg-red-500" />
                </button>
                <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
                  <div className="hidden text-right lg:block">
                    <p className="text-sm font-bold leading-tight text-blue-900">{user.name}</p>
                    <p className="text-xs text-slate-500">รหัสนักศึกษา: {identifier}</p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-100 font-bold text-cyan-700">
                    {userInitials}
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </div>

                <div className="invisible absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-slate-100 bg-white opacity-0 shadow-lg transition-all duration-200 group-hover:visible group-hover:opacity-100">
                  <div className="space-y-1 p-2">
                    <button
                      type="button"
                      className="block w-full rounded-md px-4 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-700"
                    >
                      ประวัติส่วนตัว
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-md px-4 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" /> ออกจากระบบ
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center md:hidden">
              <button
                type="button"
                className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-50 hover:text-blue-700"
                onClick={() => setStudentMobileMenuOpen((prev) => !prev)}
                aria-label="toggle mobile menu"
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        <div
          className={`absolute w-full border-t border-slate-100 bg-white pb-4 shadow-lg transition-all md:hidden ${
            studentMobileMenuOpen ? "block" : "hidden"
          }`}
        >
          <div className="space-y-1 px-4 pb-2 pt-4">
            <div className="mb-4 flex items-center gap-3 rounded-lg bg-slate-50 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-100 font-bold text-cyan-700">
                {userInitials}
              </div>
              <div>
                <p className="text-sm font-bold text-blue-900">{user.name}</p>
                <p className="text-xs text-slate-500">รหัสนักศึกษา: {identifier}</p>
              </div>
            </div>

            <a href="#" className="block rounded-md bg-blue-50 px-3 py-3 text-base font-bold text-blue-700" onClick={closeStudentMobileMenu}>
              หน้าหลัก (Dashboard)
            </a>
            <a
              href="#assessment"
              className="block rounded-md px-3 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-700"
              onClick={closeStudentMobileMenu}
            >
              แบบประเมิน
            </a>
            <a
              href="#appointments"
              className="block rounded-md px-3 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-700"
              onClick={closeStudentMobileMenu}
            >
              นัดหมาย
            </a>

            <div className="mt-2 border-t border-slate-100 pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-md px-3 py-3 text-base font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut className="h-5 w-5" /> ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      </nav>

      <section className="px-4 pb-12 pt-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="mb-2 text-2xl font-bold text-blue-900 sm:text-3xl">สวัสดี, {user.name.split(" ")[0] || "นักศึกษา"} 👋</h1>
              <p className="text-sm text-slate-600 sm:text-base">ขอให้วันนี้เป็นวันที่ดีของคุณนะ เราพร้อมรับฟังเสมอ</p>
            </div>
            <div className="flex w-fit items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
              <ShieldCheck className="h-4 w-4 text-blue-500" /> ข้อมูลของคุณถูกเก็บเป็นความลับ
            </div>
          </div>

          {showPriorityBanner && (
            <div className="relative mb-8 flex flex-col items-start justify-between gap-6 overflow-hidden rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-5 shadow-sm sm:flex-row sm:items-center sm:p-6">
              <div className="pointer-events-none absolute -right-6 -top-6 opacity-10">
                <Bell className="h-32 w-32 text-orange-500" />
              </div>

              <div className="relative z-10 flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-orange-100 bg-white text-orange-500 shadow-sm">
                  <ClipboardEdit className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="mb-1 text-lg font-bold text-orange-900">ถึงรอบประเมินสุขภาพจิต (9Q) ประจำเดือนแล้ว</h3>
                  <p className="max-w-2xl text-sm leading-relaxed text-orange-800">
                    เพื่อให้เราดูแลคุณได้อย่างเหมาะสม กรุณาสละเวลาสักครู่เพื่อทำแบบประเมินคัดกรองเบื้องต้น ประจำเดือนพฤษภาคม 2569
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAssessmentModalOpen(true)}
                className="relative z-10 flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-orange-600 sm:w-auto"
              >
                ทำแบบประเมินเดี๋ยวนี้
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="space-y-8 lg:col-span-2">
              <section id="assessment" className="scroll-mt-24">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800">
                    <Activity className="h-5 w-5 text-blue-600" /> สถานะสุขภาพใจของฉัน
                  </h2>
                  <button type="button" className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-800 hover:underline">
                    ดูประวัติทั้งหมด
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
                    <div className="relative shrink-0">
                      <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-4 border-slate-100">
                        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                          <circle cx="50" cy="50" r="46" fill="none" stroke="#10b981" strokeWidth="8" strokeDasharray="289" strokeDashoffset="60" strokeLinecap="round" />
                        </svg>
                        <div className="text-center">
                          <Smile className="mx-auto mb-1 h-8 w-8 text-emerald-500" />
                          <span className="block text-xs font-bold uppercase text-emerald-600">ปกติ</span>
                        </div>
                      </div>
                    </div>

                    <div className="w-full flex-1 text-center sm:text-left">
                      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                        <h3 className="text-lg font-bold text-slate-800">ผลการประเมิน 9Q ล่าสุด</h3>
                        <span className="mx-auto inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 sm:mx-0">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" /> ปกติ (สีเขียว)
                        </span>
                      </div>
                      <p className="mb-4 text-sm text-slate-500">
                        <Calendar className="-mt-0.5 mr-1 inline-block h-4 w-4" /> ทำประเมินเมื่อ: 10 เมษายน 2569
                      </p>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                        สภาวะอารมณ์ของคุณอยู่ในเกณฑ์ปกติ ถือว่าจัดการความเครียดได้ดีเยี่ยม! ขอให้รักษาสุขภาพใจแบบนี้ต่อไปนะ
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section id="appointments" className="scroll-mt-24">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800">
                    <CalendarClock className="h-5 w-5 text-cyan-600" /> การนัดหมายของฉัน
                  </h2>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-col items-center justify-center p-10 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <CalendarX2 className="h-8 w-8" />
                    </div>
                    <h3 className="mb-2 text-lg font-bold text-slate-800">ไม่มีนัดหมายในขณะนี้</h3>
                    <p className="mb-6 max-w-sm text-sm leading-relaxed text-slate-500">
                      คุณสามารถทำการนัดหมายเพื่อพูดคุยกับอาจารย์ที่ปรึกษา หรือขอรับคำปรึกษาจากทีมผู้เชี่ยวชาญได้เสมอ
                    </p>
                    <button className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-6 py-2.5 font-bold text-blue-700 transition-colors hover:bg-blue-100">
                      <Plus className="h-4 w-4" /> ทำการนัดหมายใหม่
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-2xl bg-red-700 p-6 text-white shadow-lg">
                <div className="pointer-events-none absolute -bottom-4 -right-4 opacity-20">
                  <Siren className="h-32 w-32" />
                </div>
                <div className="relative z-10">
                  <div className="mb-4 flex items-center gap-3 border-b border-red-500/50 pb-4">
                    <div className="flex h-10 w-10 shrink-0 animate-pulse items-center justify-center rounded-full bg-white/20">
                      <PhoneCall className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-lg font-bold leading-tight">ต้องการความช่วยเหลือด่วน</h3>
                  </div>
                  <p className="mb-5 text-sm leading-relaxed text-red-100">
                    หากรู้สึกไม่ปลอดภัย กังวลใจอย่างมาก หรือมีความคิดอยากทำร้ายตนเอง อย่าอยู่คนเดียว ติดต่อเราทันที
                  </p>
                  <div className="space-y-3">
                    <button className="w-full rounded-xl bg-white py-3 text-sm font-bold text-red-700 shadow-sm transition-colors hover:bg-red-50">
                      แจ้งเหตุทีมดูแลพิเศษ (SOS)
                    </button>
                    <a
                      href="tel:1323"
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-600 bg-red-800 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-red-900"
                    >
                      <Phone className="h-4 w-4" /> สายด่วนสุขภาพจิต 1323
                    </a>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 font-bold text-slate-800">
                  <Users className="h-5 w-5 text-blue-600" /> ทีมดูแลของฉัน
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">ส.ญ</div>
                    <div>
                      <p className="mb-0.5 text-xs font-bold uppercase tracking-wider text-blue-700">อาจารย์ที่ปรึกษา</p>
                      <p className="text-sm font-bold text-slate-800">ผศ.ดร. สมหญิง พยาบาล</p>
                      <div className="mt-2 flex gap-2">
                        <button className="rounded border border-slate-200 bg-white p-1.5 text-slate-500 transition-colors hover:text-blue-600" title="ส่งข้อความ">
                          <MessageSquare className="h-4 w-4" />
                        </button>
                        <button className="rounded border border-slate-200 bg-white p-1.5 text-slate-500 transition-colors hover:text-blue-600" title="นัดหมาย">
                          <CalendarPlus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-bold text-slate-800">
                    <BookHeart className="h-5 w-5 text-indigo-500" /> เกร็ดความรู้ฮีลใจ
                  </h3>
                  <button className="text-xs font-medium text-indigo-600 transition-colors hover:underline">ดูทั้งหมด</button>
                </div>
                <ul className="space-y-3">
                  <li>
                    <a href="#" className="group flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded bg-indigo-50 text-indigo-500 transition-colors group-hover:bg-indigo-100">
                        <Headphones className="h-4 w-4" />
                      </div>
                      <p className="line-clamp-2 text-sm font-medium text-slate-700 transition-colors group-hover:text-indigo-700">
                        พอดแคสต์: เทคนิคผ่อนคลายความเครียดก่อนสอบไฟนอล
                      </p>
                    </a>
                  </li>
                  <li>
                    <a href="#" className="group flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded bg-emerald-50 text-emerald-500 transition-colors group-hover:bg-emerald-100">
                        <FileSpreadsheet className="h-4 w-4" />
                      </div>
                      <p className="line-clamp-2 text-sm font-medium text-slate-700 transition-colors group-hover:text-emerald-700">
                        บทความ: วิธีจัดการความกังวลเมื่อต้องขึ้นวอร์ดครั้งแรก
                      </p>
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-500 sm:px-6 md:flex-row lg:px-8">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            <p>© 2026 Student Wellbeing Sys. Faculty of Nursing.</p>
          </div>
          <div className="flex gap-4">
            <Link href="/privacy" className="transition-colors hover:text-blue-700">
              นโยบายความเป็นส่วนตัว
            </Link>
            <a href="#" className="transition-colors hover:text-blue-700">
              ติดต่อผู้ดูแลระบบ
            </a>
          </div>
        </div>
      </footer>

      {assessmentModalOpen && (
        <div className="fixed inset-0 z-[200]">
          <button
            type="button"
            aria-label="close assessment modal"
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setAssessmentModalOpen(false)}
          />

          <div className="fixed inset-0 z-10 flex items-center justify-center p-4">
            <div className="flex max-h-[90vh] w-full max-w-2xl translate-y-0 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-300">
              <div className="flex shrink-0 items-center justify-between bg-blue-700 px-6 py-5">
                <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                  <ClipboardEdit className="h-5 w-5 text-blue-200" /> แบบประเมินสุขภาพจิต (9Q)
                </h3>
                <button
                  type="button"
                  onClick={() => setAssessmentModalOpen(false)}
                  className="rounded-md p-1 text-blue-200 transition-colors hover:bg-blue-600 hover:text-white"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto bg-slate-50 p-6 sm:p-8">
                <div className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                  <p className="mb-2 text-sm text-slate-600">ในช่วง 2 สัปดาห์ที่ผ่านมา ท่านมีอาการเหล่านี้บ่อยแค่ไหน?</p>
                  <p className="text-xs font-medium text-blue-600">*กรุณาตอบตามความเป็นจริง ข้อมูลจะถูกเก็บเป็นความลับ</p>
                </div>

                {["เบื่อ ไม่สนใจอยากทำอะไร", "ไม่สบายใจ ซึมเศร้า หรือท้อแท้"].map((question, index) => (
                  <div key={question} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="mb-4 text-[15px] font-bold text-slate-800">{index + 1}. {question}</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {["ไม่มีเลย", "เป็นบางวัน (1-7 วัน)", "เป็นบ่อย (มากกว่า 7 วัน)", "เป็นทุกวัน"].map((label) => (
                        <label
                          key={`${question}-${label}`}
                          className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:bg-blue-50"
                        >
                          <input type="radio" name={`q-${index + 1}`} className="h-4 w-4 text-blue-600 focus:ring-blue-500" />
                          <span className="text-sm font-medium text-slate-700">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="py-4 text-center">
                  <p className="text-xs text-slate-400">...คำถามข้อ 3 ถึง 9...</p>
                </div>
              </div>

              <div className="flex shrink-0 gap-3 border-t border-slate-200 bg-white p-5">
                <button
                  type="button"
                  onClick={() => setAssessmentModalOpen(false)}
                  className="w-1/3 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSubmitAssessment}
                  disabled={isSubmittingAssessment}
                  className="flex w-2/3 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-80"
                >
                  {isSubmittingAssessment ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      กำลังส่งข้อมูล...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      ส่งผลการประเมิน
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
