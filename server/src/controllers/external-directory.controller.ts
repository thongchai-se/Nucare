import { Request, Response } from "express";
import { readEnv } from "../lib/env";

const DEFAULT_FACULTY = "คณะพยาบาลศาสตร์";
const DEFAULT_PROGRAM = "พยาบาลศาสตรบัณฑิต";

type DirectoryList<T> = {
  total?: number;
  students?: T[];
  staff?: T[];
  faculties?: unknown[];
};

const directoryConfig = (): { baseUrl: string; apiKey: string } => {
  const baseUrl = readEnv("DIRECTORY_API_URL")?.replace(/\/+$/, "");
  const apiKey = readEnv("DIRECTORY_API_KEY");
  if (!baseUrl || !apiKey) {
    throw new Error("ยังไม่ได้ตั้ง DIRECTORY_API_URL หรือ DIRECTORY_API_KEY");
  }
  return { baseUrl, apiKey };
};

const readDirectory = async <T>(path: string): Promise<T> => {
  const { baseUrl, apiKey } = directoryConfig();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "x-api-key": apiKey },
  });
  if (!response.ok) {
    throw new Error(`คลังรายชื่อตอบกลับ ${response.status}`);
  }
  return (await response.json()) as T;
};

const requestedScope = (req: Request): { faculty: string; programs: string[] } => {
  const faculty =
    (typeof req.query.faculty === "string" && req.query.faculty.trim()) ||
    readEnv("DIRECTORY_FACULTY") ||
    DEFAULT_FACULTY;
  const rawPrograms =
    (typeof req.query.programs === "string" && req.query.programs) ||
    readEnv("DIRECTORY_PROGRAMS") ||
    DEFAULT_PROGRAM;
  const programs = rawPrograms
    .split(",")
    .map((program) => program.trim())
    .filter(Boolean);
  return { faculty, programs };
};

export const pullExternalDirectoryCatalog = async (_req: Request, res: Response): Promise<void> => {
  try {
    const body = await readDirectory<DirectoryList<never>>("/api/catalog");
    res.status(200).json({
      faculties: body.faculties || [],
      defaults: { faculty: DEFAULT_FACULTY, programs: [DEFAULT_PROGRAM] },
    });
  } catch (error) {
    console.error("Pull external directory catalog error:", error);
    res.status(502).json({
      message: error instanceof Error ? error.message : "โหลดรายชื่อคณะจาก API จำลองไม่สำเร็จ",
    });
  }
};

export const pullExternalDirectory = async (req: Request, res: Response): Promise<void> => {
  try {
    const scope = requestedScope(req);
    if (scope.programs.length === 0) {
      res.status(400).json({ message: "เลือกอย่างน้อย 1 สาขา" });
      return;
    }

    const params = new URLSearchParams({ faculty: scope.faculty, programs: scope.programs.join(",") });
    const [studentsBody, staffBody] = await Promise.all([
      readDirectory<DirectoryList<unknown>>(`/api/students?${params.toString()}`),
      readDirectory<DirectoryList<unknown>>(`/api/staff?${params.toString()}`),
    ]);
    const students = studentsBody.students || [];
    const staff = staffBody.staff || [];

    res.status(200).json({
      source: readEnv("DIRECTORY_API_URL"),
      scope,
      students,
      staff,
      summary: { students: students.length, staff: staff.length },
    });
  } catch (error) {
    console.error("Pull external directory error:", error);
    res.status(502).json({
      message: error instanceof Error ? error.message : "ดึงรายชื่อจาก API จำลองไม่สำเร็จ",
    });
  }
};
