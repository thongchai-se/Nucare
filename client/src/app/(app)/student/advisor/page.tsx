"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import {
  CalendarClock,
  CalendarX2,
  MessageSquare,
  Plus,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import { ConsultationTeacherCardRow } from "@/components/consultation-teacher-card";
import { RoleToast, type RoleToastTone } from "@/components/role-toast";
import { ConsultationScheduleActions } from "@/components/student/consultation-schedule-actions";
import { StudentCounselingRequestCard } from "@/components/student-counseling-request-card";
import { StudentEmergencyHelpCard } from "@/components/student-emergency-help-card";
import { StudentPageShell } from "@/components/student-page-shell";
import { ListPaginationFooter } from "@/components/ui/list-pagination-footer";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useListPagination } from "@/hooks/use-list-pagination";
import api from "@/lib/axios";
import {
  STUDENT_CANCEL_REASONS,
  consultationClosedBadgeClassName,
  consultationClosedStatusLabel,
  presentCloseNoteForStudent,
} from "@/lib/consultation-close";
import {
  STUDENT_HOME_UPCOMING_LIMIT,
  STUDENT_LIST_PREVIEW_LIMIT,
  countStudentActionQueue,
  hasOpenStudentConsultation,
  listAwaitingStudentResponses,
  listUpcomingConsultations,
  resolveAppointmentLocation,
  sanitizeStudentFacingNote,
} from "@/lib/student-consultation-inbox";
import {
  type ConsultationTeachersResponse,
  type StudentCareTeamMember,
  type StudentConsultationRequest,
  canStudentCancelConsultation,
  consultationStatusMeta,
  defaultConsultationTopics,
  defaultPreferredChannels,
  formatThaiDateTime,
  getApiErrorMessage,
} from "@/lib/student-dashboard";

type StudentToastState = {
  description: string;
  open: boolean;
  title: string;
  tone: RoleToastTone;
};

