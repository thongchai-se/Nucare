import type { ReactNode } from "react";
import { getNameInitials } from "@/lib/name-prefix";
import type { Role } from "@/types/auth";

export type PortalShellConfig = {
  footerNote?: {
    description: string;
    title: string;
  };
  initialsFallback: string;
  portalLabel: string;
  sections?: Array<{
    items: Array<{
      active?: boolean;
      href?: string;
      icon: ReactNode;
      label: string;
    }>;
    title: string;
  }>;
  userRoleLabel: string;
};

export const roleLabelMap: Record<Role, string> = {
  STUDENT_DEVELOPMENT: "ฝ่ายพัฒนานักศึกษา",
  ADMIN: "ผู้ดูแลระบบ",
  ADVISOR: "อาจารย์ที่ปรึกษา",
  EXECUTIVE: "ผู้บริหาร",
  INSTRUCTOR: "ผู้สอน",
  MENTAL_HEALTH: "ผู้เชี่ยวชาญสุขภาพจิต",
  STUDENT: "นักศึกษา",
};

export const formatUserIdentifier = (studentId?: string | null, employeeId?: string | null, email?: string | null): string => {
  if (studentId) {
    if (/^\d{9}-\d$/.test(studentId)) {
      return studentId;
    }

    if (/^\d{10}$/.test(studentId)) {
      return `${studentId.slice(0, 9)}-${studentId.slice(9)}`;
    }

    return studentId;
  }

  if (employeeId) {
    return employeeId;
  }

  return email ?? "-";
};

export const getInitials = (name: string, fallback: string): string => getNameInitials(name, fallback);
