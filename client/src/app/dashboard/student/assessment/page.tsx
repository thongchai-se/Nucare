"use client";

import { useEffect, useState } from "react";
import {
  ClipboardEdit,
  FileSpreadsheet,
  ShieldCheck,
} from "lucide-react";
import { OrientationSurveyModal } from "@/components/orientation-survey-modal";
import { RoleToast, type RoleToastTone } from "@/components/role-toast";
import { StudentPageShell } from "@/components/student-page-shell";
import api from "@/lib/axios";
import {
  type ActiveStudentSurveyResponse,
  getApiErrorMessage,
} from "@/lib/student-dashboard";
import type { Survey } from "@/types/survey";

type StudentToastState = {
  description: string;
  open: boolean;
  title: string;
  tone: RoleToastTone;
};

function StudentAssessmentContent() {
  const [loadingData, setLoadingData] = useState(true);
  const [serverError, setServerError] = useState("");
  const [toast, setToast] = useState<StudentToastState>({
    open: false,
    tone: "success",
    title: "",
    description: "",
  });
  const [activeSurvey, setActiveSurvey] = useState<Survey | null>(null);
  const [activeSurveySubmittedAt, setActiveSurveySubmittedAt] = useState<string | null>(null);
  const [hasSubmittedActiveSurvey, setHasSubmittedActiveSurvey] = useState(false);
  const [orientationSurveyModalOpen, setOrientationSurveyModalOpen] = useState(false);

  useEffect(() => {
    const loadAssessmentPage = async () => {
      setLoadingData(true);
      setServerError("");

      try {
        const surveyResponse = await api.get<ActiveStudentSurveyResponse>("/api/student/surveys/active");

        setActiveSurvey(surveyResponse.data.survey);
        setHasSubmittedActiveSurvey(surveyResponse.data.hasSubmitted);
        setActiveSurveySubmittedAt(surveyResponse.data.response?.submittedAt || null);
      } catch (error) {
        setServerError(getApiErrorMessage(error, "ไม่สามารถโหลดข้อมูลแบบประเมินได้"));
      } finally {
        setLoadingData(false);
      }
    };

    void loadAssessmentPage();
  }, []);

  useEffect(() => {
    if (!toast.open) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToast((current) => ({ ...current, open: false }));
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [toast.open]);

  return (
    <>
      <RoleToast
        description={toast.description}
        open={toast.open}
        title={toast.title}
        tone={toast.tone}
        zIndexClassName="z-[300]"
      />

      {serverError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          {serverError}
        </div>
      )}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="bg-[linear-gradient(135deg,#f8fafc_0%,#eef6ff_60%,#ecfeff_100%)] p-5 sm:p-7 lg:p-8">
            <div className="flex w-fit items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5" />
              อิงเฉพาะแบบประเมินที่ผู้ดูแลระบบเปิดใช้งาน
            </div>
            <div className="mt-6 max-w-3xl">
              <h1 className="font-display text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
                ทำแบบประเมิน
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                ตรวจสถานะแบบประเมินที่เปิดอยู่ ส่งคำตอบ และดูผลล่าสุดในหน้าเดียวโดยไม่ต้องไล่หาในหน้าหลัก
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
            <div className="p-5">
              <p className="text-xs font-semibold text-slate-500">แบบประเมินที่เปิดอยู่</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">{activeSurvey ? "1" : "0"}</p>
            </div>
            <div className="p-5">
              <p className="text-xs font-semibold text-slate-500">สถานะล่าสุด</p>
              <p className="mt-1 text-lg font-bold text-slate-950">
                {hasSubmittedActiveSurvey ? "ส่งแล้ว" : activeSurvey ? "รอทำแบบประเมิน" : "ไม่มีรอบประเมิน"}
              </p>
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
          <section className="rounded-lg border border-blue-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                  hasSubmittedActiveSurvey ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                }`}>
                  {hasSubmittedActiveSurvey ? <ShieldCheck className="h-5 w-5" /> : <FileSpreadsheet className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h2 className="min-w-0 text-xl font-bold text-slate-950">
                      {activeSurvey ? activeSurvey.title : "ยังไม่มีแบบประเมินที่เปิดอยู่"}
                    </h2>
                    {hasSubmittedActiveSurvey && (
                      <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        ทำแล้ว
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {activeSurvey?.description ||
                      "ระบบจะแสดงแบบประเมินในหน้านี้เมื่อผู้ดูแลระบบเปิดรอบประเมินให้ทำ"}
                  </p>
                  {activeSurvey && !hasSubmittedActiveSurvey ? (
                    <p className="mt-2 text-sm font-bold text-blue-700">
                      {activeSurvey.questionCount} คำถามที่เปิดรับคำตอบอยู่
                    </p>
                  ) : null}
                </div>
              </div>

              {!hasSubmittedActiveSurvey && (
                <button
                  type="button"
                  onClick={() => setOrientationSurveyModalOpen(true)}
                  disabled={!activeSurvey}
                  className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
                >
                  <ClipboardEdit className="h-4 w-4" />
                  ทำแบบประเมิน
                </button>
              )}
            </div>
          </section>
        </>
      )}

      <OrientationSurveyModal
        open={orientationSurveyModalOpen}
        survey={activeSurvey}
        hasSubmitted={hasSubmittedActiveSurvey}
        submittedAt={activeSurveySubmittedAt}
        onClose={() => setOrientationSurveyModalOpen(false)}
        onSubmitted={(response) => {
          setActiveSurveySubmittedAt(response.submittedAt);
          setHasSubmittedActiveSurvey(true);
          setOrientationSurveyModalOpen(false);
          setToast({
            open: true,
            tone: "success",
            title: "ส่งแบบสอบถามสำเร็จ",
            description: "ระบบบันทึกคำตอบของคุณเรียบร้อยแล้ว",
          });
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
