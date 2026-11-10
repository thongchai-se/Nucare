"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  ArrowRightLeft,
  CalendarDays,
  ChevronRight,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { AppBrand } from "@/components/app-brand";
import { ChangePasswordForm } from "@/components/change-password-form";
import { getInitials, roleLabelMap } from "@/components/change-password/shared";
import type { User } from "@/types/auth";

export function ExpertChangePasswordView({
  onLogout,
  user,
}: {
  onLogout: () => Promise<void>;
  user: User;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const expertInitials = getInitials(user.name, "MH");
  const cancelHref = "/mental-health";

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const navClassName =
    "flex min-h-12 w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900";

  const ActiveNavItem = ({ icon, label }: { icon: ReactNode; label: string }) => (
    <div className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-sm font-medium text-blue-700">
      <span className="text-blue-600">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );

  const SidebarSections = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      <div>
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">เมนูหลัก</p>
        <div className="space-y-1">
          <Link href="/mental-health" onClick={mobile ? closeMobileMenu : undefined} className={navClassName}>
            <LayoutDashboard className="h-5 w-5 text-slate-400" />
            <span className="truncate">หน้าหลัก</span>
          </Link>
          <Link href="/mental-health?view=queue" onClick={mobile ? closeMobileMenu : undefined} className={navClassName}>
            <ArrowRightLeft className="h-5 w-5 text-slate-400" />
            <span className="truncate">คิวรอรับ</span>
          </Link>
          <Link href="/mental-health?view=cases" onClick={mobile ? closeMobileMenu : undefined} className={navClassName}>
            <Users className="h-5 w-5 text-slate-400" />
            <span className="truncate">เคสที่ดูแล</span>
          </Link>
          <Link href="/mental-health?view=appointments" onClick={mobile ? closeMobileMenu : undefined} className={navClassName}>
            <CalendarDays className="h-5 w-5 text-slate-400" />
            <span className="truncate">นัดหมาย</span>
          </Link>
        </div>
      </div>

      <div>
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">บัญชี</p>
        <div className="space-y-1">
          <ActiveNavItem icon={<Lock className="h-5 w-5" />} label="เปลี่ยนรหัสผ่าน" />
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-[#F4F7FB] font-sans text-slate-800">
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="flex min-h-16 items-center border-b border-slate-100 px-4 py-2.5 sm:px-5">
          <Link href="/">
            <AppBrand subtitle="พอร์ทัลผู้เชี่ยวชาญ" size="compact" />
          </Link>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
          <SidebarSections />
        </div>

        <div className="border-t border-slate-100 bg-slate-50/80 p-4">
          <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <div className="flex items-center gap-2 font-bold">
              <ShieldCheck className="h-4 w-4" />
              โหมดคุ้มครองข้อมูลเปิดใช้งาน
            </div>
            <p className="mt-1 text-xs leading-relaxed text-emerald-700">ข้อมูลเคสที่ยังไม่รับงานจะถูกปกปิดในหน้าจอจนกว่าจะยืนยันรับเคส</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void onLogout();
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={18} /> ออกจากระบบ
          </button>
        </div>
      </aside>

      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" onClick={closeMobileMenu}>
          <div className="flex h-full w-72 flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4">
              <AppBrand subtitle="พอร์ทัลผู้เชี่ยวชาญ" size="compact" />
              <button type="button" onClick={closeMobileMenu} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-800">{user.name}</p>
                <p className="mt-1 text-xs text-slate-500">{roleLabelMap.MENTAL_HEALTH}</p>
              </div>

              <SidebarSections mobile />
            </div>

            <div className="border-t border-slate-100 p-4">
              <button
                type="button"
                onClick={() => {
                  closeMobileMenu();
                  void onLogout();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <LogOut size={18} /> ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((current) => !current)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="hidden items-center gap-2 text-sm font-medium text-slate-500 lg:flex">
              <span>Expert Portal</span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
              <span className="font-bold text-slate-800">เปลี่ยนรหัสผ่าน</span>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-3">
              <div className="hidden max-w-[12rem] overflow-hidden text-right sm:block">
                <p className="truncate whitespace-nowrap text-sm font-bold leading-none text-slate-800" title={user.name}>{user.name}</p>
                <p className="mt-0.5 truncate whitespace-nowrap text-[10px] text-slate-500" title={roleLabelMap.MENTAL_HEALTH}>{roleLabelMap.MENTAL_HEALTH}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200 bg-indigo-100 text-sm font-bold text-indigo-700">
                {expertInitials}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-3xl">
            <ChangePasswordForm
              cancelHref={cancelHref}
              description="อัปเดตรหัสผ่านของบัญชีนี้ได้จากหน้านี้โดยตรง"
              onSuccessRedirect={cancelHref}
              title="เปลี่ยนรหัสผ่าน"
              tone="portal"
            />
          </div>
        </main>
      </div>
    </div>
  );
}
