"use client";

import { ReactNode, useState } from "react";
import {
  BarChart3,
  BriefcaseBusiness,
  ClipboardList,
  Database,
  FileText,
  Images,
  LayoutDashboard,
  Settings,
  Users,
  X,
} from "lucide-react";
import { AppBrand } from "@/components/app-brand";
import { StaffSidebarFooter } from "@/components/staff-sidebar-footer";
import { StaffSidebarNavLink } from "@/components/staff-sidebar-nav-item";
import { StaffSidebarSection } from "@/components/staff-sidebar-section";
import { StaffTopBar } from "@/components/staff-top-bar";
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
};

type NavItem = {
  href: string;
  key: AdminNavKey;
  label: string;
  icon: ReactNode;
};

const overviewNavItems: NavItem[] = [
  {
    key: "dashboard",
    label: "แดชบอร์ดภาพรวม",
    href: "/admin",
    icon: <LayoutDashboard size={20} />,
  },
];

const dataNavItems: NavItem[] = [
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
];

const contentNavItems: NavItem[] = [
  {
    key: "surveys",
    label: "แบบสอบถาม",
    href: "/admin/surveys",
    icon: <ClipboardList size={20} />,
  },
  {
    key: "siteMedia",
    label: "สื่อประชาสัมพันธ์",
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
    label: "ตั้งค่าระบบ",
    href: "/admin?view=settings",
    icon: <Settings size={20} />,
  },
];

const allAdminNavItems = [
  ...overviewNavItems,
  ...dataNavItems,
  ...contentNavItems,
  ...secondaryNavItems,
  ...settingsNavItems,
];

export function AdminShell({
  activeNav,
  children,
  headerSearch: _headerSearch,
  onLogout,
  title,
}: AdminShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  void _headerSearch;
  void title;

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    closeMobileMenu();
    await onLogout();
  };

  const renderNavLinks = (items: NavItem[]) =>
    items.map(({ key, href, icon, label }) => (
      <StaffSidebarNavLink
        key={key}
        href={href}
        icon={icon}
        isActive={activeNav === key}
        label={label}
        onClick={closeMobileMenu}
      />
    ));

  const NavSections = () => (
    <>
      <StaffSidebarSection title="งานหลัก">{renderNavLinks(overviewNavItems)}</StaffSidebarSection>
      <StaffSidebarSection title="จัดการข้อมูล">{renderNavLinks(dataNavItems)}</StaffSidebarSection>
      <StaffSidebarSection title="เนื้อหาและสื่อ">{renderNavLinks(contentNavItems)}</StaffSidebarSection>
      <StaffSidebarSection title="รายงานและตรวจสอบ">{renderNavLinks(secondaryNavItems)}</StaffSidebarSection>
      <StaffSidebarSection title="ระบบ">{renderNavLinks(settingsNavItems)}</StaffSidebarSection>
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
        <StaffTopBar onOpenMenu={() => setIsMobileMenuOpen((current) => !current)} />

        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
