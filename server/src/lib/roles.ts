import { Prisma, Role } from "@prisma/client";

export const managedStaffRoleValues = [
  Role.ADMIN,
  Role.EXECUTIVE,
  Role.STUDENT_DEVELOPMENT,
  Role.MENTAL_HEALTH,
  Role.ADVISOR,
  Role.INSTRUCTOR,
] as const;

export type ManagedStaffRole = (typeof managedStaffRoleValues)[number];

const managedStaffRolePriority = new Map<ManagedStaffRole, number>(
  managedStaffRoleValues.map((role, index) => [role, index])
);

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
    return [...value];
  }

  if (typeof value === "object" && "role" in value) {
    return [value.role, ...(value.roles || [])];
  }

  return [value as Role];
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

export const getAssignedRoles = (input: {
  role: Role;
  additionalRoles?: readonly Role[] | null;
}): Role[] => {
  if (input.role === Role.STUDENT) {
    return [Role.STUDENT];
  }

  return splitPrimaryAndAdditionalStaffRoles([input.role, ...(input.additionalRoles || [])]).assignedRoles;
};

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

  if (roles.length === 0) {
    return false;
  }

  if (expectedRole === Role.STUDENT) {
    return roles.includes(Role.STUDENT);
  }

  return normalizeManagedStaffRoles(roles).includes(expectedRole as ManagedStaffRole);
};

export const buildUserHasRoleWhere = (role: Role): Prisma.UserWhereInput => {
  if (role === Role.STUDENT) {
    return {
      role: Role.STUDENT,
    };
  }

  return {
    OR: [
      {
        role,
      },
      {
        additionalRoles: {
          has: role,
        },
      },
    ],
  };
};
