import {
  Prisma,
  SurveyAudienceType,
  SurveyInstrumentCode,
  SurveyQuestionType,
  SurveyStatus,
  SurveyVersionStatus,
} from "@prisma/client";
import { prisma } from "./prisma";
import {
  parseSurveyScoringRules,
  resolveRiskCutoffs,
  surveyScoringRulesSchema,
  type SurveyScoringRules,
} from "./survey-scoring";
import { serializeStudentSurveyQuestions } from "./survey-student-serialize";

type Db = Prisma.TransactionClient | typeof prisma;

/** ฟิลด์คำถามที่ใช้เทียบ/คัดลอกระหว่าง SurveyQuestion กับ SurveyVersionQuestion */
export type VersionableQuestion = {
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

export type SnapshotQuestionRow = Omit<VersionableQuestion, "id"> & {
  sourceQuestionId: string | null;
};

export class SurveyScoringRulesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SurveyScoringRulesError";
  }
}

/** คืนเลขเวอร์ชันถัดไป = สูงสุดที่มี + 1 (เริ่มที่ 1 ถ้ายังไม่มี) — O(n) ตามจำนวนเวอร์ชัน */
export function nextVersionNumber(existingVersions: readonly number[]): number {
  return existingVersions.reduce((max, value) => (value > max ? value : max), 0) + 1;
}

/**
 * ตรวจและทำให้กฎคะแนนที่แอดมินส่งมาเป็นรูปแบบมาตรฐาน; undefined/null คืน null และโยน SurveyScoringRulesError ถ้าไม่ถูกต้อง
 */
export function validateScoringRules(raw: unknown): SurveyScoringRules | null {
  if (raw === undefined || raw === null) {
    return null;
  }

  const parsed = surveyScoringRulesSchema.safeParse(raw);
  if (!parsed.success) {
    throw new SurveyScoringRulesError(
      parsed.error.issues.map((issue) => issue.message).join("; ") || "Invalid scoring rules"
    );
  }

  return parsed.data;
}

/** แปลงคำถามใน Survey เป็นแถว snapshot (เก็บ id เดิมเป็น sourceQuestionId) โดยเรียงตาม order */
export function toSnapshotQuestionRows(questions: readonly VersionableQuestion[]): SnapshotQuestionRow[] {
  return [...questions]
    .sort((a, b) => a.order - b.order)
    .map((question) => ({
      sourceQuestionId: question.id,
      type: question.type,
      prompt: question.prompt,
      description: question.description,
      isRequired: question.isRequired,
      order: question.order,
      options: question.options,
      minValue: question.minValue,
      maxValue: question.maxValue,
    }));
}

/** แปลง JSON ให้ key เรียงคงที่ เพื่อเทียบ options โดยไม่ขึ้นกับลำดับ key */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value ?? null);
}

/**
 * เทียบว่า snapshot ของเวอร์ชันยังตรงกับคำถามใน Survey ปัจจุบันหรือไม่ (ลำดับ/ชนิด/ข้อความ/ตัวเลือก/คะแนน)
 * ใช้ตัดสินว่าต้องเผยแพร่เวอร์ชันใหม่ก่อนผูกกับคลื่น — O(n log n) จากการเรียงตาม order
 */
export function isSnapshotCurrent(
  snapshot: readonly SnapshotQuestionRow[],
  current: readonly VersionableQuestion[]
): boolean {
  if (snapshot.length !== current.length) {
    return false;
  }

  const left = [...snapshot].sort((a, b) => a.order - b.order);
  const right = toSnapshotQuestionRows(current);

  return left.every((row, index) => {
    const other = right[index];
    return (
      row.sourceQuestionId === other.sourceQuestionId &&
      row.type === other.type &&
      row.prompt === other.prompt &&
      (row.description ?? null) === (other.description ?? null) &&
      row.isRequired === other.isRequired &&
      row.order === other.order &&
      (row.minValue ?? null) === (other.minValue ?? null) &&
      (row.maxValue ?? null) === (other.maxValue ?? null) &&
      stableStringify(row.options ?? null) === stableStringify(other.options ?? null)
    );
  });
}

/** Serialize คำถามเวอร์ชัน/ร่างให้เป็นมุมมองนักศึกษา (ตัดคะแนนในตัวเลือกออก) สำหรับพรีวิวของแอดมิน */
export function serializeVersionQuestionsForPreview(questions: readonly VersionableQuestion[]) {
  return serializeStudentSurveyQuestions(
    [...questions].sort((a, b) => a.order - b.order)
  );
}

