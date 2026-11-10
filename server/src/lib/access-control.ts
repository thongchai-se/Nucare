import { Prisma, Role } from "@prisma/client";
import { prisma } from "./prisma";
import { hasAssignedRole } from "./roles";

const hasRole = (role: Role | Role[] | undefined, expectedRole: Role): boolean => hasAssignedRole(role, expectedRole);

/** ตรวจว่าผู้เรียกมีบทบาทอาจารย์ที่ปรึกษา (หลักหรือเพิ่มเติม) */
export const isAdvisorRole = (role: Role | Role[] | undefined): boolean => hasRole(role, Role.ADVISOR);

/** ที่เก็บการมอบหมายนิสิตสำหรับช่วยจำกัดสิทธิ์ (สลับได้ตอนเทส) */
export type StudentAccessStore = {
  findActiveAdvisorAssignment: (advisorId: string, studentId: string) => Promise<boolean>;
  findActiveInstructorAssignment: (instructorId: string, studentId: string) => Promise<boolean>;
  listAdvisorStudentIds: (advisorId: string) => Promise<string[]>;
  listInstructorStudentIds: (instructorId: string) => Promise<string[]>;
};

const defaultStudentAccessStore: StudentAccessStore = {
  findActiveAdvisorAssignment: async (advisorId, studentId) => {
    const assignment = await prisma.studentAdvisorAssignment.findFirst({
      where: {
        advisorId,
        studentId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });
    return Boolean(assignment);
  },
  findActiveInstructorAssignment: async (instructorId, studentId) => {
    const assignment = await prisma.studentInstructorAssignment.findFirst({
      where: {
        instructorId,
        studentId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });
    return Boolean(assignment);
  },
  listAdvisorStudentIds: async (advisorId) => {
    const assignments = await prisma.studentAdvisorAssignment.findMany({
      where: {
        advisorId,
        isActive: true,
      },
      select: {
        studentId: true,
      },
    });
    return assignments.map((assignment) => assignment.studentId);
  },
  listInstructorStudentIds: async (instructorId) => {
    const assignments = await prisma.studentInstructorAssignment.findMany({
      where: {
        instructorId,
        isActive: true,
      },
      select: {
        studentId: true,
      },
    });
    return assignments.map((assignment) => assignment.studentId);
  },
};

/**
 * สร้างเงื่อนไข Prisma จำกัดเฉพาะนิสิตที่ผู้เรียกมีสิทธิ์เห็น
 * (ตามการมอบหมายที่ปรึกษา/ผู้สอน หรือนิสิตทั้งหมดสำหรับทีมสุขภาพจิต)
 */
export const getStudentScopeWhere = async (
  role: Role | Role[],
  userId: string,
  store: StudentAccessStore = defaultStudentAccessStore
): Promise<Prisma.UserWhereInput> => {
  if (hasRole(role, Role.ADVISOR)) {
    const studentIds = await store.listAdvisorStudentIds(userId);
    return {
      id: {
        in: studentIds.length > 0 ? studentIds : ["__no_student_scope__"],
      },
      role: Role.STUDENT,
      isActive: true,
    };
  }

  if (hasRole(role, Role.MENTAL_HEALTH) || hasRole(role, Role.EXECUTIVE) || hasRole(role, Role.ADMIN)) {
    return {
      role: Role.STUDENT,
      isActive: true,
    };
  }

  if (hasRole(role, Role.INSTRUCTOR)) {
    const studentIds = await store.listInstructorStudentIds(userId);
    return {
      id: {
        in: studentIds.length > 0 ? studentIds : ["__no_student_scope__"],
      },
      role: Role.STUDENT,
      isActive: true,
    };
  }

  return {
    id: "__no_student_scope__",
  };
};

/**
 * ตรวจว่าผู้เรียกเข้าถึงนิสิตรายคนได้หรือไม่ (กัน IDOR)
 * แอดมิน / ผู้บริหาร / สุขภาพจิต เข้าถึงได้ทุกคน
 * ที่ปรึกษา/ผู้สอนต้องมีการมอบหมายที่ยังใช้งาน
 */
export const canAccessStudent = async (
  role: Role | Role[],
  userId: string,
  studentId: string,
  store: StudentAccessStore = defaultStudentAccessStore
): Promise<boolean> => {
  if (
    hasRole(role, Role.MENTAL_HEALTH) ||
    hasRole(role, Role.ADMIN) ||
    hasRole(role, Role.EXECUTIVE)
  ) {
    return true;
  }

  if (hasRole(role, Role.ADVISOR)) {
    return store.findActiveAdvisorAssignment(userId, studentId);
  }

  if (hasRole(role, Role.INSTRUCTOR)) {
    return store.findActiveInstructorAssignment(userId, studentId);
  }

  return false;
};
