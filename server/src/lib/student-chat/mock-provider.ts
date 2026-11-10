import { evaluateStudentChatGuardrails } from "./guardrails";
import { getStudentChatPersona } from "./personas";
import type { ChatProvider, StudentChatReply, StudentChatReplyInput } from "./types";

const STRESS_HINTS = [/เครียด/, /เหนื่อย/, /มึน/, /กังวล/, /เหงา/, /ร้องไห้/, /นอนไม่หลับ/, /ท้อ/];
const POSITIVE_HINTS = [/ดีขึ้น/, /โอเค/, /สบายใจ/, /ขอบคุณ/, /โล่ง/];

/** สร้างคำตอบโทนเพื่อนภาษาไทยจาก mock (ไม่เรียก LLM) */
const buildSupportiveReply = (
  gender: "male" | "female",
  content: string,
  memorySummary?: string | null
): string => {
  const particle = gender === "female" ? "นะ" : "นะ";
  const remembers = Boolean(memorySummary?.trim());

  if (STRESS_HINTS.some((pattern) => pattern.test(content))) {
    return remembers
      ? gender === "female"
        ? `ยังหนักอยู่เลยสินะ ฟังอยู่ อยากเล่าต่อจากคราวก่อนไหม${particle}`
        : `ยังหนักอยู่เลยสินะ ฟังอยู่ อยากเล่าต่อจากคราวก่อนไหม`
      : gender === "female"
        ? `ฟังแล้วเข้าใจเลยว่าช่วงนี้หนัก อยากเล่ารายละเอียดเพิ่มไหม อยู่ตรงนี้ฟังอยู่`
        : `ฟังแล้วเข้าใจเลยว่าช่วงนี้หนัก อยากเล่ารายละเอียดเพิ่มไหม ฟังอยู่`;
  }

  if (POSITIVE_HINTS.some((pattern) => pattern.test(content))) {
    return gender === "female"
      ? `ดีใจด้วยที่รู้สึกดีขึ้นนะ ถ้าอยากระบายอะไรอีกก็บอกได้เสมอ`
      : `ดีใจด้วยที่รู้สึกดีขึ้นนะ ถ้าอยากระบายอะไรอีกก็บอกได้เสมอ`;
  }

  if (content.length < 12) {
    return gender === "female"
      ? `อืม ได้ยินแล้วนะ เล่าเพิ่มได้อีกไหม ไม่ต้องเรียบร้อยมากก็ได้`
      : `อืม ได้ยินแล้วนะ เล่าเพิ่มได้อีกไหม ไม่ต้องเรียบร้อยมากก็ได้`;
  }

  if (remembers) {
    return gender === "female"
      ? `ขอบคุณที่เล่าต่อนะ ฟังแล้วเห็นภาพขึ้น ตอนนี้ใจเอนไปทางไหนที่สุด`
      : `ขอบคุณที่เล่าต่อนะ ฟังแล้วเห็นภาพขึ้น ตอนนี้ใจเอนไปทางไหนที่สุด`;
  }

  return gender === "female"
    ? `ขอบคุณที่เล่าให้นะ ฟังแล้วเห็นภาพขึ้น ตอนนี้ใจรู้สึกยังไงที่สุดหลังเล่าจบ`
    : `ขอบคุณที่เล่าให้นะ ฟังแล้วเห็นภาพขึ้น ตอนนี้ใจรู้สึกยังไงที่สุดหลังเล่าจบ${particle === "นะ" ? "" : ""}`;
};

/** สร้างผู้ให้บริการแชทแบบ mock พร้อมกันการบ้านและโทนตาม persona */
export const createMockChatProvider = (): ChatProvider => ({
  async reply(input: StudentChatReplyInput): Promise<StudentChatReply> {
    const persona = getStudentChatPersona(input.personaId);
    if (!persona) {
      return {
        content: "ขอโทษนะ เลือกเพื่อนคุยไม่ถูกต้อง ลองเลือกใหม่ได้ไหม",
        blockedReason: null,
        crisisSuggested: false,
      };
    }

    const guard = evaluateStudentChatGuardrails(input.content);
    if (guard.blocked) {
      return {
        content: guard.crisis
          ? `${persona.homeworkRefusal}\n\n${persona.crisisNudge}`
          : persona.homeworkRefusal,
        blockedReason: "homework",
        crisisSuggested: guard.crisis,
      };
    }

    const supportive = buildSupportiveReply(persona.gender, input.content, input.memorySummary);
    if (guard.crisis) {
      return {
        content: `${supportive}\n\n${persona.crisisNudge}`,
        blockedReason: null,
        crisisSuggested: true,
      };
    }

    return {
      content: supportive,
      blockedReason: null,
      crisisSuggested: false,
    };
  },
});
