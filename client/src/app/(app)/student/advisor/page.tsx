"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarClock,
  CalendarX2,
  MessageCircle,
  MessageSquare,
  Plus,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import { ConsultationTeacherCardRow } from "@/components/consultation-teacher-card";
import { EphemeralChatPanel } from "@/components/ephemeral-chat/ephemeral-chat-panel";
import type { EphemeralChatPeer, EphemeralChatSession } from "@/components/ephemeral-chat/types";
import { RoleToast, type RoleToastTone } from "@/components/role-toast";
import { ConsultationScheduleActions } from "@/components/student/consultation-schedule-actions";
import { StudentEmergencyHelpCard } from "@/components/student-emergency-help-card";
import { StudentPageShell } from "@/components/student-page-shell";
import { InlineAlert } from "@/components/ui/inline-alert";
import { ListPaginationFooter } from "@/components/ui/list-pagination-footer";
import { InlineLoader } from "@/components/ui/page-loader";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import { useAuth } from "@/context/auth.context";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useListPagination } from "@/hooks/use-list-pagination";
import api from "@/lib/axios";
import { setVisibleInterval } from "@/lib/visible-interval";
import {
  STUDENT_CANCEL_REASONS,
  consultationClosedBadgeClassName,
  consultationClosedStatusLabel,
  presentCloseNoteForStudent,
} from "@/lib/consultation-close";
import {
  countUnreadChatPeers,
  indexChatSessionsByPeer,
  listUnreadChatPeers,
  sortPeersByChatAttention,
} from "@/lib/ephemeral-chat-attention";
import {
  STUDENT_HOME_UPCOMING_LIMIT,
  STUDENT_LIST_PREVIEW_LIMIT,
  buildUpcomingAppointmentPreview,
  countStudentDashboardActions,
  hasOpenStudentConsultation,
  listAwaitingStudentResponses,
  resolveAppointmentLocation,
  sanitizeStudentFacingNote,
  splitChatPeersByCareTeam,
  type StudentMentalHealthAppointmentPreview,
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
  normalizePreferredChannelOptions,
} from "@/lib/student-dashboard";

type StudentToastState = {
  description: string;
  open: boolean;
  title: string;
  tone: RoleToastTone;
};

function StudentAdvisorContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const teacherFromQuery = searchParams.get("teacher")?.trim() || "";
  const peerFromQuery = searchParams.get("peer")?.trim() || "";
  const openedPeerFromQueryRef = useRef<string | null>(null);
  /** กัน ?peer= เดิมเปิดแชทซ้ำระหว่างรอ router ลบ query หลังปิด */
  const suppressPeerAutoOpenRef = useRef(false);
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
  const [mentalHealthAppointments, setMentalHealthAppointments] = useState<
    StudentMentalHealthAppointmentPreview[]
  >([]);
  const [consultationTeachers, setConsultationTeachers] = useState<StudentCareTeamMember[]>([]);
  const [consultationTopics, setConsultationTopics] = useState(defaultConsultationTopics);
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
  const [chatPeerId, setChatPeerId] = useState<string | null>(null);
  const [chatPeers, setChatPeers] = useState<EphemeralChatPeer[]>([]);
  const [chatSessions, setChatSessions] = useState<EphemeralChatSession[]>([]);
  const [loadingChatPeers, setLoadingChatPeers] = useState(false);
  const chatOpen = Boolean(chatPeerId);

  useEffect(() => {
    if (!peerFromQuery) {
      suppressPeerAutoOpenRef.current = false;
      return;
    }
    if (suppressPeerAutoOpenRef.current) {
      return;
    }
    if (openedPeerFromQueryRef.current === peerFromQuery) {
      return;
    }
    openedPeerFromQueryRef.current = peerFromQuery;
    setChatPeerId(peerFromQuery);
  }, [peerFromQuery]);

  /** หลังปิดแชท — ไล่ลบ ?peer= จนหมด รวมกรณี replace จากเปิดค้างหลังปิด */
  useEffect(() => {
    if (!suppressPeerAutoOpenRef.current || chatPeerId) {
      return;
    }
    if (!peerFromQuery) {
      suppressPeerAutoOpenRef.current = false;
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("peer");
    const query = params.toString();
    router.replace(query ? `/student/advisor?${query}` : "/student/advisor", {
      scroll: false,
    });
  }, [chatPeerId, peerFromQuery, router, searchParams]);

  /** โหลดสถานะ unread ของห้องแชทชั่วคราวเพื่อโชว์ว่ามีข้อความต้องดู */
  const refreshChatSessions = useCallback(async () => {
    try {
      const response = await api.get<{ sessions: EphemeralChatSession[] }>("/api/chat/sessions");
      setChatSessions(response.data.sessions || []);
    } catch {
      setChatSessions([]);
    }
  }, []);

  /** เปิดแชทและ sync ?peer= ให้แชร์ลิงก์/รีเฟรชแล้วยังอยู่ห้องเดิม */
  const openChatWithPeer = (peerId: string) => {
    suppressPeerAutoOpenRef.current = false;
    setChatPeerId(peerId);
    openedPeerFromQueryRef.current = peerId;
    const params = new URLSearchParams(searchParams.toString());
    params.set("peer", peerId);
    router.replace(`/student/advisor?${params.toString()}`, { scroll: false });
  };

  const closeChatPanel = () => {
    setChatPeerId(null);
    openedPeerFromQueryRef.current = null;
    suppressPeerAutoOpenRef.current = true;
    void refreshChatSessions();
    const params = new URLSearchParams(searchParams.toString());
    if (!params.has("peer")) {
      return;
    }
    params.delete("peer");
    const query = params.toString();
    // ไม่ให้ Next รีเซ็ตสกอลล์ตอนลบ ?peer=
    router.replace(query ? `/student/advisor?${query}` : "/student/advisor", {
      scroll: false,
    });
  };

  useEffect(() => {
    const loadAdvisorPage = async () => {
      setLoadingData(true);
      setServerError("");

      try {
        const response = await api.get<{
          careTeam?: StudentCareTeamMember[];
          consultationRequests?: StudentConsultationRequest[];
          mentalHealthAppointments?: StudentMentalHealthAppointmentPreview[];
        }>("/api/student/dashboard");

        setCareTeam(response.data.careTeam || []);
        setConsultationRequests(response.data.consultationRequests || []);
        setMentalHealthAppointments(response.data.mentalHealthAppointments || []);
      } catch (error) {
        setServerError(getApiErrorMessage(error, "ไม่สามารถโหลดข้อมูลที่ปรึกษาได้"));
      } finally {
        setLoadingData(false);
      }
    };

    void loadAdvisorPage();
  }, []);

  useEffect(() => {
    const loadChatPeers = async () => {
      setLoadingChatPeers(true);
      try {
        const response = await api.get<{ peers: EphemeralChatPeer[] }>("/api/chat/peers");
        setChatPeers(response.data.peers || []);
      } catch {
        setChatPeers([]);
      } finally {
        setLoadingChatPeers(false);
      }
    };
    void loadChatPeers();
    void refreshChatSessions();
    const clearPoll = setVisibleInterval(() => {
      void refreshChatSessions();
    }, 30_000);
    const onFocus = () => {
      void refreshChatSessions();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearPoll();
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshChatSessions]);

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
          setPreferredChannels(normalizePreferredChannelOptions(response.data.preferredChannels));
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

  const actionCounts = countStudentDashboardActions(consultationRequests, mentalHealthAppointments);
  const awaitingResponses = listAwaitingStudentResponses(consultationRequests);
  const upcomingPreviewBundle = buildUpcomingAppointmentPreview(
    consultationRequests,
    mentalHealthAppointments
  );
  const upcomingPreview = upcomingPreviewBundle.items;
  const upcomingTotal = upcomingPreviewBundle.total;
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
  const { chatableCareTeamIds, otherPeers } = useMemo(
    () => splitChatPeersByCareTeam(
      careTeam.map((member) => member.id),
      chatPeers
    ),
    [careTeam, chatPeers]
  );
  const chatAttentionByPeerId = useMemo(
    () => indexChatSessionsByPeer(chatSessions),
    [chatSessions]
  );
  const unreadChatCount = useMemo(
    () => countUnreadChatPeers(chatAttentionByPeerId),
    [chatAttentionByPeerId]
  );
  const unreadPeerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [peerId, attention] of chatAttentionByPeerId) {
      if (attention.unread) {
        ids.add(peerId);
      }
    }
    return ids;
  }, [chatAttentionByPeerId]);
  const sortedOtherPeers = useMemo(
    () => sortPeersByChatAttention(otherPeers, chatAttentionByPeerId),
    [otherPeers, chatAttentionByPeerId]
  );
  const unreadChatPeers = useMemo(
    () => listUnreadChatPeers(chatPeers, chatAttentionByPeerId),
    [chatPeers, chatAttentionByPeerId]
  );

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  };

  const openConsultationRequestModal = (teacherId = "") => {
    if (hasOpenConsultation) {
      setServerError("คุณมีคำขอหรือนัดที่ยังไม่ปิดอยู่แล้ว กรุณาทำให้รอบนี้เสร็จก่อนส่งคำขอใหม่");
      const target =
        document.getElementById("action-needed") || document.getElementById("consultation-history");
      target?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
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
        description: "อาจารย์ที่เลือกจะได้รับแจ้งแล้ว กรุณารอตอบกลับ",
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
        description: "รออาจารย์ยืนยัน เมื่อยืนยันแล้วจึงส่งคำขอใหม่ได้",
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
      description: "บันทึกคำขอแล้ว หากฉุกเฉินโทร 1323 ได้ทันที",
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
        description="เลือกเหตุผลแล้วส่งให้อาจารย์ยืนยัน"
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

      {serverError ? <InlineAlert className="shadow-sm">{serverError}</InlineAlert> : null}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="bg-[linear-gradient(135deg,#f8fafc_0%,#eef6ff_58%,#ecfeff_100%)] p-5 sm:p-7 lg:p-8">
            <div className="max-w-3xl">
              <h1 className="font-display text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
                ที่ปรึกษา
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                ขอนัดปรึกษา หรือทักถามสั้น ๆ กับทีมดูแล
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
            <button
              type="button"
              onClick={() => scrollToSection("contact-team")}
              className="p-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 sm:p-5"
            >
              <p className="text-xs font-semibold text-slate-500">ทีมดูแล</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">{careTeam.length}</p>
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("action-needed")}
              className={`p-4 text-left transition-colors hover:bg-amber-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-300 sm:p-5 ${
                actionCounts.awaitingStudent > 0 ? "bg-amber-50/50" : ""
              }`}
            >
              <p className="text-xs font-semibold text-slate-500">ต้องตอบ</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">
                {actionCounts.awaitingStudent}
              </p>
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("upcoming-appointments")}
              className="p-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300 sm:p-5"
            >
              <p className="text-xs font-semibold text-slate-500">นัดใกล้ถึง</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">{actionCounts.upcoming}</p>
            </button>
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
          <aside className="order-1 space-y-4 lg:order-2 lg:space-y-6">
            <StudentEmergencyHelpCard
              id="emergency-help"
              onConfirmSos={handleCreateSosCase}
            />

            <div
              id="upcoming-appointments"
              className="scroll-mt-24 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
                  <CalendarClock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-slate-900">นัดใกล้ถึง</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">ยืนยันแล้ว · ภายใน 7 วัน</p>
                </div>
              </div>
              {upcomingTotal > 0 ? (
                <div className="mt-4 space-y-2">
                  {upcomingPreview.map((item) => {
                    if (item.kind === "mh") {
                      const appointment = item.appointment;
                      return (
                        <div
                          key={appointment.id}
                          className="rounded-lg border border-cyan-100 bg-cyan-50/40 px-3 py-2.5"
                        >
                          <p className="text-sm font-bold tabular-nums text-slate-900">
                            {formatThaiDateTime(appointment.scheduledAt)}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {[appointment.location?.trim(), appointment.providerName]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      );
                    }
                    const request = item.request;
                    const location = resolveAppointmentLocation(request);
                    return (
                      <div key={request.id} className="rounded-lg border border-blue-100 bg-blue-50/40 px-3 py-2.5">
                        <p className="text-sm font-bold tabular-nums text-slate-900">
                          {formatThaiDateTime(request.scheduledAt)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {[location, request.teacher.name].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    );
                  })}
                  {upcomingTotal > STUDENT_HOME_UPCOMING_LIMIT ? (
                    <p className="text-xs text-slate-500">
                      แสดง {STUDENT_HOME_UPCOMING_LIMIT} จาก {upcomingTotal} นัด
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

          <div className="order-2 space-y-6 lg:order-1">
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
              id="contact-team"
              className="scroll-mt-24 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
            >
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                    <Users className="h-5 w-5 text-blue-600" />
                    ติดต่อทีมดูแล
                    {unreadChatCount > 0 ? (
                      <span className="inline-flex rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                        {unreadChatCount > 9 ? "9+" : unreadChatCount} ข้อความใหม่
                      </span>
                    ) : null}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    ขอนัดได้จากปุ่มด้านล่าง หรือทักถามสั้นได้ตลอด
                  </p>
                </div>
                {hasOpenConsultation ? (
                  <InlineAlert tone="warning" className="rounded-lg px-3 py-2 text-xs font-semibold">
                    มีคำขอที่ยังไม่ปิด — ส่งคำขอใหม่ได้เมื่อรอบนี้เสร็จ
                  </InlineAlert>
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

              {unreadChatPeers.length > 0 ? (
                <div
                  id="chat-needs-attention"
                  className="mb-5 scroll-mt-24 rounded-lg border border-blue-200 bg-blue-50/70 p-3 sm:p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-blue-900">มีข้อความถึงคุณ</p>
                    <span className="text-xs font-semibold text-blue-700">
                      {unreadChatPeers.length} คนรอให้อ่าน
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {unreadChatPeers.map((peer) => {
                      const attention = chatAttentionByPeerId.get(peer.id);
                      return (
                        <li key={peer.id}>
                          <button
                            type="button"
                            onClick={() => openChatWithPeer(peer.id)}
                            className="flex w-full items-center gap-3 rounded-lg border border-blue-100 bg-white px-3 py-2.5 text-left transition hover:border-blue-200 hover:bg-blue-50/40"
                          >
                            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700 ring-1 ring-blue-100">
                              {peer.initials}
                              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-slate-900">{peer.name}</p>
                              <p className="truncate text-xs text-slate-500">
                                {peer.roleLabels.join(" · ") || peer.employeeId || "บุคลากร"}
                              </p>
                              {attention?.previewBody ? (
                                <p className="mt-0.5 truncate text-sm text-slate-700">
                                  {attention.previewBody}
                                </p>
                              ) : null}
                            </div>
                            <span className="shrink-0 text-xs font-bold text-blue-700">เปิด</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                {careTeam.length > 0 ? (
                  careTeam.map((member) => {
                    const canChat = chatableCareTeamIds.has(member.id);
                    const hasUnreadChat = unreadPeerIds.has(member.id);
                    return (
                      <div
                        key={member.id}
                        className={`rounded-lg border p-4 ${
                          hasUnreadChat
                            ? "border-blue-200 bg-blue-50/40"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                            {member.initials}
                            {hasUnreadChat ? (
                              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-blue-700">
                              {member.roleLabels.join(" / ") || "อาจารย์"}
                            </p>
                            <p className="truncate text-sm font-bold text-slate-900">{member.name}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {member.employeeId || "ไม่มีรหัสบุคลากร"}
                            </p>
                          </div>
                        </div>
                        <div className={`mt-4 grid gap-2 ${canChat ? "grid-cols-2" : "grid-cols-1"}`}>
                          <button
                            type="button"
                            onClick={() => openConsultationRequestModal(member.id)}
                            disabled={hasOpenConsultation}
                            className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-2 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <CalendarClock className="h-4 w-4" />
                            {hasOpenConsultation ? "มีคำขอเปิดอยู่" : "ขอปรึกษา"}
                          </button>
                          {canChat ? (
                            <button
                              type="button"
                              onClick={() => openChatWithPeer(member.id)}
                              className={`relative inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-bold transition-colors ${
                                hasUnreadChat
                                  ? "border-blue-600 bg-white text-blue-800 ring-2 ring-blue-100"
                                  : "border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
                              }`}
                            >
                              <MessageCircle className="h-4 w-4" />
                              {hasUnreadChat ? "มีข้อความ" : "ทักหา"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
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

              <div id="quick-chat" className="mt-5 scroll-mt-24 border-t border-slate-100 pt-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">ทักหาคนอื่นในทีม</h3>
                  {sortedOtherPeers.some((peer) => unreadPeerIds.has(peer.id)) ? (
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
                      มีข้อความใหม่
                    </span>
                  ) : null}
                </div>
                <p className="mb-3 text-xs text-slate-500">
                  ทักถามบุคลากรอื่นได้ที่นี่ ข้อความจะถูกลบทุกวัน
                </p>
                {loadingChatPeers ? (
                  <InlineLoader label="กำลังโหลดรายชื่อ" className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-6" />
                ) : sortedOtherPeers.length > 0 ? (
                  <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                    {sortedOtherPeers.map((peer) => {
                      const attention = chatAttentionByPeerId.get(peer.id);
                      const unread = Boolean(attention?.unread);
                      return (
                        <li key={peer.id}>
                          <button
                            type="button"
                            onClick={() => openChatWithPeer(peer.id)}
                            className={`flex w-full items-start gap-3 px-3 py-3 text-left transition hover:bg-slate-50 ${
                              unread ? "bg-blue-50/40" : ""
                            }`}
                          >
                            <div
                              className={`relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ${
                                unread
                                  ? "bg-blue-50 text-blue-700 ring-blue-100"
                                  : "bg-slate-50 text-slate-600 ring-slate-100"
                              }`}
                            >
                              {peer.initials}
                              {unread ? (
                                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className={`truncate text-sm ${
                                  unread ? "font-bold text-slate-900" : "font-semibold text-slate-900"
                                }`}
                              >
                                {peer.name}
                              </p>
                              <p className="truncate text-xs text-slate-500">
                                {peer.roleLabels.join(" · ") || peer.employeeId || "บุคลากร"}
                              </p>
                              {attention?.previewBody ? (
                                <p
                                  className={`mt-0.5 truncate text-sm ${
                                    unread ? "font-medium text-slate-800" : "text-slate-500"
                                  }`}
                                >
                                  {attention.previewBody}
                                </p>
                              ) : null}
                            </div>
                            {unread ? (
                              <span className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-bold text-white">
                                ใหม่
                              </span>
                            ) : (
                              <span className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                                <Send className="h-3 w-3" />
                                ทักหา
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : chatPeers.length > 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    ทักหาทีมดูแลได้จากปุ่มบนการ์ดด้านบน
                  </p>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    ยังไม่มีผู้ที่ทักหาได้ในตอนนี้
                  </div>
                )}
              </div>
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
                <p className="mt-1 text-sm text-slate-500">คำขอที่กำลังดำเนินการและที่ปิดแล้ว</p>
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
                          <div className="mt-3">
                            <button
                              type="button"
                              disabled={cancellingRequestId === request.id}
                              onClick={() => void handleCancelConsultationRequest(request.id)}
                              className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-red-600 hover:underline disabled:opacity-60"
                            >
                              {cancellingRequestId === request.id ? "กำลังส่งคำขอยกเลิก..." : "ยกเลิก"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {historyPagination.total > 0 ? (
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
                    เลือกแค่ออนไลน์หรือออนไซต์ — อาจารย์จะแจ้งห้อง/ลิงก์เมื่อเสนอนัด
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

      {user ? (
        <EphemeralChatPanel
          open={chatOpen}
          currentUserId={user.id}
          peerUserId={chatPeerId}
          peers={chatPeers}
          unreadPeerIds={unreadPeerIds}
          onSelectPeer={openChatWithPeer}
          onClose={closeChatPanel}
        />
      ) : null}
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
