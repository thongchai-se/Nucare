"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlignLeft,
  Archive,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  Download,
  Hash,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Type,
  Users,
  X,
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { DeleteSurveyDialog } from "@/components/delete-survey-dialog";
import { RoleToast, type RoleToastTone } from "@/components/role-toast";
import { useAuth } from "@/context/auth.context";
import api from "@/lib/axios";
import { downloadCsv, pushCsvSection, pushKeyValueRows } from "@/lib/csv-export";
import type {
  Ghq28DistressLevel,
  Survey,
  SurveyQuestion,
  SurveyQuestionOption,
  SurveyQuestionType,
  SurveyRiskLevel,
  SurveyResponseRow,
  SurveyStatus,
} from "@/types/survey";

type SurveyQuestionForm = Omit<SurveyQuestion, "id" | "order"> & {
  clientId: string;
  id?: string;
  order?: number;
};

type SurveyForm = {
  id?: string;
  title: string;
  description: string;
  status: SurveyStatus;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  questions: SurveyQuestionForm[];
};

type SurveysResponse = {
  surveys: Survey[];
};

type SurveyResponse = {
  survey: Survey;
};

type SurveyResponsesResponse = {
  survey: Survey;
  responses: SurveyResponseRow[];
};

type ToastState = {
  description: string;
  open: boolean;
  title: string;
  tone: RoleToastTone;
};

const questionTypeLabels: Record<SurveyQuestionType, string> = {
  TEXT: "คำตอบสั้น",
  TEXTAREA: "คำตอบยาว",
  SINGLE_CHOICE: "เลือกได้ข้อเดียว",
  MULTIPLE_CHOICE: "เลือกได้หลายข้อ",
  SCALE: "คะแนน/ระดับ",
  NUMBER: "ตัวเลข",
  DATE: "วันที่",
};

const statusLabels: Record<SurveyStatus, string> = {
  DRAFT: "ฉบับร่าง",
  PUBLISHED: "เผยแพร่",
  ARCHIVED: "เก็บถาวร",
};

const surveyRiskMeta: Record<SurveyRiskLevel, { className: string; label: string }> = {
  NORMAL: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    label: "ปกติ",
  },
  MEDIUM: {
    className: "border-amber-200 bg-amber-50 text-amber-700",
    label: "เฝ้าระวัง",
  },
  HIGH: {
    className: "border-red-200 bg-red-50 text-red-700",
    label: "คัดกรองสูง",
  },
};

const ghq28DistressMeta: Record<Ghq28DistressLevel, { className: string; label: string }> = {
  NORMAL: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    label: "ปกติ (Normal)",
  },
  MILD: {
    className: "border-sky-200 bg-sky-50 text-sky-700",
    label: "ปัญหาสุขภาพจิตระดับน้อย (Mild Distress)",
  },
  MODERATE: {
    className: "border-amber-200 bg-amber-50 text-amber-700",
    label: "ปัญหาสุขภาพจิตระดับปานกลาง (Moderate Distress)",
  },
  SEVERE: {
    className: "border-red-200 bg-red-50 text-red-700",
    label: "ปัญหาสุขภาพจิตระดับรุนแรง (Severe Distress)",
  },
};

const isGhq28SurveyTitle = (title: string): boolean =>
  /GHQ\s*-?\s*28/i.test(title) || title.includes("แบบทดสอบสุขภาพทั่วไป");

const getGhq28DistressLevelFromScore = (score: number | null): Ghq28DistressLevel | null => {
  if (score === null) {
    return null;
  }

  if (score <= 14) {
    return "NORMAL";
  }

  if (score <= 28) {
    return "MILD";
  }

  if (score <= 42) {
    return "MODERATE";
  }

  return "SEVERE";
};

const getResponseDistressLevel = (response: SurveyResponseRow): Ghq28DistressLevel | null =>
  response.distressLevel ?? getGhq28DistressLevelFromScore(response.totalScore);

const formatSurveyScore = (response: SurveyResponseRow): string => {
  if (response.totalScore === null || response.maxScore <= 0) {
    return "-";
  }

  return `${response.totalScore.toLocaleString()} / ${response.maxScore.toLocaleString()}`;
};

const formatSurveyPercent = (response: SurveyResponseRow): string =>
  response.scorePercent === null ? "-" : `${response.scorePercent.toLocaleString()}%`;

const questionTypeQuickActions = [
  { type: "TEXT", label: "คำตอบสั้น", icon: Type },
  { type: "TEXTAREA", label: "คำตอบยาว", icon: AlignLeft },
  { type: "SINGLE_CHOICE", label: "เลือกข้อเดียว", icon: CheckCircle2 },
  { type: "MULTIPLE_CHOICE", label: "เลือกหลายข้อ", icon: CheckSquare },
  { type: "SCALE", label: "คะแนน", icon: SlidersHorizontal },
  { type: "NUMBER", label: "ตัวเลข", icon: Hash },
  { type: "DATE", label: "วันที่", icon: CalendarDays },
] satisfies Array<{
  icon: typeof Type;
  label: string;
  type: SurveyQuestionType;
}>;

const newClientId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const defaultOptions = (): SurveyQuestionOption[] => [
  { label: "ใช่", score: 1, value: "yes" },
  { label: "ไม่ใช่", score: 0, value: "no" },
];

const createQuestion = (type: SurveyQuestionType = "TEXT"): SurveyQuestionForm => ({
  clientId: newClientId(),
  type,
  prompt: "",
  description: null,
  isRequired: true,
  options:
    type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE"
      ? defaultOptions()
      : [],
  minValue: type === "SCALE" ? 1 : null,
  maxValue: type === "SCALE" ? 5 : null,
});

const createGhq28ChoiceQuestion = (
  order: number,
  prompt: string,
  labels: [string, string, string, string]
): SurveyQuestionForm => ({
  ...createQuestion("SINGLE_CHOICE"),
  prompt,
  order,
  options: labels.map((label, index) => ({
    label,
    score: index,
    value: `ghq28_q${String(order).padStart(2, "0")}_${index + 1}`,
  })),
});

const createDefaultSurveyForm = (): SurveyForm => ({
  title: "แบบทดสอบสุขภาพทั่วไป Thai GHQ-28",
  description: "แบบสอบถามสภาวะสุขภาพในระยะสองถึงสามสัปดาห์ที่ผ่านมา ใช้การให้คะแนน Likert 0-1-2-3 (คะแนนรวม 0-84) คะแนนตั้งแต่ 24 ขึ้นไปถือว่าเริ่มมีภาวะความเครียดหรือความผิดปกติ และตัดคำถามข้อมูลทั่วไปออกเพราะระบบมีข้อมูลนักศึกษาอยู่แล้ว",
  status: "DRAFT",
  isActive: false,
  startsAt: "",
  endsAt: "",
  questions: [
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
      ...createQuestion("TEXTAREA"),
      prompt: "นักศึกษาต้องการรับความช่วยเหลือ / ให้คำปรึกษาจากอาจารย์ท่านใดหรือไม่ เรื่องใดโปรดระบุ",
      isRequired: false,
      order: 29,
    },
  ],
});

const formatDateTimeInput = (value: string | null): string => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 16);
};

