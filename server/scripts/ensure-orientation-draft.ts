import "../src/lib/env";
import { PrismaClient, SurveyQuestionType, SurveyStatus } from "@prisma/client";

const prisma = new PrismaClient();

const ORIENTATION_SURVEY_TITLE = "แบบสอบถามปฐมนิเทศนักศึกษาใหม่";

const ORIENTATION_SURVEY_DESCRIPTION =
  "ฉบับร่างสำหรับเก็บข้อมูลช่วงปฐมนิเทศวันที่ 20 มิถุนายน 2026 ผู้ดูแลระบบสามารถแก้คำถามและเปิดเผยแพร่ได้จากเมนูแบบสอบถาม";

const orientationQuestions = [
  {
    type: SurveyQuestionType.SINGLE_CHOICE,
    prompt: "เข้าร่วมกิจกรรมปฐมนิเทศรอบใด",
    description: "แก้ตัวเลือกได้ตามรอบกิจกรรมจริง",
    isRequired: true,
    order: 1,
    options: [
      { label: "รอบเช้า", value: "morning" },
      { label: "รอบบ่าย", value: "afternoon" },
    ],
    minValue: null,
    maxValue: null,
  },
  {
    type: SurveyQuestionType.SINGLE_CHOICE,
    prompt: "ช่องทางติดต่อที่สะดวกที่สุด",
    description: null,
    isRequired: true,
    order: 2,
    options: [
      { label: "โทรศัพท์", value: "phone" },
      { label: "LINE", value: "line" },
      { label: "อีเมล", value: "email" },
    ],
    minValue: null,
    maxValue: null,
  },
  {
    type: SurveyQuestionType.MULTIPLE_CHOICE,
    prompt: "หัวข้อที่ต้องการข้อมูลเพิ่มเติมหลังปฐมนิเทศ",
    description: null,
    isRequired: false,
    order: 3,
    options: [
      { label: "การลงทะเบียนเรียน", value: "registration" },
      { label: "ทุนการศึกษา", value: "scholarship" },
      { label: "หอพัก/การเดินทาง", value: "housing_transport" },
      { label: "การปรับตัวในคณะ", value: "adjustment" },
    ],
    minValue: null,
    maxValue: null,
  },
  {
    type: SurveyQuestionType.SCALE,
    prompt: "ความพร้อมในการเริ่มเรียนในคณะ",
    description: "1 = ยังไม่พร้อม, 5 = พร้อมมาก",
    isRequired: true,
    order: 4,
    options: undefined,
    minValue: 1,
    maxValue: 5,
  },
  {
    type: SurveyQuestionType.TEXTAREA,
    prompt: "สิ่งที่คาดหวังจากการเรียนและการใช้ชีวิตในคณะ",
    description: null,
    isRequired: false,
    order: 5,
    options: undefined,
    minValue: null,
    maxValue: null,
  },
  {
    type: SurveyQuestionType.SINGLE_CHOICE,
    prompt: "ต้องการให้เจ้าหน้าที่ติดต่อเพิ่มเติมหลังปฐมนิเทศหรือไม่",
    description: null,
    isRequired: true,
    order: 6,
    options: [
      { label: "ต้องการ", value: "yes" },
      { label: "ไม่ต้องการ", value: "no" },
    ],
    minValue: null,
    maxValue: null,
  },
];

const looksLikeCorruptedDraft = (title: string): boolean =>
  /^\?+$/.test(title.trim()) || title.includes("????");

const findTargetSurvey = async () => {
  const configuredSurveyId = process.env.ORIENTATION_SURVEY_ID?.trim();
  if (configuredSurveyId) {
    return prisma.survey.findUnique({
      where: { id: configuredSurveyId },
      include: { _count: { select: { responses: true } } },
    });
  }

  const existing = await prisma.survey.findFirst({
    where: { title: ORIENTATION_SURVEY_TITLE },
    include: { _count: { select: { responses: true } } },
  });

  if (existing) {
    return existing;
  }

  return prisma.survey.findFirst({
    where: { title: { contains: "?" } },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { responses: true } } },
  });
};

const main = async (): Promise<void> => {
  const targetSurvey = await findTargetSurvey();

  if (targetSurvey && targetSurvey._count.responses > 0) {
    throw new Error(
      `Survey ${targetSurvey.id} already has responses. Refusing to rewrite draft questions.`
    );
  }

  if (targetSurvey && !looksLikeCorruptedDraft(targetSurvey.title) && targetSurvey.title !== ORIENTATION_SURVEY_TITLE) {
    throw new Error(
      `Survey ${targetSurvey.id} does not look like the orientation draft. Set ORIENTATION_SURVEY_ID to override.`
    );
  }

  const survey = await prisma.$transaction(async (tx) => {
    const savedSurvey = targetSurvey
      ? await tx.survey.update({
          where: { id: targetSurvey.id },
          data: {
            title: ORIENTATION_SURVEY_TITLE,
            description: ORIENTATION_SURVEY_DESCRIPTION,
            status: SurveyStatus.DRAFT,
            isActive: false,
            startsAt: null,
            endsAt: null,
          },
        })
      : await tx.survey.create({
          data: {
            title: ORIENTATION_SURVEY_TITLE,
            description: ORIENTATION_SURVEY_DESCRIPTION,
            status: SurveyStatus.DRAFT,
            isActive: false,
          },
        });

    await tx.surveyQuestion.deleteMany({
      where: { surveyId: savedSurvey.id },
    });

    await tx.surveyQuestion.createMany({
      data: orientationQuestions.map((question) => ({
        surveyId: savedSurvey.id,
        type: question.type,
        prompt: question.prompt,
        description: question.description,
        isRequired: question.isRequired,
        order: question.order,
        options: question.options,
        minValue: question.minValue,
        maxValue: question.maxValue,
      })),
    });

    return tx.survey.findUniqueOrThrow({
      where: { id: savedSurvey.id },
      include: {
        _count: {
          select: {
            questions: true,
            responses: true,
          },
        },
      },
    });
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        survey: {
          id: survey.id,
          title: survey.title,
          status: survey.status,
          isActive: survey.isActive,
          questionCount: survey._count.questions,
          responseCount: survey._count.responses,
        },
      },
      null,
      2
    )
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
