"use client";

import { ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BriefcaseBusiness,
  ChevronRight,
  ClipboardList,
  Database,
  FileText,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Server,
  Settings,
  Users,
  X,
} from "lucide-react";
import { AppBrand } from "@/components/app-brand";
import { MenuSectionHeading } from "@/components/menu-section-heading";
import { StaffRoleSwitcher } from "@/components/staff-role-switcher";
import { getNameInitials } from "@/lib/name-prefix";

type AdminNavKey = "dashboard" | "students" | "staff" | "import" | "surveys" | "reports" | "audit" | "settings" | "changePassword";

type HeaderSearchProps = {
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
};

type AdminShellProps = {
  activeNav: AdminNavKey;
  children: ReactNode;
  headerSearch?: HeaderSearchProps;
  onLogout: () => Promise<void> | void;
  title: string;
  userName: string;
  userRoleLabel: string;
};

type NavItem = {
  href: string;
  key: AdminNavKey;
  label: string;
  icon: ReactNode;
};

const primaryNavItems: NavItem[] = [
  {
    key: "dashboard",
    label: "แดชบอร์ดภาพรวม",
    href: "/dashboard/admin",
    icon: <LayoutDashboard size={20} />,
  },
  {
    key: "students",
    label: "จัดการนักศึกษา",
    href: "/dashboard/admin/manage-students",
    icon: <Users size={20} />,
  },
  {
    key: "staff",
    label: "จัดการบุคลากร",
    href: "/dashboard/admin/manage-staff",
    icon: <BriefcaseBusiness size={20} />,
  },
  {
    key: "import",
    label: "นำเข้าข้อมูล",
    href: "/dashboard/admin/import-students",
    icon: <Database size={20} />,
  },
  {
    key: "surveys",
    label: "แบบสอบถาม",
    href: "/dashboard/admin/surveys",
    icon: <ClipboardList size={20} />,
  },
];

const secondaryNavItems: NavItem[] = [
  {
    key: "reports",
    label: "สถิติและรายงาน",
    href: "/dashboard/admin?view=reports",
    icon: <BarChart3 size={20} />,
  },
  {
    key: "audit",
    label: "บันทึกระบบ (Audit Logs)",
    href: "/dashboard/admin?view=audit",
    icon: <FileText size={20} />,
  },
];

const settingsNavItems: NavItem[] = [
  {
    key: "settings",
    label: "ตั้งค่าระบบพื้นฐาน",
    href: "/dashboard/admin?view=settings",
    icon: <Settings size={20} />,
  },
];

const getInitials = (name: string, fallback = "AD"): string => getNameInitials(name, fallback);

export function AdminShell({
  activeNav,
  children,
  headerSearch: _headerSearch,
  onLogout,
  title,
  userName,
  userRoleLabel,
}: AdminShellProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  void _headerSearch;

  const isChangePasswordPage = pathname === "/dashboard/admin" && activeNav === "changePassword";
  const initials = useMemo(() => getInitials(userName), [userName]);
  const activeLabel = useMemo(() => {
    const allItems = [...primaryNavItems, ...secondaryNavItems, ...settingsNavItems];
    return allItems.find((item) => item.key === activeNav)?.label || title;
  }, [activeNav, title]);

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    closeMobileMenu();
    await onLogout();
  };

  const SidebarItem = ({ href, icon, isActive, label }: Omit<NavItem, "key"> & { isActive: boolean }) => (
    <Link
      href={href}
      onClick={closeMobileMenu}
      className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left font-medium transition-colors ${
        isActive
          ? "border-blue-100 bg-blue-50 text-blue-700"
          : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
      }`}
      aria-current={isActive ? "page" : undefined}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className={isActive ? "text-blue-600" : "text-slate-400"}>{icon}</span>
        <span className="truncate text-sm">{label}</span>
      </span>
    </Link>
  );

  const SidebarContent = () => (
    <>
      <div className="flex h-16 items-center justify-between border-b border-slate-100 px-6">
        <AppBrand subtitle="คณะพยาบาลศาสตร์" size="compact" />
        <button type="button" onClick={closeMobileMenu} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-6">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:hidden">
          <p className="text-sm font-bold text-slate-800">{userName}</p>
          <p className="mt-1 text-xs text-slate-500">{userRoleLabel}</p>
        </div>

        <div>
          <MenuSectionHeading title="เมนูหลัก" />
          <div className="space-y-1">
            {primaryNavItems.map(({ key, ...item }) => (
              <SidebarItem key={key} {...item} isActive={activeNav === key} />
            ))}
          </div>
        </div>

        <div>
          <MenuSectionHeading title="รายงานและตรวจสอบ" />
          <div className="space-y-1">
            {secondaryNavItems.map(({ key, ...item }) => (
              <SidebarItem key={key} {...item} isActive={activeNav === key} />
            ))}
          </div>
        </div>

        <div>
          <MenuSectionHeading title="ระบบและความปลอดภัย" />
          <div className="space-y-1">
            {settingsNavItems.map(({ key, ...item }) => (
              <SidebarItem key={key} {...item} isActive={activeNav === key} />
            ))}
            <Link
              href="/dashboard/admin?view=change-password"
              onClick={closeMobileMenu}
              className={`mt-1 flex min-h-12 w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left font-medium transition-colors ${
                isChangePasswordPage
                  ? "border-blue-100 bg-blue-50 text-blue-700"
                  : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              }`}
              aria-current={isChangePasswordPage ? "page" : undefined}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className={isChangePasswordPage ? "text-blue-600" : "text-slate-400"}>
                  <Lock size={18} />
                </span>
                <span className="truncate text-sm">เปลี่ยนรหัสผ่าน</span>
              </span>
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 bg-slate-50/80 p-4">
        <StaffRoleSwitcher className="mb-3" onRoleSelect={closeMobileMenu} />
        <button
          type="button"
          onClick={() => {
            void handleLogout();
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
      <aside className="hidden h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
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
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setIsMobileMenuOpen((current) => !current)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
              <Menu size={20} />
            </button>

            <div className="hidden items-center gap-2 text-sm font-medium text-slate-500 lg:flex">
              <span>Admin Portal</span>
              <ChevronRight size={14} />
              <span className="font-bold text-slate-800">{activeLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 sm:flex">
              <Server size={14} /> System Online
            </div>
            <div className="hidden h-6 w-px bg-slate-200 sm:block" />
            <div className="flex items-center gap-3">
              <div className="hidden max-w-[12rem] overflow-hidden text-right sm:block">
                <p className="truncate whitespace-nowrap text-sm font-bold leading-none text-slate-800" title={userName}>{userName}</p>
                <p className="mt-0.5 truncate whitespace-nowrap text-[10px] text-slate-500" title={userRoleLabel}>{userRoleLabel}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-sm font-bold text-white">
                {initials}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
