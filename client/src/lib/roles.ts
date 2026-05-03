import type { Role, User } from "@/types/auth";

export const roleHomePathMap: Record<Role, string> = {
  ADMIN: "/dashboard/admin",
  EXECUTIVE: "/dashboard/executive",
  STUDENT_DEVELOPMENT: "/dashboard/student-development",
  MENTAL_HEALTH: "/dashboard/mental-health",
  ADVISOR: "/dashboard/advisor",
  INSTRUCTOR: "/dashboard/instructor",
  STUDENT: "/dashboard/student",
};

export const roleLabelMap: Record<Role, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  EXECUTIVE: "ผู้บริหาร",
  STUDENT_DEVELOPMENT: "ฝ่ายพัฒนานักศึกษา",
  MENTAL_HEALTH: "ทีมสุขภาพจิต / ผู้เชี่ยวชาญ",
  ADVISOR: "อาจารย์ที่ปรึกษา",
  INSTRUCTOR: "ผู้สอน",
  STUDENT: "นักศึกษา",
};

const staffRolePriority: Role[] = [
  "ADMIN",
  "EXECUTIVE",
  "STUDENT_DEVELOPMENT",
  "MENTAL_HEALTH",
  "ADVISOR",
  "INSTRUCTOR",
];

export const getAssignedRoles = (user: Pick<User, "role" | "roles"> | null | undefined): Role[] => {
  if (!user) {
    return [];
  }

  const rawRoles = user.roles?.length ? user.roles : [user.role];
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
  getAssignedRoles(user).includes(role);

export const getDefaultRole = (user: Pick<User, "role" | "roles"> | null | undefined): Role | null =>
  getAssignedRoles(user)[0] || null;

export const getRoleHomePath = (role: Role): string => roleHomePathMap[role];
