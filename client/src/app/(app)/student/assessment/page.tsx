"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ClipboardEdit,
  FileSpreadsheet,
  ShieldCheck,
} from "lucide-react";
import { OrientationSurveyModal } from "@/components/orientation-survey-modal";
import { RoleToast, type RoleToastTone } from "@/components/role-toast";
import { StudentPageShell } from "@/components/student-page-shell";
import { InlineAlert } from "@/components/ui/inline-alert";
import api from "@/lib/axios";
import {
  type ActiveStudentSurveyResponse,
  getApiErrorMessage,
} from "@/lib/student-dashboard";
import type { ActiveStudentSurveyResult, StudentFacingSurvey, Survey } from "@/types/survey";

type StudentToastState = {
  description: string;
  open: boolean;
  title: string;
  tone: RoleToastTone;
};

type StudentSurveyItem = Survey | StudentFacingSurvey;

/** สถานะแบบประเมินที่กำลังเปิดในหน้าต่างทำ/ดูผล (แยกจากรายการที่ค้างอยู่) */
type ModalSurveyState = {
  hasSubmitted: boolean;
  result: ActiveStudentSurveyResult | null;
  submittedAt: string | null;
  survey: StudentSurveyItem;
};

/** จำนวนคำถามของแบบประเมิน รองรับทั้ง payload ของนักศึกษา (questions) และแบบเต็ม (questionCount) */
const getSurveyQuestionCount = (survey: StudentSurveyItem): number => {
  if (Array.isArray(survey.questions)) {
    return survey.questions.length;
  }
  return Number((survey as Survey).questionCount || 0);
};

