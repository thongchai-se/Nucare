import { Prisma, Role } from "@prisma/client";
import { prisma } from "./prisma";

export const advisorRoles = new Set<Role>([Role.ADVISOR]);
export const mentalHealthRoles = new Set<Role>([Role.MENTAL_HEALTH]);
export const instructorRoles = new Set<Role>([Role.INSTRUCTOR]);

export const isAdvisorRole = (role: Role | undefined): role is Role.ADVISOR =>
  role === Role.ADVISOR;

export const isInstructorRole = (role: Role | undefined): role is Role.INSTRUCTOR =>
  role === Role.INSTRUCTOR;

export const isMentalHealthRole = (role: Role | undefined): role is Role.MENTAL_HEALTH =>
  role === Role.MENTAL_HEALTH;

export const getStudentScopeWhere = async (
  role: Role,
  userId: string
): Promise<Prisma.UserWhereInput> => {
  if (role === Role.ADVISOR) {
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

  if (role === Role.MENTAL_HEALTH) {
    return {
      role: Role.STUDENT,
      isActive: true,
    };
  }

  if (role === Role.INSTRUCTOR) {
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
  role: Role,
  userId: string,
  studentId: string
): Promise<boolean> => {
  if (role === Role.MENTAL_HEALTH || role === Role.ADMIN) {
    return true;
  }

  if (role === Role.ADVISOR) {
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

  if (role === Role.INSTRUCTOR) {
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
