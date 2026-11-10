/**
 * แปลงบันทึก SOAP / บันทึกผู้เชี่ยวชาญให้อ่านเป็นภาษาไทย
 * รองรับทั้งรูปแบบเก่า S:/O:/A:/P: และหัวข้อไทย
 */

const SECTION_MAP: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /^S:\s*/i, label: "นิสิตเล่า" },
  { pattern: /^O:\s*/i, label: "สิ่งที่สังเกต" },
  { pattern: /^A:\s*/i, label: "ประเมิน" },
  { pattern: /^P:\s*/i, label: "แผนการดูแล" },
  { pattern: /^นิสิตเล่า:\s*/u, label: "นิสิตเล่า" },
  { pattern: /^สิ่งที่สังเกต:\s*/u, label: "สิ่งที่สังเกต" },
  { pattern: /^ประเมิน:\s*/u, label: "ประเมิน" },
  { pattern: /^แผน(การดูแล)?:\s*/u, label: "แผนการดูแล" },
];

/** จัดรูปข้อความบันทึกคลินิก/SOAP ให้ไม่มีหัวข้ออังกฤษ */
export function presentClinicalNote(text: string | null | undefined): string {
  if (!text) {
    return "";
  }

  return text
    .split(/\n+/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return "";
      }
      for (const section of SECTION_MAP) {
        if (section.pattern.test(trimmed)) {
          const body = trimmed.replace(section.pattern, "").trim();
          return body ? `${section.label}: ${body}` : `${section.label}:`;
        }
      }
      return trimmed;
    })
    .filter(Boolean)
    .join("\n");
}

/** รวมฟอร์ม SOAP เป็นข้อความเก็บในฐานข้อมูล — ใช้หัวข้อไทย */
export function formatSoapNotePayload(input: {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}): { topic: string; action: string; outcome: string } {
  return {
    topic: `นิสิตเล่า: ${input.subjective.trim()}`,
    action: `สิ่งที่สังเกต: ${input.objective.trim()}\nประเมิน: ${input.assessment.trim()}`,
    outcome: `แผนการดูแล: ${input.plan.trim()}`,
  };
}

/** รวมฟอร์มบันทึกผู้เชี่ยวชาญ */
export function formatMhCareNotePayload(input: {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}): { summary: string; interventionPlan: string } {
  return {
    summary: [
      `นิสิตเล่า: ${input.subjective.trim()}`,
      `สิ่งที่สังเกต: ${input.objective.trim()}`,
      `ประเมิน: ${input.assessment.trim()}`,
    ].join("\n\n"),
    interventionPlan: `แผนการดูแล: ${input.plan.trim()}`,
  };
}