/** กำหนดปิดรับของรอบ (ถ้ามี) เป็นข้อความภาษาไทย หรือ null เมื่อไม่มี/อ่านค่าไม่ได้ */
const getSurveyClosesAtLabel = (survey: StudentSurveyItem): string | null => {
  const closesAt = "closesAt" in survey ? survey.closesAt : null;
  if (!closesAt) {
    return null;
  }
  const date = new Date(closesAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(date);
};

const getSurveyKey = (survey: StudentSurveyItem): string =>
  "waveId" in survey && survey.waveId ? survey.waveId : survey.id;

function StudentAssessmentContent() {
  const [loadingData, setLoadingData] = useState(true);
  const [serverError, setServerError] = useState("");
  const [toast, setToast] = useState<StudentToastState>({
    open: false,
    tone: "success",
    title: "",
    description: "",
  });
  const [pendingSurveys, setPendingSurveys] = useState<StudentSurveyItem[]>([]);
  const [primarySurvey, setPrimarySurvey] = useState<StudentSurveyItem | null>(null);
  const [primarySubmittedAt, setPrimarySubmittedAt] = useState<string | null>(null);
  const [hasSubmittedActiveSurvey, setHasSubmittedActiveSurvey] = useState(false);
  const [surveyResult, setSurveyResult] = useState<ActiveStudentSurveyResult | null>(null);
  const [modalState, setModalState] = useState<ModalSurveyState | null>(null);
  const [orientationSurveyModalOpen, setOrientationSurveyModalOpen] = useState(false);

  /** โหลดรายการแบบประเมินที่เปิดอยู่จาก API; `silent` ใช้หลังส่งเพื่อไม่ให้หน้าจอกะพริบเป็นสถานะโหลด */
  const loadActiveSurveys = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadingData(true);
    }
    setServerError("");

    try {
      const { data } = await api.get<ActiveStudentSurveyResponse>("/api/student/surveys/active");
      // เมื่อทำครบแล้ว API คืน surveys[] เป็นรอบที่ทำเสร็จเพื่อความเข้ากันได้ย้อนหลัง จึงนับเป็นค้างเฉพาะตอนที่ยังไม่ครบ
      const pending = data.hasSubmitted ? [] : data.surveys ?? (data.survey ? [data.survey] : []);

      setPendingSurveys(pending);
      setPrimarySurvey(data.survey);
      setHasSubmittedActiveSurvey(data.hasSubmitted);
      setPrimarySubmittedAt(data.response?.submittedAt || null);
      setSurveyResult(data.response ?? null);
    } catch (error) {
      setServerError(getApiErrorMessage(error, "ไม่สามารถโหลดข้อมูลแบบประเมินได้"));
    } finally {
      if (!silent) {
        setLoadingData(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadActiveSurveys();
  }, [loadActiveSurveys]);

  const pendingCount = pendingSurveys.length;
  const hasPending = pendingCount > 0;
  const showCompletedCard = Boolean(primarySurvey) && Boolean(surveyResult) && (hasSubmittedActiveSurvey || hasPending);

  const statusLabel = useMemo(() => {
    if (hasPending) {
      return "รอทำแบบประเมิน";
    }
    return hasSubmittedActiveSurvey ? "ส่งแล้ว" : "ไม่มีรอบประเมิน";
  }, [hasPending, hasSubmittedActiveSurvey]);

  const openSurveyToAnswer = (survey: StudentSurveyItem) => {
    setModalState({ survey, hasSubmitted: false, result: null, submittedAt: null });
    setOrientationSurveyModalOpen(true);
  };

  const openSubmittedResult = () => {
    if (!primarySurvey) {
      return;
    }
    setModalState({
      survey: primarySurvey,
      hasSubmitted: true,
      result: surveyResult,
      submittedAt: primarySubmittedAt,
    });
    setOrientationSurveyModalOpen(true);
  };

  return (
    <>
      <RoleToast
        description={toast.description}
        open={toast.open}
        onClose={() => setToast((current) => ({ ...current, open: false }))}
        title={toast.title}
        tone={toast.tone}
        zIndexClassName="z-[300]"
      />

      {serverError ? <InlineAlert className="shadow-sm">{serverError}</InlineAlert> : null}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="bg-[linear-gradient(135deg,#f8fafc_0%,#eef6ff_60%,#ecfeff_100%)] p-5 sm:p-7 lg:p-8">
            <div className="flex w-fit items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5" />
              แบบประเมินที่เปิดให้ทำในรอบนี้
            </div>
            <div className="mt-6 max-w-3xl">
              <h1 className="font-display text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
                ทำแบบประเมิน
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                เมื่อมีแบบประเมินเปิดอยู่ ระบบจะแสดงให้ทำที่นี่ — ตอบตามความเป็นจริงได้ตามสบาย
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
            <div className="p-5">
              <p className="text-xs font-semibold text-slate-500">แบบประเมินที่รอทำ</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{pendingCount}</p>
            </div>
            <div className="p-5">
              <p className="text-xs font-semibold text-slate-500">สถานะล่าสุด</p>
              <p className="mt-1 text-lg font-bold text-slate-950">{statusLabel}</p>
            </div>
          </div>
        </div>
      </section>

      {loadingData ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <span className="loader mx-auto h-6 w-6 text-blue-600"></span>
          <p className="mt-3 text-sm font-medium text-slate-500">กำลังโหลดข้อมูลแบบประเมิน...</p>
        </div>
      ) : (
        <>
          {hasPending ? (
            <section aria-label="แบบประเมินที่รอทำ" className="space-y-3">
              {pendingSurveys.map((survey) => {
                const closesAtLabel = getSurveyClosesAtLabel(survey);
                return (
                  <article
                    key={getSurveyKey(survey)}
                    className="rounded-lg border border-blue-200 bg-white p-5 shadow-sm sm:p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 flex-1 items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                          <FileSpreadsheet className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <h2 className="min-w-0 text-xl font-bold text-slate-950">{survey.title}</h2>
                            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                              <span className="h-2 w-2 rounded-full bg-amber-500" />
                              รอทำ
                            </span>
                          </div>
                          {survey.description ? (
                            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-600">
                              {survey.description}
                            </p>
                          ) : null}
                          <p className="mt-2 text-sm font-bold text-blue-700">
                            {getSurveyQuestionCount(survey)} คำถาม
                          </p>
                          {closesAtLabel ? (
                            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-600">
                              <CalendarClock className="h-4 w-4 text-slate-400" />
                              ปิดรับ {closesAtLabel}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openSurveyToAnswer(survey)}
                        className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-800 sm:w-auto"
                      >
                        <ClipboardEdit className="h-4 w-4" />
                        ทำแบบประเมิน
                      </button>
                    </div>
                  </article>
                );
              })}
            </section>
          ) : null}

          {showCompletedCard && primarySurvey && surveyResult ? (
            <section className="rounded-lg border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h2 className="min-w-0 text-xl font-bold text-slate-950">{primarySurvey.title}</h2>
                      <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        ทำแล้ว
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      ส่งเมื่อ {primarySubmittedAt ? new Date(primarySubmittedAt).toLocaleString("th-TH") : "-"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openSubmittedResult}
                  className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-blue-200 hover:text-blue-700 sm:w-auto"
                >
                  ดูผลและเกณฑ์อีกครั้ง
                </button>
              </div>

              <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                  <p className="text-xs font-semibold text-slate-500">คะแนนรวม</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                    {surveyResult.totalScore != null ? surveyResult.totalScore : "—"}
                    {surveyResult.totalScore != null &&
                    surveyResult.maxScore != null &&
                    surveyResult.maxScore > 0 ? (
                      <span className="text-base font-semibold text-slate-500"> / {surveyResult.maxScore}</span>
                    ) : null}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                  <p className="text-xs font-semibold text-slate-500">ผลตามเกณฑ์</p>
                  <p className="mt-1 text-base font-bold leading-snug text-slate-900">
                    {surveyResult.distressLabel ||
                      (surveyResult.totalScore != null ? "ดูรายละเอียดเกณฑ์ในแบบประเมิน" : "บันทึกคำตอบแล้ว")}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                ผลนี้เป็นข้อมูลเพื่อดูแลตนเอง — หากรู้สึกหนักหรืออยากคุยกับคนจริง ใช้เมนูที่ปรึกษาได้
              </p>
            </section>
          ) : !hasPending ? (
            <section className="rounded-lg border border-blue-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-slate-950">ยังไม่มีแบบประเมินที่เปิดอยู่</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    ระบบจะแสดงแบบประเมินในหน้านี้เมื่อผู้ดูแลระบบเปิดรอบประเมินให้ทำ
                  </p>
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}

      <OrientationSurveyModal
        open={orientationSurveyModalOpen}
        survey={modalState?.survey ?? null}
        hasSubmitted={modalState?.hasSubmitted ?? false}
        submittedAt={modalState?.submittedAt ?? null}
        result={modalState?.result ?? null}
        onClose={() => setOrientationSurveyModalOpen(false)}
        onSubmitted={(response) => {
          // คงหน้าต่างไว้เพื่อแสดงผลของรอบที่เพิ่งส่ง ส่วนรายการด้านหลังรีโหลดให้รอบที่ทำแล้วหลุดจากรายการค้าง
          setModalState((current) =>
            current
              ? { ...current, hasSubmitted: true, result: response, submittedAt: response.submittedAt }
              : current
          );
          setToast({
            open: true,
            tone: "success",
            title: "ส่งแบบสอบถามสำเร็จ",
            description: "ดูผลและเกณฑ์ได้ในหน้าต่างนี้ หรือปิดหน้าต่างเพื่อกลับไปที่รายการ",
          });
          void loadActiveSurveys(true);
        }}
      />
    </>
  );
}

export default function StudentAssessmentPage() {
  return (
    <StudentPageShell activePage="assessment">
      {() => <StudentAssessmentContent />}
    </StudentPageShell>
  );
}
