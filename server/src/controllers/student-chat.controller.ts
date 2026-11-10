import { Role } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { getRequestIpAddress, writeAuditLog } from "../lib/audit-log";
import { prisma } from "../lib/prisma";
import { hasAssignedRole } from "../lib/roles";
import {
  buildContinuityGreeting,
  formatMemoryForPrompt,
  loadStudentChatMemory,
  upsertStudentChatMemory,
} from "../lib/student-chat/memory";
import {
  getStudentChatPersona,
  listStudentChatPersonasPublic,
  STUDENT_CHAT_PERSONA_IDS,
} from "../lib/student-chat/personas";
import { getStudentChatProvider } from "../lib/student-chat/provider";
import { recordWellnessTrendsFromChatMessage } from "../lib/student-chat/record-wellness-trends";

const MAX_MESSAGE_LENGTH = 2000;
/** เก็บ history ในคำขอสั้นลง — อาศัย memory สรุปแทนการส่งยาว */
const MAX_HISTORY_MESSAGES = 12;

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

const chatRequestSchema = z.object({
  personaId: z.enum(STUDENT_CHAT_PERSONA_IDS),
  content: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  history: z.array(chatMessageSchema).max(MAX_HISTORY_MESSAGES).default([]),
});

const chatMemoryQuerySchema = z.object({
  personaId: z.enum(STUDENT_CHAT_PERSONA_IDS),
});

/** ส่งรายการเพื่อน AI ให้หน้าเลือก persona ของนิสิต */
export const listStudentChatPersonas = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.userId || !hasAssignedRole(req.user, Role.STUDENT)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  res.status(200).json({
    personas: listStudentChatPersonasPublic(),
  });
};

/** คืนทักทายต่อเนื่องจาก memory สั้น — ไม่ส่งประวัติแชทเต็ม */
export const getStudentChatMemoryGreeting = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.STUDENT)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsed = chatMemoryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid personaId" });
    return;
  }

  const persona = getStudentChatPersona(parsed.data.personaId);
  if (!persona) {
    res.status(400).json({ message: "Unknown persona" });
    return;
  }

  try {
    const memory = await loadStudentChatMemory(prisma, userId, parsed.data.personaId);
    res.status(200).json({
      hasMemory: Boolean(memory?.summary?.trim()),
      greeting: buildContinuityGreeting(persona, memory),
      lastTopic: memory?.lastTopic ?? null,
      lastChattedAt: memory?.updatedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("Student chat memory greeting error:", error);
    res.status(500).json({ message: "Failed to load chat memory" });
  }
};

/** รับข้อความแชทหนึ่งรอบแล้วตอบผ่าน ChatProvider ที่ตั้งไว้ (ค่าเริ่มต้น mock) */
export const postStudentChatMessage = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.STUDENT)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid payload",
      errors: parsed.error.flatten(),
    });
    return;
  }

  try {
    const memory = await loadStudentChatMemory(prisma, userId, parsed.data.personaId);
    const provider = getStudentChatProvider();
    const reply = await provider.reply({
      personaId: parsed.data.personaId,
      content: parsed.data.content,
      history: parsed.data.history,
      memorySummary: formatMemoryForPrompt(memory),
    });

    if (!reply.blockedReason) {
      try {
        await upsertStudentChatMemory(prisma, {
          studentId: userId,
          personaId: parsed.data.personaId,
          userMessage: parsed.data.content,
        });
      } catch (memoryError) {
        console.error("Student chat memory upsert failed:", memoryError);
      }
    }

    // เก็บเฉพาะรหัสแนวโน้มในประวัตินิสิต — ไม่บันทึกเนื้อหาแชท และไม่สร้างแจ้งเตือนในกล่องกระดิ่ง
    try {
      await recordWellnessTrendsFromChatMessage(prisma, userId, parsed.data.content);
    } catch (signalError) {
      console.error("Wellness trend recording failed:", signalError);
    }

    await writeAuditLog({
      actorUserId: userId,
      action: reply.blockedReason
        ? "student.chat.blocked"
        : "student.chat.message",
      entityType: "StudentChat",
      description: reply.blockedReason
        ? `Student chat blocked (${reply.blockedReason}) with persona ${parsed.data.personaId}`
        : `Student chat reply with persona ${parsed.data.personaId}`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({
      reply: {
        role: "assistant" as const,
        content: reply.content,
        blockedReason: reply.blockedReason,
        crisisSuggested: reply.crisisSuggested,
      },
    });
  } catch (error) {
    console.error("Student chat error:", error);
    res.status(500).json({ message: "Failed to generate chat reply" });
  }
};