/** สรุปเวอร์ชันสำหรับรายการฝั่งแอดมิน (ไม่รวมตัวคำถาม) */
export function serializeVersionSummary(version: {
  id: string;
  version: number;
  status: SurveyVersionStatus;
  title: string;
  instrumentCode: SurveyInstrumentCode;
  scoringRulesJson: Prisma.JsonValue | null;
  publishedAt: Date | null;
  createdAt: Date;
  _count?: { questions?: number; waves?: number; responses?: number };
}) {
  return {
    id: version.id,
    version: version.version,
    status: version.status,
    title: version.title,
    instrumentCode: version.instrumentCode,
    scoringRules: parseSurveyScoringRules(version.scoringRulesJson),
    publishedAt: version.publishedAt,
    createdAt: version.createdAt,
    questionCount: version._count?.questions ?? 0,
    waveCount: version._count?.waves ?? 0,
    responseCount: version._count?.responses ?? 0,
  };
}

/** สร้าง snapshot กฎคะแนนที่ใช้จริงตอนส่งคำตอบ เพื่อเก็บใน SurveyResponse.scoringSnapshot */
export function buildScoringSnapshot(input: {
  versionId: string | null;
  version: number | null;
  instrumentCode: SurveyInstrumentCode;
  rules: SurveyScoringRules | null;
}): Prisma.InputJsonObject {
  const cutoffs = resolveRiskCutoffs(input.rules, input.instrumentCode);
  return {
    versionId: input.versionId,
    version: input.version,
    instrumentCode: input.instrumentCode,
    riskCutoffs: { medium: cutoffs.medium, high: cutoffs.high },
    customCutoffsApplied:
      input.instrumentCode !== SurveyInstrumentCode.GHQ28 && Boolean(input.rules?.riskCutoffs),
    ...(input.rules?.maxScore !== undefined ? { maxScore: input.rules.maxScore } : {}),
    ...(input.rules?.note ? { note: input.rules.note } : {}),
  };
}

/**
 * สร้างเวอร์ชันถัดไปของแบบประเมินพร้อม snapshot คำถามปัจจุบันจาก SurveyQuestion (ค่าเริ่มต้นเป็น DRAFT);
 * เขียนฐานข้อมูลผ่าน tx ที่ส่งมา
 */
