import { Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import { z } from "zod";
import { getRequestIpAddress, writeAuditLog } from "../lib/audit-log";
import { buildExecutiveDashboardStats } from "../lib/executive-analytics";
import { normalizePersonNameForRole } from "../lib/name-prefix";
import { prisma } from "../lib/prisma";
import {
  buildUserHasRoleWhere,
  getAssignedRoles,
  hasAssignedRole,
  managedStaffRoleValues,
  ManagedStaffRole,
  splitPrimaryAndAdditionalStaffRoles,
} from "../lib/roles";
import { MAX_STUDY_YEAR, MIN_STUDY_YEAR, normalizeStudyYear } from "../lib/study-year";
import { createTemporaryPassword } from "../lib/temporary-password";
import { formatStudentIdForResponse } from "../lib/user-format";

const DEFAULT_IMPORT_BCRYPT_ROUNDS = 10;
const DEFAULT_IMPORT_CONCURRENCY = 12;
const ADMIN_LIST_MAX_RESULTS = 2500;
const STUDENT_ID_PATTERN = /^\d{9}-\d$/;
const STUDENT_ID_FORMAT_MESSAGE = "Student ID must be in the format 663380696-6";
const SECTION_REQUIRED_MESSAGE = "Section is required";
const SECTION_LENGTH_MESSAGE = "Section must be 50 characters or fewer";

const parsePositiveIntFromEnv = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const IMPORT_BCRYPT_ROUNDS = parsePositiveIntFromEnv(
  process.env.STUDENT_IMPORT_BCRYPT_ROUNDS,
  DEFAULT_IMPORT_BCRYPT_ROUNDS
);

const IMPORT_CONCURRENCY = Math.max(
  1,
  Math.min(
    parsePositiveIntFromEnv(process.env.STUDENT_IMPORT_CONCURRENCY, DEFAULT_IMPORT_CONCURRENCY),
    32
  )
);

const runWithConcurrency = async <T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> => {
  if (items.length === 0) {
    return;
  }

  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
};

const importStudentRowSchema = z.object({
  studentId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(120),
  email: z.union([z.string().trim().email(), z.literal(""), z.undefined()]).optional(),
  studyYear: z.coerce.number().int().min(MIN_STUDY_YEAR).max(MAX_STUDY_YEAR),
  section: z.string().trim().min(1).max(50),
});

const importStudentsSchema = z.object({
  rows: z.array(importStudentRowSchema).min(1).max(2000),
});

const checkExistingStudentsSchema = z.object({
  studentIds: z.array(z.string().trim().min(1)).min(1).max(2000),
  emails: z.array(z.string().trim().max(320)).max(2000).optional(),
});

const listStudentsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
});

const listUsersQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
});

const listAuditLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const studentStatusSchema = z.enum(["active", "inactive"]);
const managedRoleSchema = z.nativeEnum(Role);
const managedStaffRoleSchema = z.enum(managedStaffRoleValues);

const instructorIdsSchema = z.array(z.string().trim().min(1)).max(20);

const createStudentSchema = z.object({
  studentId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(120),
  email: z.union([z.string().trim().email(), z.literal(""), z.undefined()]).optional(),
  studyYear: z.coerce.number().int().min(MIN_STUDY_YEAR).max(MAX_STUDY_YEAR),
  section: z.string().trim().min(1).max(50),
  status: studentStatusSchema,
});

const managedUserSchema = z
  .object({
    role: managedRoleSchema.optional(),
    roles: z.array(managedStaffRoleSchema).min(1).max(managedStaffRoleValues.length).optional(),
    studentId: z.string().trim().optional(),
    employeeId: z.string().trim().optional(),
    advisorId: z.union([z.string().trim(), z.literal(""), z.null(), z.undefined()]).optional(),
    instructorIds: instructorIdsSchema.optional(),
    studyYear: z.coerce.number().int().min(MIN_STUDY_YEAR).max(MAX_STUDY_YEAR).nullable().optional(),
    section: z.union([z.string().trim().max(50), z.literal(""), z.null(), z.undefined()]).optional(),
    name: z.string().trim().min(2).max(120),
    email: z.union([z.string().trim().email(), z.literal(""), z.undefined()]).optional(),
    status: studentStatusSchema,
  })
  .superRefine((data, context) => {
    const explicitRole = data.role;
    const selectedRoles = data.roles || (explicitRole ? [explicitRole as ManagedStaffRole] : []);

    if (selectedRoles.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["roles"],
        message: "At least one role is required",
      });
      return;
    }

    const containsStudentRole = selectedRoles.includes(Role.STUDENT as never);

    if (containsStudentRole && selectedRoles.length > 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["roles"],
        message: "Student accounts cannot have multiple roles",
      });
    }
  });

const updateStudentSchema = z.object({
  studentId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(120),
  email: z.union([z.string().trim().email(), z.literal(""), z.undefined()]).optional(),
  studyYear: z.coerce.number().int().min(MIN_STUDY_YEAR).max(MAX_STUDY_YEAR),
  section: z.string().trim().min(1).max(50),
  status: studentStatusSchema,
});

const assignAdvisorStudentsSchema = z.object({
  advisorId: z.string().trim().min(1),
  studentIds: z.array(z.string().trim().min(1)).min(1).max(500),
});

const bulkUpdateStudentStudyYearSchema = z.object({
  fromStudyYear: z.coerce.number().int().min(MIN_STUDY_YEAR).max(MAX_STUDY_YEAR),
  toStudyYear: z.coerce.number().int().min(MIN_STUDY_YEAR).max(MAX_STUDY_YEAR),
});

const importStaffRowSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  roles: z.array(managedStaffRoleSchema).min(1).max(managedStaffRoleValues.length),
});

const importStaffUsersSchema = z.object({
  rows: z.array(importStaffRowSchema).min(1).max(2000),
});

const checkExistingStaffUsersSchema = z.object({
  emails: z.array(z.string().trim().email()).min(1).max(2000),
});

type StudentRecord = {
  id: string;
  studentId: string | null;
  name: string;
  email: string | null;
  studyYear: number | null;
  section: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type ImportStudentRow = {
  studentId: string;
  name: string;
  email: string | null;
  studyYear: number;
  section: string;
};

type ImportStaffRow = {
  name: string;
  email: string;
  roles: ManagedStaffRole[];
};

type ImportAuditOutcome = "success" | "partial" | "failed";

type ImportAuditSummary = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
};

const resolveImportAuditOutcome = (summary: ImportAuditSummary): ImportAuditOutcome => {
  const completedCount = summary.created + summary.updated + summary.skipped;

  if (summary.failed <= 0) {
    return "success";
  }

  return completedCount > 0 ? "partial" : "failed";
};

