"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BookOpen, ChevronRight, LayoutDashboard, Lock, LogOut, Menu, Send, Users } from "lucide-react";
import { AppBrand } from "@/components/app-brand";
import { ChangePasswordForm } from "@/components/change-password-form";
import { getInitials, roleLabelMap } from "@/components/change-password/shared";
import type { User } from "@/types/auth";

export function AdvisorChangePasswordView({
  homePath,
  onLogout,
  user,
}: {
  homePath: string;
  onLogout: () => Promise<void>;
  user: User;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const advisorInitials = getInitials(user.name, "AD");

  const SidebarItem = ({
    active,
    icon,
    label,
    onClick,
  }: {
    active: boolean;
    icon: ReactNode;
    label: string;
    onClick?: () => void;
  }) =>
    onClick ? (
      <button
        type="button"
        onClick={onClick}
        className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left font-medium transition-colors ${
          active
            ? "border-blue-100 bg-blue-50 text-blue-700"
            : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
        }`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className={active ? "text-blue-600" : "text-slate-400"}>{icon}</span>
          <span className="truncate text-sm">{label}</span>
        </span>
      </button>
    ) : (
      <div className="flex min-h-12 w-full items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-left font-medium text-blue-700">
        <span className="flex min-w-0 items-center gap-3">
          <span className="text-blue-600">{icon}</span>
          <span className="truncate text-sm">{label}</span>
        </span>
      </div>
    );

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const SidebarContent = () => (
    <>
      <div className="flex min-h-16 items-center border-b border-slate-100 px-4 py-2.5 sm:px-5">
        <AppBrand subtitle="พอร์ทัลอาจารย์ที่ปรึกษา" size="compact" />
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">เมนูหลัก</p>
        <Link
          href="/advisor"
          onClick={closeMobileMenu}
          className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
        >
          <LayoutDashboard size={20} className="text-slate-400" />
          <span className="truncate">หน้าหลัก</span>
        </Link>
        <Link
          href="/advisor?view=advisees"
          onClick={closeMobileMenu}
          className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
        >
          <Users size={20} className="text-slate-400" />
          <span className="truncate">นักศึกษาในที่ปรึกษา</span>
        </Link>
        <Link
          href="/advisor?view=referrals"
          onClick={closeMobileMenu}
          className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
        >
          <Send size={20} className="text-slate-400" />
          <span className="truncate">ติดตามการส่งต่อ</span>
        </Link>
        <Link
          href="/advisor?view=academic"
          onClick={closeMobileMenu}
          className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
        >
          <BookOpen size={20} className="text-slate-400" />
          <span className="truncate">แจ้งปัญหาจากผู้สอน</span>
        </Link>
        <SidebarItem active={true} icon={<Lock size={20} />} label="เปลี่ยนรหัสผ่าน" />
      </div>

      <div className="border-t border-slate-100 bg-slate-50/80 p-4">
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
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F7FB] font-sans text-slate-800">
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <SidebarContent />
      </aside>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" onClick={closeMobileMenu}>
          <div className="flex h-full w-72 flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <SidebarContent />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setIsMobileMenuOpen((current) => !current)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
              <Menu size={20} />
            </button>

            <div className="hidden items-center gap-2 text-sm font-medium text-slate-500 lg:flex">
              <span>Advisor Portal</span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
              <span className="font-bold text-slate-800">เปลี่ยนรหัสผ่าน</span>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-3">
              <div className="hidden max-w-[12rem] overflow-hidden text-right sm:block">
                <p className="truncate whitespace-nowrap text-sm font-bold leading-none text-slate-800" title={user.name}>{user.name}</p>
                <p className="mt-0.5 truncate whitespace-nowrap text-[10px] text-slate-500" title={roleLabelMap.ADVISOR}>{roleLabelMap.ADVISOR}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-200 bg-blue-100 text-sm font-bold text-blue-700">
                {advisorInitials}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-3xl">
            <ChangePasswordForm
              cancelHref={homePath}
              description="อัปเดตรหัสผ่านของบัญชีนี้ได้จากหน้านี้โดยตรง"
              onSuccessRedirect={homePath}
              title="เปลี่ยนรหัสผ่าน"
              tone="portal"
            />
          </div>
        </main>
      </div>
    </div>
  );
}