export async function snapshotQuestionsFromSurvey(
  surveyId: string,
  tx: Db,
  options: {
    status?: SurveyVersionStatus;
    actorUserId?: string | null;
    scoringRules?: SurveyScoringRules | null;
  } = {}
) {
  const survey = await tx.survey.findUnique({
    where: { id: surveyId },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!survey) {
    throw new Error("Survey not found");
  }
  if (survey.questions.length === 0) {
    throw new Error("Survey has no questions to snapshot");
  }

  const existing = await tx.surveyVersion.findMany({
    where: { surveyId },
    select: { version: true },
  });
  const status = options.status ?? SurveyVersionStatus.DRAFT;
  const rows = toSnapshotQuestionRows(survey.questions);

  return tx.surveyVersion.create({
    data: {
      surveyId,
      version: nextVersionNumber(existing.map((row) => row.version)),
      status,
      title: survey.title,
      description: survey.description,
      instrumentCode: survey.instrumentCode,
      scoringRulesJson: options.scoringRules ?? Prisma.JsonNull,
      publishedAt: status === SurveyVersionStatus.PUBLISHED ? new Date() : null,
      createdById: options.actorUserId ?? null,
      questions: {
        create: rows.map((row) => ({
          ...row,
          options: row.options === null ? Prisma.JsonNull : (row.options as Prisma.InputJsonValue),
        })),
      },
    },
  });
}

/** ดึงเวอร์ชัน PUBLISHED ล่าสุดของแบบประเมิน (พร้อมคำถามเรียงตาม order) หรือ null ถ้ายังไม่มี */
export async function getLatestPublishedVersion(surveyId: string, db: Db = prisma) {
  return db.surveyVersion.findFirst({
    where: { surveyId, status: SurveyVersionStatus.PUBLISHED },
    orderBy: { version: "desc" },
    include: { questions: { orderBy: { order: "asc" } } },
  });
}

/**
 * เผยแพร่เวอร์ชันใหม่: ถ้ามีร่างค้างอยู่จะเปลี่ยนร่างเป็น PUBLISHED ไม่เช่นนั้น snapshot จาก SurveyQuestion แล้วเผยแพร่
 * scoringRules ที่ไม่ส่ง (undefined) จะสืบทอดจากเวอร์ชันเผยแพร่ล่าสุด ส่ง null เพื่อล้างกฎ; ทำใน transaction เดียว
 */
export async function publishSurveyVersion(
  surveyId: string,
  actorUserId: string | null | undefined,
  scoringRules?: unknown | null,
  db: Db = prisma
) {
  const run = async (tx: Db) => {
    const validated = scoringRules === undefined ? undefined : validateScoringRules(scoringRules);

    let inherited: SurveyScoringRules | null = null;
    if (validated === undefined) {
      const latest = await tx.surveyVersion.findFirst({
        where: { surveyId, status: SurveyVersionStatus.PUBLISHED },
        orderBy: { version: "desc" },
        select: { scoringRulesJson: true },
      });
      inherited = parseSurveyScoringRules(latest?.scoringRulesJson);
    }
    const rules = validated === undefined ? inherited : validated;

    const draft = await tx.surveyVersion.findFirst({
      where: { surveyId, status: SurveyVersionStatus.DRAFT },
      orderBy: { version: "desc" },
    });

    if (draft) {
      // ไม่ส่งกฎมา = คงกฎที่ร่างมีอยู่เดิม (ไม่ทับด้วยค่าที่สืบทอด)
      const draftRules =
        validated === undefined ? (parseSurveyScoringRules(draft.scoringRulesJson) ?? rules) : validated;
      return tx.surveyVersion.update({
        where: { id: draft.id },
        data: {
          status: SurveyVersionStatus.PUBLISHED,
          publishedAt: new Date(),
          scoringRulesJson: draftRules ?? Prisma.JsonNull,
          createdById: draft.createdById ?? actorUserId ?? null,
        },
      });
    }

    return snapshotQuestionsFromSurvey(surveyId, tx, {
      status: SurveyVersionStatus.PUBLISHED,
      actorUserId,
      scoringRules: rules,
    });
  };

  if ("$transaction" in db) {
    return db.$transaction((tx) => run(tx));
  }
  return run(db);
}

/**
 * คืนเวอร์ชันที่ควรผูกกับคลื่น: ใช้เวอร์ชันเผยแพร่ล่าสุดถ้า snapshot ยังตรงกับคำถามปัจจุบัน
 * ถ้าไม่มี/คำถามถูกแก้หลังเผยแพร่ จะเผยแพร่เวอร์ชันใหม่ให้อัตโนมัติ (ต้องเรียกภายใน tx ของการสร้าง/เปิดคลื่น)
 */
export async function ensureVersionForWave(
  surveyId: string,
  actorUserId: string | null | undefined,
  tx: Prisma.TransactionClient
) {
  const latest = await getLatestPublishedVersion(surveyId, tx);
  const questions = await tx.surveyQuestion.findMany({ where: { surveyId }, orderBy: { order: "asc" } });

  if (latest && isSnapshotCurrent(latest.questions, questions)) {
    return latest;
  }

  return publishSurveyVersion(surveyId, actorUserId, undefined, tx);
}

const COPY_SUFFIX = " (สำเนา)";
const MAX_TITLE_LENGTH = 200;

/** ตั้งชื่อสำเนา: ต่อท้าย " (สำเนา)" และตัดชื่อเดิมไม่ให้เกินความยาวสูงสุด */
export function buildDuplicateTitle(title: string): string {
  const base = title.trim().slice(0, MAX_TITLE_LENGTH - COPY_SUFFIX.length);
  return `${base}${COPY_SUFFIX}`;
}

/**
 * ทำสำเนาแบบประเมิน (คำถาม + เกณฑ์กลุ่มเป้าหมาย) เป็นแบบใหม่สถานะ DRAFT ไม่เปิดใช้งาน
 * ไม่คัดลอกคลื่น คำตอบ หรือวันที่เริ่ม/สิ้นสุด; คืน null ถ้าไม่พบแบบต้นทาง
 */
export async function duplicateSurvey(
  surveyId: string,
  actorUserId: string | null | undefined,
  db: typeof prisma = prisma
) {
  return db.$transaction(async (tx) => {
    const source = await tx.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: { orderBy: { order: "asc" } },
        eligibilityRule: true,
      },
    });
    if (!source) {
      return null;
    }

    const copy = await tx.survey.create({
      data: {
        title: buildDuplicateTitle(source.title),
        description: source.description,
        status: SurveyStatus.DRAFT,
        isActive: false,
        startsAt: null,
        endsAt: null,
        frequency: source.frequency,
        scheduleEvery: source.scheduleEvery,
        scheduleUnit: source.scheduleUnit,
        audienceType: source.audienceType,
        instrumentCode: source.instrumentCode,
        createdById: actorUserId ?? null,
        questions: {
          create: source.questions.map((question) => ({
            type: question.type,
            prompt: question.prompt,
            description: question.description,
            isRequired: question.isRequired,
            order: question.order,
            options:
              question.options === null ? Prisma.JsonNull : (question.options as Prisma.InputJsonValue),
            minValue: question.minValue,
            maxValue: question.maxValue,
          })),
        },
      },
    });

    if (source.eligibilityRule && source.audienceType === SurveyAudienceType.RULE_BASED) {
      await tx.surveyEligibilityRule.create({
        data: {
          surveyId: copy.id,
          priorRiskLevels: source.eligibilityRule.priorRiskLevels,
          wellnessSignalCodes: source.eligibilityRule.wellnessSignalCodes,
          studyYears: source.eligibilityRule.studyYears,
          sections: source.eligibilityRule.sections,
        },
      });
    }

    return copy;
  });
}