const summarizeImportFailureReasons = (
  failures: Array<{ reason: string }>,
  limit = 2
): string | null => {
  if (failures.length === 0) {
    return null;
  }

  const counts = new Map<string, number>();

  for (const failure of failures) {
    const normalizedReason = failure.reason.replace(/[|\r\n]+/g, " ").trim();
    counts.set(normalizedReason, (counts.get(normalizedReason) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([reason, count]) => `${count}x ${reason}`)
    .join("; ");
};

const buildImportAuditDescription = (
  label: string,
  summary: ImportAuditSummary,
  failures: Array<{ reason: string }> = [],
  note?: string
): string => {
  const parts = [
    label,
    `outcome=${resolveImportAuditOutcome(summary)}`,
    `total=${summary.total}`,
    `created=${summary.created}`,
    `updated=${summary.updated}`,
    `skipped=${summary.skipped}`,
    `failed=${summary.failed}`,
  ];

  const issueSummary = summarizeImportFailureReasons(failures);
  if (issueSummary) {
    parts.push(`issues=${issueSummary}`);
  }

  if (note) {
    parts.push(`note=${note.replace(/[|\r\n]+/g, " ").trim()}`);
  }

  return parts.join(" | ");
};

const normalizeStudentId = (raw: string): string => {
  const normalized = raw.trim();
  if (!STUDENT_ID_PATTERN.test(normalized)) {
    throw new Error(STUDENT_ID_FORMAT_MESSAGE);
  }

  return normalized;
};

const normalizeEmail = (raw?: string | null): string | null => {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : null;
};

const normalizeSection = (raw?: string | null): string => {
  const trimmed = raw?.trim() || "";
  if (!trimmed) {
    throw new Error(SECTION_REQUIRED_MESSAGE);
  }

  if (trimmed.length > 50) {
    throw new Error(SECTION_LENGTH_MESSAGE);
  }

  return trimmed;
};

const normalizeComparableSection = (raw?: string | null): string => (raw?.trim() || "").toLowerCase();

const staffEmployeeIdPrefixMap: Record<ManagedStaffRole, string> = {
  ADMIN: "ADM",
  ADVISOR: "ADV",
  EXECUTIVE: "EXE",
  INSTRUCTOR: "INS",
  MENTAL_HEALTH: "MHT",
  STUDENT_DEVELOPMENT: "SDV",
};

const EMPLOYEE_ID_SEQUENCE_PAD_LENGTH = 3;

const getAdminUserAuditMetadata = (role: Role) => {
  if (role === Role.STUDENT) {
    return {
      actionPrefix: "admin.student",
      descriptionLabel: "student account",
      entityType: "StudentAccount",
    } as const;
  }

  return {
    actionPrefix: "admin.user",
    descriptionLabel: `${role} account`,
    entityType: "StaffAccount",
  } as const;
};

const normalizeAdvisorId = (raw?: string | null): string | null => {
  const trimmed = raw?.trim() || "";
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeInstructorIds = (raw?: string[] | null): string[] =>
  Array.from(new Set((raw || []).map((value) => value.trim()).filter(Boolean)));

const activeInstructorAssignmentSelect = {
  where: {
    isActive: true,
  },
  select: {
    instructor: {
      select: {
        id: true,
        name: true,
      },
    },
  },
} as const;

const syncStudentAdvisorAssignment = async (
  tx: Prisma.TransactionClient,
  studentId: string,
  advisorId: string | null
): Promise<{ advisorId: string | null; advisorName: string | null }> => {
  await tx.studentAdvisorAssignment.updateMany({
    where: {
      studentId,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  if (!advisorId) {
    return {
      advisorId: null,
      advisorName: null,
    };
  }

  const advisor = await tx.user.findFirst({
    where: {
      id: advisorId,
      ...buildUserHasRoleWhere(Role.ADVISOR),
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!advisor) {
    throw new Error("Advisor not found");
  }

  await tx.studentAdvisorAssignment.create({
    data: {
      studentId,
      advisorId: advisor.id,
      isActive: true,
    },
  });

  return {
    advisorId: advisor.id,
    advisorName: advisor.name,
  };
};

const syncStudentInstructorAssignments = async (
  tx: Prisma.TransactionClient,
  studentId: string,
  instructorIds: string[]
): Promise<Array<{ id: string; name: string }>> => {
  const uniqueIds = normalizeInstructorIds(instructorIds);
  const instructors =
    uniqueIds.length === 0
      ? []
      : await tx.user.findMany({
          where: {
            id: {
              in: uniqueIds,
            },
            ...buildUserHasRoleWhere(Role.INSTRUCTOR),
            isActive: true,
          },
          select: {
            id: true,
            name: true,
          },
        });

  if (instructors.length !== uniqueIds.length) {
    throw new Error("Instructor not found");
  }

  await tx.studentInstructorAssignment.updateMany({
    where: {
      studentId,
      isActive: true,
      ...(uniqueIds.length > 0
        ? {
            instructorId: {
              notIn: uniqueIds,
            },
          }
        : {}),
    },
    data: {
      isActive: false,
    },
  });

  for (const instructor of instructors) {
    await tx.studentInstructorAssignment.upsert({
      where: {
        studentId_instructorId: {
          studentId,
          instructorId: instructor.id,
        },
      },
      update: {
        isActive: true,
        assignedAt: new Date(),
      },
      create: {
        studentId,
        instructorId: instructor.id,
        isActive: true,
      },
    });
  }

  return instructors.map((instructor) => ({
    id: instructor.id,
    name: instructor.name,
  }));
};

const hasStudentProfileChanges = (
  student: Pick<StudentRecord, "name" | "email" | "studyYear" | "section" | "isActive">,
  row: ImportStudentRow
): boolean =>
  normalizePersonNameForRole(student.name, Role.STUDENT) !==
  normalizePersonNameForRole(row.name, Role.STUDENT) ||
  normalizeEmail(student.email) !== normalizeEmail(row.email) ||
  student.studyYear !== row.studyYear ||
  normalizeComparableSection(student.section) !== normalizeComparableSection(row.section) ||
  !student.isActive;

const hasStaffProfileChanges = (
  user: {
    name: string;
    email: string | null;
    role: Role;
    additionalRoles?: Role[] | null;
    isActive: boolean;
  },
  row: ImportStaffRow
): boolean => {
  const existingRoles = getAssignedRoles(user);
  const nextRoles = splitPrimaryAndAdditionalStaffRoles(row.roles).assignedRoles;
  const primaryRole = nextRoles[0] ?? Role.ADVISOR;

  return (
    normalizePersonNameForRole(user.name, primaryRole) !==
    normalizePersonNameForRole(row.name, primaryRole) ||
    normalizeEmail(user.email) !== normalizeEmail(row.email) ||
    existingRoles.length !== nextRoles.length ||
    existingRoles.some((role, index) => role !== nextRoles[index]) ||
    !user.isActive
  );
};

type ExistingStaffImportUser = {
  id: string;
  name: string;
  email: string | null;
  employeeId: string | null;
  role: Role;
  additionalRoles?: Role[] | null;
  isActive: boolean;
};

const mapStudent = (user: StudentRecord) => ({
  id: user.id,
  studentId: formatStudentIdForResponse(user.studentId),
  name: user.name,
  email: user.email,
  studyYear: user.studyYear ?? null,
  section: user.section ?? null,
  status: user.isActive ? "active" : "inactive",
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const mapStaff = (user: {
  id: string;
  name: string;
  email: string | null;
  employeeId: string | null;
  role: Role;
  additionalRoles?: Role[];
}) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  employeeId: user.employeeId,
  role: user.role,
  roles: getAssignedRoles({
    role: user.role,
    additionalRoles: user.additionalRoles || [],
  }),
});

const mapManagedUser = (user: {
  id: string;
  name: string;
  email: string | null;
  studentId: string | null;
  employeeId: string | null;
  studyYear: number | null;
  section: string | null;
  role: Role;
  additionalRoles?: Role[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  studentAssignments?: Array<{
    advisor: {
      id: string;
      name: string;
    };
  }>;
  studentInstructorAssignments?: Array<{
    instructor: {
      id: string;
      name: string;
    };
  }>;
}) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  studentId: formatStudentIdForResponse(user.studentId),
  employeeId: user.employeeId,
  studyYear: user.studyYear ?? null,
  section: user.section ?? null,
  role: user.role,
  roles: getAssignedRoles({
    role: user.role,
    additionalRoles: user.additionalRoles || [],
  }),
  advisorId: user.studentAssignments?.[0]?.advisor.id ?? null,
  advisorName: user.studentAssignments?.[0]?.advisor.name ?? null,
  instructorIds: (user.studentInstructorAssignments || []).map((assignment) => assignment.instructor.id),
  instructorNames: (user.studentInstructorAssignments || []).map((assignment) => assignment.instructor.name),
  status: user.isActive ? "active" : "inactive",
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const normalizeEmployeeId = (raw?: string): string | null => {
  const trimmed = raw?.trim() || "";
  return trimmed.length > 0 ? trimmed : null;
};

const buildStaffEmployeeId = (prefix: string, sequence: number): string =>
  `${prefix}${String(sequence).padStart(EMPLOYEE_ID_SEQUENCE_PAD_LENGTH, "0")}`;

const generateNextStaffEmployeeId = async (
  tx: Prisma.TransactionClient,
  role: ManagedStaffRole
): Promise<string> => {
  const prefix = staffEmployeeIdPrefixMap[role];
  const existingUsers = await tx.user.findMany({
    where: {
      role,
      employeeId: {
        not: null,
      },
    },
    select: {
      employeeId: true,
    },
  });

  let maxSequence = 0;

  for (const user of existingUsers) {
    const normalizedEmployeeId = user.employeeId?.trim().toUpperCase() || "";
    const match = new RegExp(`^${prefix}(\\d+)$`).exec(normalizedEmployeeId);
    if (!match) {
      continue;
    }

    const sequence = Number.parseInt(match[1], 10);
    if (Number.isFinite(sequence)) {
      maxSequence = Math.max(maxSequence, sequence);
    }
  }

  return buildStaffEmployeeId(prefix, maxSequence + 1);
};

const parseManagedUserPayload = (
  input: z.infer<typeof managedUserSchema>,
  options?: {
    allowGeneratedEmployeeId?: boolean;
  }
) => {
  const selectedRoles = input.roles?.length
    ? input.roles
    : input.role
      ? [input.role]
      : [];
  const email = normalizeEmail(input.email);
  const employeeId = normalizeEmployeeId(input.employeeId);
  const advisorId = normalizeAdvisorId(input.advisorId);
  const instructorIds = normalizeInstructorIds(input.instructorIds);
  let studentId: string | null = null;
  let studyYear: number | null = null;
  let section: string | null = null;
  let role: Role;
  let roles: Role[] = [];
  let additionalRoles: Role[] = [];

  if (selectedRoles.length === 1 && selectedRoles[0] === Role.STUDENT) {
    role = Role.STUDENT;
    roles = [Role.STUDENT];
    studentId = normalizeStudentId(input.studentId || "");
    studyYear = normalizeStudyYear(input.studyYear ?? Number.NaN);
    section = normalizeSection(input.section);
  } else {
    const resolvedRoles = splitPrimaryAndAdditionalStaffRoles(selectedRoles);
    role = resolvedRoles.primaryRole;
    roles = resolvedRoles.assignedRoles;
    additionalRoles = resolvedRoles.additionalRoles;

    if (!employeeId && !options?.allowGeneratedEmployeeId) {
      throw new Error("Employee ID is required for non-student roles");
    }

    if (!email) {
      throw new Error("Email is required for non-student roles");
    }
  }

  if (role !== Role.STUDENT && !employeeId && !options?.allowGeneratedEmployeeId) {
    throw new Error("Employee ID is required for non-student roles");
  }

  return {
    role,
    roles,
    additionalRoles,
    studentId,
    employeeId: role === Role.STUDENT ? null : employeeId,
    advisorId: role === Role.STUDENT ? advisorId : null,
    instructorIds: role === Role.STUDENT ? instructorIds : [],
    studyYear: role === Role.STUDENT ? studyYear : null,
    section: role === Role.STUDENT ? section : null,
    name: normalizePersonNameForRole(input.name, role),
    email,
    isActive: input.status === "active",
  };
};

const countActiveAdmins = async (): Promise<number> =>
  prisma.user.count({
    where: {
      role: Role.ADMIN,
      isActive: true,
    },
  });

const getStudentDependencyCount = async (studentUserId: string): Promise<number> => {
  const [
    assessments,
    careRecords,
    referrals,
    behaviors,
    emergencyCases,
    specializedCareRecords,
    advisorAssignments,
    alerts,
    auditLogs,
  ] = await Promise.all([
    prisma.studentAssessment.count({ where: { studentId: studentUserId } }),
    prisma.careRecord.count({ where: { studentId: studentUserId } }),
    prisma.caseReferral.count({ where: { studentId: studentUserId } }),
    prisma.behaviorRecord.count({ where: { studentId: studentUserId } }),
    prisma.emergencyCase.count({ where: { studentId: studentUserId } }),
    prisma.specializedCareRecord.count({ where: { studentId: studentUserId } }),
    prisma.studentAdvisorAssignment.count({ where: { studentId: studentUserId } }),
    prisma.alert.count({ where: { studentId: studentUserId } }),
    prisma.auditLog.count({ where: { actorUserId: studentUserId } }),
  ]);

  return (
    assessments +
    careRecords +
    referrals +
    behaviors +
    emergencyCases +
    specializedCareRecords +
    advisorAssignments +
    alerts +
    auditLogs
  );
};

export const listStudents = async (req: Request, res: Response): Promise<void> => {
  const parsed = listStudentsQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid query",
      errors: parsed.error.flatten(),
    });
    return;
  }

  const search = parsed.data.search?.trim();

  try {
    const students = await prisma.user.findMany({
      where: {
        role: Role.STUDENT,
        ...(search
          ? {
              OR: [
                { studentId: { contains: search, mode: "insensitive" } },
                { name: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        studentId: true,
        name: true,
        email: true,
        studyYear: true,
        section: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: ADMIN_LIST_MAX_RESULTS,
    });

    res.status(200).json({
      students: students.map(mapStudent),
      total: students.length,
    });
  } catch (error) {
    console.error("List students error:", error);
    res.status(500).json({ message: "Failed to list students" });
  }
};

export const listUsers = async (req: Request, res: Response): Promise<void> => {
  const actorUserId = req.user?.userId;
  const parsed = listUsersQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid query",
      errors: parsed.error.flatten(),
    });
    return;
  }

  const search = parsed.data.search?.trim();

  try {
    const where: Prisma.UserWhereInput = {
      ...(actorUserId
        ? {
            id: {
              not: actorUserId,
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                email: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                studentId: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                employeeId: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        studentId: true,
        employeeId: true,
        studyYear: true,
        section: true,
        role: true,
        additionalRoles: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        studentAssignments: {
          where: {
            isActive: true,
          },
          take: 1,
          select: {
            advisor: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        studentInstructorAssignments: activeInstructorAssignmentSelect,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      take: ADMIN_LIST_MAX_RESULTS,
    });

    res.status(200).json({
      users: users.map(mapManagedUser),
      total: users.length,
    });
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ message: "Failed to list users" });
  }
};

export const createStudent = async (req: Request, res: Response): Promise<void> => {
  const actorUserId = req.user?.userId;
  const parsed = createStudentSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid payload",
      errors: parsed.error.flatten(),
    });
    return;
  }

  let studentId: string;
  try {
    studentId = normalizeStudentId(parsed.data.studentId);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Invalid studentId",
    });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  const studyYear = normalizeStudyYear(parsed.data.studyYear);
  const section = normalizeSection(parsed.data.section);

  try {
    const conflict = await prisma.user.findFirst({
      where: {
        OR: [{ studentId }, ...(email ? [{ email }] : [])],
      },
      select: {
        id: true,
      },
    });

    if (conflict) {
      res.status(409).json({ message: "Student ID or email already exists" });
      return;
    }

    const temporaryPassword = createTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    const created = await prisma.user.create({
      data: {
        studentId,
        name: normalizePersonNameForRole(parsed.data.name, Role.STUDENT),
        email,
        studyYear,
        section,
        role: Role.STUDENT,
        password: passwordHash,
        mustChangePassword: true,
        isActive: parsed.data.status === "active",
      },
      select: {
        id: true,
        studentId: true,
        name: true,
        email: true,
        studyYear: true,
        section: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const auditMetadata = getAdminUserAuditMetadata(Role.STUDENT);

    await writeAuditLog({
      actorUserId,
      action: `${auditMetadata.actionPrefix}.create`,
      entityType: auditMetadata.entityType,
      entityId: created.id,
      description: `Created ${auditMetadata.descriptionLabel} ${studentId}`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(201).json({
      message: "Student created successfully",
      student: mapStudent(created),
      temporaryPassword,
      onboardingHint:
        "ส่งรหัสผ่านชั่วคราวให้นิสิตครั้งเดียว — ระบบจะบังคับเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก",
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ message: "Student ID or email already exists" });
      return;
    }

    console.error("Create student error:", error);
    res.status(500).json({ message: "Failed to create student" });
  }
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  const actorUserId = req.user?.userId;
  const parsed = managedUserSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid payload",
      errors: parsed.error.flatten(),
    });
    return;
  }

  let payload: ReturnType<typeof parseManagedUserPayload>;
  try {
    payload = parseManagedUserPayload(parsed.data, {
      allowGeneratedEmployeeId: true,
    });
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Invalid user payload",
    });
    return;
  }

  try {
    const conflict = await prisma.user.findFirst({
      where: {
        OR: [
          ...(payload.studentId ? [{ studentId: payload.studentId }] : []),
          ...(payload.employeeId ? [{ employeeId: payload.employeeId }] : []),
          ...(payload.email ? [{ email: payload.email }] : []),
        ],
      },
      select: {
        id: true,
      },
    });

    if (conflict) {
      res.status(409).json({ message: "Student ID, employee ID or email already exists" });
      return;
    }

    const temporaryPassword = createTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const shouldAutoGenerateEmployeeId = payload.role !== Role.STUDENT && !payload.employeeId;
    let created: Parameters<typeof mapManagedUser>[0] | null = null;

    for (let attempt = 0; attempt < (shouldAutoGenerateEmployeeId ? 3 : 1); attempt += 1) {
      try {
        created = await prisma.$transaction(async (tx) => {
          const resolvedEmployeeId =
            payload.role === Role.STUDENT
              ? payload.employeeId
              : payload.employeeId ?? (await generateNextStaffEmployeeId(tx, payload.role));

          const createdUser = await tx.user.create({
            data: {
              name: payload.name,
              email: payload.email,
              role: payload.role,
              additionalRoles: payload.additionalRoles,
              studentId: payload.studentId,
              employeeId: resolvedEmployeeId,
              studyYear: payload.studyYear,
              section: payload.section,
              isActive: payload.isActive,
              password: passwordHash,
              mustChangePassword: true,
            },
            select: {
              id: true,
            },
          });

          if (payload.role === Role.STUDENT) {
            await syncStudentAdvisorAssignment(tx, createdUser.id, payload.advisorId);
            await syncStudentInstructorAssignments(tx, createdUser.id, payload.instructorIds);
          }

          return tx.user.findUniqueOrThrow({
            where: {
              id: createdUser.id,
            },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              additionalRoles: true,
              studentId: true,
              employeeId: true,
              studyYear: true,
              section: true,
              isActive: true,
              createdAt: true,
              updatedAt: true,
              studentAssignments: {
                where: {
                  isActive: true,
                },
                take: 1,
                select: {
                  advisor: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
              studentInstructorAssignments: activeInstructorAssignmentSelect,
            },
          });
        });

        break;
      } catch (error) {
        const shouldRetryGeneratedEmployeeId =
          shouldAutoGenerateEmployeeId &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          attempt < 2;

        if (shouldRetryGeneratedEmployeeId) {
          continue;
        }

        throw error;
      }
    }

    if (!created) {
      throw new Error("Failed to create user");
    }

    const auditMetadata = getAdminUserAuditMetadata(payload.role);

    await writeAuditLog({
      actorUserId,
      action: `${auditMetadata.actionPrefix}.create`,
      entityType: auditMetadata.entityType,
      entityId: created.id,
      description: `Created ${auditMetadata.descriptionLabel} ${payload.studentId ?? payload.employeeId ?? created.id}`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(201).json({
      message: "User created successfully",
      user: mapManagedUser(created),
      temporaryPassword,
      onboardingHint:
        "ส่งรหัสผ่านชั่วคราวให้ผู้ใช้ครั้งเดียว — ระบบจะบังคับเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก",
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "Advisor not found" || error.message === "Instructor not found")) {
      res.status(404).json({ message: error.message });
      return;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ message: "Student ID, employee ID or email already exists" });
      return;
    }

    console.error("Create user error:", error);
    res.status(500).json({ message: "Failed to create user" });
  }
};

export const updateStudent = async (req: Request, res: Response): Promise<void> => {
  const actorUserId = req.user?.userId;
  const studentUserId = req.params.id;
  const parsed = updateStudentSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid payload",
      errors: parsed.error.flatten(),
    });
    return;
  }

  let studentId: string;
  try {
    studentId = normalizeStudentId(parsed.data.studentId);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Invalid studentId",
    });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  const studyYear = normalizeStudyYear(parsed.data.studyYear);
  const section = normalizeSection(parsed.data.section);

  try {
    const existing = await prisma.user.findFirst({
      where: {
        id: studentUserId,
        role: Role.STUDENT,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      res.status(404).json({ message: "Student not found" });
      return;
    }

    const conflict = await prisma.user.findFirst({
      where: {
        id: { not: studentUserId },
        OR: [{ studentId }, ...(email ? [{ email }] : [])],
      },
      select: {
        id: true,
      },
    });

    if (conflict) {
      res.status(409).json({ message: "Student ID or email already exists" });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: studentUserId },
      data: {
        studentId,
        name: normalizePersonNameForRole(parsed.data.name, Role.STUDENT),
        email,
        studyYear,
        section,
        isActive: parsed.data.status === "active",
      },
      select: {
        id: true,
        studentId: true,
        name: true,
        email: true,
        studyYear: true,
        section: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const auditMetadata = getAdminUserAuditMetadata(Role.STUDENT);

    await writeAuditLog({
      actorUserId,
      action: `${auditMetadata.actionPrefix}.update`,
      entityType: auditMetadata.entityType,
      entityId: updated.id,
      description: `Updated ${auditMetadata.descriptionLabel} ${studentId}`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({
      message: "Student updated successfully",
      student: mapStudent(updated),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ message: "Student ID or email already exists" });
      return;
    }

    console.error("Update student error:", error);
    res.status(500).json({ message: "Failed to update student" });
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  const actorUserId = req.user?.userId;
  const userId = req.params.id;
  const parsed = managedUserSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid payload",
      errors: parsed.error.flatten(),
    });
    return;
  }

  let payload: ReturnType<typeof parseManagedUserPayload>;
  try {
    payload = parseManagedUserPayload(parsed.data);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Invalid user payload",
    });
    return;
  }

  try {
    const existing = await prisma.user.findFirst({
      where: {
        id: userId,
      },
      select: {
        id: true,
        role: true,
        additionalRoles: true,
        isActive: true,
      },
    });

    if (!existing) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (actorUserId === userId && (payload.role !== Role.ADMIN || !payload.isActive)) {
      res.status(409).json({ message: "Cannot demote or deactivate the current admin account" });
      return;
    }

    if (
      existing.role === Role.ADMIN &&
      existing.isActive &&
      (payload.role !== Role.ADMIN || !payload.isActive)
    ) {
      const activeAdminCount = await countActiveAdmins();
      if (activeAdminCount <= 1) {
        res.status(409).json({ message: "At least one active admin account is required" });
        return;
      }
    }

    const conflict = await prisma.user.findFirst({
      where: {
        id: { not: userId },
        OR: [
          ...(payload.studentId ? [{ studentId: payload.studentId }] : []),
          ...(payload.employeeId ? [{ employeeId: payload.employeeId }] : []),
          ...(payload.email ? [{ email: payload.email }] : []),
        ],
      },
      select: {
        id: true,
      },
    });

    if (conflict) {
      res.status(409).json({ message: "Student ID, employee ID or email already exists" });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: userId,
        },
        data: {
          name: payload.name,
          email: payload.email,
          role: payload.role,
          additionalRoles: payload.additionalRoles,
          studentId: payload.studentId,
          employeeId: payload.employeeId,
          studyYear: payload.studyYear,
          section: payload.section,
          isActive: payload.isActive,
        },
        select: {
          id: true,
        },
      });

      if (payload.role === Role.STUDENT) {
        await syncStudentAdvisorAssignment(tx, userId, payload.advisorId);
        await syncStudentInstructorAssignments(tx, userId, payload.instructorIds);
      }

      return tx.user.findUniqueOrThrow({
        where: {
          id: userId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          additionalRoles: true,
          studentId: true,
          employeeId: true,
          studyYear: true,
          section: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          studentAssignments: {
            where: {
              isActive: true,
            },
            take: 1,
            select: {
              advisor: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          studentInstructorAssignments: activeInstructorAssignmentSelect,
        },
      });
    });

    const auditMetadata = getAdminUserAuditMetadata(payload.role);

    await writeAuditLog({
      actorUserId,
      action: `${auditMetadata.actionPrefix}.update`,
      entityType: auditMetadata.entityType,
      entityId: updated.id,
      description: `Updated ${auditMetadata.descriptionLabel} ${payload.studentId ?? payload.employeeId ?? updated.id}`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({
      message: "User updated successfully",
      user: mapManagedUser(updated),
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "Advisor not found" || error.message === "Instructor not found")) {
      res.status(404).json({ message: error.message });
      return;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ message: "Student ID, employee ID or email already exists" });
      return;
    }

    console.error("Update user error:", error);
    res.status(500).json({ message: "Failed to update user" });
  }
};

