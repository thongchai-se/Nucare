import type { Role, User } from "@/types/auth";

/** ยุบบทบาทผู้สอน (legacy) ให้เทียบเท่าที่ปรึกษา */
export const collapseLegacyStaffRole = (role: Role): Role =>
  role === "INSTRUCTOR" ? "ADVISOR" : role;

export const roleHomePathMap: Record<Role, string> = {
  ADMIN: "/admin",
  EXECUTIVE: "/executive",
  STUDENT_DEVELOPMENT: "/student-development",
  MENTAL_HEALTH: "/mental-health",
  ADVISOR: "/advisor",
  INSTRUCTOR: "/advisor",
  STUDENT: "/student",
};

export const roleLabelMap: Record<Role, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  EXECUTIVE: "ผู้บริหาร",
  STUDENT_DEVELOPMENT: "ฝ่ายพัฒนานักศึกษา",
  MENTAL_HEALTH: "ทีมสุขภาพจิต / ผู้เชี่ยวชาญ",
  ADVISOR: "อาจารย์ที่ปรึกษา",
  INSTRUCTOR: "อาจารย์ที่ปรึกษา",
  STUDENT: "นักศึกษา",
};

const staffRolePriority: Role[] = [
  "ADMIN",
  "EXECUTIVE",
  "STUDENT_DEVELOPMENT",
  "MENTAL_HEALTH",
  "ADVISOR",
];

export const getAssignedRoles = (user: Pick<User, "role" | "roles"> | null | undefined): Role[] => {
  if (!user) {
    return [];
  }

  const rawRoles = (user.roles?.length ? user.roles : [user.role]).map(collapseLegacyStaffRole);
  const uniqueRoles = Array.from(new Set(rawRoles));

  if (uniqueRoles.includes("STUDENT")) {
    return ["STUDENT"];
  }

  return uniqueRoles.sort((left, right) => {
    const leftIndex = staffRolePriority.indexOf(left);
    const rightIndex = staffRolePriority.indexOf(right);
    return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
  });
};

export const hasRole = (user: Pick<User, "role" | "roles"> | null | undefined, role: Role): boolean =>
  getAssignedRoles(user).includes(collapseLegacyStaffRole(role));

export const getDefaultRole = (user: Pick<User, "role" | "roles"> | null | undefined): Role | null =>
  getAssignedRoles(user)[0] || null;

export const getRoleHomePath = (role: Role): string => roleHomePathMap[collapseLegacyStaffRole(role)];
