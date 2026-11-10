export type StudentChatPersonaId = "peer-male" | "peer-female";

export type StudentChatPersona = {
  id: StudentChatPersonaId;
  gender: "male" | "female";
  displayName: string;
  shortBio: string;
  greeting: string;
};

export type StudentChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  blockedReason?: "homework" | null;
  crisisSuggested?: boolean;
};

export const STUDENT_CHAT_PERSONA_STORAGE_KEY = "nucare_student_chat_persona";
