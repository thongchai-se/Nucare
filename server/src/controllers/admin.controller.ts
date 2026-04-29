import { Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { getRequestIpAddress, writeAuditLog } from "../lib/audit-log";
import { prisma } from "../lib/prisma";

const DEFAULT_IMPORT_BCRYPT_ROUNDS = 10;
const DEFAULT_IMPORT_CONCURRENCY = 12;
const STUDENT_ID_PATTERN = /^\d{9}-\d$/;
const STUDENT_ID_FORMAT_MESSAGE = "Student ID must be in the format 663380696-6";

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

const studentStatusSchema = z.enum(["active", "inactive"]);

const createStudentSchema = z.object({
  studentId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(120),
  email: z.union([z.string().trim().email(), z.literal(""), z.undefined()]).optional(),
  status: studentStatusSchema,
});

const updateStudentSchema = z.object({
  studentId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(120),
  email: z.union([z.string().trim().email(), z.literal(""), z.undefined()]).optional(),
  status: studentStatusSchema,
});

const assignAdvisorStudentsSchema = z.object({
  advisorId: z.string().trim().min(1),
  studentIds: z.array(z.string().trim().min(1)).min(1).max(500),
});

type StudentRecord = {
  id: string;
  studentId: string | null;
  name: string;
  email: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type ImportStudentRow = {
  studentId: string;
  name: string;
  email: string | null;
};

const normalizeStudentId = (raw: string): string => {
  const normalized = raw.trim();
  if (!STUDENT_ID_PATTERN.test(normalized)) {
    throw new Error(STUDENT_ID_FORMAT_MESSAGE);
  }

  return normalized;
};

const formatStudentIdForResponse = (studentId: string | null): string | null => {
  if (!studentId) {
    return null;
  }

  if (STUDENT_ID_PATTERN.test(studentId)) {
    return studentId;
  }

  if (/^\d{10}$/.test(studentId)) {
    return `${studentId.slice(0, 9)}-${studentId.slice(9)}`;
  }

  return studentId;
};

const normalizeEmail = (raw?: string | null): string | null => {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : null;
};

const createTemporaryPassword = (): string => randomBytes(18).toString("base64url");

const hasStudentProfileChanges = (
  student: Pick<StudentRecord, "name" | "email" | "isActive">,
  row: ImportStudentRow
): boolean =>
  student.name.trim() !== row.name.trim() ||
  normalizeEmail(student.email) !== normalizeEmail(row.email) ||
  !student.isActive;

const mapStudent = (user: StudentRecord) => ({
  id: user.id,
  studentId: formatStudentIdForResponse(user.studentId),
  name: user.name,
  email: user.email,
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
}) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  employeeId: user.employeeId,
  role: user.role,
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
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
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
        name: parsed.data.name.trim(),
        email,
        role: Role.STUDENT,
        password: passwordHash,
        isActive: parsed.data.status === "active",
      },
      select: {
        id: true,
        studentId: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await writeAuditLog({
      actorUserId,
      action: "admin.student.create",
      entityType: "User",
      entityId: created.id,
      description: `Created student account ${studentId}`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(201).json({
      message: "Student created successfully",
      student: mapStudent(created),
      temporaryPassword,
      onboardingHint: "Use the temporary password once or reset the password via the forgot-password flow.",
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
        name: parsed.data.name.trim(),
        email,
        isActive: parsed.data.status === "active",
      },
      select: {
        id: true,
        studentId: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await writeAuditLog({
      actorUserId,
      action: "admin.student.update",
      entityType: "User",
      entityId: updated.id,
      description: `Updated student account ${studentId}`,
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

    await writeAuditLog({
      actorUserId,
      action: "admin.student.delete",
      entityType: "User",
      entityId: studentUserId,
      description: `Deleted student account ${existing.studentId ?? studentUserId}`,
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
        name: row.name.trim(),
        email: normalizeEmail(row.email),
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
            role: Role.STUDENT,
            password: passwordHash,
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

    await writeAuditLog({
      actorUserId,
      action: "admin.student.import",
      entityType: "User",
      description: `Imported student batch (created=${created}, updated=${updated}, skipped=${skipped}, failed=${failures.length})`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({
      message: "Student import completed",
      summary: {
        total: normalizedRows.length,
        created,
        updated,
        skipped,
        failed: failures.length,
      },
      failures,
      updatedStudents,
      skippedStudents,
      createdCredentials,
      onboardingHint:
        "New accounts receive random temporary passwords. Students can also use the forgot-password flow to set a new password securely.",
    });
  } catch (error) {
    console.error("Import students error:", error);
    res.status(500).json({ message: "Failed to import students" });
  }
};

export const listStaffUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const staffUsers = await prisma.user.findMany({
      where: {
        role: {
          in: [Role.ADMIN, Role.ADVISOR, Role.INSTRUCTOR, Role.MENTAL_HEALTH, Role.EXECUTIVE],
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        role: true,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
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
        role: Role.ADVISOR,
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
  const limit = Math.min(Number.parseInt(String(req.query.limit || "100"), 10) || 100, 200);

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