export const deleteStudent = async (req: Request, res: Response): Promise<void> => {
  const actorUserId = req.user?.userId;
  const studentUserId = req.params.id;

  try {
    const existing = await prisma.user.findFirst({
      where: {
        id: studentUserId,
        role: Role.STUDENT,
      },
      select: {
        id: true,
        studentId: true,
      },
    });

    if (!existing) {
      res.status(404).json({ message: "Student not found" });
      return;
    }

    const dependencyCount = await getStudentDependencyCount(studentUserId);
    if (dependencyCount > 0) {
      res.status(409).json({
        message:
          "This student already has related records in the system. Set the account to inactive instead of deleting it.",
      });
      return;
    }

    await prisma.user.delete({
      where: {
        id: studentUserId,
      },
    });

    const auditMetadata = getAdminUserAuditMetadata(Role.STUDENT);

    await writeAuditLog({
      actorUserId,
      action: `${auditMetadata.actionPrefix}.delete`,
      entityType: auditMetadata.entityType,
      entityId: studentUserId,
      description: `Deleted ${auditMetadata.descriptionLabel} ${existing.studentId ?? studentUserId}`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({
      message: "Student deleted successfully",
      deletedId: studentUserId,
    });
  } catch (error) {
    console.error("Delete student error:", error);
    res.status(500).json({ message: "Failed to delete student" });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  const actorUserId = req.user?.userId;
  const userId = req.params.id;

  if (actorUserId === userId) {
    res.status(409).json({ message: "Cannot delete the current admin account" });
    return;
  }

  try {
    const existing = await prisma.user.findFirst({
      where: {
        id: userId,
      },
      select: {
        id: true,
        role: true,
        isActive: true,
        studentId: true,
        employeeId: true,
      },
    });

    if (!existing) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (existing.role === Role.ADMIN && existing.isActive) {
      const activeAdminCount = await countActiveAdmins();
      if (activeAdminCount <= 1) {
        res.status(409).json({ message: "At least one active admin account is required" });
        return;
      }
    }

    await prisma.user.delete({
      where: {
        id: userId,
      },
    });

    const auditMetadata = getAdminUserAuditMetadata(existing.role);

    await writeAuditLog({
      actorUserId,
      action: `${auditMetadata.actionPrefix}.delete`,
      entityType: auditMetadata.entityType,
      entityId: userId,
      description: `Deleted ${auditMetadata.descriptionLabel} ${existing.studentId ?? existing.employeeId ?? userId}`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({
      message: "User deleted successfully",
      deletedId: userId,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2003" || error.code === "P2014")) {
      res.status(409).json({
        message: "This user already has related records in the system. Set the account to inactive instead of deleting it.",
      });
      return;
    }

    console.error("Delete user error:", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
};

export const checkExistingStudents = async (req: Request, res: Response): Promise<void> => {
  const parsed = checkExistingStudentsSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid payload",
      errors: parsed.error.flatten(),
    });
    return;
  }

  const normalizedStudentIds: string[] = [];

  for (let index = 0; index < parsed.data.studentIds.length; index += 1) {
    try {
      normalizedStudentIds.push(normalizeStudentId(parsed.data.studentIds[index]));
    } catch (error) {
      res.status(400).json({
        message: `Row ${index + 1}: ${error instanceof Error ? error.message : "Invalid studentId"}`,
      });
      return;
    }
  }

  const uniqueStudentIds = Array.from(new Set(normalizedStudentIds));
  const normalizedEmails = Array.from(
    new Set(
      (parsed.data.emails || [])
        .map((email) => normalizeEmail(email))
        .filter((email): email is string => Boolean(email))
    )
  );

  try {
    const existingUsers = await prisma.user.findMany({
      where: {
        role: Role.STUDENT,
        OR: [
          {
            studentId: {
              in: uniqueStudentIds,
            },
          },
          ...(normalizedEmails.length > 0
            ? [
                {
                  email: {
                    in: normalizedEmails,
                  },
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        studentId: true,
        name: true,
        email: true,
        studyYear: true,
        section: true,
      },
    });

    const matchedByStudentIdCount = existingUsers.filter(
      (user) => user.studentId && uniqueStudentIds.includes(user.studentId)
    ).length;

    const existingStudents = Array.from(
      new Map(
        existingUsers.map((user) => [
          user.id,
          {
            studentId: user.studentId,
            name: user.name,
            email: user.email,
            studyYear: user.studyYear ?? null,
            section: user.section ?? null,
            reason:
              user.studentId && uniqueStudentIds.includes(user.studentId)
                ? "Student already exists in the system"
                : "Email is already used by another student account",
          },
        ])
      ).values()
    );

    res.status(200).json({
      summary: {
        total: uniqueStudentIds.length,
        existing: existingStudents.length,
        available: Math.max(0, uniqueStudentIds.length - matchedByStudentIdCount),
      },
      existingStudents,
    });
  } catch (error) {
    console.error("Check existing students error:", error);
    res.status(500).json({ message: "Failed to check existing students" });
  }
};

export const importStudents = async (req: Request, res: Response): Promise<void> => {
  const actorUserId = req.user?.userId;
  const parsed = importStudentsSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid payload",
      errors: parsed.error.flatten(),
    });
    return;
  }

  const normalizedRows: ImportStudentRow[] = [];

  for (let index = 0; index < parsed.data.rows.length; index += 1) {
    const row = parsed.data.rows[index];

    try {
      normalizedRows.push({
        studentId: normalizeStudentId(row.studentId),
        name: normalizePersonNameForRole(row.name, Role.STUDENT),
        email: normalizeEmail(row.email),
        studyYear: normalizeStudyYear(row.studyYear),
        section: normalizeSection(row.section),
      });
    } catch (error) {
      res.status(400).json({
        message: `Row ${index + 2}: ${error instanceof Error ? error.message : "Invalid data"}`,
      });
      return;
    }
  }

  const duplicateInCsv = normalizedRows
    .map((row) => row.studentId)
    .find((studentId, index, all) => all.indexOf(studentId) !== index);

  if (duplicateInCsv) {
    res.status(400).json({
      message: `Duplicate studentId found in CSV: ${duplicateInCsv}`,
    });
    return;
  }

  const duplicateEmailInCsv = normalizedRows
    .map((row) => row.email)
    .find(
      (email, index, all) =>
        Boolean(email) && all.findIndex((candidate) => candidate === email) !== index
    );

  if (duplicateEmailInCsv) {
    res.status(400).json({
      message: `Duplicate email found in CSV: ${duplicateEmailInCsv}`,
    });
    return;
  }

  try {
    const studentIds = normalizedRows.map((row) => row.studentId);
    const emails = normalizedRows
      .map((row) => row.email)
      .filter((email): email is string => Boolean(email));

    const existingUsers = await prisma.user.findMany({
      where: {
        role: Role.STUDENT,
        OR: [
          {
            studentId: {
              in: studentIds,
            },
          },
          ...(emails.length > 0
            ? [
                {
                  email: {
                    in: emails,
                  },
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        studentId: true,
        name: true,
        email: true,
        studyYear: true,
        section: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const existingByStudentId = new Map(
      existingUsers
        .filter((user) => Boolean(user.studentId))
        .map((user) => [user.studentId as string, user] as const)
    );

    const existingByEmail = new Map(
      existingUsers
        .filter((user) => Boolean(user.email))
        .map((user) => [normalizeEmail(user.email) as string, user] as const)
    );

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const failures: Array<{ studentId: string; reason: string }> = [];
    const updatedStudents: Array<{ studentId: string; reason: string }> = [];
    const skippedStudents: Array<{ studentId: string; reason: string }> = [];
    const createdCredentials: Array<{ studentId: string; temporaryPassword: string }> = [];

    await runWithConcurrency(normalizedRows, IMPORT_CONCURRENCY, async (row) => {
      try {
        const existingById = existingByStudentId.get(row.studentId);
        const emailOwner = row.email ? existingByEmail.get(row.email) : undefined;

        if (emailOwner && (!existingById || emailOwner.id !== existingById.id)) {
          failures.push({
            studentId: row.studentId,
            reason: "Email is already used by another student account",
          });
          return;
        }

        if (existingById) {
          if (!hasStudentProfileChanges(existingById, row)) {
            skipped += 1;
            skippedStudents.push({
              studentId: row.studentId,
              reason: "No changes detected",
            });
            return;
          }

          await prisma.user.update({
            where: { id: existingById.id },
            data: {
              name: row.name,
              email: row.email,
              studyYear: row.studyYear,
              section: row.section,
              isActive: true,
            },
          });

          updated += 1;
          updatedStudents.push({
            studentId: row.studentId,
            reason: "Student profile updated",
          });
          return;
        }

        const temporaryPassword = createTemporaryPassword();
        const passwordHash = await bcrypt.hash(temporaryPassword, IMPORT_BCRYPT_ROUNDS);

        await prisma.user.create({
          data: {
            name: row.name,
            studentId: row.studentId,
            email: row.email,
            studyYear: row.studyYear,
            section: row.section,
            role: Role.STUDENT,
            password: passwordHash,
            mustChangePassword: true,
            isActive: true,
          },
        });

        created += 1;
        createdCredentials.push({
          studentId: row.studentId,
          temporaryPassword,
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          failures.push({
            studentId: row.studentId,
            reason: "Unique field conflict while importing student",
          });
          return;
        }

        failures.push({
          studentId: row.studentId,
          reason: "Failed to save this row",
        });
      }
    });

    const importSummary: ImportAuditSummary = {
      total: normalizedRows.length,
      created,
      updated,
      skipped,
      failed: failures.length,
    };
    const auditMetadata = getAdminUserAuditMetadata(Role.STUDENT);

    try {
      await writeAuditLog({
        actorUserId,
        action: "admin.student.import",
        entityType: auditMetadata.entityType,
        description: buildImportAuditDescription("Imported student batch", importSummary, failures),
        ipAddress: getRequestIpAddress(req),
      });
    } catch (auditError) {
      console.error("Write audit log after student import error:", auditError);
    }

    res.status(200).json({
      message: "Student import completed",
      summary: {
        ...importSummary,
        outcome: resolveImportAuditOutcome(importSummary),
      },
      failures,
      updatedStudents,
      skippedStudents,
      createdCredentials,
      onboardingHint:
        "บัญชีที่สร้างใหม่ได้รหัสผ่านชั่วคราวแบบสุ่มใน createdCredentials — บังคับเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก",
    });
  } catch (error) {
    console.error("Import students error:", error);

    try {
      const auditMetadata = getAdminUserAuditMetadata(Role.STUDENT);
      const failedSummary: ImportAuditSummary = {
        total: normalizedRows.length,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: normalizedRows.length,
      };

      await writeAuditLog({
        actorUserId,
        action: "admin.student.import",
        entityType: auditMetadata.entityType,
        description: buildImportAuditDescription(
          "Imported student batch",
          failedSummary,
          [],
          error instanceof Error ? error.message : "Unexpected import error"
        ),
        ipAddress: getRequestIpAddress(req),
      });
    } catch (auditError) {
      console.error("Write failed audit log after student import error:", auditError);
    }

    res.status(500).json({ message: "Failed to import students" });
  }
};

export const bulkPromoteStudentStudyYear = async (req: Request, res: Response): Promise<void> => {
  const actorUserId = req.user?.userId;
  const parsed = bulkUpdateStudentStudyYearSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid payload",
      errors: parsed.error.flatten(),
    });
    return;
  }

  const fromStudyYear = normalizeStudyYear(parsed.data.fromStudyYear);
  const toStudyYear = normalizeStudyYear(parsed.data.toStudyYear);

  if (fromStudyYear === toStudyYear) {
    res.status(400).json({ message: "Source and target study year must be different" });
    return;
  }

  try {
    const result = await prisma.user.updateMany({
      where: {
        role: Role.STUDENT,
        studyYear: fromStudyYear,
      },
      data: {
        studyYear: toStudyYear,
      },
    });

    const auditMetadata = getAdminUserAuditMetadata(Role.STUDENT);

    await writeAuditLog({
      actorUserId,
      action: "admin.student.study-year.bulk-update",
      entityType: auditMetadata.entityType,
      description: `Bulk updated study year from ${fromStudyYear} to ${toStudyYear} for ${result.count} students`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({
      message:
        result.count > 0
          ? `Updated ${result.count} students from year ${fromStudyYear} to year ${toStudyYear}`
          : `No students found in study year ${fromStudyYear}`,
      fromStudyYear,
      toStudyYear,
      updatedCount: result.count,
    });
  } catch (error) {
    console.error("Bulk promote student study year error:", error);
    res.status(500).json({ message: "Failed to bulk update student study year" });
  }
};

export const checkExistingStaffUsers = async (req: Request, res: Response): Promise<void> => {
  const parsed = checkExistingStaffUsersSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid payload",
      errors: parsed.error.flatten(),
    });
    return;
  }

  try {
    const normalizedEmails = Array.from(
      new Set(parsed.data.emails.map((email) => normalizeEmail(email)).filter((email): email is string => Boolean(email)))
    );

    if (normalizedEmails.length === 0) {
      res.status(200).json({
        summary: {
          total: 0,
          existing: 0,
          available: 0,
        },
        existingUsers: [],
      });
      return;
    }

    const existingUsers = await prisma.user.findMany({
      where: {
        OR: normalizedEmails.map((email) => ({
          email: {
            equals: email,
            mode: "insensitive",
          },
        })),
      },
      select: {
        name: true,
        email: true,
        employeeId: true,
        role: true,
        additionalRoles: true,
        isActive: true,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      take: ADMIN_LIST_MAX_RESULTS,
    });

    res.status(200).json({
      summary: {
        total: normalizedEmails.length,
        existing: existingUsers.length,
        available: Math.max(0, normalizedEmails.length - existingUsers.length),
      },
      existingUsers: existingUsers.map((user) => ({
        name: user.name,
        email: user.email,
        employeeId: user.employeeId,
        role: user.role,
        roles: getAssignedRoles(user),
        reason:
          user.role === Role.STUDENT
            ? "Email already belongs to a student account"
            : user.isActive
              ? "Staff account already exists in the system"
              : "Inactive staff account will be reactivated",
      })),
    });
  } catch (error) {
    console.error("Check existing staff users error:", error);
    res.status(500).json({ message: "Failed to check existing staff users" });
  }
};

export const importStaffUsers = async (req: Request, res: Response): Promise<void> => {
  const actorUserId = req.user?.userId;
  const parsed = importStaffUsersSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid payload",
      errors: parsed.error.flatten(),
    });
    return;
  }

  let normalizedRows: ImportStaffRow[];

  try {
    normalizedRows = parsed.data.rows.map((row) => ({
      name: normalizePersonNameForRole(
        row.name,
        splitPrimaryAndAdditionalStaffRoles(row.roles).primaryRole
      ),
      email: normalizeEmail(row.email) as string,
      roles: splitPrimaryAndAdditionalStaffRoles(row.roles).assignedRoles,
    }));
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Invalid staff import row",
    });
    return;
  }

  try {
    const existingUsers = await prisma.user.findMany({
      where: {
        OR: normalizedRows.map((row) => ({
          email: {
            equals: row.email,
            mode: "insensitive",
          },
        })),
      },
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        role: true,
        additionalRoles: true,
        isActive: true,
      },
    });

    const existingUsersByEmail = new Map<string, ExistingStaffImportUser>();

    for (const user of existingUsers) {
      if (!user.email) {
        continue;
      }

      existingUsersByEmail.set(normalizeEmail(user.email) as string, user);
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const failures: Array<{ email: string; reason: string }> = [];
    const updatedUsers: Array<{ email: string; reason: string }> = [];
    const skippedUsers: Array<{ email: string; reason: string }> = [];
    const createdUsers: Array<{
      email: string;
      employeeId: string;
      role: ManagedStaffRole;
      roles: ManagedStaffRole[];
      temporaryPassword: string;
    }> = [];

    for (const row of normalizedRows) {
      const existing = existingUsersByEmail.get(row.email);

      if (existing?.role === Role.STUDENT) {
        failures.push({
          email: row.email,
          reason: "Email already belongs to a student account",
        });
        continue;
      }

      try {
        if (existing) {
          if (!hasStaffProfileChanges(existing, row)) {
            skipped += 1;
            skippedUsers.push({
              email: row.email,
              reason: "Staff profile is already up to date",
            });
            continue;
          }

          const updatedUser = await prisma.$transaction(async (tx) => {
            const nextRoles = splitPrimaryAndAdditionalStaffRoles(row.roles);
            const existingRoles = getAssignedRoles(existing);
            const roleChanged =
              existing.role !== nextRoles.primaryRole ||
              existingRoles.length !== nextRoles.assignedRoles.length ||
              existingRoles.some((role, index) => role !== nextRoles.assignedRoles[index]);
            const employeeId =
              roleChanged || !existing.employeeId
                ? await generateNextStaffEmployeeId(tx, nextRoles.primaryRole)
                : existing.employeeId;

            return tx.user.update({
              where: {
                id: existing.id,
              },
              data: {
                name: row.name,
                email: row.email,
                role: nextRoles.primaryRole,
                additionalRoles: nextRoles.additionalRoles,
                employeeId,
                isActive: true,
              },
              select: {
                id: true,
                email: true,
                employeeId: true,
                role: true,
                additionalRoles: true,
                name: true,
                isActive: true,
              },
            });
          });

          updated += 1;
          updatedUsers.push({
            email: row.email,
            reason:
              existing.role !== updatedUser.role
                ? `Updated profile and reassigned employee ID to ${updatedUser.employeeId}`
                : "Updated existing staff profile",
          });
          if (updatedUser.email) {
            existingUsersByEmail.set(normalizeEmail(updatedUser.email) as string, updatedUser);
          }
          continue;
        }

        const temporaryPassword = createTemporaryPassword();
        const passwordHash = await bcrypt.hash(temporaryPassword, 12);
        const createdUser = await prisma.$transaction(async (tx) => {
          const nextRoles = splitPrimaryAndAdditionalStaffRoles(row.roles);
          const employeeId = await generateNextStaffEmployeeId(tx, nextRoles.primaryRole);

          return tx.user.create({
            data: {
              name: row.name,
              email: row.email,
              role: nextRoles.primaryRole,
              additionalRoles: nextRoles.additionalRoles,
              employeeId,
              password: passwordHash,
              mustChangePassword: true,
              isActive: true,
            },
            select: {
              id: true,
              email: true,
              employeeId: true,
              role: true,
              additionalRoles: true,
              name: true,
              isActive: true,
            },
          });
        });

        created += 1;
        createdUsers.push({
          email: row.email,
          employeeId: createdUser.employeeId || "-",
          role: createdUser.role as ManagedStaffRole,
          roles: getAssignedRoles(createdUser) as ManagedStaffRole[],
          temporaryPassword,
        });
        if (createdUser.email) {
          existingUsersByEmail.set(normalizeEmail(createdUser.email) as string, createdUser);
        }
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          failures.push({
            email: row.email,
            reason: "Unique field conflict while importing staff",
          });
          continue;
        }

        failures.push({
          email: row.email,
          reason: "Failed to save this row",
        });
      }
    }

    const importSummary: ImportAuditSummary = {
      total: normalizedRows.length,
      created,
      updated,
      skipped,
      failed: failures.length,
    };

    try {
      await writeAuditLog({
        actorUserId,
        action: "admin.user.import",
        entityType: "StaffAccount",
        description: buildImportAuditDescription("Imported staff batch", importSummary, failures),
        ipAddress: getRequestIpAddress(req),
      });
    } catch (auditError) {
      console.error("Write audit log after staff import error:", auditError);
    }

    res.status(200).json({
      message: "Staff import completed",
      summary: {
        ...importSummary,
        outcome: resolveImportAuditOutcome(importSummary),
      },
      failures,
      updatedUsers,
      skippedUsers,
      createdUsers,
      onboardingHint:
        "บัญชีบุคลากรใหม่ได้รหัสผ่านชั่วคราวแบบสุ่มใน createdUsers — บังคับเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก",
    });
  } catch (error) {
    console.error("Import staff users error:", error);

    try {
      const failedSummary: ImportAuditSummary = {
        total: normalizedRows.length,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: normalizedRows.length,
      };

      await writeAuditLog({
        actorUserId,
        action: "admin.user.import",
        entityType: "StaffAccount",
        description: buildImportAuditDescription(
          "Imported staff batch",
          failedSummary,
          [],
          error instanceof Error ? error.message : "Unexpected import error"
        ),
        ipAddress: getRequestIpAddress(req),
      });
    } catch (auditError) {
      console.error("Write failed audit log after staff import error:", auditError);
    }

    res.status(500).json({ message: "Failed to import staff users" });
  }
};

export const listStaffUsers = async (req: Request, res: Response): Promise<void> => {
  const actorUserId = req.user?.userId;

  try {
    const staffUsers = await prisma.user.findMany({
      where: {
        ...(actorUserId
          ? {
              id: {
                not: actorUserId,
              },
            }
          : {}),
        role: {
          not: Role.STUDENT,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        role: true,
        additionalRoles: true,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      take: ADMIN_LIST_MAX_RESULTS,
    });

    res.status(200).json({
      staff: staffUsers.map(mapStaff),
    });
  } catch (error) {
    console.error("List staff users error:", error);
    res.status(500).json({ message: "Failed to list staff users" });
  }
};

export const assignAdvisorStudents = async (req: Request, res: Response): Promise<void> => {
  const actorUserId = req.user?.userId;
  const parsed = assignAdvisorStudentsSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid payload",
      errors: parsed.error.flatten(),
    });
    return;
  }

  try {
    const advisor = await prisma.user.findFirst({
      where: {
        id: parsed.data.advisorId,
        ...buildUserHasRoleWhere(Role.ADVISOR),
      },
      select: {
        id: true,
      },
    });

    if (!advisor) {
      res.status(404).json({ message: "Advisor not found" });
      return;
    }

    const students = await prisma.user.findMany({
      where: {
        id: {
          in: parsed.data.studentIds,
        },
        role: Role.STUDENT,
      },
      select: {
        id: true,
      },
    });

    if (students.length !== parsed.data.studentIds.length) {
      res.status(400).json({ message: "One or more student ids are invalid" });
      return;
    }

    await prisma.$transaction([
      prisma.studentAdvisorAssignment.updateMany({
        where: {
          studentId: {
            in: parsed.data.studentIds,
          },
          isActive: true,
        },
        data: {
          isActive: false,
        },
      }),
      prisma.studentAdvisorAssignment.createMany({
        data: parsed.data.studentIds.map((studentId) => ({
          studentId,
          advisorId: parsed.data.advisorId,
          isActive: true,
        })),
      }),
    ]);

    await writeAuditLog({
      actorUserId,
      action: "admin.advisor-assignment.assign",
      entityType: "StudentAdvisorAssignment",
      entityId: parsed.data.advisorId,
      description: `Assigned ${parsed.data.studentIds.length} students to advisor`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({
      message: "Advisor assignment updated successfully",
      advisorId: parsed.data.advisorId,
      studentCount: parsed.data.studentIds.length,
    });
  } catch (error) {
    console.error("Assign advisor students error:", error);
    res.status(500).json({ message: "Failed to assign advisor students" });
  }
};

export const listAuditLogs = async (req: Request, res: Response): Promise<void> => {
  const parsed = listAuditLogsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid query",
      errors: parsed.error.flatten(),
    });
    return;
  }

  const limit = parsed.data.limit ?? 100;

  try {
    const auditLogs = await prisma.auditLog.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    res.status(200).json({
      logs: auditLogs,
    });
  } catch (error) {
    console.error("List audit logs error:", error);
    res.status(500).json({ message: "Failed to list audit logs" });
  }
};

/** สรุปสถิติคัดกรอง/ปฏิบัติการแบบไม่ระบุตัวตนสำหรับหน้ารายงานแอดมิน */
export const getAdminReportsSummary = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.userId || !hasAssignedRole(req.user, Role.ADMIN)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const payload = await buildExecutiveDashboardStats();
    res.status(200).json(payload);
  } catch (error) {
    console.error("Get admin reports summary error:", error);
    res.status(500).json({ message: "Failed to fetch admin reports summary" });
  }
};
