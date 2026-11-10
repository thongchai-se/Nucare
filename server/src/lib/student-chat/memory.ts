import type { PrismaClient } from "@prisma/client";
import { looksLikeCodeOrHomeworkDump } from "./guardrails";
import type { StudentChatPersona, StudentChatPersonaId } from "./personas";

export const CHAT_MEMORY_SUMMARY_MAX_CHARS = 700;
export const CHAT_MEMORY_MAX_BULLETS = 6;
export const CHAT_MEMORY_SNIPPET_MAX_CHARS = 120;
/** ลบ memory ที่ไม่ได้คุยเกินนี้ (วัน) — คุมขนาด DB ระยะยาว */
export const CHAT_MEMORY_TTL_DAYS = 90;
export const CHAT_MEMORY_TIME_ZONE = "Asia/Bangkok";

export type StudentChatMemoryRecord = {
  summary: string;
  lastTopic: string | null;
  turnCount: number;
  updatedAt: Date;
};

export type ChatTimeGap = {
  /** จำนวนวันปฏิทินห่างจากคุยล่าสุด (โซนไทย) */
  calendarDays: number;
  /** ป้ายสั้น เช่น เมื่อวาน / 4 วันที่แล้ว */
  label: string;
};

/** วันที่ปฏิทิน YYYY-MM-DD ตามโซนไทย */
export function calendarDateKey(date: Date, timeZone = CHAT_MEMORY_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** ระยะห่างเป็นวันปฏิทิน (ไม่นับชั่วโมงเป๊ะ) */
export function calendarDaysBetween(from: Date, to: Date, timeZone = CHAT_MEMORY_TIME_ZONE): number {
  const start = calendarDateKey(from, timeZone);
  const end = calendarDateKey(to, timeZone);
  const startMs = Date.parse(`${start}T00:00:00+07:00`);
  const endMs = Date.parse(`${end}T00:00:00+07:00`);
  return Math.max(0, Math.round((endMs - startMs) / 86_400_000));
}

/** ป้ายเวลาแบบเพื่อนคุยกัน */
export function describeChatTimeGap(lastAt: Date, now = new Date()): ChatTimeGap {
  const calendarDays = calendarDaysBetween(lastAt, now);
  if (calendarDays <= 0) {
    const hours = Math.max(0, (now.getTime() - lastAt.getTime()) / 3_600_000);
    if (hours < 3) {
      return { calendarDays: 0, label: "เมื่อกี้" };
    }
    return { calendarDays: 0, label: "วันนี้" };
  }
  if (calendarDays === 1) {
    return { calendarDays: 1, label: "เมื่อวาน" };
  }
  if (calendarDays <= 6) {
    return { calendarDays, label: `${calendarDays} วันที่แล้ว` };
  }
  if (calendarDays <= 13) {
    return { calendarDays, label: "ประมาณสัปดาห์ที่แล้ว" };
  }
  if (calendarDays <= 29) {
    return { calendarDays, label: "หลายสัปดาห์แล้ว" };
  }
  return { calendarDays, label: "นานแล้ว" };
}

/** วันที่สั้นภาษาไทยสำหรับแปะใน bullet */
export function formatThaiShortDate(date: Date, timeZone = CHAT_MEMORY_TIME_ZONE): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone,
    day: "numeric",
    month: "short",
  }).format(date);
}

/**
 * รวมบริบทเวลา + บันทึกสั้นเข้า system prompt
 * ส่งเป็นข้อเท็จจริงอย่างเดียว — ไม่บังคับประโยคทักทาย ให้โมเดลพูดเอง
 */
