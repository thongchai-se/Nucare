import "../src/lib/env";
import { PrismaClient, SurveyQuestionType, SurveyStatus } from "@prisma/client";

const prisma = new PrismaClient();

const GHQ28_SURVEY_TITLE = "แบบทดสอบสุขภาพทั่วไป Thai GHQ-28";
const GHQ28_SURVEY_DESCRIPTION =
  "แบบสอบถามสภาวะสุขภาพในระยะสองถึงสามสัปดาห์ที่ผ่านมา ระบบตัดคำถามข้อมูลทั่วไปออกเพราะมีข้อมูลนักศึกษาอยู่แล้ว และให้คะแนน GHQ แบบ 0-0-1-1 โดยคะแนนต่ำกว่า 6 อยู่ในเกณฑ์ปกติ คะแนน 6 ขึ้นไปอยู่ในกลุ่มคัดกรองสุขภาพจิตสูง";

type Ghq28Question = {
  type: SurveyQuestionType;
  prompt: string;
  description: string | null;
  isRequired: boolean;
  order: number;
  options?: Array<{
    label: string;
    score: number;
    value: string;
  }>;
  minValue: number | null;
  maxValue: number | null;
};

const createGhq28ChoiceQuestion = (
  order: number,
  prompt: string,
  labels: [string, string, string, string]
): Ghq28Question => ({
  type: SurveyQuestionType.SINGLE_CHOICE,
  prompt,
  description: null,
  isRequired: true,
  order,
  options: labels.map((label, index) => ({
    label,
    score: index < 2 ? 0 : 1,
    value: `ghq28_q${String(order).padStart(2, "0")}_${index + 1}`,
  })),
  minValue: null,
  maxValue: null,
});

