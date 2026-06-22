"use client";

import { ReactNode } from "react";
import { MenuSectionHeading } from "@/components/menu-section-heading";

type StaffSidebarSectionProps = {
  children: ReactNode;
  title: string;
};

export function StaffSidebarSection({ children, title }: StaffSidebarSectionProps) {
  return (
    <div className="space-y-1">
      <MenuSectionHeading title={title} />
      {children}
    </div>
  );
}
