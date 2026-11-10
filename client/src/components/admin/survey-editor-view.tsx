"use client";

import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import {
  AlertCircle,
  AlignLeft,
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
  Plus,
  SlidersHorizontal,
  Trash2,
  Type,
  Users,
  X,
} from "lucide-react";
import type {
  Ghq28DistressLevel,
  Survey,
  SurveyAudienceType,
  SurveyEligibilityRule,
  SurveyFrequency,
  SurveyInstrumentCode,
  SurveyQuestion,
  SurveyQuestionOption,
  SurveyQuestionType,
  SurveyResponseRow,
  SurveyRiskLevel,
  SurveyScheduleUnit,
  SurveyStatus,
  SurveyWaveSummary,
  WellnessTrendSignalCode,
} from "@/types/survey";
import { ConfirmSubmitLabel } from "@/components/ui/confirm-submit-label";
import { buildNextWaveDraft, toDateTimeLocalValue } from "@/lib/survey-schedule";

export type SurveyQuestionForm = Omit<SurveyQuestion, "id" | "order"> & {
  clientId: string;
  id?: string;
  order?: number;
};

export type SurveyFormState = {
  id?: string;
  title: string;
  description: string;
  status: SurveyStatus;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  frequency: SurveyFrequency;
  scheduleEvery: number | null;
  scheduleUnit: SurveyScheduleUnit | null;
  audienceType: SurveyAudienceType;
  instrumentCode: SurveyInstrumentCode;
  eligibilityRule: SurveyEligibilityRule;
  questions: SurveyQuestionForm[];
};

const frequencyLabels: Record<SurveyFrequency, string> = {
  ONE_SHOT: "ครั้งเดียว",
  WEEKLY: "รายสัปดาห์",
  ACADEMIC_TERM: "ตามเทอม (ระบุเอง)",
  CUSTOM_INTERVAL: "กำหนดเอง (กี่วัน/กี่เดือน)",
};

const scheduleUnitLabels: Record<SurveyScheduleUnit, string> = {
  DAYS: "วัน",
  WEEKS: "สัปดาห์",
  MONTHS: "เดือน",
};

const waveStatusLabels: Record<string, string> = {
  SCHEDULED: "รอเปิด",
  OPEN: "เปิดอยู่",
  CLOSED: "ปิดแล้ว",
  CANCELLED: "ยกเลิก",
};

const audienceLabels: Record<SurveyAudienceType, string> = {
  ALL_STUDENTS: "นักศึกษาทุกคน",
  RULE_BASED: "เฉพาะกลุ่มตามเงื่อนไข",
};

const wellnessSignalLabels: Record<WellnessTrendSignalCode, string> = {
  DEPRESSIVE_THEME: "อารมณ์ซึมเศร้า",
  ANXIETY_THEME: "วิตกกังวล",
  ACADEMIC_STRESS: "เครียดเรียน",
  SLEEP_DISTURBANCE: "นอนไม่หลับ",
  LONELINESS_ISOLATION: "เหงา/โดดเดี่ยว",
  RELATIONSHIP_STRESS: "ความสัมพันธ์",
  BURNOUT_FATIGUE: "เหนื่อยล้า",
  SELF_HARM_CRISIS: "สัญญาณวิกฤต",
};

