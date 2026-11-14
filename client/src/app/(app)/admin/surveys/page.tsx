"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, ShieldAlert, X } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { SurveyEditorView } from "@/components/admin/survey-editor-view";
import { SurveyListView } from "@/components/admin/survey-list-view";
import { SurveyPreviewModal } from "@/components/admin/survey-preview-modal";
import { SurveyPublishVersionModal } from "@/components/admin/survey-publish-version-modal";
import { DeleteSurveyDialog } from "@/components/delete-survey-dialog";
import { RoleToast, type RoleToastTone } from "@/components/role-toast";
import { StaffModalOverlay } from "@/components/ui/staff-modal-overlay";
import { useAuth } from "@/context/auth.context";
import api from "@/lib/axios";
import { UNAUTHENTICATED_PATH } from "@/lib/auth-routes";
import { downloadCsv, pushCsvSection, pushKeyValueRows } from "@/lib/csv-export";
import { toDateTimeLocalValue } from "@/lib/survey-schedule";
import { pickLatestVersion } from "@/lib/survey-scoring-rules-input";
import type {
  Ghq28DistressLevel,
  Survey,
  SurveyAdminPreview,
  SurveyAssignmentRosterResponse,
  SurveyAssignmentRosterState,
  SurveyAssignmentStatusFilter,
  SurveyEligibilityRule,
  SurveyQuestion,
  SurveyQuestionOption,
  SurveyQuestionType,
  SurveyRiskLevel,
  SurveyResponseRow,
  SurveyScoringRules,
  SurveyStatus,
  SurveyVersionSummary,
  SurveyWaveSummary,
} from "@/types/survey";
import type { SurveyFormState } from "@/components/admin/survey-editor-view";

type SurveyQuestionForm = Omit<SurveyQuestion, "id" | "order"> & {
  clientId: string;
  id?: string;
  order?: number;
};

type SurveyForm = SurveyFormState;

const emptyEligibilityRule = (): SurveyEligibilityRule => ({
  priorRiskLevels: [],
  wellnessSignalCodes: [],
  studyYears: [],
  sections: [],
});

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

