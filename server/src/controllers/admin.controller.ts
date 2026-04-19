import { Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const DEFAULT_IMPORT_BCRYPT_ROUNDS = 10;
const DEFAULT_IMPORT_CONCURRENCY = 12;

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
  email: z
    .union([z.string().trim().email(), z.literal(""), z.undefined()])
    .optional(),
});

const importStudentsSchema = z.object({
  rows: z.array(importStudentRowSchema).min(1).max(2000),
});

const checkExistingStudentsSchema = z.object({
  studentIds: z.array(z.string().trim().min(1)).min(1).max(2000),
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

const normalizeStudentId = (raw: string): string => {
  const digitsOnly = raw.replace(/\D/g, "");

  if (digitsOnly.length !== 10) {
    throw new Error("รหัสนักศึกษาต้องมี 10 หลัก");
  }

  return `${digitsOnly.slice(0, 9)}-${digitsOnly.slice(9)}`;
};

const normalizeEmail = (raw?: string): string | null => {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : null;
};

const mapStudent = (user: {
  id: string;
  studentId: string | null;
  name: string;
  email: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: user.id,
  studentId: user.studentId,
  name: user.name,
  email: user.email,
  status: user.isActive ? "active" : "inactive",
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

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
                {
                  studentId: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
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
      message: error instanceof Error ? error.message : "ข้อมูล studentId ไม่ถูกต้อง",
    });
    return;
  }

  const email = normalizeEmail(parsed.data.email);

  try {
    const conflict = await prisma.user.findFirst({
      where: {
        OR: [
          { studentId },
          ...(email ? [{ email }] : []),
        ],
      },
      select: {
        id: true,
      },
    });

    if (conflict) {
      res.status(409).json({ message: "รหัสนักศึกษาหรืออีเมลนี้มีในระบบแล้ว" });
      return;
    }

    const initialPassword = `Nu${studentId}`;
    const passwordHash = await bcrypt.hash(initialPassword, 12);

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

    res.status(201).json({
      message: "เพิ่มข้อมูลนักศึกษาสำเร็จ",
      student: mapStudent(created),
      initialPasswordRule: "Nu<studentId>",
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ message: "รหัสนักศึกษาหรืออีเมลนี้มีในระบบแล้ว" });
      return;
    }

    console.error("Create student error:", error);
    res.status(500).json({ message: "Failed to create student" });
  }
};

export const updateStudent = async (req: Request, res: Response): Promise<void> => {
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
      message: error instanceof Error ? error.message : "ข้อมูล studentId ไม่ถูกต้อง",
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
        studentId: true,
        email: true,
      },
    });

    if (!existing) {
      res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
      return;
    }

    const conflict = await prisma.user.findFirst({
      where: {
        id: { not: studentUserId },
        OR: [
          { studentId },
          ...(email ? [{ email }] : []),
        ],
      },
      select: {
        id: true,
      },
    });

    if (conflict) {
      res.status(409).json({ message: "รหัสนักศึกษาหรืออีเมลนี้มีในระบบแล้ว" });
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

    res.status(200).json({
      message: "อัปเดตข้อมูลนักศึกษาสำเร็จ",
      student: mapStudent(updated),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ message: "รหัสนักศึกษาหรืออีเมลนี้มีในระบบแล้ว" });
      return;
    }

    console.error("Update student error:", error);
    res.status(500).json({ message: "Failed to update student" });
  }
};

export const deleteStudent = async (req: Request, res: Response): Promise<void> => {
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
      res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
      return;
    }

    await prisma.user.delete({
      where: {
        id: studentUserId,
      },
    });

    res.status(200).json({
      message: "ลบข้อมูลนักศึกษาสำเร็จ",
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
        message: `รายการที่ ${index + 1}: ${error instanceof Error ? error.message : "ข้อมูลไม่ถูกต้อง"}`,
      });
      return;
    }
  }

  const uniqueStudentIds = Array.from(new Set(normalizedStudentIds));

  try {
    const existingUsers = await prisma.user.findMany({
      where: {
        studentId: {
          in: uniqueStudentIds,
        },
      },
      select: {
        studentId: true,
        name: true,
        email: true,
      },
    });

    res.status(200).json({
      summary: {
        total: uniqueStudentIds.length,
        existing: existingUsers.length,
        available: uniqueStudentIds.length - existingUsers.length,
      },
      existingStudents: existingUsers.map((user) => ({
        studentId: user.studentId,
        name: user.name,
        email: user.email,
        reason: "มีข้อมูลอยู่แล้วในระบบ",
      })),
    });
  } catch (error) {
    console.error("Check existing students error:", error);
    res.status(500).json({ message: "Failed to check existing students" });
  }
};

export const importStudents = async (req: Request, res: Response): Promise<void> => {
  const parsed = importStudentsSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid payload",
      errors: parsed.error.flatten(),
    });
    return;
  }

  const normalizedRows: Array<{
    studentId: string;
    name: string;
    email: string | null;
  }> = [];

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
        message: `แถวที่ ${index + 2}: ${error instanceof Error ? error.message : "ข้อมูลไม่ถูกต้อง"}`,
      });
      return;
    }
  }

  const duplicateInCsv = normalizedRows
    .map((row) => row.studentId)
    .find((studentId, index, all) => all.indexOf(studentId) !== index);

  if (duplicateInCsv) {
    res.status(400).json({
      message: `พบรหัสนักศึกษาซ้ำในไฟล์ CSV: ${duplicateInCsv}`,
    });
    return;
  }

  try {
    const studentIds = normalizedRows.map((row) => row.studentId);
    const existingUsers = await prisma.user.findMany({
      where: {
        studentId: {
          in: studentIds,
        },
      },
      select: {
        studentId: true,
      },
    });

    const existingStudentIdSet = new Set(existingUsers.map((user) => user.studentId).filter(Boolean));

    const existingStudents: Array<{ studentId: string; reason: string }> = [];
    const rowsToCreate: Array<{ studentId: string; name: string; email: string | null }> = [];

    for (const row of normalizedRows) {
      if (existingStudentIdSet.has(row.studentId)) {
        existingStudents.push({
          studentId: row.studentId,
          reason: "มีข้อมูลอยู่แล้วในระบบ",
        });
        continue;
      }

      rowsToCreate.push(row);
    }

    let created = 0;
    const failures: Array<{ studentId: string; reason: string }> = [];

    await runWithConcurrency(rowsToCreate, IMPORT_CONCURRENCY, async (row) => {
      try {
        const initialPassword = `Nu${row.studentId}`;
        const passwordHash = await bcrypt.hash(initialPassword, IMPORT_BCRYPT_ROUNDS);

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
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          failures.push({
            studentId: row.studentId,
            reason: "ข้อมูลซ้ำกับ unique field (เช่น email) ในระบบ",
          });
          return;
        }

        failures.push({
          studentId: row.studentId,
          reason: "ไม่สามารถบันทึกข้อมูลได้",
        });
      }
    });

    const existing = existingStudents.length;
    const failed = failures.length;

    res.status(200).json({
      message: "นำเข้าข้อมูลนักศึกษาเสร็จสิ้น",
      summary: {
        total: normalizedRows.length,
        created,
        existing,
        failed,
      },
      initialPasswordRule: "Nu<studentId>",
      failures,
      existingStudents,
    });
  } catch (error) {
    console.error("Import students error:", error);
    res.status(500).json({ message: "Failed to import students" });
  }
};
