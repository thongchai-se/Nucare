import { Prisma, SurveyQuestionType } from "@prisma/client";

type QuestionRow = {
  id: string;
  type: SurveyQuestionType;
  prompt: string;
  description: string | null;
  isRequired: boolean;
  order: number;
  options: Prisma.JsonValue | null;
  minValue: number | null;
  maxValue: number | null;
};

/** ตัดคะแนนออกจากตัวเลือกก่อนส่งให้นักศึกษา — กัน leak น้ำหนักคำตอบ */
export function stripOptionScores(options: Prisma.JsonValue | null): Array<{
  label: string;
  value: string;
}> {
  if (!Array.isArray(options)) {
    return [];
  }

  return options.flatMap((option) => {
    if (typeof option !== "object" || option === null || Array.isArray(option)) {
      return [];
    }

    const record = option as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label.trim() : "";
    const value = typeof record.value === "string" ? record.value.trim() : "";
    return label && value ? [{ label, value }] : [];
  });
}

/** Serialize คำถามสำหรับนักศึกษา (ไม่มีคะแนนใน options) */
export function serializeStudentSurveyQuestions(questions: QuestionRow[]) {
  return questions.map((question) => ({
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    description: question.description,
    isRequired: question.isRequired,
    order: question.order,
    options: stripOptionScores(question.options),
    minValue: question.minValue,
    maxValue: question.maxValue,
  }));
}

/** Payload แบบประเมินที่นักศึกษามองเห็น — ไม่มี eligibility / risk / wave targeting */
export function serializeStudentFacingSurvey(input: {
  id: string;
  title: string;
  description: string | null;
  questions: QuestionRow[];
  waveId: string;
  waveLabel: string;
  closesAt: Date | null;
}) {
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    waveId: input.waveId,
    waveLabel: input.waveLabel,
    closesAt: input.closesAt,
    questions: serializeStudentSurveyQuestions(input.questions),
  };
}
