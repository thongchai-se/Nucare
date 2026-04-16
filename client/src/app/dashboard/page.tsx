"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HeartPulse, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/auth.context";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
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

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-100 p-2 text-blue-700">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold text-slate-900">nucare Dashboard</h1>
            <p className="text-sm text-slate-500">พื้นที่ใช้งานสำหรับผู้ดูแลระบบสุขภาวะนักศึกษา</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <LogOut className="h-4 w-4" />
          ออกจากระบบ
        </button>
      </div>

      <section className="mx-auto mt-6 grid w-full max-w-5xl gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">ผู้ใช้งานปัจจุบัน</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <p>
              <span className="font-medium text-slate-900">ชื่อ:</span> {user.name}
            </p>
            <p>
              <span className="font-medium text-slate-900">บทบาท:</span> {user.role}
            </p>
            <p>
              <span className="font-medium text-slate-900">Identifier:</span> {identifier}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-lg bg-white/80 px-3 py-2 text-blue-700">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Protected Route</span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-blue-900">
            หน้านี้เป็นพื้นที่ protected สำหรับผู้ใช้งานที่ผ่านการยืนยันตัวตนแล้ว ในเฟสถัดไปจะต่อยอดเป็นระบบติดตามสุขภาวะรายบุคคลและแดชบอร์ดการดูแลนักศึกษา
          </p>
        </div>
      </section>
    </main>
  );
}
