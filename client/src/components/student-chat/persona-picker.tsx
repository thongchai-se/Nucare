"use client";

import { PersonaCardGrid } from "./persona-card-grid";
import type { StudentChatPersona } from "./types";

type PersonaPickerProps = {
  personas: StudentChatPersona[];
  selectedId: string | null;
  onStart: (personaId: StudentChatPersona["id"]) => void;
};

/** กรอบเลือกเพื่อนในหน้าแชท — กว้างเต็มคอนเทนเนอร์ให้อ่านข้อความในภาพได้ */
export function PersonaPicker({ personas, selectedId, onStart }: PersonaPickerProps) {
  return (
    <div className="mx-auto w-full max-w-4xl rounded-[1.35rem] border border-slate-200 bg-white p-3 shadow-sm sm:rounded-[1.75rem] sm:p-4 md:p-5">
      <PersonaCardGrid
        density="comfortable"
        selectedId={selectedId}
        onSelect={onStart}
        items={personas.map((persona) => ({
          id: persona.id,
          label: persona.gender === "male" ? "คุยกับพี่ต้น" : "คุยกับพี่เมย์",
        }))}
      />
    </div>
  );
}
