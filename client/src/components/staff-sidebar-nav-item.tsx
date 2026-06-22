"use client";

import Link from "next/link";
import { ReactNode } from "react";
import {
  STAFF_SIDEBAR_NAV_ITEM_ACTIVE,
  STAFF_SIDEBAR_NAV_ITEM_BASE,
  STAFF_SIDEBAR_NAV_ITEM_INACTIVE,
} from "@/lib/ui-classes";

type StaffSidebarNavItemContentProps = {
  badge?: number;
  icon: ReactNode;
  isActive: boolean;
  label: string;
};

function StaffSidebarNavItemContent({ badge, icon, isActive, label }: StaffSidebarNavItemContentProps) {
  return (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <span className={isActive ? "text-blue-600" : "text-slate-400"}>{icon}</span>
        <span className="truncate text-sm">{label}</span>
      </span>
      {badge ? (
        <span className="shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">{badge}</span>
      ) : null}
    </>
  );
}

function getNavItemClassName(isActive: boolean) {
  return `${STAFF_SIDEBAR_NAV_ITEM_BASE} ${
    isActive ? STAFF_SIDEBAR_NAV_ITEM_ACTIVE : STAFF_SIDEBAR_NAV_ITEM_INACTIVE
  }`;
}

type StaffSidebarNavButtonProps = {
  active: boolean;
  badge?: number;
  icon: ReactNode;
  label: string;
  onClick: () => void;
};

export function StaffSidebarNavButton({ active, badge, icon, label, onClick }: StaffSidebarNavButtonProps) {
  return (
    <button type="button" onClick={onClick} className={`${getNavItemClassName(active)} text-left`}>
      <StaffSidebarNavItemContent badge={badge} icon={icon} isActive={active} label={label} />
    </button>
  );
}

type StaffSidebarNavLinkProps = {
  badge?: number;
  href: string;
  icon: ReactNode;
  isActive: boolean;
  label: string;
  onClick?: () => void;
};

export function StaffSidebarNavLink({ badge, href, icon, isActive, label, onClick }: StaffSidebarNavLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={getNavItemClassName(isActive)}
      aria-current={isActive ? "page" : undefined}
    >
      <StaffSidebarNavItemContent badge={badge} icon={icon} isActive={isActive} label={label} />
    </Link>
  );
}