const ghq28Questions: Ghq28Question[] = [
  createGhq28ChoiceQuestion(1, "รู้สึกสบายและมีสุขภาพดี", [
    "ดีกว่าปกติ",
    "เหมือนปกติ",
    "แย่กว่าปกติ",
    "แย่กว่าปกติมาก",
  ]),
  createGhq28ChoiceQuestion(2, "รู้สึกต้องการยาบำรุงให้มีกำลังวังชา", [
    "ไม่เลย",
    "ไม่มากกว่าปกติ",
    "ค่อนข้างมากกว่าปกติ",
    "มากกว่าปกติมาก",
  ]),
  createGhq28ChoiceQuestion(3, "รู้สึกทรุดโทรมและสุขภาพไม่ดี", [
    "ไม่เลย",
    "ไม่มากกว่าปกติ",
    "ค่อนข้างมากกว่าปกติ",
    "มากกว่าปกติ",
  ]),
  createGhq28ChoiceQuestion(4, "รู้สึกไม่สบาย", [
    "ไม่เลย",
    "ไม่มากกว่าปกติ",
    "ค่อนข้างมากกว่าปกติ",
    "มากกว่าปกติ",
  ]),
  createGhq28ChoiceQuestion(5, "เจ็บหรือปวดบริเวณศีรษะ", [
    "ไม่เลย",
    "ไม่มากกว่าปกติ",
    "ค่อนข้างมากกว่าปกติ",
    "มากกว่าปกติ",
  ]),
  createGhq28ChoiceQuestion(6, "รู้สึกตึงหรือคล้ายมีแรงกดที่ศีรษะ", [
    "ไม่เลย",
    "ไม่มากกว่าปกติ",
    "ค่อนข้างมากกว่าปกติ",
    "มากกว่าปกติ",
  ]),
  createGhq28ChoiceQuestion(7, "มีอาการวูบร้อนหรือหนาว", [
    "ไม่เลย",
    "ไม่มากกว่าปกติ",
    "ค่อนข้างมากกว่าปกติ",
    "มากกว่าปกติ",
  ]),
  createGhq28ChoiceQuestion(8, "นอนไม่หลับเพราะกังวลใจ", [
    "ไม่เลย",
    "ไม่มากกว่าปกติ",
    "ค่อนข้างมากกว่าปกติ",
    "มากกว่าปกติ",
  ]),
  createGhq28ChoiceQuestion(9, "ไม่สามารถนอนหลับสนิทหลังจากหลับแล้ว", [
    "ไม่เลย",
    "ไม่มากกว่าปกติ",
    "ค่อนข้างมากกว่าปกติ",
    "มากกว่าปกติ",
  ]),
  createGhq28ChoiceQuestion(10, "รู้สึกตึงเครียดอยู่ตลอดเวลา", [
    "ไม่เลย",
    "ไม่มากกว่าปกติ",
    "ค่อนข้างมากกว่าปกติ",
    "มากกว่าปกติ",
  ]),
  createGhq28ChoiceQuestion(11, "รู้สึกหงุดหงิด อารมณ์ไม่ดี", [
    "ไม่เลย",
    "ไม่มากกว่าปกติ",
    "ค่อนข้างมากกว่าปกติ",
    "มากกว่าปกติ",
  ]),
  createGhq28ChoiceQuestion(12, "รู้สึกกลัวหรือตกใจโดยไม่มีเหตุผลสมควร", [
    "ไม่เคย",
    "ไม่มากกว่าปกติ",
    "ค่อนข้างมากกว่าปกติ",
    "มากกว่าปกติ",
  ]),
  createGhq28ChoiceQuestion(13, "รู้สึกเรื่องต่าง ๆ ทับถมจนรับไม่ไหว", [
    "ไม่เลย",
    "ไม่มากกว่าปกติ",
    "ค่อนข้างมากกว่าปกติ",
    "มากกว่าปกติ",
  ]),
  createGhq28ChoiceQuestion(14, "รู้สึกกังวล กระวนกระวาย และเครียดอยู่ตลอดเวลา", [
    "ไม่เลย",
    "ไม่มากกว่าปกติ",
    "ค่อนข้างมากกว่าปกติ",
    "มากกว่าปกติ",
  ]),
  createGhq28ChoiceQuestion(15, "หาอะไรทำให้ตัวเองไม่มีเวลาว่างได้", [
    "มากกว่าปกติ",
    "เหมือนเดิม",
    "ค่อนข้างน้อยกว่าปกติ",
    "น้อยกว่าปกติ",
  ]),
  createGhq28ChoiceQuestion(16, "ทำอะไรช้ากว่าปกติ", [
    "เร็วกว่าปกติ",
    "เหมือนปกติ",
    "ช้ากว่าปกติ",
    "ช้ากว่าปกติมาก",
  ]),
  createGhq28ChoiceQuestion(17, "รู้สึกโดยทั่วไปแล้วทำอะไร ๆ ได้ดี", [
    "ดีกว่าปกติ",
    "เหมือนปกติ",
    "ดีน้อยกว่าปกติ",
    "ดีน้อยกว่าปกติมาก",
  ]),
  createGhq28ChoiceQuestion(18, "พอใจกับการทำงานที่ลุล่วงไป", [
    "มากกว่าปกติ",
    "พอ ๆ กับตามปกติ",
    "น้อยกว่าปกติ",
    "น้อยกว่าปกติมาก",
  ]),
  createGhq28ChoiceQuestion(19, "รู้สึกว่าทำตัวให้เป็นประโยชน์ในเรื่องต่าง ๆ", [
    "มากกว่าปกติ",
    "เหมือนปกติ",
    "น้อยกว่าปกติ",
    "น้อยกว่าปกติมาก",
  ]),
  createGhq28ChoiceQuestion(20, "รู้สึกสามารถตัดสินใจเรื่องต่าง ๆ ได้", [
    "มากกว่าปกติ",
    "เหมือนปกติ",
    "น้อยกว่าปกติ",
    "น้อยกว่าปกติมาก",
  ]),
  createGhq28ChoiceQuestion(21, "สามารถมีความสุขกับกิจกรรมในชีวิตประจำวันได้", [
    "มากกว่าปกติ",
    "เหมือนปกติ",
    "น้อยกว่าปกติ",
    "น้อยกว่าปกติมาก",
  ]),
  createGhq28ChoiceQuestion(22, "คิดว่าตัวเองเป็นคนไร้ค่า", [
    "ไม่เลย",
    "ไม่มากกว่าปกติ",
    "ค่อนข้างมากกว่าปกติ",
    "มากกว่าปกติ",
  ]),
  createGhq28ChoiceQuestion(23, "รู้สึกชีวิตนี้หมดหวังโดยสิ้นเชิง", [
    "ไม่เลย",
    "ไม่มากกว่าปกติ",
    "ค่อนข้างมากกว่าปกติ",
    "มากกว่าปกติมาก",
  ]),
  createGhq28ChoiceQuestion(24, "รู้สึกไม่คุ้มค่าที่จะมีชีวิตอยู่ต่อไป", [
    "ไม่เลย",
    "ไม่มากกว่าปกติ",
    "ค่อนข้างมากกว่าปกติ",
    "มากกว่าปกติมาก",
  ]),
  createGhq28ChoiceQuestion(25, "คิดว่ามีความเป็นไปได้ที่อยากจบชีวิตตัวเอง", [
    "ไม่อย่างแน่นอน",
    "ไม่คิดว่าเป็นอย่างนั้น",
    "มีอยู่บ้างเหมือนกัน",
    "มีแน่ ๆ",
  ]),
  createGhq28ChoiceQuestion(26, "รู้สึกว่าบางครั้งทำอะไรไม่ได้เลยเพราะประสาทตึงเครียดมาก", [
    "ไม่เลย",
    "ไม่มากกว่าปกติ",
    "ค่อนข้างมากกว่าปกติ",
    "มากกว่าปกติมาก",
  ]),
  createGhq28ChoiceQuestion(27, "พบว่าตัวเองรู้สึกอยากตายไปให้พ้น ๆ", [
    "ไม่เลย",
    "ไม่มากกว่าปกติ",
    "ค่อนข้างมากกว่าปกติ",
    "มากกว่าปกติมาก",
  ]),
  createGhq28ChoiceQuestion(28, "พบว่ามีความรู้สึกที่อยากจะทำลายชีวิตตัวเองเข้ามาอยู่ในความคิดเสมอ", [
    "ไม่อย่างแน่นอน",
    "ไม่คิดว่าเป็นอย่างนั้น",
    "มีอยู่เหมือนกัน",
    "มีแน่ ๆ",
  ]),
  {
    type: SurveyQuestionType.TEXTAREA,
    prompt: "นักศึกษาต้องการรับความช่วยเหลือ / ให้คำปรึกษาจากอาจารย์ท่านใดหรือไม่ เรื่องใดโปรดระบุ",
    description: null,
    isRequired: false,
    order: 29,
    minValue: null,
    maxValue: null,
  },
];

