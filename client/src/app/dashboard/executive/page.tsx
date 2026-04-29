"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle,
  FileText,
  HeartPulse,
  LogOut,
  Menu,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth.context";

const executiveRiskBreakdown = [
  { year: "1", total: 320, normal: 85, watch: 10, high: 5 },
  { year: "2", total: 315, normal: 80, watch: 15, high: 5 },
  { year: "3", total: 305, normal: 65, watch: 25, high: 10, alert: true },
  { year: "4", total: 300, normal: 75, watch: 20, high: 5 },
];

const watchlistCases = [
  {
    id: "6601XXXX",
    year: "2",
    label: "เสี่ยงทำร้ายตนเอง",
    tone: "red",
    description: "ถูกส่งต่อจากอาจารย์ที่ปรึกษา ขณะนี้อยู่ในความดูแลของจิตแพทย์",
  },
  {
    id: "6502XXXX",
    year: "3",
    label: "ขาดเรียนติดต่อกัน",
    tone: "amber",
    description: "ฝ่ายพัฒนานักศึกษากำลังลงพื้นที่หอพักเพื่อตรวจสอบ",
  },
];

export default function ExecutiveDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    if (!loading && user?.role === "ADVISOR") {
      router.replace("/dashboard/advisor");
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
    if (!loading && user?.role === "STUDENT") {
      router.replace("/dashboard/student");
    }
  }, [loading, router, user?.role]);

  const isExecutive = useMemo(() => user?.role === "EXECUTIVE", [user]);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const initials = useMemo(() => {
    return (
      user?.name
        ?.trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "EX"
    );
  }, [user?.name]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <span className="loader h-7 w-7  text-blue-600"></span>
      </main>
    );
  }

  if (!user || !isExecutive) {
    return null;
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 font-sans text-slate-800">
      <nav className="fixed z-50 w-full border-b border-slate-100 bg-white shadow-sm transition-all duration-300">
        <div className="mx-auto max-w-[116rem] px-1.5 sm:px-2 lg:px-3">
          <div className="flex h-20 items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white shadow-sm">
                <HeartPulse className="h-6 w-6" />
              </div>
              <div className="flex flex-col justify-center">
                <span className="block text-xl font-bold leading-none text-blue-900">
                  Nucare<span className="text-2xl leading-none text-cyan-500">.</span>
                </span>
                <span className="block text-[11px] font-medium leading-none text-slate-500">
                  คณะพยาบาลศาสตร์
                </span>
              </div>
            </Link>

            <div className="hidden items-center gap-4 md:flex">
              <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                Executive Portal
              </span>
              <div className="text-right">
                <p className="text-sm font-bold leading-tight text-blue-900">{user.name}</p>
                <p className="text-xs text-slate-500">ผู้บริหารคณะพยาบาลศาสตร์</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-100 font-bold text-cyan-700">
                {initials}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-red-600"
                aria-label="logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>

            <button
              type="button"
              className="rounded-lg p-2 text-slate-500 md:hidden"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        <div
          className={`overflow-hidden border-t border-slate-100 bg-white transition-all duration-300 md:hidden ${
            mobileMenuOpen ? "max-h-48 py-4" : "max-h-0"
          }`}
        >
          <div className="space-y-4 px-4">
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-center text-xs font-semibold text-blue-700">
                Executive Portal
              </div>
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-100 font-bold text-cyan-700">
                {initials}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{user.name}</p>
                <p className="text-xs text-slate-500">ผู้บริหารคณะพยาบาลศาสตร์</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600"
            >
              <LogOut className="h-4 w-4" />
              ออกจากระบบ
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-32 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="mb-1 text-3xl font-extrabold text-slate-900">ภาพรวมสุขภาวะนักศึกษา</h1>
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Calendar className="h-4 w-4" /> ข้อมูลอัปเดตแบบเรียลไทม์ (พฤษภาคม 2569)
            </p>
          </div>
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <FileText className="h-4 w-4" /> ออกรายงาน (Export)
          </button>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                <Users className="h-6 w-6" />
              </div>
              <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-600">
                <ArrowUpRight className="h-3 w-3" /> 98%
              </span>
            </div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">ทำประเมินแล้ว</p>
            <h3 className="text-3xl font-black text-slate-800">
              1,240 <span className="text-base font-medium text-slate-500">คน</span>
            </h3>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
                <CheckCircle className="h-6 w-6" />
              </div>
            </div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">กลุ่มปกติ</p>
            <h3 className="text-3xl font-black text-emerald-600">
              1,067 <span className="text-base font-medium text-slate-500">คน</span>
            </h3>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-xl bg-amber-50 p-3 text-amber-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-600">
                <ArrowDownRight className="h-3 w-3" /> 5%
              </span>
            </div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">กลุ่มเฝ้าระวัง</p>
            <h3 className="text-3xl font-black text-amber-600">
              128 <span className="text-base font-medium text-slate-500">คน</span>
            </h3>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-xl bg-red-50 p-3 text-red-600">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <span className="flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-red-600">
                <ArrowUpRight className="h-3 w-3" /> 2%
              </span>
            </div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">กลุ่มเสี่ยงสูง</p>
            <h3 className="text-3xl font-black text-red-600">
              45 <span className="text-base font-medium text-slate-500">คน</span>
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2 sm:p-8">
            <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-slate-800">
              <BarChart3 className="h-5 w-5 text-blue-600" /> สัดส่วนความเสี่ยงแยกตามชั้นปี
            </h3>

            <div className="space-y-6">
              {executiveRiskBreakdown.map((item) => (
                <div key={item.year}>
                  <div className="mb-2 flex justify-between text-sm font-bold text-slate-700">
                    <span>
                      ชั้นปีที่ {item.year}
                      {item.alert && <span className="ml-2 font-medium text-red-500">(จับตาพิเศษ)</span>}
                    </span>
                    <span>{item.total} คน</span>
                  </div>
                  <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-emerald-400" style={{ width: `${item.normal}%` }} />
                    <div className="h-full bg-amber-400" style={{ width: `${item.watch}%` }} />
                    <div className="h-full bg-red-400" style={{ width: `${item.high}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-4 border-t border-slate-100 pt-6 text-xs font-bold text-slate-500">
              <span className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-emerald-400" /> ปกติ
              </span>
              <span className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-amber-400" /> เฝ้าระวัง
              </span>
              <span className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-400" /> เสี่ยงสูง
              </span>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 p-6 text-white shadow-xl">
            <h3 className="mb-5 flex items-center gap-2 text-lg font-bold">
              <AlertOctagon className="h-5 w-5 text-red-400" /> เคสวิกฤต (Watchlist)
            </h3>

            <div className="space-y-4">
              {watchlistCases.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/20 bg-white/10 p-4">
                  <span
                    className={`mb-2 inline-block rounded px-2 py-0.5 text-[10px] font-bold text-white ${
                      item.tone === "red" ? "bg-red-500" : "bg-amber-500"
                    }`}
                  >
                    {item.label}
                  </span>
                  <p className="text-sm font-bold">
                    รหัส {item.id} (ปี {item.year})
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-300">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
