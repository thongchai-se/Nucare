"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Loader2,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth.context";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (!loading && user?.role === "EXECUTIVE") {
      router.replace("/dashboard/executive");
      return;
    }

    if (!loading && user?.role === "MENTAL_HEALTH") {
      router.replace("/dashboard/mental-health");
      return;
    }

    if (!loading && user?.role === "INSTRUCTOR") {
      router.replace("/dashboard/instructor");
      return;
    }

    if (!loading && user?.role === "ADVISOR") {
      router.replace("/dashboard/advisor");
      return;
    }

    if (!loading && user && user.role !== "ADMIN") {
      router.replace("/dashboard/student");
    }
  }, [loading, router, user]);

  useEffect(() => {
    router.prefetch("/dashboard/admin/manage-students");
    router.prefetch("/dashboard/admin/import-students");
  }, [router]);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const identifier = user?.studentId || user?.employeeId || user?.email || "-";
  const isAdmin = useMemo(() => user?.role === "ADMIN", [user]);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
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

  if (!isAdmin) {
    return null;
  }

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