const findExistingGhq28Survey = async () => {
  const configuredSurveyId = process.env.GHQ28_SURVEY_ID?.trim();
  if (configuredSurveyId) {
    return prisma.survey.findUnique({
      where: { id: configuredSurveyId },
      include: { _count: { select: { responses: true } } },
    });
  }

  return prisma.survey.findFirst({
    where: {
      OR: [
        { title: GHQ28_SURVEY_TITLE },
        { title: { contains: "GHQ-28" } },
        { title: { contains: "แบบทดสอบสุขภาพทั่วไป" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { responses: true } } },
  });
};

const main = async (): Promise<void> => {
  const existingSurvey = await findExistingGhq28Survey();

  const survey = await prisma.$transaction(async (tx) => {
    const canRewriteExisting = existingSurvey && existingSurvey._count.responses === 0;
    const savedSurvey = canRewriteExisting
      ? await tx.survey.update({
          where: { id: existingSurvey.id },
          data: {
            title: GHQ28_SURVEY_TITLE,
            description: GHQ28_SURVEY_DESCRIPTION,
            status: SurveyStatus.PUBLISHED,
            isActive: true,
            startsAt: null,
            endsAt: null,
          },
        })
      : await tx.survey.create({
          data: {
            title: GHQ28_SURVEY_TITLE,
            description: GHQ28_SURVEY_DESCRIPTION,
            status: SurveyStatus.PUBLISHED,
            isActive: true,
          },
        });

    if (canRewriteExisting) {
      await tx.surveyQuestion.deleteMany({
        where: { surveyId: savedSurvey.id },
      });
    }

    await tx.surveyQuestion.createMany({
      data: ghq28Questions.map((question) => ({
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

    await tx.survey.updateMany({
      where: {
        id: { not: savedSurvey.id },
        status: SurveyStatus.PUBLISHED,
        isActive: true,
      },
      data: { isActive: false },
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
        preservedExistingResponses: Boolean(existingSurvey && existingSurvey._count.responses > 0),
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
