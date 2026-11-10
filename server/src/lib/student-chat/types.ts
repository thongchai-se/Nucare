import type { StudentChatPersonaId } from "./personas";

export type StudentChatRole = "user" | "assistant";

export type StudentChatMessage = {
  role: StudentChatRole;
  content: string;
};

export type StudentChatReplyInput = {
  personaId: StudentChatPersonaId;
  content: string;
  history: StudentChatMessage[];
  /** สรุปสั้นจาก DB สำหรับคุยต่อเนื่อง — ไม่ใช่ประวัติเต็ม */
  memorySummary?: string | null;
};

export type StudentChatReply = {
  content: string;
  blockedReason: "homework" | null;
  crisisSuggested: boolean;
};

export type ChatProvider = {
  reply: (input: StudentChatReplyInput) => Promise<StudentChatReply>;
};