export function formatMemoryForPrompt(
  memory: Pick<StudentChatMemoryRecord, "summary" | "lastTopic" | "updatedAt"> | null | undefined,
  now = new Date()
): string {
  const trimmed = memory?.summary?.trim();
  if (!trimmed || !memory) {
    return "";
  }

  const gap = describeChatTimeGap(memory.updatedAt, now);
  const today = formatThaiShortDate(now);
  const topic = memory.lastTopic?.trim();

  return [
    `บริบทเวลา (ข้อเท็จจริงเท่านั้น — อย่าท่องเป็นสคริปต์):`,
    `- วันนี้: ${today}`,
    `- คุยล่าสุดเมื่อ: ${gap.label} (${formatThaiShortDate(memory.updatedAt)})`,
    topic ? `- หัวข้อที่เคยแตะ: ${topic}` : null,
    `บันทึกสั้นจากครั้งก่อน:`,
    trimmed,
    `ถ้าเข้ากับบทสนทนา ค่อยอ้างอิงเวลา/เรื่องเดิมแบบเพื่อนคุยกันเอง ห้ามเปิดด้วยประโยคจำเจซ้ำ ๆ และห้ามพูดว่าเป็น AI`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/** ทักทายเปิดแชท — ใช้ greeting ของ persona อย่างเดียว ไม่ฟิกประโยคจาก memory */
export function buildContinuityGreeting(
  persona: StudentChatPersona,
  _memory?: StudentChatMemoryRecord | null,
  _now?: Date
): string {
  return persona.greeting;
}

/** สร้างหัวข้อสั้นจากข้อความนิสิต สำหรับทักทายรอบถัดไป */
export function extractLastTopic(content: string): string | null {
  const cleaned = content
    .trim()
    .replace(/\s+/g, " ")
    .replace(/["'`]/g, "")
    .slice(0, 48);
  if (cleaned.length < 6 || looksLikeCodeOrHomeworkDump(cleaned)) {
    return null;
  }
  return cleaned;
}

/** อัปเดตสรุปแบบ bullet พร้อมวันที่ — ไม่เรียก LLM เพิ่ม */
export function appendMemorySummary(
  previousSummary: string | null | undefined,
  userMessage: string,
  at = new Date()
): string {
  if (looksLikeCodeOrHomeworkDump(userMessage)) {
    return (previousSummary || "").trim();
  }

  const snippet = userMessage.trim().replace(/\s+/g, " ").slice(0, CHAT_MEMORY_SNIPPET_MAX_CHARS);
  if (snippet.length < 8) {
    return (previousSummary || "").trim();
  }

  const stamped = `- [${formatThaiShortDate(at)}] ${snippet}`;
  const lines = (previousSummary || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const last = lines[lines.length - 1];
  if (last?.endsWith(snippet)) {
    return lines.join("\n");
  }

  lines.push(stamped);
  while (lines.length > CHAT_MEMORY_MAX_BULLETS || lines.join("\n").length > CHAT_MEMORY_SUMMARY_MAX_CHARS) {
    lines.shift();
  }

  return lines.join("\n");
}

export function isStudentChatMemoryStale(
  updatedAt: Date,
  now = new Date(),
  ttlDays = CHAT_MEMORY_TTL_DAYS
): boolean {
  const cutoff = now.getTime() - ttlDays * 86_400_000;
  return updatedAt.getTime() < cutoff;
}

/** โหลด memory — ถ้าเก่าเกิน TTL ให้ลบทิ้งแล้วถือว่าไม่มี */
export async function loadStudentChatMemory(
  db: PrismaClient,
  studentId: string,
  personaId: StudentChatPersonaId,
  now = new Date()
): Promise<StudentChatMemoryRecord | null> {
  const row = await db.studentChatMemory.findUnique({
    where: {
      studentId_personaId: { studentId, personaId },
    },
    select: { summary: true, lastTopic: true, turnCount: true, updatedAt: true },
  });

  if (!row) {
    return null;
  }

  if (isStudentChatMemoryStale(row.updatedAt, now)) {
    await db.studentChatMemory.delete({
      where: { studentId_personaId: { studentId, personaId } },
    });
    return null;
  }

  return row;
}

/** บันทึก/อัปเดต memory หลังนิสิตคุยจริง (ไม่เก็บแชทเต็ม) */
export async function upsertStudentChatMemory(
  db: PrismaClient,
  input: {
    studentId: string;
    personaId: StudentChatPersonaId;
    userMessage: string;
    at?: Date;
  }
): Promise<StudentChatMemoryRecord> {
  const at = input.at ?? new Date();
  const existing = await loadStudentChatMemory(db, input.studentId, input.personaId, at);
  const summary = appendMemorySummary(existing?.summary, input.userMessage, at);
  const lastTopic = extractLastTopic(input.userMessage) || existing?.lastTopic || null;
  const turnCount = (existing?.turnCount || 0) + 1;

  const saved = await db.studentChatMemory.upsert({
    where: {
      studentId_personaId: {
        studentId: input.studentId,
        personaId: input.personaId,
      },
    },
    create: {
      studentId: input.studentId,
      personaId: input.personaId,
      summary,
      lastTopic,
      turnCount,
    },
    update: {
      summary,
      lastTopic,
      turnCount,
    },
    select: { summary: true, lastTopic: true, turnCount: true, updatedAt: true },
  });

  return saved;
}

/** ลบ memory ทั้งก้อนที่ไม่ได้ใช้เกิน TTL — เรียกตอนสตาร์ทเซิร์ฟเวอร์ */
export async function purgeStaleStudentChatMemories(
  db: PrismaClient,
  options?: { now?: Date; ttlDays?: number }
): Promise<number> {
  const now = options?.now ?? new Date();
  const ttlDays = options?.ttlDays ?? CHAT_MEMORY_TTL_DAYS;
  const cutoff = new Date(now.getTime() - ttlDays * 86_400_000);
  const result = await db.studentChatMemory.deleteMany({
    where: { updatedAt: { lt: cutoff } },
  });
  return result.count;
}
