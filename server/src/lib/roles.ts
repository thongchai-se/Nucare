import { Prisma, Role } from "@prisma/client";

/** บทบาทเจ้าหน้าที่ที่มอบหมายได้ — ยุบผู้สอนเข้าที่ปรึกษาแล้ว */
export const managedStaffRoleValues = [
  Role.ADMIN,
  Role.EXECUTIVE,
  Role.STUDENT_DEVELOPMENT,
  Role.MENTAL_HEALTH,
  Role.ADVISOR,
] as const;

export type ManagedStaffRole = (typeof managedStaffRoleValues)[number];

const managedStaffRolePriority = new Map<ManagedStaffRole, number>(
  managedStaffRoleValues.map((role, index) => [role, index])
);

/** ยุบบทบาทผู้สอน (legacy) ให้เทียบเท่าที่ปรึกษา */
export const collapseLegacyStaffRole = (role: Role): Role =>
  role === Role.INSTRUCTOR ? Role.ADVISOR : role;

const toRoleArray = (
  value:
    | Role
    | readonly Role[]
    | {
        role: Role;
        roles?: readonly Role[] | null;
      }
    | undefined
): Role[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((role) => collapseLegacyStaffRole(role));
  }

  if (typeof value === "object" && "role" in value) {
    return [collapseLegacyStaffRole(value.role), ...(value.roles || []).map(collapseLegacyStaffRole)];
  }

  return [collapseLegacyStaffRole(value as Role)];
};

export const isManagedStaffRole = (role: Role): role is ManagedStaffRole =>
  managedStaffRoleValues.includes(role as ManagedStaffRole);

export const normalizeManagedStaffRoles = (roles: Iterable<Role>): ManagedStaffRole[] => {
  const uniqueRoles = new Set<ManagedStaffRole>();

  for (const role of roles) {
    if (isManagedStaffRole(role)) {
      uniqueRoles.add(role);
    }
  }

  return [...uniqueRoles].sort(
    (left, right) => (managedStaffRolePriority.get(left) ?? Number.MAX_SAFE_INTEGER) - (managedStaffRolePriority.get(right) ?? Number.MAX_SAFE_INTEGER)
  );
};

export const splitPrimaryAndAdditionalStaffRoles = (roles: Iterable<Role>) => {
  const normalizedRoles = normalizeManagedStaffRoles(roles);
  const primaryRole = normalizedRoles[0];

  if (!primaryRole) {
    throw new Error("At least one staff role is required");
  }

  return {
    primaryRole,
    assignedRoles: normalizedRoles,
    additionalRoles: normalizedRoles.slice(1),
  };
};

/** รวมบทบาททั้งหมดของผู้ใช้ (บทบาทหลัก + บทบาทเพิ่มเติม) */
export const getAssignedRoles = (input: {
  role: Role;
  additionalRoles?: readonly Role[] | null;
}): Role[] => {
  const primaryRole = collapseLegacyStaffRole(input.role);
  if (primaryRole === Role.STUDENT) {
    return [Role.STUDENT];
  }

  return splitPrimaryAndAdditionalStaffRoles([
    primaryRole,
    ...(input.additionalRoles || []).map(collapseLegacyStaffRole),
  ]).assignedRoles;
};

/** ตรวจว่าผู้ใช้มีบทบาทที่ต้องการเป็นหลัก เป็นเพิ่มเติม หรืออยู่ในรายการ roles */
export const hasAssignedRole = (
  input:
    | Role
    | readonly Role[]
    | {
        role: Role;
        roles?: readonly Role[] | null;
      }
    | undefined,
  expectedRole: Role
): boolean => {
  const roles = toRoleArray(input);
  const expected = collapseLegacyStaffRole(expectedRole);

  if (roles.length === 0) {
    return false;
  }

  if (expected === Role.STUDENT) {
    return roles.includes(Role.STUDENT);
  }

  return normalizeManagedStaffRoles(roles).includes(expected as ManagedStaffRole);
};

/** เงื่อนไข Prisma หาผู้ใช้ที่มีบทบาท — รวม INSTRUCTOR เก่าเมื่อถาม ADVISOR */
export const buildUserHasRoleWhere = (role: Role): Prisma.UserWhereInput => {
  if (role === Role.STUDENT) {
    return {
      role: Role.STUDENT,
    };
  }

  const matchedRoles =
    role === Role.ADVISOR || role === Role.INSTRUCTOR
      ? [Role.ADVISOR, Role.INSTRUCTOR]
      : [role];

  return {
    OR: matchedRoles.flatMap((matchedRole) => [
      { role: matchedRole },
      { additionalRoles: { has: matchedRole } },
    ]),
  };
};
