"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, LogOut, Menu, X } from "lucide-react";
import { AppBrand } from "@/components/app-brand";
import { ChangePasswordForm } from "@/components/change-password-form";
import { getInitials, type PortalShellConfig } from "@/components/change-password/shared";
import type { User } from "@/types/auth";

export function RoleAlignedChangePasswordView({
  config,
  homePath,
  identifier,
  onLogout,
  user,
}: {
  config: PortalShellConfig;
  homePath: string;
  identifier: string;
  onLogout: () => Promise<void>;
  user: User;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const userInitials = getInitials(user.name, config.initialsFallback);
  const identifierLabel = user.studentId ? "รหัสนักศึกษา" : user.employeeId ? "รหัสบุคลากร" : "อีเมล";

  const SectionedSidebarItems = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {(config.sections ?? []).map((section) => (
        <div key={section.title}>
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{section.title}</p>
          <div className="space-y-1">
            {section.items.map((item) => {
              const active = item.active ?? false;
              const content = (
                <span className="flex min-w-0 items-center gap-3">
                  <span className={active ? "text-blue-600" : "text-slate-400"}>{item.icon}</span>
                  <span className="truncate text-sm">{item.label}</span>
                </span>
              );

              if (!item.href || active) {
                return (
                  <div
                    key={`${section.title}-${item.label}`}
                    className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left font-medium ${
                      active ? "border-blue-100 bg-blue-50 text-blue-700" : "border-transparent text-slate-600"
                    }`}
                  >
                    {content}
                  </div>
                );
              }

              return (
                <Link
                  key={`${section.title}-${item.label}`}
                  href={item.href}
                  onClick={() => {
                    if (mobile) {
                      setIsMobileMenuOpen(false);
                    }
                  }}
                  className="flex min-h-12 w-full items-center justify-between rounded-xl border border-transparent px-3 py-2.5 text-left font-medium text-slate-600 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                >
                  {content}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F7FB] font-sans text-slate-800">
      <aside className="hidden h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex min-h-16 items-center border-b border-slate-100 px-4 py-2.5 sm:px-5">
          <AppBrand subtitle={config.portalLabel} size="compact" />
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
          <SectionedSidebarItems />
        </div>

        <div className="border-t border-slate-100 bg-slate-50/80 p-4">
          {config.footerNote ? (
            <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <div className="font-bold">{config.footerNote.title}</div>
              <p className="mt-1 text-xs leading-relaxed text-emerald-700">{config.footerNote.description}</p>
            </div>
          ) : null}
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
        <div className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="flex h-full w-72 flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4">
              <AppBrand subtitle={config.portalLabel} size="compact" />
              <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-800">{user.name}</p>
                <p className="mt-1 text-xs text-slate-500">{config.userRoleLabel}</p>
                <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-medium text-slate-500">{identifierLabel}: {identifier}</p>
              </div>
              <SectionedSidebarItems mobile />
            </div>

            <div className="border-t border-slate-100 p-4">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
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
            <button type="button" onClick={() => setIsMobileMenuOpen((current) => !current)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
              <Menu className="h-5 w-5" />
            </button>

            <div className="hidden items-center gap-2 text-sm font-medium text-slate-500 lg:flex">
              <span>{config.portalLabel}</span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
              <span className="font-bold text-slate-800">เปลี่ยนรหัสผ่าน</span>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-3">
              <div className="hidden max-w-[12rem] overflow-hidden text-right sm:block">
                <p className="truncate whitespace-nowrap text-sm font-bold leading-none text-slate-800" title={user.name}>{user.name}</p>
                <p className="mt-0.5 truncate whitespace-nowrap text-[10px] text-slate-500" title={config.userRoleLabel}>{config.userRoleLabel}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-200 bg-blue-100 text-sm font-bold text-blue-700">
                {userInitials}
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
