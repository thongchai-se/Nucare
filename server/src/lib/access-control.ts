import { Prisma, Role } from "@prisma/client";
import { prisma } from "./prisma";
import { hasAssignedRole } from "./roles";

const hasRole = (role: Role | Role[] | undefined, expectedRole: Role): boolean => hasAssignedRole(role, expectedRole);

export const isAdvisorRole = (role: Role | Role[] | undefined): boolean => hasRole(role, Role.ADVISOR);

export const getStudentScopeWhere = async (
  role: Role | Role[],
  userId: string
): Promise<Prisma.UserWhereInput> => {
  if (hasRole(role, Role.ADVISOR)) {
    const assignments = await prisma.studentAdvisorAssignment.findMany({
      where: {
        advisorId: userId,
        isActive: true,
      },
      select: {
        studentId: true,
      },
    });

    const studentIds = assignments.map((assignment) => assignment.studentId);
    return {
      id: {
        in: studentIds.length > 0 ? studentIds : ["__no_student_scope__"],
      },
      role: Role.STUDENT,
      isActive: true,
    };
  }

  if (hasRole(role, Role.MENTAL_HEALTH)) {
    return {
      role: Role.STUDENT,
      isActive: true,
    };
  }

  if (hasRole(role, Role.INSTRUCTOR)) {
    return {
      role: Role.STUDENT,
      isActive: true,
    };
  }

  return {
    id: "__no_student_scope__",
  };
};

export const canAccessStudent = async (
  role: Role | Role[],
  userId: string,
  studentId: string
): Promise<boolean> => {
  if (hasRole(role, Role.MENTAL_HEALTH) || hasRole(role, Role.ADMIN)) {
    return true;
  }

  if (hasRole(role, Role.ADVISOR)) {
    const assignment = await prisma.studentAdvisorAssignment.findFirst({
      where: {
        advisorId: userId,
        studentId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    return Boolean(assignment);
  }

  if (hasRole(role, Role.INSTRUCTOR)) {
    const student = await prisma.user.findFirst({
      where: {
        id: studentId,
        role: Role.STUDENT,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    return Boolean(student);
  }

  return false;
};