function StudentAdvisorContent() {
  const searchParams = useSearchParams();
  const teacherFromQuery = searchParams.get("teacher")?.trim() || "";
  const [loadingData, setLoadingData] = useState(true);
  const [serverError, setServerError] = useState("");
  const [toast, setToast] = useState<StudentToastState>({
    open: false,
    tone: "success",
    title: "",
    description: "",
  });
  const [careTeam, setCareTeam] = useState<StudentCareTeamMember[]>([]);
  const [consultationRequests, setConsultationRequests] = useState<StudentConsultationRequest[]>([]);
  const [consultationTeachers, setConsultationTeachers] = useState<StudentCareTeamMember[]>([]);
  const [consultationTopics, setConsultationTopics] = useState(defaultConsultationTopics);
  const [canRequestExpertCounseling, setCanRequestExpertCounseling] = useState(true);
  const [expertCounselingDisabledReason, setExpertCounselingDisabledReason] = useState<string | null>(null);
  const [preferredChannels, setPreferredChannels] = useState(defaultPreferredChannels);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedConsultationTopic, setSelectedConsultationTopic] = useState(defaultConsultationTopics[0]);
  const [preferredConsultationChannel, setPreferredConsultationChannel] = useState("ONLINE");
  const [consultationNote, setConsultationNote] = useState("");
  const [consultationModalOpen, setConsultationModalOpen] = useState(false);
  const [isSubmittingConsultation, setIsSubmittingConsultation] = useState(false);
  const [isLoadingConsultationTeachers, setIsLoadingConsultationTeachers] = useState(false);
  const [didAutoOpenTeacher, setDidAutoOpenTeacher] = useState(false);
  const [cancellingRequestId, setCancellingRequestId] = useState<string | null>(null);
  const [pendingCancelRequestId, setPendingCancelRequestId] = useState<string | null>(null);

  useEffect(() => {
    const loadAdvisorPage = async () => {
      setLoadingData(true);
      setServerError("");

      try {
        const response = await api.get<{
          careTeam?: StudentCareTeamMember[];
          consultationRequests?: StudentConsultationRequest[];
          canRequestExpertCounseling?: boolean;
          openCounselingReferral?: { id: string; status: string } | null;
        }>("/api/student/dashboard");

        setCareTeam(response.data.careTeam || []);
        setConsultationRequests(response.data.consultationRequests || []);
        const canRequest = response.data.canRequestExpertCounseling !== false;
        setCanRequestExpertCounseling(canRequest);
        if (response.data.openCounselingReferral) {
          setExpertCounselingDisabledReason(
            response.data.openCounselingReferral.status === "ACCEPTED"
              ? "มีคิวผู้เชี่ยวชาญที่กำลังดูแลอยู่แล้ว"
              : "มีคำขอพบผู้เชี่ยวชาญรอรับอยู่แล้ว"
          );
        } else if (response.data.canRequestExpertCounseling === false) {
          setExpertCounselingDisabledReason("ยังไม่มีอาจารย์ที่ปรึกษาในระบบ กรุณาติดต่องานพัฒนานิสิต");
        } else {
          setExpertCounselingDisabledReason(null);
        }
      } catch (error) {
        setServerError(getApiErrorMessage(error, "ไม่สามารถโหลดข้อมูลที่ปรึกษาได้"));
      } finally {
        setLoadingData(false);
      }
    };

    void loadAdvisorPage();
  }, []);

  useEffect(() => {
    if (!consultationModalOpen) {
      return;
    }

    let isCurrent = true;
    const timer = window.setTimeout(() => {
      const loadTeachers = async () => {
        try {
          const response = await api.get<ConsultationTeachersResponse>("/api/student/consultation-teachers", {
            params: {
              search: teacherSearchQuery.trim() || undefined,
            },
          });

          if (!isCurrent) {
            return;
          }

          setConsultationTeachers(response.data.teachers);
          setConsultationTopics(response.data.topics.length > 0 ? response.data.topics : defaultConsultationTopics);
          const channels =
            Object.keys(response.data.preferredChannels || {}).length > 0
              ? response.data.preferredChannels
              : defaultPreferredChannels;
          const allowed = Object.fromEntries(
            Object.entries(channels).filter(([key]) => key === "ONLINE" || key === "IN_PERSON")
          );
          setPreferredChannels(Object.keys(allowed).length > 0 ? allowed : defaultPreferredChannels);
        } catch (error) {
          if (isCurrent) {
            setServerError(getApiErrorMessage(error, "ไม่สามารถค้นหาอาจารย์ได้"));
          }
        } finally {
          if (isCurrent) {
            setIsLoadingConsultationTeachers(false);
          }
        }
      };

      void loadTeachers();
    }, 250);

    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [consultationModalOpen, teacherSearchQuery]);

  useBodyScrollLock(consultationModalOpen);

  useEffect(() => {
    if (loadingData || didAutoOpenTeacher || !teacherFromQuery) {
      return;
    }
    setDidAutoOpenTeacher(true);
    if (hasOpenStudentConsultation(consultationRequests)) {
      setServerError("คุณมีคำขอหรือนัดที่ยังไม่ปิดอยู่แล้ว กรุณาทำให้รอบนี้เสร็จก่อนส่งคำขอใหม่");
      return;
    }
    setSelectedTeacherId(teacherFromQuery);
    setIsLoadingConsultationTeachers(true);
    setConsultationModalOpen(true);
  }, [consultationRequests, didAutoOpenTeacher, loadingData, teacherFromQuery]);

  const selectedConsultationTeacher =
    consultationTeachers.find((teacher) => teacher.id === selectedTeacherId) ||
    careTeam.find((teacher) => teacher.id === selectedTeacherId) ||
    null;

  const actionCounts = countStudentActionQueue(consultationRequests);
  const awaitingResponses = listAwaitingStudentResponses(consultationRequests);
  const upcomingConsultations = listUpcomingConsultations(consultationRequests);
  const upcomingPreview = upcomingConsultations.slice(0, STUDENT_HOME_UPCOMING_LIMIT);
  const hasOpenConsultation = hasOpenStudentConsultation(consultationRequests);
  /** ประวัติแยกจากคิวต้องตอบ — เรียงอัปเดตล่าสุด O(n log n) */
  const historyRequests = useMemo(() => {
    const awaitingIds = new Set(listAwaitingStudentResponses(consultationRequests).map((item) => item.id));
    return consultationRequests
      .filter((request) => !awaitingIds.has(request.id))
      .sort(
        (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      );
  }, [consultationRequests]);
  const historyPagination = useListPagination(historyRequests, historyRequests.length, {
    fixedRowsPerPage: STUDENT_LIST_PREVIEW_LIMIT,
  });
  const visibleHistory = historyPagination.pageItems;

  const openConsultationRequestModal = (teacherId = "") => {
    if (hasOpenConsultation) {
      setServerError("คุณมีคำขอหรือนัดที่ยังไม่ปิดอยู่แล้ว กรุณาทำให้รอบนี้เสร็จก่อนส่งคำขอใหม่");
      const target =
        document.getElementById("action-needed") || document.getElementById("consultation-history");
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setSelectedTeacherId(teacherId);
    setIsLoadingConsultationTeachers(true);
    setConsultationModalOpen(true);
    setServerError("");
  };

  const handleSubmitConsultationRequest = async () => {
    if (isSubmittingConsultation) {
      return;
    }

    if (!selectedTeacherId) {
      setServerError("กรุณาเลือกอาจารย์ที่ต้องการปรึกษา");
      return;
    }

    if (!selectedConsultationTopic) {
      setServerError("กรุณาเลือกประเด็นที่จะปรึกษา");
      return;
    }

    setIsSubmittingConsultation(true);
    setServerError("");

    try {
      const response = await api.post<{ request: StudentConsultationRequest }>("/api/student/consultation-requests", {
        teacherId: selectedTeacherId,
        topic: selectedConsultationTopic,
        preferredChannel: preferredConsultationChannel,
        note: consultationNote.trim() || undefined,
      });

      setConsultationModalOpen(false);
      setTeacherSearchQuery("");
      setConsultationNote("");
      setConsultationRequests((current) => [
        response.data.request,
        ...current.filter((item) => item.id !== response.data.request.id),
      ]);
      setToast({
        open: true,
        tone: "success",
        title: "ส่งคำขอปรึกษาสำเร็จ",
        description: "ระบบแจ้งอาจารย์ที่เลือกแล้ว กรุณารอตอบกลับหรือนัดหมายจากอาจารย์",
      });
    } catch (error) {
      setServerError(getApiErrorMessage(error, "ไม่สามารถส่งคำขอรับคำปรึกษาได้"));
    } finally {
      setIsSubmittingConsultation(false);
    }
  };

  const executeCancelConsultationRequest = async (requestId: string, reason: string) => {
    if (cancellingRequestId) {
      return;
    }

    setCancellingRequestId(requestId);
    setServerError("");
    try {
      const response = await api.post<{ request: StudentConsultationRequest }>(
        `/api/student/consultation-requests/${requestId}/cancel`,
        { reason }
      );
      setConsultationRequests((current) =>
        current.map((item) => (item.id === response.data.request.id ? response.data.request : item))
      );
      setToast({
        open: true,
        tone: "warning",
        title: "ส่งคำขอยกเลิกแล้ว",
        description: "รออาจารย์ยืนยันยกเลิก — จะส่งคำขอใหม่ได้หลังอาจารย์รับทราบ",
      });
    } catch (error) {
      setServerError(getApiErrorMessage(error, "ไม่สามารถส่งคำขอยกเลิกได้"));
    } finally {
      setCancellingRequestId(null);
      setPendingCancelRequestId(null);
    }
  };

  const handleCancelConsultationRequest = (requestId: string) => {
    if (cancellingRequestId) {
      return;
    }
    setPendingCancelRequestId(requestId);
  };

  /** ส่งเคส SOS — โยน error ต่อเพื่อไม่ให้การ์ดปิด dialog แบบสำเร็จปลอม */
  const handleCreateSosCase = async () => {
    await api.post("/api/student/sos", {
      summary: "นักศึกษาร้องขอความช่วยเหลือด่วนผ่านหน้าที่ปรึกษา",
    });
    setToast({
      open: true,
      tone: "success",
      title: "ส่งคำขอช่วยเหลือสำเร็จ",
      description: "ระบบบันทึกคำขอแล้ว หากฉุกเฉินโทร 1323 ได้ทันที",
    });
  };

  return (
    <>
      <RoleToast
        description={toast.description}
        open={toast.open}
        title={toast.title}
        tone={toast.tone}
        zIndexClassName="z-[300]"
      />

      <PromptDialog
        open={Boolean(pendingCancelRequestId)}
        loading={Boolean(pendingCancelRequestId && cancellingRequestId === pendingCancelRequestId)}
        title="ขอยกเลิกคำขอ"
        description="เลือกเหตุผลสั้น ๆ แล้วส่งให้อาจารย์ยืนยัน — คิวจะเป็นสถานะยกเลิกเมื่ออาจารย์รับทราบ"
        confirmLabel="ส่งคำขอยกเลิก"
        cancelLabel="เก็บคำขอไว้"
        selectPlaceholder="เลือกเหตุผลที่ตรงที่สุด"
        options={STUDENT_CANCEL_REASONS.map((reason) => ({
          value: reason,
          label: reason,
        }))}
        onCancel={() => {
          if (!cancellingRequestId) {
            setPendingCancelRequestId(null);
          }
        }}
        onConfirm={(reason) => {
          if (pendingCancelRequestId) {
            void executeCancelConsultationRequest(pendingCancelRequestId, reason);
          }
        }}
      />

      {serverError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          {serverError}
        </div>
      )}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="bg-[linear-gradient(135deg,#f8fafc_0%,#eef6ff_58%,#ecfeff_100%)] p-5 sm:p-7 lg:p-8">
            <div className="flex w-fit items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm">
              <Users className="h-3.5 w-3.5" />
              ทีมดูแลและคำขอปรึกษา
            </div>
            <div className="mt-6 max-w-3xl">
              <h1 className="font-display text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
                ที่ปรึกษา
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                เลือกอาจารย์ ส่งคำขอปรึกษา ติดตามสถานะ และใช้ช่องทางด่วนเมื่อรู้สึกไม่ปลอดภัย
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
            <div className="p-5">
              <p className="text-xs font-semibold text-slate-500">ทีมดูแล</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">{careTeam.length}</p>
            </div>
            <div className="p-5">
              <p className="text-xs font-semibold text-slate-500">ต้องตอบ</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">{actionCounts.awaitingStudent}</p>
            </div>
            <div className="p-5">
              <p className="text-xs font-semibold text-slate-500">นัดใกล้ถึง</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">{actionCounts.upcoming}</p>
            </div>
          </div>
        </div>
      </section>

      {loadingData ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <span className="loader mx-auto h-6 w-6 text-blue-600"></span>
          <p className="mt-3 text-sm font-medium text-slate-500">กำลังโหลดข้อมูลที่ปรึกษา...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="space-y-6">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                    <Users className="h-5 w-5 text-blue-600" />
                    ทีมดูแลของฉัน
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">เลือกอาจารย์แล้วส่งคำขอ — นัดจะตามมาเมื่ออาจารย์เสนอเวลา</p>
                </div>
                {hasOpenConsultation ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                    มีคำขอเปิดอยู่ · ส่งคำขอใหม่ได้เมื่อรอบนี้ปิดแล้ว
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => openConsultationRequestModal()}
                    className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100"
                  >
                    <Plus className="h-4 w-4" />
                    ส่งคำขอใหม่
                  </button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {careTeam.length > 0 ? (
                  careTeam.map((member) => (
                    <div key={member.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                          {member.initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-blue-700">
                            {member.roleLabels.join(" / ") || "อาจารย์"}
                          </p>
                          <p className="truncate text-sm font-bold text-slate-900">{member.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{member.employeeId || "ไม่มีรหัสบุคลากร"}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openConsultationRequestModal(member.id)}
                        disabled={hasOpenConsultation}
                        className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <MessageSquare className="h-4 w-4" />
                        {hasOpenConsultation ? "มีคำขอเปิดอยู่" : "ส่งคำขอปรึกษา"}
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 sm:col-span-2">
                    ยังไม่มีข้อมูลอาจารย์ที่ปรึกษาในระบบ สามารถค้นหาอาจารย์เพื่อส่งคำขอปรึกษาได้
                    <button
                      type="button"
                      onClick={() => openConsultationRequestModal()}
                      className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-50"
                    >
                      <Search className="h-3.5 w-3.5" />
                      ค้นหาอาจารย์
                    </button>
                  </div>
                )}
              </div>
            </section>

            <section
              id="action-needed"
              className="scroll-mt-24 rounded-lg border border-amber-200 bg-white shadow-sm"
            >
              <div className="border-b border-amber-100 bg-amber-50/50 p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="flex items-center gap-2 text-[15px] font-bold text-slate-900 sm:text-base">
                      <MessageSquare className="h-5 w-5 text-amber-700" />
                      ต้องตอบจากคุณ
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">ข้อเสนอนัดที่รอคุณยอมรับหรือขอเปลี่ยน</p>
                  </div>
                  {awaitingResponses.length > 0 ? (
                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                      {awaitingResponses.length} รายการ
                    </span>
                  ) : null}
                </div>
              </div>
              {awaitingResponses.length > 0 ? (
                <div className="divide-y divide-amber-100">
                  {awaitingResponses.map((request) => {
                    const statusMeta = consultationStatusMeta[request.status];
                    const studentNote = sanitizeStudentFacingNote(request.note);
                    const advisorNote = sanitizeStudentFacingNote(request.advisorNote);
                    const location = resolveAppointmentLocation(request);
                    const statusLabel =
                      request.status === "CLOSED"
                        ? consultationClosedStatusLabel(request.advisorNote)
                        : statusMeta.label;
                    return (
                      <div
                        key={request.id}
                        id={`request-${request.id}`}
                        className="bg-amber-50/30 p-5 transition-colors hover:bg-amber-50/60"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900">
                              {request.topic}
                              {location ? ` · ${location}` : ""}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">ถึง {request.teacher.name}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                              รอคุณตอบ
                            </span>
                            <span
                              className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold ${statusMeta.className}`}
                            >
                              {statusLabel}
                            </span>
                          </div>
                        </div>
                        {studentNote ? (
                          <p className="mt-3 line-clamp-3 whitespace-pre-line rounded-lg bg-white/80 px-3 py-2 text-sm text-slate-600">
                            {studentNote}
                          </p>
                        ) : null}
                        {advisorNote ? (
                          <p className="mt-2 line-clamp-2 text-xs text-slate-500">
                            หมายเหตุจากอาจารย์: {advisorNote}
                          </p>
                        ) : null}
                        <ConsultationScheduleActions
                          request={request}
                          onUpdated={(updated) => {
                            setConsultationRequests((current) =>
                              current.map((item) => (item.id === updated.id ? updated : item))
                            );
                          }}
                          onError={setServerError}
                          onToast={(title, description) =>
                            setToast({ open: true, tone: "success", title, description })
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="px-5 py-6 text-sm text-slate-500 sm:px-6">
                  ไม่มีข้อเสนอที่รอคุณตอบในตอนนี้
                </p>
              )}
            </section>

            <section
              id="consultation-history"
              className="scroll-mt-24 rounded-lg border border-slate-200 bg-white shadow-sm"
            >
              <div className="border-b border-slate-100 p-5 sm:p-6">
                <h2 className="flex items-center gap-2 text-[15px] font-bold text-slate-900 sm:text-base">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                  ประวัติคำขอปรึกษา
                </h2>
                <p className="mt-1 text-sm text-slate-500">คำขอที่กำลังดำเนินการและที่ปิดแล้ว — แยกจากคิวต้องตอบด้านบน</p>
              </div>

              {historyRequests.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {visibleHistory.map((request) => {
                    const statusMeta = consultationStatusMeta[request.status];
                    const studentNote = sanitizeStudentFacingNote(request.note);
                    const advisorNote = sanitizeStudentFacingNote(request.advisorNote);
                    const location = resolveAppointmentLocation(request);
                    const statusLabel =
                      request.status === "CLOSED" ||
                      request.status === "CANCELLED" ||
                      request.status === "CANCEL_REQUESTED"
                        ? consultationClosedStatusLabel(request.status, request.advisorNote)
                        : statusMeta.label;
                    const statusClassName =
                      request.status === "CLOSED" ||
                      request.status === "CANCELLED" ||
                      request.status === "CANCEL_REQUESTED"
                        ? `border-transparent ${consultationClosedBadgeClassName(request.status, request.advisorNote)}`
                        : statusMeta.className;
                    const closeNoteLabel =
                      request.status === "CLOSED" ||
                      request.status === "CANCELLED" ||
                      request.status === "CANCEL_REQUESTED"
                        ? presentCloseNoteForStudent(advisorNote) || advisorNote
                        : advisorNote;

                    return (
                      <div
                        key={request.id}
                        id={`request-${request.id}`}
                        className="p-5 transition-colors hover:bg-slate-50/80"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            {request.status === "SCHEDULED" && request.scheduledAt ? (
                              <p className="text-sm font-bold tabular-nums text-slate-900">
                                {formatThaiDateTime(request.scheduledAt)}
                              </p>
                            ) : null}
                            <p
                              className={`${
                                request.status === "SCHEDULED" && request.scheduledAt
                                  ? "mt-0.5 text-xs text-slate-500"
                                  : "text-sm font-bold text-slate-900"
                              }`}
                            >
                              {request.topic}
                              {location ? ` · ${location}` : ""}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">ถึง {request.teacher.name}</p>
                            {request.status === "CLOSED" && request.scheduledAt ? (
                              <p className="mt-1 text-xs text-slate-400">
                                นัดที่เคยยืนยัน: {formatThaiDateTime(request.scheduledAt)} ({statusLabel})
                              </p>
                            ) : null}
                          </div>
                          <span
                            className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold ${statusClassName}`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        {studentNote ? (
                          <p className="mt-3 line-clamp-3 whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                            {studentNote}
                          </p>
                        ) : null}
                        <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                          <p>ส่งคำขอ: {formatThaiDateTime(request.createdAt)}</p>
                          <p>อัปเดตล่าสุด: {formatThaiDateTime(request.updatedAt)}</p>
                          {closeNoteLabel ? (
                            <p className="line-clamp-2 sm:col-span-2">
                              {request.status === "CANCELLED" || request.status === "CANCEL_REQUESTED"
                                ? "เหตุผลการยกเลิก"
                                : request.status === "CLOSED"
                                  ? "หมายเหตุการปิด"
                                  : "หมายเหตุจากอาจารย์"}
                              : {closeNoteLabel}
                            </p>
                          ) : null}
                        </div>
                        <ConsultationScheduleActions
                          request={request}
                          onUpdated={(updated) => {
                            setConsultationRequests((current) =>
                              current.map((item) => (item.id === updated.id ? updated : item))
                            );
                          }}
                          onError={setServerError}
                          onToast={(title, description) =>
                            setToast({ open: true, tone: "success", title, description })
                          }
                        />
                        {canStudentCancelConsultation(request.status) ? (
                          <button
                            type="button"
                            disabled={cancellingRequestId === request.id}
                            onClick={() => void handleCancelConsultationRequest(request.id)}
                            className="mt-3 text-xs font-semibold text-slate-500 underline-offset-2 hover:text-red-600 hover:underline disabled:opacity-60"
                          >
                            {cancellingRequestId === request.id ? "กำลังส่งคำขอยกเลิก..." : "ยกเลิก"}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                  {historyPagination.total > historyPagination.rowsPerPage ? (
                    <ListPaginationFooter
                      total={historyPagination.total}
                      rangeStart={historyPagination.rangeStart}
                      rangeEnd={historyPagination.rangeEnd}
                      currentPage={historyPagination.currentPage}
                      canGoPrev={historyPagination.canGoPrev}
                      canGoNext={historyPagination.canGoNext}
                      onPrev={() => historyPagination.setCurrentPage((prev) => Math.max(1, prev - 1))}
                      onNext={() => historyPagination.setCurrentPage((prev) => prev + 1)}
                    />
                  ) : null}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">ยังไม่มีประวัติคำขอปรึกษา</p>
                  <p className="mt-1 text-sm text-slate-500">เมื่อส่งคำขอแล้ว สถานะจะปรากฏในส่วนนี้</p>
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <StudentEmergencyHelpCard
              id="emergency-help"
              onConfirmSos={handleCreateSosCase}
            />

            <StudentCounselingRequestCard
              id="expert-counseling"
              disabled={!canRequestExpertCounseling}
              disabledReason={expertCounselingDisabledReason}
              onSubmitted={() => {
                setCanRequestExpertCounseling(false);
                setExpertCounselingDisabledReason("มีคำขอพบผู้เชี่ยวชาญรอรับอยู่แล้ว");
                setToast({
                  open: true,
                  tone: "success",
                  title: "ส่งคำขอแล้ว",
                  description: "ทีมสุขภาพจิตได้รับการแจ้งแล้ว จะติดต่อนัดหมาย",
                });
              }}
            />

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
                  <CalendarClock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-slate-900">นัดใกล้ถึง</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">ยืนยันแล้ว · ภายใน 7 วัน</p>
                </div>
              </div>
              {upcomingConsultations.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {upcomingPreview.map((request) => {
                    const location = resolveAppointmentLocation(request);
                    return (
                      <div key={request.id} className="rounded-lg border border-cyan-100 bg-cyan-50/40 px-3 py-2.5">
                        <p className="text-sm font-bold tabular-nums text-slate-900">
                          {formatThaiDateTime(request.scheduledAt)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {request.topic}
                          {location ? ` · ${location}` : ""}
                        </p>
                      </div>
                    );
                  })}
                  {upcomingConsultations.length > STUDENT_HOME_UPCOMING_LIMIT ? (
                    <p className="text-xs text-slate-500">
                      แสดง {STUDENT_HOME_UPCOMING_LIMIT} จาก {upcomingConsultations.length} นัด
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-500">
                  <CalendarX2 className="h-4 w-4" />
                  ยังไม่มีนัดใน 7 วันข้างหน้า
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {consultationModalOpen &&
        createPortal(
          <div className="fixed inset-0" style={{ inset: 0, position: "fixed", zIndex: 10000 }}>
          <button
            type="button"
            aria-label="close consultation request popup"
            className="fixed inset-0 bg-slate-900/60"
            style={{ inset: 0, position: "fixed" }}
            onClick={() => setConsultationModalOpen(false)}
          />

          <div
            className="fixed inset-0 flex items-center justify-center overflow-hidden p-3 sm:p-4"
            style={{ inset: 0, position: "fixed", zIndex: 1 }}
          >
            <div className="flex min-h-0 max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 p-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-950 sm:text-2xl">ส่งคำขอปรึกษา</h2>
                  <p className="mt-1 text-sm text-slate-500">เลือกอาจารย์และระบุช่องทางที่สะดวก</p>
                </div>
                <button
                  type="button"
                  onClick={() => setConsultationModalOpen(false)}
                  className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="close consultation modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-slate-50 p-4 sm:p-5">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <label htmlFor="teacher-search" className="mb-2 block text-sm font-bold text-slate-800">
                    ค้นหาอาจารย์
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="teacher-search"
                      value={teacherSearchQuery}
                      onChange={(event) => setTeacherSearchQuery(event.target.value)}
                      placeholder="พิมพ์ชื่อหรือรหัสบุคลากร"
                      type="search"
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm font-medium text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <div className="mt-3">
                    {isLoadingConsultationTeachers ? (
                      <div className="flex items-center justify-center rounded-xl border border-slate-100 bg-slate-50 px-4 py-10 text-sm font-medium text-slate-500">
                        <span className="loader mr-2 h-4 w-4"></span>
                        กำลังค้นหาอาจารย์...
                      </div>
                    ) : consultationTeachers.length > 0 ? (
                      <ConsultationTeacherCardRow
                        teachers={consultationTeachers}
                        selectedId={selectedTeacherId}
                        onSelect={setSelectedTeacherId}
                      />
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                        ไม่พบอาจารย์ที่ตรงกับคำค้นหา
                      </div>
                    )}
                  </div>

                  {selectedConsultationTeacher ? (
                    <p className="mt-2 text-xs font-semibold text-blue-700">
                      เลือก: {selectedConsultationTeacher.name}
                    </p>
                  ) : null}
                </div>

                <div className="min-w-0">
                  <label htmlFor="consultation-topic" className="mb-2 block text-sm font-bold text-slate-800">
                    ประเด็นที่จะปรึกษา
                  </label>
                  <select
                    id="consultation-topic"
                    value={selectedConsultationTopic}
                    onChange={(event) => setSelectedConsultationTopic(event.target.value)}
                    className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-800 outline-none transition-colors focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  >
                    {consultationTopics.map((topic) => (
                      <option key={topic} value={topic}>
                        {topic}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <p className="mb-2 text-sm font-bold text-slate-800">รูปแบบที่สะดวก</p>
                  <p className="mb-3 text-xs text-slate-500">
                    เลือกแค่ออนไลน์หรือพบตัว — อาจารย์จะแจ้งห้อง/ลิงก์เมื่อเสนอนัด
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(preferredChannels).map(([value, label]) => {
                      const selected = preferredConsultationChannel === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setPreferredConsultationChannel(value)}
                          className={`rounded-xl border px-3 py-3 text-sm font-bold transition-colors ${
                            selected
                              ? "border-blue-600 bg-blue-50 text-blue-800 ring-2 ring-blue-200"
                              : "border-slate-200 bg-white text-slate-700 hover:border-blue-200"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="consultation-note" className="mb-2 block text-sm font-bold text-slate-800">
                    รายละเอียดเพิ่มเติม
                  </label>
                  <textarea
                    id="consultation-note"
                    value={consultationNote}
                    onChange={(event) => setConsultationNote(event.target.value)}
                    maxLength={1200}
                    rows={4}
                    placeholder="เล่ารายละเอียดสั้น ๆ เพื่อให้อาจารย์เตรียมตัวก่อนให้คำปรึกษา"
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  />
                  <p className="mt-1 text-right text-xs text-slate-400">{consultationNote.length}/1200</p>
                </div>
              </div>

              <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-200 bg-white p-5 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setConsultationModalOpen(false)}
                  className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200 sm:w-1/3"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSubmitConsultationRequest}
                  disabled={isSubmittingConsultation || !selectedTeacherId}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70 sm:w-2/3"
                >
                  {isSubmittingConsultation ? (
                    <>
                      <span className="loader h-4 w-4"></span>
                      กำลังส่งคำขอ...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      ส่งคำขอปรึกษา
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          </div>,
          document.body
        )}
    </>
  );
}

export default function StudentAdvisorPage() {
  return (
    <StudentPageShell activePage="advisor">
      {() => (
        <Suspense
          fallback={
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
              <span className="loader mx-auto h-6 w-6 text-blue-600"></span>
              <p className="mt-3 text-sm font-medium text-slate-500">กำลังโหลดหน้าที่ปรึกษา...</p>
            </div>
          }
        >
          <StudentAdvisorContent />
        </Suspense>
      )}
    </StudentPageShell>
  );
}
