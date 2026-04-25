"use client";

import Link from "next/link";
import { ClipboardCheck, HeartPulse, LogIn, Menu, User, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/auth.context";

type LegalPageKey = "terms" | "privacy" | "cookies";

type LegalTopNavProps = {
  active: LegalPageKey;
};

const getUserInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "NU";
  }

  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? "";
  return `${first}${second}`.toUpperCase();
};

export default function LegalTopNav({ active: _active }: LegalTopNavProps) {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
  };

  const userInitials = getUserInitials(user?.name ?? "");

  return (
    <nav className="fixed z-50 w-full border-b border-slate-100 bg-white shadow-sm transition-all duration-300">
      <div className="mx-auto max-w-[116rem] px-1.5 sm:px-2 lg:px-3">
        <div className="flex h-20 items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
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

          <div className="hidden items-center gap-5 lg:flex xl:gap-8">
            <Link href="/#home" className="whitespace-nowrap font-medium text-slate-600 transition-colors hover:text-blue-700">
              หน้าแรก
            </Link>
            <Link href="/#workflow" className="whitespace-nowrap font-medium text-slate-600 transition-colors hover:text-blue-700">
              ขั้นตอนการดูแล
            </Link>
            <Link href="/#roles" className="whitespace-nowrap font-medium text-slate-600 transition-colors hover:text-blue-700">
              ทีมผู้เชี่ยวชาญ
            </Link>

            <div className="mx-2 h-6 border-l border-slate-200" />

            {!loading && !isAuthenticated && (
              <div className="flex items-center gap-3">
                <Link
                  href="/?auth=login"
                  className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-blue-700 px-4 py-2.5 text-sm font-semibold text-blue-700 transition-all hover:bg-blue-50 xl:px-5"
                >
                  <User className="h-4 w-4" /> เข้าสู่ระบบ
                </Link>
                <Link
                  href="/?auth=login"
                  className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800 xl:px-5"
                >
                  <ClipboardCheck className="h-4 w-4" /> ทำแบบประเมิน
                </Link>
              </div>
            )}

            {!loading && isAuthenticated && (
              <div className="flex items-center gap-3 xl:gap-4">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800 xl:px-5"
                >
                  ไปที่แดชบอร์ด
                </Link>
                <div className="group flex cursor-pointer items-center gap-3 border-l border-slate-200 pl-4">
                  <div className="hidden text-right lg:block">
                    <p className="text-sm font-bold leading-tight text-blue-900">{user?.name}</p>
                    <p className="text-xs text-slate-500">{user?.studentId ? "นักศึกษาพยาบาลศาสตร์" : "บุคลากร"}</p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-100 font-bold text-cyan-700">
                    {userInitials}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  ออกจากระบบ
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center lg:hidden">
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
        className={`overflow-hidden border-t border-slate-100 bg-white transition-all duration-300 lg:hidden ${
          mobileMenuOpen ? "max-h-[420px] pb-4" : "max-h-0"
        }`}
      >
        <div className="space-y-1 px-4 pt-2">
          <Link
            href="/#home"
            className="block rounded-md px-3 py-3 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-700"
            onClick={() => setMobileMenuOpen(false)}
          >
            หน้าแรก
          </Link>
          <Link
            href="/#workflow"
            className="block rounded-md px-3 py-3 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-700"
            onClick={() => setMobileMenuOpen(false)}
          >
            ขั้นตอนการดูแล
          </Link>
          <Link
            href="/#roles"
            className="block rounded-md px-3 py-3 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-700"
            onClick={() => setMobileMenuOpen(false)}
          >
            ทีมผู้เชี่ยวชาญ
          </Link>

          {!loading && !isAuthenticated && (
            <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4">
              <Link
                href="/?auth=login"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                <ClipboardCheck className="h-5 w-5" /> ทำแบบประเมิน
              </Link>
              <Link
                href="/?auth=login"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-700 px-4 py-3 font-semibold text-blue-700"
                onClick={() => setMobileMenuOpen(false)}
              >
                <LogIn className="h-5 w-5" /> เข้าสู่ระบบ
              </Link>
            </div>
          )}

          {!loading && isAuthenticated && (
            <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4">
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white"
              >
                ไปที่แดชบอร์ด
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-700"
              >
                ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}