const formatThaiDateTime = (value: string | null): string => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const surveyToForm = (survey: Survey): SurveyForm => ({
  id: survey.id,
  title: survey.title,
  description: survey.description || "",
  status: survey.status,
  isActive: survey.isActive,
  startsAt: formatDateTimeInput(survey.startsAt),
  endsAt: formatDateTimeInput(survey.endsAt),
  questions: survey.questions.map((question) => ({
    ...question,
    clientId: question.id,
    description: question.description || "",
    options: question.options || [],
  })),
});

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
  ) {
    return (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
};

const buildSurveyPayload = (form: SurveyForm) => ({
  title: form.title.trim(),
  description: form.description.trim(),
  status: form.isActive ? "PUBLISHED" : form.status,
  isActive: form.isActive,
  startsAt: form.startsAt || null,
  endsAt: form.endsAt || null,
  questions: form.questions.map((question, index) => ({
    id: question.id,
    type: question.type,
    prompt: question.prompt.trim(),
    description: question.description?.trim() || null,
    isRequired: question.isRequired,
    order: index + 1,
    options:
      question.type === "SINGLE_CHOICE" || question.type === "MULTIPLE_CHOICE"
        ? question.options.map((option) => ({
            label: option.label.trim(),
            score: option.score ?? null,
            value: option.value.trim(),
          }))
        : undefined,
    minValue:
      question.type === "SCALE" || question.type === "NUMBER"
        ? question.minValue
        : null,
    maxValue:
      question.type === "SCALE" || question.type === "NUMBER"
        ? question.maxValue
        : null,
  })),
});

export default function AdminSurveysPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [form, setForm] = useState<SurveyForm>(() => createDefaultSurveyForm());
  const [responses, setResponses] = useState<SurveyResponseRow[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [openMenuSurveyId, setOpenMenuSurveyId] = useState<string | null>(null);
  const [togglingSurveyId, setTogglingSurveyId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>({
    open: false,
    title: "",
    description: "",
    tone: "success",
  });
  const [toastKey, setToastKey] = useState(0);
  const [downloadedSurveyIds, setDownloadedSurveyIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"active" | "archived">("active");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [activeQuestionClientId, setActiveQuestionClientId] = useState<string | null>(
    () => form.questions[0]?.clientId || null
  );

  const isAdmin = Boolean(user?.roles?.includes("ADMIN") || user?.role === "ADMIN");

  const selectedSurvey = useMemo(
    () => surveys.find((survey) => survey.id === form.id) || null,
    [form.id, surveys]
  );

  const activeQuestion = useMemo(
    () => form.questions.find((question) => question.clientId === activeQuestionClientId) || null,
    [activeQuestionClientId, form.questions]
  );

  const scoredResponses = useMemo(
    () => responses.filter((response) => response.totalScore !== null && response.maxScore > 0),
    [responses]
  );

  const averageScore = useMemo(() => {
    if (scoredResponses.length === 0) {
      return null;
    }

    const total = scoredResponses.reduce((sum, response) => sum + (response.totalScore ?? 0), 0);
    return total / scoredResponses.length;
  }, [scoredResponses]);

  const ghq28DistressCounts = useMemo(() => {
    const counts: Record<Ghq28DistressLevel, number> = {
      NORMAL: 0,
      MILD: 0,
      MODERATE: 0,
      SEVERE: 0,
    };

    for (const response of responses) {
      const level = getResponseDistressLevel(response);
      if (level) {
        counts[level] += 1;
      }
    }

    return counts;
  }, [responses]);

  const highRiskResponseCount = useMemo(
    () => responses.filter((response) => response.riskLevel === "HIGH").length,
    [responses]
  );

  const isCurrentSurveyGhq28 = isGhq28SurveyTitle(form.title);

  const activeSurveys = useMemo(
    () => surveys.filter((survey) => survey.status !== "ARCHIVED"),
    [surveys]
  );

  const archivedSurveys = useMemo(
    () => surveys.filter((survey) => survey.status === "ARCHIVED"),
    [surveys]
  );

  const displaySurveys = viewMode === "archived" ? archivedSurveys : activeSurveys;

  const showToast = useCallback((title: string, description = "", tone: RoleToastTone = "success") => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastKey((k) => k + 1);
    setToast({ open: true, title, description, tone });
    toastTimerRef.current = window.setTimeout(() => {
      setToast((current) => ({ ...current, open: false }));
    }, 3600);
  }, []);

  const closeToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast((current) => ({ ...current, open: false }));
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  const loadSurveyDetail = useCallback(async (surveyId: string) => {
    const [surveyResponse, responsesResponse] = await Promise.all([
      api.get<SurveyResponse>(`/api/admin/surveys/${surveyId}`),
      api.get<SurveyResponsesResponse>(`/api/admin/surveys/${surveyId}/responses`),
    ]);

    const nextForm = surveyToForm(surveyResponse.data.survey);
    setForm(nextForm);
    setActiveQuestionClientId(nextForm.questions[0]?.clientId || null);
    setResponses(responsesResponse.data.responses);
  }, []);

  const fetchSurveys = useCallback(async () => {
    setLoadingData(true);
    setServerError("");

    try {
      const response = await api.get<SurveysResponse>("/api/admin/surveys");
      setSurveys(response.data.surveys);
    } catch (error) {
      setServerError(getErrorMessage(error, "ไม่สามารถโหลดแบบสอบถามได้"));
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && isAdmin) {
      void fetchSurveys();
    }
  }, [fetchSurveys, isAdmin, loading]);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const scrollEditorIntoView = () => {
    window.setTimeout(() => {
      document.getElementById("survey-question-editor")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 60);
  };

  const focusQuestion = (clientId: string) => {
    setActiveQuestionClientId(clientId);
    scrollEditorIntoView();
  };

  const updateQuestion = (clientId: string, nextQuestion: Partial<SurveyQuestionForm>) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.clientId === clientId ? { ...question, ...nextQuestion } : question
      ),
    }));
  };

  const changeQuestionType = (clientId: string, type: SurveyQuestionType) => {
    updateQuestion(clientId, {
      type,
      options:
        type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE"
          ? defaultOptions()
          : [],
      minValue: type === "SCALE" ? 1 : null,
      maxValue: type === "SCALE" ? 5 : null,
    });
  };

  const addQuestion = (type: SurveyQuestionType = "TEXT", afterClientId?: string) => {
    const nextQuestion = createQuestion(type);

    setForm((current) => {
      const nextQuestions = [...current.questions];
      const targetIndex = afterClientId
        ? nextQuestions.findIndex((question) => question.clientId === afterClientId)
        : -1;

      if (targetIndex >= 0) {
        nextQuestions.splice(targetIndex + 1, 0, nextQuestion);
      } else {
        nextQuestions.push(nextQuestion);
      }

      return {
        ...current,
        questions: nextQuestions,
      };
    });
    setActiveQuestionClientId(nextQuestion.clientId);
    scrollEditorIntoView();
  };

  const removeQuestion = (clientId: string) => {
    setForm((current) => {
      if (current.questions.length <= 1) {
        return current;
      }

      const removedIndex = current.questions.findIndex((question) => question.clientId === clientId);
      const nextQuestions = current.questions.filter((question) => question.clientId !== clientId);

      if (activeQuestionClientId === clientId) {
        setActiveQuestionClientId(
          nextQuestions[Math.min(Math.max(removedIndex, 0), nextQuestions.length - 1)]?.clientId ||
            null
        );
      }

      return {
        ...current,
        questions: nextQuestions,
      };
    });
  };

  const moveQuestion = (clientId: string, direction: -1 | 1) => {
    setForm((current) => {
      const index = current.questions.findIndex((question) => question.clientId === clientId);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.questions.length) {
        return current;
      }

      const nextQuestions = [...current.questions];
      const [question] = nextQuestions.splice(index, 1);
      nextQuestions.splice(nextIndex, 0, question);

      return {
        ...current,
        questions: nextQuestions,
      };
    });
    setActiveQuestionClientId(clientId);
  };

  const updateQuestionOption = (
    questionClientId: string,
    optionIndex: number,
    nextOption: Partial<SurveyQuestionOption>
  ) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question) => {
        if (question.clientId !== questionClientId) {
          return question;
        }

        return {
          ...question,
          options: question.options.map((option, index) =>
            index === optionIndex ? { ...option, ...nextOption } : option
          ),
        };
      }),
    }));
  };

  const addQuestionOption = (questionClientId: string) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.clientId === questionClientId
          ? {
              ...question,
              options: [
                ...question.options,
                {
                  label: `ตัวเลือก ${question.options.length + 1}`,
                  value: `option_${question.options.length + 1}`,
                },
              ],
            }
          : question
      ),
    }));
    window.setTimeout(() => {
      const optionList = document.getElementById(`question-options-${questionClientId}`);
      optionList?.scrollTo({
        top: optionList.scrollHeight,
        behavior: "smooth",
      });
    }, 60);
  };

  const removeQuestionOption = (questionClientId: string, optionIndex: number) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.clientId === questionClientId && question.options.length > 2
          ? {
              ...question,
              options: question.options.filter((_, index) => index !== optionIndex),
            }
          : question
      ),
    }));
  };

  const validateForm = (): string | null => {
    if (form.title.trim().length < 3) {
      return "กรุณาระบุชื่อแบบสอบถามอย่างน้อย 3 ตัวอักษร";
    }

    if (form.questions.length === 0) {
      return "แบบสอบถามต้องมีอย่างน้อย 1 คำถาม";
    }

    for (const [index, question] of form.questions.entries()) {
      if (!question.prompt.trim()) {
        return `กรุณากรอกคำถามข้อที่ ${index + 1}`;
      }

      if (question.type === "SINGLE_CHOICE" || question.type === "MULTIPLE_CHOICE") {
        const validOptions = question.options.filter(
          (option) => option.label.trim() && option.value.trim()
        );

        if (validOptions.length < 2) {
          return `คำถามข้อที่ ${index + 1} ต้องมีตัวเลือกอย่างน้อย 2 ตัวเลือก`;
        }

        const uniqueValues = new Set(validOptions.map((option) => option.value.trim()));
        if (uniqueValues.size !== validOptions.length) {
          return `คำถามข้อที่ ${index + 1} มีค่าตัวเลือกซ้ำกัน`;
        }
      }

      if (
        (question.type === "SCALE" || question.type === "NUMBER") &&
        question.minValue !== null &&
        question.maxValue !== null &&
        question.minValue >= question.maxValue
      ) {
        return `คำถามข้อที่ ${index + 1} ต้องมีค่าสูงสุดมากกว่าค่าต่ำสุด`;
      }
    }

    return null;
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setServerError(validationError);
      return;
    }

    setSaving(true);
    setServerError("");

    try {
      const payload = buildSurveyPayload(form);
      const response = form.id
        ? await api.put<SurveyResponse>(`/api/admin/surveys/${form.id}`, payload)
        : await api.post<SurveyResponse>("/api/admin/surveys", payload);

      const nextForm = surveyToForm(response.data.survey);
      setForm(nextForm);
      setActiveQuestionClientId(nextForm.questions[0]?.clientId || null);
      await fetchSurveys();
      showToast("บันทึกแบบสอบถามสำเร็จ", form.isActive ? "แบบสอบถามนี้เปิดให้นักศึกษาทำแล้ว" : "");
    } catch (error) {
      setServerError(getErrorMessage(error, "ไม่สามารถบันทึกแบบสอบถามได้"));
    } finally {
      setSaving(false);
    }
  };

  const handleSelectSurvey = async (surveyId: string) => {
    setEditorOpen(true);
    setLoadingData(true);
    setServerError("");
    setOpenMenuSurveyId(null);

    try {
      await loadSurveyDetail(surveyId);
    } catch (error) {
      setServerError(getErrorMessage(error, "ไม่สามารถโหลดรายละเอียดแบบสอบถามได้"));
    } finally {
      setLoadingData(false);
    }
  };

  const handleCreateNew = () => {
    const nextForm = createDefaultSurveyForm();
    setForm(nextForm);
    setActiveQuestionClientId(nextForm.questions[0]?.clientId || null);
    setResponses([]);
    setServerError("");
    setOpenMenuSurveyId(null);
    setLoadingData(false);
    setEditorOpen(true);
  };

  const handleRequestDeleteSurvey = async (survey: Survey) => {
    setOpenMenuSurveyId(null);
    setLoadingData(true);
    setServerError("");

    try {
      await loadSurveyDetail(survey.id);
    } catch (error) {
      setServerError(getErrorMessage(error, "ไม่สามารถโหลดรายละเอียดแบบสอบถามได้"));
      setLoadingData(false);
      return;
    } finally {
      setLoadingData(false);
    }

    setDeleteDialogOpen(true);
  };

  const handleToggleSurveyActive = async (survey: Survey, nextIsActive: boolean) => {
    setTogglingSurveyId(survey.id);
    setServerError("");
    setOpenMenuSurveyId(null);

    try {
      const surveyResponse = await api.get<SurveyResponse>(`/api/admin/surveys/${survey.id}`);
      const surveyForm = surveyToForm(surveyResponse.data.survey);
      const nextStatus: SurveyStatus = nextIsActive ? "PUBLISHED" : surveyForm.status;
      const payload = {
        ...buildSurveyPayload({
          ...surveyForm,
          isActive: nextIsActive,
          status: nextStatus,
        }),
        isActive: nextIsActive,
        status: nextStatus,
      };

      const response = await api.put<SurveyResponse>(`/api/admin/surveys/${survey.id}`, payload);
      const nextForm = surveyToForm(response.data.survey);
      setForm(nextForm);
      setActiveQuestionClientId(nextForm.questions[0]?.clientId || null);
      await fetchSurveys();
      showToast(
        nextIsActive ? "เปิดแบบสอบถามแล้ว" : "ปิดแบบสอบถามแล้ว",
        nextIsActive ? "นักศึกษาจะเห็นแบบสอบถามนี้ในรอบปัจจุบัน" : "นักศึกษาจะไม่เห็นแบบสอบถามนี้แล้ว"
      );
    } catch (error) {
      setServerError(getErrorMessage(error, "ไม่สามารถเปลี่ยนสถานะแบบสอบถามได้"));
    } finally {
      setTogglingSurveyId(null);
    }
  };

  const handleDelete = async () => {
    if (!form.id) {
      return;
    }

    setDeleting(true);
    setServerError("");

    try {
      const hasResponses = responses.length > 0;
      await api.delete(`/api/admin/surveys/${form.id}${hasResponses ? "?force=true" : ""}`);
      setDeleteDialogOpen(false);
      setEditorOpen(false);
      setDownloadedSurveyIds((prev) => {
        const next = new Set(prev);
        next.delete(form.id!);
        return next;
      });
      showToast(
        "ลบแบบสอบถามสำเร็จ",
        hasResponses ? `ลบพร้อมข้อมูลคำตอบ ${responses.length.toLocaleString()} รายการแล้ว` : ""
      );
      const nextForm = createDefaultSurveyForm();
      setForm(nextForm);
      setActiveQuestionClientId(nextForm.questions[0]?.clientId || null);
      setResponses([]);
      await fetchSurveys();
    } catch (error) {
      setServerError(getErrorMessage(error, "ไม่สามารถลบแบบสอบถามได้"));
      setDeleteDialogOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleRestoreSurvey = async (survey: Survey) => {
    setOpenMenuSurveyId(null);
    setRestoringId(survey.id);
    setServerError("");

    try {
      const { data } = await api.get<SurveyResponse>(`/api/admin/surveys/${survey.id}`);
      const savedForm = surveyToForm(data.survey);
      const payload = buildSurveyPayload({ ...savedForm, status: "DRAFT", isActive: false });
      await api.put<SurveyResponse>(`/api/admin/surveys/${survey.id}`, payload);
      await fetchSurveys();
      setViewMode("active");
      showToast("ดึงกลับแบบสอบถามแล้ว", "สถานะเปลี่ยนเป็น ฉบับร่าง — แก้ไขและเผยแพร่ใหม่ได้เลย");
    } catch (error) {
      setServerError(getErrorMessage(error, "ไม่สามารถดึงกลับแบบสอบถามได้"));
    } finally {
      setRestoringId(null);
    }
  };

  const handleArchiveSurvey = async () => {
    if (!form.id) {
      return;
    }

    setDeleting(true);
    setServerError("");

    try {
      const { data } = await api.get<SurveyResponse>(`/api/admin/surveys/${form.id}`);
      const savedForm = surveyToForm(data.survey);
      const payload = buildSurveyPayload({ ...savedForm, status: "ARCHIVED", isActive: false });
      await api.put<SurveyResponse>(`/api/admin/surveys/${form.id}`, payload);
      setDeleteDialogOpen(false);
      setForm((current) => ({ ...current, status: "ARCHIVED", isActive: false }));
      await fetchSurveys();
      showToast("เก็บถาวรแล้ว", "สถานะเปลี่ยนเป็น เก็บถาวร — ข้อมูลคำตอบยังคงอยู่ในระบบ");
    } catch (error) {
      setServerError(getErrorMessage(error, "ไม่สามารถเก็บถาวรแบบสอบถามได้"));
      setDeleteDialogOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const exportResponsesCsv = () => {
    if (!selectedSurvey || responses.length === 0) {
      return;
    }

    const submittedTimestamps = responses
      .map((response) => new Date(response.submittedAt).getTime())
      .filter((value) => Number.isFinite(value));
    const earliestSubmittedAt =
      submittedTimestamps.length > 0
        ? formatThaiDateTime(new Date(Math.min(...submittedTimestamps)).toISOString())
        : "-";
    const latestSubmittedAt =
      submittedTimestamps.length > 0
        ? formatThaiDateTime(new Date(Math.max(...submittedTimestamps)).toISOString())
        : "-";

    const dataRows = responses.map((response) => {
      const distressLevel = getResponseDistressLevel(response);
      const distressLabel =
        response.distressLabel ??
        (distressLevel ? ghq28DistressMeta[distressLevel].label : "");

      return [
        response.submittedAt,
        response.student.studentId || "",
        response.student.name,
        response.student.studyYear || "",
        response.student.section || "",
        response.instrument || "",
        response.totalScore === null ? "" : response.totalScore,
        response.maxScore > 0 ? response.maxScore : "",
        response.scorePercent === null ? "" : response.scorePercent,
        isCurrentSurveyGhq28 ? distressLabel : surveyRiskMeta[response.riskLevel].label,
      ];
    });

    const rows: unknown[][] = [];
    rows.push(["Metadata"]);
    rows.push(["รายการ", "ค่า"]);
    pushKeyValueRows(rows, [
      ["วันที่ export", new Date().toISOString().slice(0, 10)],
      ["ชื่อแบบสอบถาม", selectedSurvey.title],
      ["จำนวน response", responses.length],
      ["ส่งแบบเร็วที่สุด", earliestSubmittedAt],
      ["ส่งแบบล่าสุด", latestSubmittedAt],
    ]);

    pushCsvSection(
      rows,
      "Responses",
      [
        "submittedAt",
        "studentId",
        "name",
        "studyYear",
        "section",
        "instrument",
        "totalScore",
        "maxScore",
        "scorePercent",
        isCurrentSurveyGhq28 ? "distressLevel" : "riskLevel",
      ],
      dataRows
    );

    downloadCsv(`${selectedSurvey.title.replace(/[^\wก-๙-]+/g, "_")}_responses.csv`, rows);

    if (form.id) {
      setDownloadedSurveyIds((prev) => new Set([...prev, form.id!]));
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <span className="loader h-7 w-7 text-blue-600"></span>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <div className="mb-3 inline-flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2">
            <ShieldAlert className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Admin Only</span>
          </div>
          <h1 className="text-xl font-semibold">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
          <p className="mt-2 text-sm">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>
          <Link href="/dashboard/admin" className="mt-4 inline-flex rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium">
            กลับไป Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <AdminShell
      activeNav="surveys"
      onLogout={handleLogout}
      title="จัดการแบบสอบถาม"
      userName={user.name}
      userRoleLabel="ผู้ดูแลระบบ (System Admin)"
    >
      <RoleToast
        key={toastKey}
        open={toast.open}
        title={toast.title}
        description={toast.description}
        tone={toast.tone}
        onClose={closeToast}
      />

      <DeleteSurveyDialog
        open={deleteDialogOpen}
        surveyTitle={form.title}
        responseCount={responses.length}
        hasDownloaded={form.id ? downloadedSurveyIds.has(form.id) : false}
        deleting={deleting}
        onDownload={exportResponsesCsv}
        onArchive={handleArchiveSurvey}
        onDelete={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />

      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-start gap-2 text-xl font-black text-slate-900 sm:text-2xl">
              <ClipboardList className="mt-0.5 h-6 w-6 shrink-0 text-blue-600" />
              แบบสอบถามและแบบประเมินสุขภาพใจ
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              จัดการแบบประเมิน เปิด/ปิดรอบ และดูผลสรุปแบบไม่เปิดเผยคำตอบละเอียดเกินจำเป็น
            </p>
          </div>

          <button
            type="button"
            onClick={handleCreateNew}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800 sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            สร้างแบบสอบถามใหม่
          </button>
        </div>

        {serverError && !editorOpen ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <p className="flex-1 text-sm font-medium text-red-700">{serverError}</p>
            <button
              type="button"
              onClick={() => setServerError("")}
              className="rounded-lg p-1 text-red-400 transition-colors hover:bg-red-100 hover:text-red-600"
              aria-label="ปิด"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div className="space-y-5">
          <section className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold text-slate-500">แบบสอบถามทั้งหมด</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{surveys.length.toLocaleString()}</p>
              <p className="mt-1 text-xs text-slate-400">
                <span className="font-semibold text-slate-600">{activeSurveys.length}</span> ใช้งาน
                {archivedSurveys.length > 0 ? (
                  <>
                    {" · "}
                    <button
                      type="button"
                      onClick={() => setViewMode("archived")}
                      className="font-semibold text-slate-500 underline decoration-dotted hover:text-slate-700"
                    >
                      {archivedSurveys.length} เก็บถาวร
                    </button>
                  </>
                ) : null}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <p className="text-xs font-bold text-emerald-700">เปิดใช้งานอยู่</p>
              <p className="mt-2 text-2xl font-black text-emerald-800">
                {surveys.filter((survey) => survey.isActive).length.toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold text-slate-500">ผู้ส่งคำตอบรวม</p>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {surveys.reduce((total, survey) => total + survey.responseCount, 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
              <p className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Privacy-first summary
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-blue-900">
                แสดงผู้ที่ทำแบบสอบถามแล้วพร้อมผลคะแนนสรุป โดยไม่เปิดคำตอบรายข้อบนหน้ารวม
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-black text-slate-900">รายการแบบสอบถาม</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {viewMode === "active"
                      ? "กดชื่อแบบสอบถามเพื่อเข้าไปแก้ไข เปิด/ปิดได้จาก switch ในรายการ"
                      : "แบบสอบถามที่เก็บถาวรแล้ว กด ดึงกลับ เพื่อนำกลับมาใช้งาน"}
                  </p>
                </div>
                {viewMode === "active" ? (
                  <button
                    type="button"
                    onClick={handleCreateNew}
                    className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-800 sm:w-auto"
                  >
                    <Plus className="h-4 w-4" />
                    เพิ่มแบบสอบถาม
                  </button>
                ) : null}
              </div>

              <div className="flex gap-1.5 rounded-xl border border-slate-200 bg-slate-100/60 p-1 sm:self-start">
                <button
                  type="button"
                  onClick={() => setViewMode("active")}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
                    viewMode === "active"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  ใช้งาน
                  <span className={`rounded-full px-1.5 py-0.5 text-xs font-black ${
                    viewMode === "active" ? "bg-slate-100 text-slate-600" : "bg-slate-200 text-slate-500"
                  }`}>
                    {activeSurveys.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("archived")}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
                    viewMode === "archived"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Archive className="h-3.5 w-3.5" />
                  เก็บถาวร
                  <span className={`rounded-full px-1.5 py-0.5 text-xs font-black ${
                    viewMode === "archived" ? "bg-slate-100 text-slate-600" : "bg-slate-200 text-slate-500"
                  }`}>
                    {archivedSurveys.length}
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-3 p-3 lg:hidden">
              {displaySurveys.map((survey) => {
                const isSelected = survey.id === form.id;
                const menuOpen = openMenuSurveyId === survey.id;
                const isToggling = togglingSurveyId === survey.id;
                const isRestoring = restoringId === survey.id;
                const isArchived = viewMode === "archived";

                return (
                  <article
                    key={`mobile-${survey.id}`}
                    className={`relative rounded-2xl border p-4 transition-colors ${
                      isSelected ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"
                    }`}
                    onClick={() => {
                      void handleSelectSurvey(survey.id);
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="line-clamp-2 text-base font-black text-slate-950">{survey.title}</h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                          {survey.description || "ไม่มีคำอธิบาย"}
                        </p>
                      </div>

                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenMenuSurveyId((current) => (current === survey.id ? null : survey.id));
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
                          aria-label="เมนูแบบสอบถาม"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {menuOpen ? (
                          <div
                            className="absolute right-0 top-10 z-40 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-lg"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuSurveyId(null);
                                void handleSelectSurvey(survey.id);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                            >
                              <Pencil className="h-4 w-4" />
                              แก้ไข/รายละเอียด
                            </button>
                            {isArchived ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleRestoreSurvey(survey);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
                              >
                                <RotateCcw className="h-4 w-4" />
                                ดึงกลับ
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleToggleSurveyActive(survey, !survey.isActive);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                >
                                  <Power className="h-4 w-4" />
                                  {survey.isActive ? "ปิดแบบสอบถาม" : "เปิดแบบสอบถาม"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleRequestDeleteSurvey(survey);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  ลบ
                                </button>
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          survey.isActive
                            ? "bg-emerald-100 text-emerald-700"
                            : survey.status === "ARCHIVED"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {survey.isActive ? "เปิดอยู่" : statusLabels[survey.status]}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                        {survey.questionCount.toLocaleString()} คำถาม
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                        ทำแล้ว {survey.responseCount.toLocaleString()}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                      <div className="min-w-0 text-xs font-medium text-slate-500">
                        แก้ไขล่าสุด {formatThaiDateTime(survey.updatedAt)}
                      </div>
                      {isArchived ? (
                        <button
                          type="button"
                          disabled={isRestoring}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleRestoreSurvey(survey);
                          }}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isRestoring ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                          ดึงกลับ
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isToggling}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleToggleSurveyActive(survey, !survey.isActive);
                          }}
                          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                            survey.isActive ? "bg-emerald-500" : "bg-slate-300"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                          aria-label={survey.isActive ? "ปิดแบบสอบถาม" : "เปิดแบบสอบถาม"}
                          aria-pressed={survey.isActive}
                        >
                          <span
                            className={`inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
                              survey.isActive ? "translate-x-[22px]" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}

              {displaySurveys.length === 0 && !loadingData ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                  {viewMode === "archived"
                    ? "ยังไม่มีแบบสอบถามที่เก็บถาวร"
                                    : 'ยังไม่มีแบบสอบถามในระบบ กด “เพิ่มแบบสอบถาม” เพื่อเริ่มสร้าง'}
                </div>
              ) : null}
            </div>

            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[52%]" />
                  <col className="w-[7rem]" />
                  <col className="w-[5.5rem]" />
                  <col className="w-[5.5rem]" />
                  <col className="w-[10.5rem]" />
                  <col className="w-[5rem]" />
                </colgroup>
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3">แบบสอบถาม</th>
                    <th className="whitespace-nowrap px-4 py-3 text-center">สถานะ</th>
                    <th className="whitespace-nowrap px-4 py-3 text-center">คำถาม</th>
                    <th className="whitespace-nowrap px-4 py-3 text-center">ทำแล้ว</th>
                    <th className="whitespace-nowrap px-4 py-3">แก้ไขล่าสุด</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displaySurveys.map((survey) => {
                    const isSelected = survey.id === form.id;
                    const menuOpen = openMenuSurveyId === survey.id;
                    const isToggling = togglingSurveyId === survey.id;
                    const isRestoring = restoringId === survey.id;
                    const isArchived = viewMode === "archived";

                    return (
                      <tr
                        key={survey.id}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-blue-50/70" : "hover:bg-slate-50"
                        }`}
                        onClick={() => {
                          void handleSelectSurvey(survey.id);
                        }}
                      >
                        <td className="px-4 py-4 align-middle">
                          <p className="line-clamp-1 font-black text-slate-950">{survey.title}</p>
                          <p className="mt-1 line-clamp-1 text-xs text-slate-500">{survey.description || "ไม่มีคำอธิบาย"}</p>
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <div className="flex justify-center">
                            {isArchived ? (
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                                เก็บถาวร
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={isToggling}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleToggleSurveyActive(survey, !survey.isActive);
                                }}
                                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                                  survey.isActive ? "bg-emerald-500" : "bg-slate-300"
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                                aria-label={survey.isActive ? "ปิดแบบสอบถาม" : "เปิดแบบสอบถาม"}
                                aria-pressed={survey.isActive}
                              >
                                <span
                                  className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                                    survey.isActive ? "translate-x-[22px]" : "translate-x-0.5"
                                  }`}
                                />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center text-slate-600 align-middle">{survey.questionCount.toLocaleString()}</td>
                        <td className="px-4 py-4 text-center text-slate-600 align-middle">{survey.responseCount.toLocaleString()}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-slate-500 align-middle">{formatThaiDateTime(survey.updatedAt)}</td>
                        <td className="px-4 py-4 text-right align-middle">
                          {isArchived ? (
                            <button
                              type="button"
                              disabled={isRestoring}
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleRestoreSurvey(survey);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isRestoring ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3.5 w-3.5" />
                              )}
                              ดึงกลับ
                            </button>
                          ) : (
                            <div className="relative inline-flex">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenMenuSurveyId((current) => (current === survey.id ? null : survey.id));
                                }}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
                                aria-label="เมนูแบบสอบถาม"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                              {menuOpen ? (
                                <div
                                  className="absolute right-0 top-10 z-40 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-lg"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuSurveyId(null);
                                      void handleSelectSurvey(survey.id);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                  >
                                    <Pencil className="h-4 w-4" />
                                    แก้ไข/รายละเอียด
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void handleToggleSurveyActive(survey, !survey.isActive);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                  >
                                    <Power className="h-4 w-4" />
                                    {survey.isActive ? "ปิดแบบสอบถาม" : "เปิดแบบสอบถาม"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void handleRequestDeleteSurvey(survey);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    ลบ
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {displaySurveys.length === 0 && !loadingData ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                        {viewMode === "archived"
                          ? "ยังไม่มีแบบสอบถามที่เก็บถาวร"
          : 'ยังไม่มีแบบสอบถามในระบบ กด “เพิ่มแบบสอบถาม” เพื่อเริ่มสร้าง'}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          {editorOpen ? (
            <div
              className="fixed inset-0 z-[220] !mt-0 grid place-items-center overflow-y-auto overscroll-contain bg-slate-950/35 p-3 backdrop-blur-sm sm:p-4"
              role="dialog"
              aria-modal="true"
              aria-label={form.id ? "แก้ไขแบบสอบถาม" : "สร้างแบบสอบถามใหม่"}
            >
              <div className="flex min-h-0 max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/80 bg-slate-50 shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      {form.id ? "แก้ไขแบบสอบถาม" : "สร้างแบบสอบถามใหม่"}
                    </p>
                    <h2 className="truncate text-base font-black text-slate-950 sm:text-lg">
                      {form.title.trim() || "สร้างแบบสอบถามใหม่"}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditorOpen(false);
                      setOpenMenuSurveyId(null);
                      setServerError("");
                    }}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
                    aria-label="ปิดหน้าต่างแก้ไขแบบสอบถาม"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                {serverError ? (
                  <div className="flex shrink-0 items-start gap-3 border-b border-red-200 bg-red-50 px-4 py-3 sm:px-5">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <p className="flex-1 text-sm font-semibold text-red-700">{serverError}</p>
                    <button
                      type="button"
                      onClick={() => setServerError("")}
                      className="rounded-md p-0.5 text-red-400 transition-colors hover:bg-red-100 hover:text-red-600"
                      aria-label="ปิด"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
                  <div id="survey-workspace" className="mx-auto max-w-7xl space-y-6 pb-6">
            {loadingData ? (
              <div className="flex min-h-[24rem] items-center justify-center rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  กำลังโหลดข้อมูล
                </div>
              </div>
            ) : (
              <form id="admin-survey-form" onSubmit={handleSave} className="space-y-5 pb-10 lg:pb-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        {form.id ? "Edit survey" : "New survey"}
                      </p>
                      <p className="truncate text-sm font-black text-slate-900">
                        {form.questions.length.toLocaleString()} คำถาม
                        {activeQuestion ? ` · กำลังแก้ข้อ ${form.questions.findIndex((question) => question.clientId === activeQuestion.clientId) + 1}` : ""}
                      </p>
                      <p className="mt-1 truncate text-xs font-medium text-slate-500">
                        {form.id ? `ID: ${form.id}` : "ยังไม่ได้บันทึกลงฐานข้อมูล"}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      {form.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedSurvey) {
                              void handleRequestDeleteSurvey(selectedSurvey);
                            }
                          }}
                          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-bold text-red-600 transition-colors hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          ลบ
                        </button>
                      ) : null}
                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        บันทึกแบบสอบถาม
                      </button>
                    </div>
                  </div>
                </div>

                <section id="survey-settings" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-base font-black text-slate-900">รายละเอียดแบบสอบถาม</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      ตั้งค่าชื่อ คำอธิบาย สถานะ และช่วงเวลาที่เปิดให้นักศึกษาทำแบบสอบถาม
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="lg:col-span-2">
                      <label htmlFor="survey-title" className="mb-2 block text-sm font-bold text-slate-700">
                        ชื่อแบบสอบถาม
                      </label>
                      <input
                        id="survey-title"
                        type="text"
                        value={form.title}
                        onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                        maxLength={200}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>

                    <div className="lg:col-span-2">
                      <label htmlFor="survey-description" className="mb-2 block text-sm font-bold text-slate-700">
                        คำอธิบาย
                      </label>
                      <textarea
                        id="survey-description"
                        value={form.description}
                        onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                        rows={3}
                        maxLength={4000}
                        className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>

                    <div>
                      <label htmlFor="survey-status" className="mb-2 block text-sm font-bold text-slate-700">
                        สถานะ
                      </label>
                      <select
                        id="survey-status"
                        value={form.status}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            status: event.target.value as SurveyStatus,
                            isActive: event.target.value === "PUBLISHED" ? current.isActive : false,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                      >
                        {Object.entries(statusLabels).map(([status, label]) => (
                          <option key={status} value={status}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-end">
                      <label className="flex min-h-[42px] w-full cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={form.isActive}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              status: event.target.checked ? "PUBLISHED" : current.status,
                              isActive: event.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        เปิดให้นักศึกษาทำแบบสอบถามนี้
                      </label>
                    </div>

                    <div>
                      <label htmlFor="survey-starts-at" className="mb-2 block text-sm font-bold text-slate-700">
                        เปิดตั้งแต่
                      </label>
                      <input
                        id="survey-starts-at"
                        type="datetime-local"
                        value={form.startsAt}
                        onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>

                    <div>
                      <label htmlFor="survey-ends-at" className="mb-2 block text-sm font-bold text-slate-700">
                        ปิดรับถึง
                      </label>
                      <input
                        id="survey-ends-at"
                        type="datetime-local"
                        value={form.endsAt}
                        onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid lg:min-h-[34rem] lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)]">
                  <aside className="border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
                    <div className="border-b border-slate-200 bg-slate-50/70 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-sm font-black text-slate-900">โครงสร้างคำถาม</h2>
                          <p className="mt-0.5 text-xs font-medium text-slate-500">
                            {form.questions.length.toLocaleString()} ข้อ
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => addQuestion("TEXT", activeQuestionClientId || undefined)}
                          className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-700 px-3 text-xs font-bold text-white transition-colors hover:bg-blue-800"
                        >
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          เพิ่ม
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7 lg:grid-cols-4">
                        {questionTypeQuickActions.map(({ icon: Icon, label, type }) => (
                          <button
                            key={`panel-add-${type}`}
                            type="button"
                            onClick={() => addQuestion(type, activeQuestionClientId || undefined)}
                            className="flex min-h-[3.25rem] flex-col items-center justify-center rounded-lg border border-slate-200 bg-white px-1.5 py-2 text-[10px] font-bold text-slate-500 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                            title={label}
                          >
                            <Icon className="mb-1 h-4 w-4" />
                            <span className="max-w-full truncate">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="max-h-72 space-y-2 overflow-y-auto p-3 lg:max-h-[30rem] xl:max-h-[34rem]">
                      {form.questions.map((question, questionIndex) => {
                        const isActiveQuestion = question.clientId === activeQuestionClientId;

                        return (
                          <div
                            key={`structure-${question.clientId}`}
                            className={`group rounded-xl border p-3 transition-colors ${
                              isActiveQuestion
                                ? "border-blue-500 bg-blue-50 shadow-sm"
                                : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => focusQuestion(question.clientId)}
                              className="block w-full text-left"
                            >
                              <span className="mb-1 flex items-center gap-2">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-black ${
                                    isActiveQuestion
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-slate-100 text-slate-500"
                                  }`}
                                >
                                  ข้อ {questionIndex + 1}
                                </span>
                                <span className="truncate text-[10px] font-bold text-slate-400">
                                  {questionTypeLabels[question.type]}
                                </span>
                                {question.isRequired ? (
                                  <span className="ml-auto text-xs font-black text-red-500">*</span>
                                ) : null}
                              </span>
                              <span
                                className={`line-clamp-2 text-sm leading-5 ${
                                  isActiveQuestion
                                    ? "font-black text-blue-800"
                                    : "font-semibold text-slate-800"
                                }`}
                              >
                                {question.prompt.trim() || "ยังไม่ได้ใส่คำถาม"}
                              </span>
                            </button>

                            <div className="mt-3 flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => moveQuestion(question.clientId, -1)}
                                disabled={questionIndex === 0}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
                                title="เลื่อนขึ้น"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveQuestion(question.clientId, 1)}
                                disabled={questionIndex === form.questions.length - 1}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
                                title="เลื่อนลง"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => addQuestion("TEXT", question.clientId)}
                                className="ml-auto inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 transition-colors hover:border-blue-200 hover:text-blue-700"
                              >
                                <Plus className="mr-1 h-3.5 w-3.5" />
                                ต่อ
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </aside>

                  <div id="survey-question-editor" className="min-w-0 bg-slate-50/60 p-4 sm:p-5 lg:max-h-[38rem] lg:overflow-y-auto lg:p-6 xl:max-h-[42rem]">
                    {activeQuestion ? (
                      <div className="mx-auto max-w-2xl space-y-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">
                              <ClipboardList className="h-3.5 w-3.5" />
                              กำลังแก้ข้อ {form.questions.findIndex((question) => question.clientId === activeQuestion.clientId) + 1}
                            </span>
                            <h3 className="mt-2 text-xl font-black text-slate-900">
                              {questionTypeLabels[activeQuestion.type]}
                            </h3>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => moveQuestion(activeQuestion.clientId, -1)}
                              disabled={form.questions.findIndex((question) => question.clientId === activeQuestion.clientId) === 0}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                              title="เลื่อนขึ้น"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveQuestion(activeQuestion.clientId, 1)}
                              disabled={form.questions.findIndex((question) => question.clientId === activeQuestion.clientId) === form.questions.length - 1}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                              title="เลื่อนลง"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeQuestion(activeQuestion.clientId)}
                              disabled={form.questions.length <= 1}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-white text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                              title="ลบคำถาม"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                          <div className="grid gap-5">
                            <div>
                              <label className="mb-2 block text-sm font-black text-slate-800">
                                คำถาม
                              </label>
                              <textarea
                                rows={3}
                                value={activeQuestion.prompt}
                                onChange={(event) => updateQuestion(activeQuestion.clientId, { prompt: event.target.value })}
                                maxLength={800}
                                placeholder="พิมพ์คำถามที่ต้องการถาม"
                                className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold leading-7 text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                              />
                            </div>

                            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
                              <div>
                                <label className="mb-2 block text-sm font-black text-slate-800">
                                  คำอธิบายใต้คำถาม
                                </label>
                                <input
                                  type="text"
                                  value={activeQuestion.description || ""}
                                  onChange={(event) => updateQuestion(activeQuestion.clientId, { description: event.target.value })}
                                  maxLength={1200}
                                  placeholder="เว้นว่างได้"
                                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-sm font-black text-slate-800">
                                  ชนิดคำถาม
                                </label>
                                <select
                                  value={activeQuestion.type}
                                  onChange={(event) => changeQuestionType(activeQuestion.clientId, event.target.value as SurveyQuestionType)}
                                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                                >
                                  {Object.entries(questionTypeLabels).map(([type, label]) => (
                                    <option key={type} value={type}>
                                      {label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <label className="inline-flex w-fit cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700">
                              <input
                                type="checkbox"
                                checked={activeQuestion.isRequired}
                                onChange={(event) => updateQuestion(activeQuestion.clientId, { isRequired: event.target.checked })}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              จำเป็นต้องตอบ
                            </label>
                          </div>
                        </div>

                        {activeQuestion.type === "SINGLE_CHOICE" || activeQuestion.type === "MULTIPLE_CHOICE" ? (
                          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <h4 className="text-sm font-black text-slate-900">ตัวเลือกคำตอบ</h4>
                                <p className="mt-0.5 text-xs font-medium text-slate-500">
                                  {activeQuestion.options.length.toLocaleString()} ตัวเลือก
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => addQuestionOption(activeQuestion.clientId)}
                                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition-colors hover:border-blue-200 hover:text-blue-700"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                เพิ่มตัวเลือก
                              </button>
                            </div>

                            <div id={`question-options-${activeQuestion.clientId}`} className="max-h-[24rem] space-y-2 overflow-y-auto p-3 sm:p-4">
                              {activeQuestion.options.map((option, optionIndex) => (
                                <div
                                  key={`${activeQuestion.clientId}-${optionIndex}`}
                                  className="grid gap-2 rounded-xl border border-slate-100 bg-white p-2 sm:grid-cols-[minmax(0,1fr)_minmax(7rem,10rem)_7rem_2.5rem]"
                                >
                                  <input
                                    type="text"
                                    value={option.label}
                                    onChange={(event) => updateQuestionOption(activeQuestion.clientId, optionIndex, { label: event.target.value })}
                                    placeholder="ข้อความที่แสดง"
                                    className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                  />
                                  <input
                                    type="text"
                                    value={option.value}
                                    onChange={(event) => updateQuestionOption(activeQuestion.clientId, optionIndex, { value: event.target.value })}
                                    placeholder="ค่าในระบบ"
                                    className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                  />
                                  <input
                                    type="number"
                                    value={option.score ?? ""}
                                    onChange={(event) =>
                                      updateQuestionOption(activeQuestion.clientId, optionIndex, {
                                        score: event.target.value === "" ? null : Number(event.target.value),
                                      })
                                    }
                                    placeholder="คะแนน"
                                    className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeQuestionOption(activeQuestion.clientId, optionIndex)}
                                    disabled={activeQuestion.options.length <= 2}
                                    className="inline-flex h-10 items-center justify-center rounded-lg border border-red-200 text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-auto"
                                    title="ลบตัวเลือก"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {activeQuestion.type === "SCALE" || activeQuestion.type === "NUMBER" ? (
                          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h4 className="text-sm font-black text-slate-900">ช่วงค่าคะแนน</h4>
                            <p className="mb-4 mt-1 text-xs leading-5 text-slate-500">
                              ค่านี้ใช้สำหรับคำนวณผลให้ทีมดูแลที่มีสิทธิ์ ไม่แสดงผลคะแนนในหน้าผู้ดูแลระบบ
                            </p>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <label className="mb-2 block text-sm font-bold text-slate-700">
                                  ค่าต่ำสุด
                                </label>
                                <input
                                  type="number"
                                  value={activeQuestion.minValue ?? ""}
                                  onChange={(event) => updateQuestion(activeQuestion.clientId, { minValue: event.target.value === "" ? null : Number(event.target.value) })}
                                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                />
                              </div>
                              <div>
                                <label className="mb-2 block text-sm font-bold text-slate-700">
                                  ค่าสูงสุด
                                </label>
                                <input
                                  type="number"
                                  value={activeQuestion.maxValue ?? ""}
                                  onChange={(event) => updateQuestion(activeQuestion.clientId, { maxValue: event.target.value === "" ? null : Number(event.target.value) })}
                                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                />
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <button
                            type="button"
                            onClick={() => addQuestion("TEXT", activeQuestion.clientId)}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            <Plus className="h-4 w-4" />
                            เพิ่มคำถามต่อจากข้อนี้
                          </button>
                          <button
                            type="button"
                            onClick={() => addQuestion("SINGLE_CHOICE", activeQuestion.clientId)}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            เพิ่มข้อเลือกตอบต่อจากข้อนี้
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-h-[24rem] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-sm font-medium text-slate-500">
                        เลือกคำถามจากด้านซ้ายเพื่อแก้ไข
                      </div>
                    )}
                  </div>
                </section>



              </form>
            )}

            {form.id ? (
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
                      <BarChart3 className="h-5 w-5 text-blue-600" />
                      สรุปการทำแบบสอบถาม
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      เก็บผลสรุปที่จำเป็น: ใครทำแล้ว คะแนนรวม ระดับคัดกรอง และเวลาส่ง โดยไม่แสดงคำตอบรายข้อ
                    </p>
                    <p className="mt-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                      ไฟล์ CSV มีข้อมูลส่วนบุคคล (ชื่อ-นามสกุล) — สำหรับผู้ดูแลระบบเท่านั้น ห้ามแชร์นอกองค์กรหรือใช้เสนอที่ประชุมคณะ
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={exportResponsesCsv}
                    disabled={responses.length === 0}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 border-b border-slate-100 p-5 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="flex items-center gap-2 text-xs font-bold text-slate-500">
                      <Users className="h-4 w-4" />
                      นักศึกษาที่ทำแล้ว
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-950">{responses.length.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-500">คะแนนเฉลี่ย</p>
                    <p className="mt-2 text-2xl font-black text-slate-950">
                      {averageScore === null ? "-" : averageScore.toFixed(1)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                    <p className="text-xs font-bold text-red-700">
                      {isCurrentSurveyGhq28 ? "ระดับรุนแรง (Severe)" : "คัดกรองสูง"}
                    </p>
                    <p className="mt-2 text-2xl font-black text-red-800">
                      {(isCurrentSurveyGhq28 ? ghq28DistressCounts.SEVERE : highRiskResponseCount).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-500">ส่งล่าสุด</p>
                    <p className="mt-2 text-lg font-black text-slate-950">
                      {responses[0]?.submittedAt ? formatThaiDateTime(responses[0].submittedAt) : "-"}
                    </p>
                  </div>
                </div>

                {isCurrentSurveyGhq28 ? (
                  <div className="grid grid-cols-2 gap-3 border-b border-slate-100 p-5 sm:grid-cols-4">
                    {(Object.keys(ghq28DistressMeta) as Ghq28DistressLevel[]).map((level) => {
                      const meta = ghq28DistressMeta[level];
                      return (
                        <div key={level} className={`rounded-xl border p-3 ${meta.className}`}>
                          <p className="text-xs font-bold leading-5">{meta.label}</p>
                          <p className="mt-2 text-xl font-black">{ghq28DistressCounts[level].toLocaleString()}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <div className="max-h-[32rem] space-y-3 overflow-y-auto p-3 md:hidden">
                  {responses.map((response) => {
                    const distressLevel = getResponseDistressLevel(response);
                    const distressMeta = distressLevel ? ghq28DistressMeta[distressLevel] : null;
                    const riskMeta = surveyRiskMeta[response.riskLevel];

                    return (
                      <article key={`mobile-response-${response.id}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-black text-slate-950">{response.student.name}</h3>
                            <p className="mt-1 text-xs text-slate-500">{response.student.studentId || "-"}</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            {isCurrentSurveyGhq28 && distressMeta ? (
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${distressMeta.className}`}>
                                {response.distressLabel ?? distressMeta.label}
                              </span>
                            ) : (
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${riskMeta.className}`}>
                                {riskMeta.label}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs font-bold text-slate-500">คะแนน</p>
                            <p className="mt-1 font-black text-slate-950">{formatSurveyScore(response)}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs font-bold text-slate-500">เปอร์เซ็นต์</p>
                            <p className="mt-1 font-black text-slate-950">{formatSurveyPercent(response)}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2">
                            <p className="text-xs font-bold text-slate-500">ชั้นปี/Section</p>
                            <p className="mt-1 font-black text-slate-950">
                              ปี {response.student.studyYear || "-"} · {response.student.section || "-"}
                            </p>
                          </div>
                        </div>
                        <p className="mt-3 text-xs font-medium text-slate-500">
                          ส่งเมื่อ {formatThaiDateTime(response.submittedAt)}
                        </p>
                      </article>
                    );
                  })}
                  {responses.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                      ยังไม่มีคำตอบสำหรับแบบสอบถามนี้
                    </div>
                  ) : null}
                </div>

                <div className="hidden max-h-[30rem] overflow-auto md:block">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500 shadow-[0_1px_0_rgba(148,163,184,0.2)]">
                      <tr>
                        <th className="px-4 py-3">ส่งเมื่อ</th>
                        <th className="px-4 py-3">นักศึกษา</th>
                        <th className="px-4 py-3">ชั้นปี/Section</th>
                        <th className="px-4 py-3">แบบประเมิน</th>
                        <th className="px-4 py-3">คะแนน</th>
                        <th className="px-4 py-3">เปอร์เซ็นต์</th>
                        <th className="px-4 py-3">{isCurrentSurveyGhq28 ? "ความรุนแรง" : "สถานะ"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {responses.map((response) => {
                        const distressLevel = getResponseDistressLevel(response);
                        const distressMeta = distressLevel ? ghq28DistressMeta[distressLevel] : null;
                        const riskMeta = surveyRiskMeta[response.riskLevel];

                        return (
                          <tr key={response.id}>
                            <td className="px-4 py-4 text-slate-600">{formatThaiDateTime(response.submittedAt)}</td>
                            <td className="px-4 py-4">
                              <p className="font-bold text-slate-900">{response.student.name}</p>
                              <p className="mt-1 text-xs text-slate-500">{response.student.studentId || "-"}</p>
                            </td>
                            <td className="px-4 py-4 text-slate-600">
                              ปี {response.student.studyYear || "-"} · {response.student.section || "-"}
                            </td>
                            <td className="px-4 py-4 text-slate-600">{response.instrument || "-"}</td>
                            <td className="px-4 py-4 font-bold text-slate-900">{formatSurveyScore(response)}</td>
                            <td className="px-4 py-4 text-slate-600">{formatSurveyPercent(response)}</td>
                            <td className="px-4 py-4">
                              {isCurrentSurveyGhq28 && distressMeta ? (
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${distressMeta.className}`}>
                                  {response.distressLabel ?? distressMeta.label}
                                </span>
                              ) : (
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${riskMeta.className}`}>
                                  {riskMeta.label}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {responses.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                            ยังไม่มีคำตอบสำหรับแบบสอบถามนี้
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AdminShell>
  );
}
