import type { StudentChatPersona, StudentChatPersonaId } from "./types";

/** หาเพื่อนคนถัดไปในรายการสำหรับสลับในห้องแชท */
export function getNextPersona(
  personas: StudentChatPersona[],
  currentId: StudentChatPersonaId | null
): StudentChatPersona | null {
  if (personas.length < 2 || !currentId) {
    return null;
  }
  const index = personas.findIndex((persona) => persona.id === currentId);
  if (index < 0) {
    return personas[0] ?? null;
  }
  return personas[(index + 1) % personas.length] ?? null;
}