const newClientId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const defaultOptions = (): SurveyQuestionOption[] => [
  { label: "ตัวเลือก 1", score: null, value: "option_1" },
  { label: "ตัวเลือก 2", score: null, value: "option_2" },
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

const createBlankSurveyForm = (): SurveyForm => ({
  title: "แบบสอบถามใหม่",
  description: "",
  status: "DRAFT",
  isActive: false,
  startsAt: "",
  endsAt: "",
  frequency: "ONE_SHOT",
  scheduleEvery: null,
  scheduleUnit: null,
  audienceType: "ALL_STUDENTS",
  instrumentCode: "CUSTOM",
  eligibilityRule: emptyEligibilityRule(),
  questions: [
    {
      ...createQuestion("TEXT"),
      prompt: "คำถามที่ 1",
    },
  ],
});

const createGhq28SurveyForm = (): SurveyForm => ({
  title: "แบบทดสอบสุขภาพทั่วไป Thai GHQ-28",
  description:
    "แบบสอบถามสภาวะสุขภาพในระยะสองถึงสามสัปดาห์ที่ผ่านมา ใช้การให้คะแนน Likert 0-1-2-3 (คะแนนรวม 0-84)",
  status: "DRAFT",
  isActive: false,
  startsAt: "",
  endsAt: "",
  frequency: "ONE_SHOT",
  scheduleEvery: null,
  scheduleUnit: null,
  audienceType: "ALL_STUDENTS",
  instrumentCode: "GHQ28",
  eligibilityRule: emptyEligibilityRule(),
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

const formatDateTimeInput = (value: string | null): string => toDateTimeLocalValue(value);

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
  frequency: survey.frequency ?? "ONE_SHOT",
  scheduleEvery: survey.scheduleEvery ?? null,
  scheduleUnit: survey.scheduleUnit ?? null,
  audienceType: survey.audienceType ?? "ALL_STUDENTS",
  instrumentCode: survey.instrumentCode ?? (survey.title.includes("GHQ") ? "GHQ28" : "CUSTOM"),
  eligibilityRule: survey.eligibilityRule
    ? {
        priorRiskLevels: survey.eligibilityRule.priorRiskLevels ?? [],
        wellnessSignalCodes: survey.eligibilityRule.wellnessSignalCodes ?? [],
        studyYears: survey.eligibilityRule.studyYears ?? [],
        sections: survey.eligibilityRule.sections ?? [],
      }
    : emptyEligibilityRule(),
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
  frequency: form.frequency,
  scheduleEvery: form.frequency === "CUSTOM_INTERVAL" ? form.scheduleEvery : null,
  scheduleUnit: form.frequency === "CUSTOM_INTERVAL" ? form.scheduleUnit : null,
  audienceType: form.audienceType,
  instrumentCode: form.instrumentCode,
  eligibilityRule:
    form.audienceType === "RULE_BASED"
      ? {
          priorRiskLevels: form.eligibilityRule.priorRiskLevels,
          wellnessSignalCodes: form.eligibilityRule.wellnessSignalCodes,
          studyYears: form.eligibilityRule.studyYears,
          sections: form.eligibilityRule.sections,
        }
      : null,
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
  const [form, setForm] = useState<SurveyForm>(() => createBlankSurveyForm());
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
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
  const [activeQuestionClientId, setActiveQuestionClientId] = useState<string | null>(
    () => form.questions[0]?.clientId || null
  );
  const [waves, setWaves] = useState<SurveyWaveSummary[]>([]);
  const [eligibilityPreviewCount, setEligibilityPreviewCount] = useState<number | null>(null);
  const [eligibilityPreviewLoading, setEligibilityPreviewLoading] = useState(false);
  const [waveActionLoading, setWaveActionLoading] = useState(false);
  const [assignmentRoster, setAssignmentRoster] = useState<SurveyAssignmentRosterState | null>(null);
  const [assignmentRosterLoading, setAssignmentRosterLoading] = useState(false);
  const [assignmentRosterError, setAssignmentRosterError] = useState("");
  // นับลำดับคำขอรายชื่อ เพื่อทิ้งผลของคำขอเก่าเมื่อสลับแท็บ/รอบเร็ว ๆ
  const assignmentRosterRequestRef = useRef(0);
  const [versions, setVersions] = useState<SurveyVersionSummary[]>([]);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishingVersion, setPublishingVersion] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewData, setPreviewData] = useState<SurveyAdminPreview | null>(null);
  // นับลำดับคำขอ เพื่อทิ้งผลของคำขอเก่าเมื่อปิดพรีวิว/สลับแบบสอบถามเร็ว ๆ
  const versionsRequestRef = useRef(0);
  const previewRequestRef = useRef(0);

  const isAdmin = Boolean(user?.roles?.includes("ADMIN") || user?.role === "ADMIN");

  const selectedSurvey = useMemo(
    () => surveys.find((survey) => survey.id === form.id) || null,
    [form.id, surveys]
  );

  const loadWaves = useCallback(async (surveyId: string) => {
    try {
      const response = await api.get<{ waves: SurveyWaveSummary[] }>(`/api/admin/surveys/${surveyId}/waves`);
      setWaves(response.data.waves || []);
    } catch {
      setWaves([]);
    }
  }, []);

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
    setToastKey((k) => k + 1);
    setToast({ open: true, title, description, tone });
  }, []);

  const closeToast = useCallback(() => {
    setToast((current) => ({ ...current, open: false }));
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace(UNAUTHENTICATED_PATH);
    }
  }, [isAuthenticated, loading, router]);

  const loadSurveyDetail = useCallback(async (surveyId: string) => {
    const [surveyResponse, responsesResponse, wavesResponse] = await Promise.all([
      api.get<SurveyResponse>(`/api/admin/surveys/${surveyId}`),
      api.get<SurveyResponsesResponse>(`/api/admin/surveys/${surveyId}/responses`),
      api.get<{ waves: SurveyWaveSummary[] }>(`/api/admin/surveys/${surveyId}/waves`),
    ]);

    const nextForm = surveyToForm(surveyResponse.data.survey);
    setForm(nextForm);
    setActiveQuestionClientId(nextForm.questions[0]?.clientId || null);
    setResponses(responsesResponse.data.responses);
    setWaves(wavesResponse.data.waves || surveyResponse.data.survey.waves || []);
    setEligibilityPreviewCount(null);
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
    router.replace(UNAUTHENTICATED_PATH);
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
      showToast(
        "บันทึกแบบสอบถามสำเร็จ",
        form.isActive
          ? "แบบสอบถามนี้เปิดให้นักศึกษาทำแล้ว"
          : "บันทึกเป็นฉบับร่างแล้ว เผยแพร่ได้เมื่อพร้อม"
      );
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

  const openEditorWithForm = (nextForm: SurveyForm) => {
    setForm(nextForm);
    setActiveQuestionClientId(nextForm.questions[0]?.clientId || null);
    setResponses([]);
    setWaves([]);
    assignmentRosterRequestRef.current += 1;
    setAssignmentRoster(null);
    setAssignmentRosterLoading(false);
    setAssignmentRosterError("");
    setEligibilityPreviewCount(null);
    setServerError("");
    setOpenMenuSurveyId(null);
    setLoadingData(false);
    setShowTemplatePicker(false);
    setEditorOpen(true);
  };

  const handleCreateNew = () => {
    setServerError("");
    setOpenMenuSurveyId(null);
    setShowTemplatePicker(true);
  };

  const handlePreviewEligibility = async () => {
    if (!form.id) {
      setServerError("บันทึกแบบสอบถามก่อน จึงจะดูจำนวนกลุ่มเป้าหมายได้");
      return;
    }

    setEligibilityPreviewLoading(true);
    setServerError("");
    try {
      const response = await api.post<{ matchedCount: number }>(
        `/api/admin/surveys/${form.id}/eligibility-preview`,
        {
          audienceType: form.audienceType,
          rule: form.audienceType === "RULE_BASED" ? form.eligibilityRule : null,
        }
      );
      setEligibilityPreviewCount(response.data.matchedCount);
    } catch (error) {
      setServerError(getErrorMessage(error, "ไม่สามารถดูจำนวนกลุ่มเป้าหมายได้"));
    } finally {
      setEligibilityPreviewLoading(false);
    }
  };

  const handleCreateWave = async (input: {
    label: string;
    openNow: boolean;
    opensAt?: string | null;
    closesAt?: string | null;
    termKey?: string | null;
    weekStart?: string | null;
  }) => {
    if (!form.id) {
      return;
    }
    setWaveActionLoading(true);
    setServerError("");
    try {
      await api.post(`/api/admin/surveys/${form.id}/waves`, {
        label: input.label,
        openNow: input.openNow,
        opensAt: input.opensAt || form.startsAt || new Date().toISOString(),
        closesAt: input.closesAt ?? form.endsAt ?? null,
        termKey: input.termKey || null,
        weekStart: input.weekStart || null,
      });
      await Promise.all([loadWaves(form.id), fetchSurveys()]);
      showToast("เปิดคลื่นสำเร็จ", "ระบบจัดกลุ่มเป้าหมายให้แล้ว");
    } catch (error) {
      setServerError(getErrorMessage(error, "ไม่สามารถสร้างคลื่นได้"));
    } finally {
      setWaveActionLoading(false);
    }
  };

  const handleOpenWave = async (waveId: string) => {
    if (!form.id) {
      return;
    }
    setWaveActionLoading(true);
    try {
      await api.post(`/api/admin/surveys/${form.id}/waves/${waveId}/open`);
      await Promise.all([loadWaves(form.id), fetchSurveys()]);
      showToast("เปิดคลื่นแล้ว", "คลื่นนี้เปิดรับคำตอบแล้ว นักศึกษาในกลุ่มเป้าหมายจะเห็นแบบประเมิน");
    } catch (error) {
      setServerError(getErrorMessage(error, "ไม่สามารถเปิดคลื่นได้"));
    } finally {
      setWaveActionLoading(false);
    }
  };

  const handleCloseWave = async (waveId: string) => {
    if (!form.id) {
      return;
    }
    setWaveActionLoading(true);
    try {
      await api.post(`/api/admin/surveys/${form.id}/waves/${waveId}/close`);
      await Promise.all([loadWaves(form.id), fetchSurveys()]);
      showToast("ปิดคลื่นแล้ว", "คลื่นนี้ปิดรับคำตอบแล้ว ดูผลได้จากหน้ารายงานของแบบประเมิน");
    } catch (error) {
      setServerError(getErrorMessage(error, "ไม่สามารถปิดคลื่นได้"));
    } finally {
      setWaveActionLoading(false);
    }
  };

  /** ยกเลิกรอบที่ SCHEDULED/OPEN ผ่าน API แล้วรีโหลดรายการรอบและรายการแบบสอบถาม */
  const handleCancelWave = async (waveId: string) => {
    if (!form.id) {
      return;
    }
    setWaveActionLoading(true);
    setServerError("");
    try {
      await api.post(`/api/admin/surveys/${form.id}/waves/${waveId}/cancel`);
      assignmentRosterRequestRef.current += 1;
      setAssignmentRoster((current) => (current?.waveId === waveId ? null : current));
      setAssignmentRosterLoading(false);
      await Promise.all([loadWaves(form.id), fetchSurveys()]);
      showToast("ยกเลิกรอบแล้ว", "รอบนี้ถูกยกเลิก นักศึกษาจะไม่เห็นแบบประเมินจากรอบนี้อีก");
    } catch (error) {
      setServerError(getErrorMessage(error, "ไม่สามารถยกเลิกรอบได้"));
    } finally {
      setWaveActionLoading(false);
    }
  };

  /** โหลดรายชื่อมอบหมายของรอบตามตัวกรองสถานะ; ทิ้งผลเมื่อมีคำขอใหม่กว่าแซงหน้า */
  const handleLoadAssignments = async (waveId: string, status: SurveyAssignmentStatusFilter) => {
    if (!form.id) {
      return;
    }
    const requestId = assignmentRosterRequestRef.current + 1;
    assignmentRosterRequestRef.current = requestId;
    setAssignmentRosterLoading(true);
    setAssignmentRosterError("");
    try {
      const response = await api.get<SurveyAssignmentRosterResponse>(
        `/api/admin/surveys/${form.id}/waves/${waveId}/assignments`,
        { params: { status } }
      );
      if (assignmentRosterRequestRef.current !== requestId) {
        return;
      }
      setAssignmentRoster({
        waveId,
        status,
        rows: response.data.assignments || [],
        summary: response.data.summary,
      });
    } catch (error) {
      if (assignmentRosterRequestRef.current !== requestId) {
        return;
      }
      setAssignmentRoster(null);
      setAssignmentRosterError(getErrorMessage(error, "ไม่สามารถโหลดรายชื่อมอบหมายได้"));
    } finally {
      if (assignmentRosterRequestRef.current === requestId) {
        setAssignmentRosterLoading(false);
      }
    }
  };

  /** โหลดรายการเวอร์ชันของแบบสอบถาม; ทิ้งผลเมื่อมีคำขอใหม่กว่าแซง และไม่แสดง error (ไม่มีเวอร์ชัน = ไม่มี badge) */
  const loadVersions = useCallback(async (surveyId: string) => {
    const requestId = versionsRequestRef.current + 1;
    versionsRequestRef.current = requestId;
    try {
      const response = await api.get<{ versions: SurveyVersionSummary[] }>(
        `/api/admin/surveys/${surveyId}/versions`
      );
      if (versionsRequestRef.current === requestId) {
        setVersions(response.data.versions || []);
      }
    } catch {
      if (versionsRequestRef.current === requestId) {
        setVersions([]);
      }
    }
  }, []);

  /** ปิด modal พรีวิวและยกเลิกคำขอที่ค้างอยู่ ไม่ให้ผลเก่าเด้งกลับมาเปิดใหม่ */
  const handleClosePreview = useCallback(() => {
    previewRequestRef.current += 1;
    setPreviewOpen(false);
    setPreviewLoading(false);
    setPreviewData(null);
    setPreviewError("");
  }, []);

  // เปิด/ปิดหน้าแก้ไขหรือสลับแบบสอบถาม: โหลดเวอร์ชันใหม่ และปิด modal พรีวิว/เผยแพร่ของแบบเดิม
  useEffect(() => {
    handleClosePreview();
    setPublishOpen(false);
    if (editorOpen && form.id) {
      void loadVersions(form.id);
    } else {
      versionsRequestRef.current += 1;
      setVersions([]);
    }
  }, [editorOpen, form.id, handleClosePreview, loadVersions]);

  /** ทำสำเนาแบบสอบถามเป็นฉบับร่างใหม่ (ไม่เปิดใช้งาน) แล้วเปิดหน้าแก้ไขของฉบับใหม่ พร้อมรีเฟรชรายการ */
  const handleDuplicateSurvey = async (survey: Survey) => {
    setOpenMenuSurveyId(null);
    setDuplicatingId(survey.id);
    setServerError("");

    try {
      const response = await api.post<SurveyResponse>(`/api/admin/surveys/${survey.id}/duplicate`);
      openEditorWithForm(surveyToForm(response.data.survey));
      await fetchSurveys();
      showToast("ทำสำเนาแล้ว", "เปิดฉบับร่างใหม่ให้แก้ไข ยังไม่เปิดให้นักศึกษาทำ");
    } catch (error) {
      setServerError(getErrorMessage(error, "ไม่สามารถทำสำเนาแบบสอบถามได้"));
    } finally {
      setDuplicatingId(null);
    }
  };

  /** เปิด modal พรีวิวมุมมองนักศึกษาของแบบสอบถามที่บันทึกแล้ว (อ่านอย่างเดียว) */
  const handlePreviewSurvey = async () => {
    if (!form.id) {
      return;
    }

    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError("");
    setPreviewData(null);

    try {
      const response = await api.get<{ preview: SurveyAdminPreview }>(`/api/admin/surveys/${form.id}/preview`);
      if (previewRequestRef.current === requestId) {
        setPreviewData(response.data.preview);
      }
    } catch (error) {
      if (previewRequestRef.current === requestId) {
        setPreviewError(getErrorMessage(error, "ไม่สามารถโหลดพรีวิวได้"));
      }
    } finally {
      if (previewRequestRef.current === requestId) {
        setPreviewLoading(false);
      }
    }
  };

  /** เผยแพร่เวอร์ชันใหม่ (ส่ง scoringRules เฉพาะ CUSTOM ที่กรอก); คืนข้อความ error หรือ null เมื่อสำเร็จ */
  const handlePublishVersion = async (scoringRules: SurveyScoringRules | undefined): Promise<string | null> => {
    if (!form.id) {
      return "ต้องบันทึกแบบสอบถามก่อนจึงจะเผยแพร่เวอร์ชันได้";
    }

    setPublishingVersion(true);
    try {
      const response = await api.post<{ version: SurveyVersionSummary }>(
        `/api/admin/surveys/${form.id}/publish-version`,
        scoringRules ? { scoringRules } : {}
      );
      setPublishOpen(false);
      await Promise.all([loadVersions(form.id), fetchSurveys()]);
      showToast("เผยแพร่เวอร์ชันแล้ว", `ตรึงคำถามปัจจุบันเป็นเวอร์ชัน ${response.data.version.version}`);
      return null;
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status === 409) {
        return "มีการเผยแพร่เวอร์ชันพร้อมกัน กรุณาลองอีกครั้ง";
      }
      return getErrorMessage(error, "ไม่สามารถเผยแพร่เวอร์ชันได้");
    } finally {
      setPublishingVersion(false);
    }
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
      const nextForm = createBlankSurveyForm();
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
            <span className="text-xs font-semibold">เฉพาะผู้ดูแลระบบ</span>
          </div>
          <h1 className="text-xl font-semibold">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
          <p className="mt-2 text-sm">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>
          <Link href="/admin" className="mt-4 inline-flex rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium">
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
        <SurveyListView
          activeSurveys={activeSurveys}
          archivedSurveys={archivedSurveys}
          displaySurveys={displaySurveys}
          editorOpen={editorOpen}
          formatThaiDateTime={formatThaiDateTime}
          handleCreateNew={handleCreateNew}
          handleRequestDeleteSurvey={handleRequestDeleteSurvey}
          handleDuplicateSurvey={handleDuplicateSurvey}
          handleRestoreSurvey={handleRestoreSurvey}
          handleSelectSurvey={handleSelectSurvey}
          handleToggleSurveyActive={handleToggleSurveyActive}
          duplicatingId={duplicatingId}
          loadingData={loadingData}
          openMenuSurveyId={openMenuSurveyId}
          restoringId={restoringId}
          selectedFormId={form.id}
          serverError={serverError}
          setOpenMenuSurveyId={setOpenMenuSurveyId}
          setServerError={setServerError}
          setViewMode={setViewMode}
          statusLabels={statusLabels}
          surveys={surveys}
          togglingSurveyId={togglingSurveyId}
          viewMode={viewMode}
        />

        <SurveyEditorView
          activeQuestion={activeQuestion}
          activeQuestionClientId={activeQuestionClientId}
          addQuestion={addQuestion}
          addQuestionOption={addQuestionOption}
          changeQuestionType={changeQuestionType}
          averageScore={averageScore}
          editorOpen={editorOpen}
          exportResponsesCsv={exportResponsesCsv}
          focusQuestion={focusQuestion}
          form={form}
          formatSurveyPercent={formatSurveyPercent}
          formatSurveyScore={formatSurveyScore}
          formatThaiDateTime={formatThaiDateTime}
          getResponseDistressLevel={getResponseDistressLevel}
          ghq28DistressCounts={ghq28DistressCounts}
          ghq28DistressMeta={ghq28DistressMeta}
          handleRequestDeleteSurvey={handleRequestDeleteSurvey}
          handleSave={handleSave}
          highRiskResponseCount={highRiskResponseCount}
          isCurrentSurveyGhq28={isCurrentSurveyGhq28}
          loadingData={loadingData}
          moveQuestion={moveQuestion}
          removeQuestion={removeQuestion}
          removeQuestionOption={removeQuestionOption}
          responses={responses}
          saving={saving}
          selectedSurvey={selectedSurvey}
          serverError={serverError}
          setEditorOpen={setEditorOpen}
          setForm={setForm}
          setOpenMenuSurveyId={setOpenMenuSurveyId}
          setServerError={setServerError}
          statusLabels={statusLabels}
          surveyRiskMeta={surveyRiskMeta}
          updateQuestion={updateQuestion}
          updateQuestionOption={updateQuestionOption}
          waves={waves}
          eligibilityPreviewCount={eligibilityPreviewCount}
          eligibilityPreviewLoading={eligibilityPreviewLoading}
          waveActionLoading={waveActionLoading}
          onPreviewEligibility={handlePreviewEligibility}
          onCreateWave={handleCreateWave}
          onOpenWave={handleOpenWave}
          onCloseWave={handleCloseWave}
          onCancelWave={handleCancelWave}
          onLoadAssignments={handleLoadAssignments}
          assignmentRoster={assignmentRoster}
          assignmentRosterLoading={assignmentRosterLoading}
          assignmentRosterError={assignmentRosterError}
          versions={versions}
          duplicating={duplicatingId !== null}
          onPreviewSurvey={handlePreviewSurvey}
          onDuplicateSurvey={handleDuplicateSurvey}
          onOpenPublishVersion={() => setPublishOpen(true)}
        />
      </div>

      <SurveyPreviewModal
        open={previewOpen}
        loading={previewLoading}
        error={previewError}
        preview={previewData}
        onClose={handleClosePreview}
      />

      <SurveyPublishVersionModal
        open={publishOpen}
        isCustomInstrument={form.instrumentCode !== "GHQ28" && !isCurrentSurveyGhq28}
        publishing={publishingVersion}
        latestVersion={pickLatestVersion(versions)}
        onCancel={() => setPublishOpen(false)}
        onConfirm={handlePublishVersion}
      />

      {showTemplatePicker ? (
        <StaffModalOverlay panelClassName="max-w-xl">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900">สร้างแบบสอบถามใหม่</h3>
              <p className="mt-1 text-sm text-slate-500">เลือกเริ่มจากฟอร์มว่าง หรือใช้แม่แบบ GHQ-28</p>
            </div>
            <button
              type="button"
              onClick={() => setShowTemplatePicker(false)}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              aria-label="ปิด"
            >
              <X size={18} />
            </button>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => openEditorWithForm(createBlankSurveyForm())}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/40"
            >
              <FileText className="h-5 w-5 text-blue-700" />
              <p className="mt-3 text-sm font-bold text-slate-900">ฟอร์มว่าง</p>
              <p className="mt-1 text-xs text-slate-500">เริ่มจากคำถามเดียว แล้วเพิ่มเองได้เหมือน Google Forms</p>
            </button>
            <button
              type="button"
              onClick={() => openEditorWithForm(createGhq28SurveyForm())}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/40"
            >
              <FileText className="h-5 w-5 text-emerald-700" />
              <p className="mt-3 text-sm font-bold text-slate-900">แม่แบบ GHQ-28</p>
              <p className="mt-1 text-xs text-slate-500">โหลดชุดคำถามมาตรฐานพร้อมคะแนนคัดกรอง</p>
            </button>
          </div>
        </StaffModalOverlay>
      ) : null}
    </AdminShell>
  );
}