const riskLevelLabels: Record<SurveyRiskLevel, string> = {
  NORMAL: "ปกติ",
  MEDIUM: "ปานกลาง",
  HIGH: "สูง",
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

type SurveyEditorViewProps = {
  editorOpen: boolean;
  averageScore: number | null;
  form: SurveyFormState;
  setForm: Dispatch<SetStateAction<SurveyFormState>>;
  activeQuestion: SurveyQuestionForm | null;
  activeQuestionClientId: string | null;
  responses: SurveyResponseRow[];
  loadingData: boolean;
  saving: boolean;
  serverError: string;
  setServerError: Dispatch<SetStateAction<string>>;
  setEditorOpen: Dispatch<SetStateAction<boolean>>;
  setOpenMenuSurveyId: Dispatch<SetStateAction<string | null>>;
  isCurrentSurveyGhq28: boolean;
  ghq28DistressCounts: Record<Ghq28DistressLevel, number>;
  highRiskResponseCount: number;
  statusLabels: Record<SurveyStatus, string>;
  surveyRiskMeta: Record<SurveyRiskLevel, { className: string; label: string }>;
  ghq28DistressMeta: Record<Ghq28DistressLevel, { className: string; label: string }>;
  formatThaiDateTime: (value: string | null) => string;
  formatSurveyScore: (response: SurveyResponseRow) => string;
  formatSurveyPercent: (response: SurveyResponseRow) => string;
  getResponseDistressLevel: (response: SurveyResponseRow) => Ghq28DistressLevel | null;
  focusQuestion: (clientId: string) => void;
  changeQuestionType: (clientId: string, type: SurveyQuestionType) => void;
  addQuestion: (type?: SurveyQuestionType, afterClientId?: string) => void;
  removeQuestion: (clientId: string) => void;
  moveQuestion: (clientId: string, direction: -1 | 1) => void;
  updateQuestion: (clientId: string, nextQuestion: Partial<SurveyQuestionForm>) => void;
  updateQuestionOption: (
    questionClientId: string,
    optionIndex: number,
    nextOption: Partial<SurveyQuestionOption>
  ) => void;
  addQuestionOption: (questionClientId: string) => void;
  removeQuestionOption: (questionClientId: string, optionIndex: number) => void;
  handleSave: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  handleRequestDeleteSurvey: (survey: Survey) => void | Promise<void>;
  exportResponsesCsv: () => void;
  selectedSurvey: Survey | null;
  waves?: SurveyWaveSummary[];
  eligibilityPreviewCount?: number | null;
  eligibilityPreviewLoading?: boolean;
  waveActionLoading?: boolean;
  onPreviewEligibility?: () => void | Promise<void>;
  onCreateWave?: (input: {
    label: string;
    openNow: boolean;
    opensAt?: string | null;
    closesAt?: string | null;
    termKey?: string | null;
    weekStart?: string | null;
  }) => void | Promise<void>;
  onOpenWave?: (waveId: string) => void | Promise<void>;
  onCloseWave?: (waveId: string) => void | Promise<void>;
};

export function SurveyEditorView(props: SurveyEditorViewProps) {
  const {
    editorOpen,
    averageScore,
    form,
    setForm,
    activeQuestion,
    activeQuestionClientId,
    selectedSurvey,
    responses,
    loadingData,
    saving,
    serverError,
    setServerError,
    setEditorOpen,
    setOpenMenuSurveyId,
    isCurrentSurveyGhq28,
    waves = [],
    eligibilityPreviewCount = null,
    eligibilityPreviewLoading = false,
    waveActionLoading = false,
    onPreviewEligibility,
    onCreateWave,
    onOpenWave,
    onCloseWave,
    ghq28DistressCounts,
    highRiskResponseCount,
    statusLabels,
    surveyRiskMeta,
    ghq28DistressMeta,
    formatThaiDateTime,
    formatSurveyScore,
    formatSurveyPercent,
    getResponseDistressLevel,
    focusQuestion,
    changeQuestionType,
    addQuestion,
    removeQuestion,
    moveQuestion,
    updateQuestion,
    updateQuestionOption,
    addQuestionOption,
    removeQuestionOption,
    handleSave,
    handleRequestDeleteSurvey,
    exportResponsesCsv,
  } = props;

  const suggestedWave = useMemo(() => {
    const lastOpensAt = waves[0]?.opensAt ? new Date(waves[0].opensAt) : null;
    return buildNextWaveDraft({
      frequency: form.frequency,
      scheduleEvery: form.scheduleEvery,
      scheduleUnit: form.scheduleUnit,
      lastOpensAt,
      termKey: waves[0]?.termKey || null,
    });
  }, [form.frequency, form.scheduleEvery, form.scheduleUnit, waves]);

  const [waveLabel, setWaveLabel] = useState("");
  const [waveOpensAt, setWaveOpensAt] = useState("");
  const [waveClosesAt, setWaveClosesAt] = useState("");
  const [waveTermKey, setWaveTermKey] = useState("");
  const [waveOpenNow, setWaveOpenNow] = useState(true);

  const applySuggestedWave = () => {
    setWaveLabel(suggestedWave.label);
    setWaveOpensAt(toDateTimeLocalValue(suggestedWave.opensAt));
    setWaveClosesAt(toDateTimeLocalValue(suggestedWave.closesAt));
    setWaveTermKey(suggestedWave.termKey || "");
    setWaveOpenNow(true);
  };

  const showOptionScores = form.instrumentCode === "GHQ28" || isCurrentSurveyGhq28;

  return editorOpen ? (
      <div
        className="fixed inset-0 z-[220] !mt-0 flex items-center justify-center overflow-hidden bg-slate-950/35 p-3 sm:p-4"
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
                  <ConfirmSubmitLabel busy={saving}>บันทึกแบบสอบถาม</ConfirmSubmitLabel>
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

              <div className="lg:col-span-2">
                <label htmlFor="survey-frequency" className="mb-2 block text-sm font-bold text-slate-700">
                  ความถี่ / รอบเปิด
                </label>
                <select
                  id="survey-frequency"
                  value={form.frequency}
                  onChange={(event) => {
                    const frequency = event.target.value as SurveyFrequency;
                    setForm((current) => ({
                      ...current,
                      frequency,
                      scheduleEvery:
                        frequency === "CUSTOM_INTERVAL" ? current.scheduleEvery || 14 : null,
                      scheduleUnit:
                        frequency === "CUSTOM_INTERVAL" ? current.scheduleUnit || "DAYS" : null,
                    }));
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                >
                  {Object.entries(frequencyLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-slate-500">
                  ใช้ช่วยคำนวณรอบถัดไป — เปิด–ปิดจริงยังกดยืนยันเองได้ เพราะวันเปิดเทอมไม่ตายตัว
                </p>
              </div>

              {form.frequency === "CUSTOM_INTERVAL" ? (
                <div className="grid grid-cols-2 gap-3 lg:col-span-2">
                  <div>
                    <label htmlFor="survey-schedule-every" className="mb-2 block text-sm font-bold text-slate-700">
                      ทุกกี่ช่วง
                    </label>
                    <input
                      id="survey-schedule-every"
                      type="number"
                      min={1}
                      max={365}
                      value={form.scheduleEvery ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          scheduleEvery: event.target.value ? Number(event.target.value) : null,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="survey-schedule-unit" className="mb-2 block text-sm font-bold text-slate-700">
                      หน่วย
                    </label>
                    <select
                      id="survey-schedule-unit"
                      value={form.scheduleUnit || "DAYS"}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          scheduleUnit: event.target.value as SurveyScheduleUnit,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    >
                      {Object.entries(scheduleUnitLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              <div>
                <label htmlFor="survey-instrument" className="mb-2 block text-sm font-bold text-slate-700">
                  เครื่องมือ
                </label>
                <select
                  id="survey-instrument"
                  value={form.instrumentCode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      instrumentCode: event.target.value as SurveyInstrumentCode,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="GHQ28">GHQ-28</option>
                  <option value="CUSTOM">กำหนดเอง</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label htmlFor="survey-audience" className="mb-2 block text-sm font-bold text-slate-700">
                  กลุ่มเป้าหมาย
                </label>
                <select
                  id="survey-audience"
                  value={form.audienceType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      audienceType: event.target.value as SurveyAudienceType,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                >
                  {Object.entries(audienceLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-slate-500">
                  นักศึกษาจะไม่เห็นว่าถูกคัดเลือกเพราะเงื่อนไขใด — ระบบแสดงแค่แบบที่เปิดให้ทำ
                </p>
              </div>

              {form.audienceType === "RULE_BASED" ? (
                <div className="lg:col-span-2 space-y-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <div>
                    <p className="text-sm font-bold text-slate-800">ความเสี่ยงจากผลรอบก่อน</p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {(Object.keys(riskLevelLabels) as SurveyRiskLevel[]).map((level) => {
                        const checked = form.eligibilityRule.priorRiskLevels.includes(level);
                        return (
                          <label key={level} className="inline-flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setForm((current) => ({
                                  ...current,
                                  eligibilityRule: {
                                    ...current.eligibilityRule,
                                    priorRiskLevels: checked
                                      ? current.eligibilityRule.priorRiskLevels.filter((item) => item !== level)
                                      : [...current.eligibilityRule.priorRiskLevels, level],
                                  },
                                }))
                              }
                            />
                            {riskLevelLabels[level]}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-800">สัญญาณจากแชท</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {(Object.keys(wellnessSignalLabels) as WellnessTrendSignalCode[]).map((code) => {
                        const checked = form.eligibilityRule.wellnessSignalCodes.includes(code);
                        return (
                          <label key={code} className="inline-flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setForm((current) => ({
                                  ...current,
                                  eligibilityRule: {
                                    ...current.eligibilityRule,
                                    wellnessSignalCodes: checked
                                      ? current.eligibilityRule.wellnessSignalCodes.filter((item) => item !== code)
                                      : [...current.eligibilityRule.wellnessSignalCodes, code],
                                  },
                                }))
                              }
                            />
                            {wellnessSignalLabels[code]}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-700" htmlFor="rule-years">
                        ชั้นปี (คั่นด้วยจุลภาค)
                      </label>
                      <input
                        id="rule-years"
                        type="text"
                        value={form.eligibilityRule.studyYears.join(",")}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            eligibilityRule: {
                              ...current.eligibilityRule,
                              studyYears: event.target.value
                                .split(",")
                                .map((part) => Number(part.trim()))
                                .filter((value) => Number.isInteger(value) && value > 0),
                            },
                          }))
                        }
                        placeholder="1,2,3,4"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                      <p className="mt-1.5 text-xs text-slate-500">ตรงกับชั้นปีในโปรไฟล์นิสิต</p>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-700" htmlFor="rule-sections">
                        เซค / กลุ่ม (คั่นด้วยจุลภาค)
                      </label>
                      <input
                        id="rule-sections"
                        type="text"
                        value={form.eligibilityRule.sections.join(",")}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            eligibilityRule: {
                              ...current.eligibilityRule,
                              sections: event.target.value
                                .split(",")
                                .map((part) => part.trim())
                                .filter(Boolean),
                            },
                          }))
                        }
                        placeholder="A,B"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                      <p className="mt-1.5 text-xs text-slate-500">
                        คือกลุ่ม/เซคของนิสิตในระบบ (เช่น A, B) ไม่ใช่ช่วงเวลาเรียน
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={!onPreviewEligibility || eligibilityPreviewLoading}
                      onClick={() => void onPreviewEligibility?.()}
                      className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {eligibilityPreviewLoading ? "กำลังนับ..." : "ดูจำนวนที่เข้าเกณฑ์"}
                    </button>
                    {eligibilityPreviewCount !== null ? (
                      <p className="text-sm font-semibold text-slate-700">
                        ประมาณ {eligibilityPreviewCount.toLocaleString()} คน
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          {form.id ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-base font-black text-slate-900">คลื่น / รอบเปิด</h3>
                <p className="mt-1 text-sm text-slate-500">
                  ตั้งชื่อรอบ วันเปิด–ปิด และรหัสเทอมได้เอง กดเติมค่าแนะนำจากความถี่ได้ถ้าต้องการ
                </p>
              </div>

              <div className="mb-4 space-y-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-800">เปิดรอบใหม่</p>
                  <button
                    type="button"
                    onClick={applySuggestedWave}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    เติมค่าแนะนำจากความถี่
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-bold text-slate-600">ชื่อรอบ</label>
                    <input
                      type="text"
                      value={waveLabel}
                      onChange={(event) => setWaveLabel(event.target.value)}
                      placeholder={suggestedWave.label}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-600">วันเวลาเปิด</label>
                    <input
                      type="datetime-local"
                      value={waveOpensAt}
                      onChange={(event) => setWaveOpensAt(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-600">วันเวลาปิด (ว่างได้)</label>
                    <input
                      type="datetime-local"
                      value={waveClosesAt}
                      onChange={(event) => setWaveClosesAt(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-600">รหัสเทอม / รอบ (เช่น 1/2569)</label>
                    <input
                      type="text"
                      value={waveTermKey}
                      onChange={(event) => setWaveTermKey(event.target.value)}
                      placeholder="ใส่เมื่อเปิดตามเทอม"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex min-h-[42px] w-full cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={waveOpenNow}
                        onChange={(event) => setWaveOpenNow(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      เปิดให้นักศึกษาทันที
                    </label>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={waveActionLoading || !onCreateWave || !(waveLabel.trim() || suggestedWave.label)}
                    onClick={() =>
                      void onCreateWave?.({
                        label: waveLabel.trim() || suggestedWave.label,
                        openNow: waveOpenNow,
                        opensAt: waveOpensAt || toDateTimeLocalValue(suggestedWave.opensAt),
                        closesAt: waveClosesAt || null,
                        termKey: waveTermKey.trim() || suggestedWave.termKey,
                        weekStart: suggestedWave.weekStart
                          ? suggestedWave.weekStart.toISOString()
                          : null,
                      })
                    }
                    className="inline-flex min-h-10 items-center rounded-lg bg-blue-700 px-3 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60"
                  >
                    {waveOpenNow ? "สร้างและเปิดรอบนี้" : "สร้างรอบ (ยังไม่เปิด)"}
                  </button>
                </div>
              </div>

              {waves.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  ยังไม่มีรอบ — บันทึกแบบสอบถามแล้วเปิดรอบด้านบน หรือติ๊ก “เปิดให้นักศึกษาทำ” ตอนบันทึก
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2">ชื่อรอบ</th>
                        <th className="px-3 py-2">สถานะ</th>
                        <th className="px-3 py-2">เปิด</th>
                        <th className="px-3 py-2">ปิด</th>
                        <th className="px-3 py-2">เทอม</th>
                        <th className="px-3 py-2">ส่งแล้ว</th>
                        <th className="px-3 py-2">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {waves.map((wave) => (
                        <tr key={wave.id}>
                          <td className="px-3 py-2 font-semibold text-slate-900">{wave.label}</td>
                          <td className="px-3 py-2 text-slate-600">
                            {waveStatusLabels[wave.status] || "ไม่ทราบสถานะ"}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{formatThaiDateTime(wave.opensAt)}</td>
                          <td className="px-3 py-2 text-slate-600">{formatThaiDateTime(wave.closesAt)}</td>
                          <td className="px-3 py-2 text-slate-600">{wave.termKey || "-"}</td>
                          <td className="px-3 py-2 text-slate-600">
                            {(wave.responseCount ?? 0).toLocaleString()} / {(wave.assignmentCount ?? 0).toLocaleString()}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-2">
                              {wave.status !== "OPEN" ? (
                                <button
                                  type="button"
                                  disabled={waveActionLoading}
                                  onClick={() => void onOpenWave?.(wave.id)}
                                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"
                                >
                                  เปิด
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={waveActionLoading}
                                  onClick={() => void onCloseWave?.(wave.id)}
                                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700"
                                >
                                  ปิด
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : (
            <section className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 p-4 text-sm font-medium text-blue-900">
              บันทึกแบบสอบถามก่อน แล้วค่อยเปิดรอบให้นักศึกษา — หรือติ๊ก “เปิดให้นักศึกษาทำ” ตอนบันทึกครั้งแรกก็ได้
            </section>
          )}

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
                            className={`grid gap-2 rounded-xl border border-slate-100 bg-white p-2 ${
                              showOptionScores
                                ? "sm:grid-cols-[minmax(0,1fr)_minmax(7rem,10rem)_7rem_2.5rem]"
                                : "sm:grid-cols-[minmax(0,1fr)_2.5rem]"
                            }`}
                          >
                            <input
                              type="text"
                              value={option.label}
                              onChange={(event) => {
                                const label = event.target.value;
                                updateQuestionOption(activeQuestion.clientId, optionIndex, {
                                  label,
                                  value: showOptionScores
                                    ? option.value
                                    : label.trim() || `option_${optionIndex + 1}`,
                                });
                              }}
                              placeholder="ข้อความตัวเลือก"
                              className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />
                            {showOptionScores ? (
                              <>
                                <input
                                  type="text"
                                  value={option.value}
                                  onChange={(event) =>
                                    updateQuestionOption(activeQuestion.clientId, optionIndex, {
                                      value: event.target.value,
                                    })
                                  }
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
                              </>
                            ) : null}
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
  ) : null;
}
