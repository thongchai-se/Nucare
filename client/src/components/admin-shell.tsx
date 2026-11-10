"use client";

import { ReactNode, useMemo, useState } from "react";
import {
  BarChart3,
  BriefcaseBusiness,
  ChevronRight,
  ClipboardList,
  Database,
  FileText,
  Images,
  LayoutDashboard,
  Menu,
  Server,
  Settings,
  Users,
  X,
} from "lucide-react";
import { AppBrand } from "@/components/app-brand";
import { StaffSidebarFooter } from "@/components/staff-sidebar-footer";
import { StaffSidebarNavLink } from "@/components/staff-sidebar-nav-item";
import { StaffSidebarSection } from "@/components/staff-sidebar-section";
import { getNameInitials } from "@/lib/name-prefix";
import {
  STAFF_SIDEBAR_ASIDE,
  STAFF_SIDEBAR_HEADER,
  STAFF_SIDEBAR_MOBILE_HEADER,
  STAFF_SIDEBAR_MOBILE_NAV_SCROLL,
  STAFF_SIDEBAR_NAV_SCROLL,
} from "@/lib/ui-classes";

type AdminNavKey =
  | "dashboard"
  | "students"
  | "staff"
  | "import"
  | "externalDirectory"
  | "surveys"
  | "siteMedia"
  | "reports"
  | "audit"
  | "settings";

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
    href: "/admin",
    icon: <LayoutDashboard size={20} />,
  },
  {
    key: "students",
    label: "จัดการนักศึกษา",
    href: "/admin/manage-students",
    icon: <Users size={20} />,
  },
  {
    key: "staff",
    label: "จัดการบุคลากร",
    href: "/admin/manage-staff",
    icon: <BriefcaseBusiness size={20} />,
  },
  {
    key: "import",
    label: "นำเข้าข้อมูล",
    href: "/admin/import-students",
    icon: <Database size={20} />,
  },
  {
    key: "externalDirectory",
    label: "รายชื่อจาก API",
    href: "/admin/external-directory",
    icon: <Server size={20} />,
  },
  {
    key: "surveys",
    label: "แบบสอบถาม",
    href: "/admin/surveys",
    icon: <ClipboardList size={20} />,
  },
  {
    key: "siteMedia",
    label: "ภาพประชาสัมพันธ์",
    href: "/admin/site-media",
    icon: <Images size={20} />,
  },
];

const secondaryNavItems: NavItem[] = [
  {
    key: "reports",
    label: "สถิติและรายงาน",
    href: "/admin?view=reports",
    icon: <BarChart3 size={20} />,
  },
  {
    key: "audit",
    label: "บันทึกระบบ (Audit Logs)",
    href: "/admin?view=audit",
    icon: <FileText size={20} />,
  },
];

const settingsNavItems: NavItem[] = [
  {
    key: "settings",
    label: "ตั้งค่าระบบพื้นฐาน",
    href: "/admin?view=settings",
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  void _headerSearch;

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

  const NavSections = () => (
    <>
      <StaffSidebarSection title="เมนูหลัก">
        {primaryNavItems.map(({ key, href, icon, label }) => (
          <StaffSidebarNavLink
            key={key}
            href={href}
            icon={icon}
            isActive={activeNav === key}
            label={label}
            onClick={closeMobileMenu}
          />
        ))}
      </StaffSidebarSection>

      <StaffSidebarSection title="รายงานและตรวจสอบ">
        {secondaryNavItems.map(({ key, href, icon, label }) => (
          <StaffSidebarNavLink
            key={key}
            href={href}
            icon={icon}
            isActive={activeNav === key}
            label={label}
            onClick={closeMobileMenu}
          />
        ))}
      </StaffSidebarSection>

      <StaffSidebarSection title="ระบบ">
        {settingsNavItems.map(({ key, href, icon, label }) => (
          <StaffSidebarNavLink
            key={key}
            href={href}
            icon={icon}
            isActive={activeNav === key}
            label={label}
            onClick={closeMobileMenu}
          />
        ))}
      </StaffSidebarSection>
    </>
  );

  const DesktopSidebarContent = () => (
    <>
      <div className={STAFF_SIDEBAR_HEADER}>
        <AppBrand subtitle="คณะพยาบาลศาสตร์" size="compact" />
      </div>

      <div className={STAFF_SIDEBAR_NAV_SCROLL}>
        <NavSections />
      </div>

      <StaffSidebarFooter onLogout={handleLogout} onRoleSelect={closeMobileMenu} />
    </>
  );

  const MobileSidebarContent = () => (
    <>
      <div className={STAFF_SIDEBAR_MOBILE_HEADER}>
        <AppBrand subtitle="คณะพยาบาลศาสตร์" size="compact" />
        <button type="button" onClick={closeMobileMenu} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
          <X size={20} />
        </button>
      </div>

      <div className={STAFF_SIDEBAR_MOBILE_NAV_SCROLL}>
        <NavSections />
      </div>

      <StaffSidebarFooter onLogout={handleLogout} onRoleSelect={closeMobileMenu} />
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F7FB] font-sans text-slate-800">
      <aside className={STAFF_SIDEBAR_ASIDE}>
        <DesktopSidebarContent />
      </aside>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" onClick={closeMobileMenu}>
          <div className="flex h-full w-72 flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <MobileSidebarContent />
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
              <span>พอร์ทัลผู้ดูแลระบบ</span>
              <ChevronRight size={14} />
              <span className="font-bold text-slate-800">{activeLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 sm:flex">
              <Server size={14} /> ระบบพร้อมใช้งาน
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

        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
