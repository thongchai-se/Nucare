"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  MessageSquare,
  Plus,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import { RoleToast, type RoleToastTone } from "@/components/role-toast";
import { StudentEmergencyHelpCard } from "@/components/student-emergency-help-card";
import { StudentPageShell } from "@/components/student-page-shell";
import api from "@/lib/axios";
import {
  type ConsultationTeachersResponse,
  type StudentCareTeamMember,
  type StudentConsultationRequest,
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
  const [preferredChannels, setPreferredChannels] = useState(defaultPreferredChannels);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedConsultationTopic, setSelectedConsultationTopic] = useState(defaultConsultationTopics[0]);
  const [preferredConsultationChannel, setPreferredConsultationChannel] = useState("IN_PERSON");
  const [consultationNote, setConsultationNote] = useState("");
  const [consultationModalOpen, setConsultationModalOpen] = useState(false);
  const [isSubmittingConsultation, setIsSubmittingConsultation] = useState(false);
  const [isLoadingConsultationTeachers, setIsLoadingConsultationTeachers] = useState(false);

  useEffect(() => {
    const loadAdvisorPage = async () => {
      setLoadingData(true);
      setServerError("");

      try {
        const response = await api.get<{
          careTeam?: StudentCareTeamMember[];
          consultationRequests?: StudentConsultationRequest[];
        }>("/api/student/dashboard");

        setCareTeam(response.data.careTeam || []);
        setConsultationRequests(response.data.consultationRequests || []);
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
        setIsLoadingConsultationTeachers(true);

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
          setPreferredChannels(
            Object.keys(response.data.preferredChannels).length > 0
              ? response.data.preferredChannels
              : defaultPreferredChannels,
          );
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

  useEffect(() => {
    if (!toast.open) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToast((current) => ({ ...current, open: false }));
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [toast.open]);

  useEffect(() => {
    if (!consultationModalOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [consultationModalOpen]);

  const selectedConsultationTeacher =
    consultationTeachers.find((teacher) => teacher.id === selectedTeacherId) ||
    careTeam.find((teacher) => teacher.id === selectedTeacherId) ||
    null;

  const openConsultationRequestModal = (teacherId = "") => {
    setSelectedTeacherId(teacherId);
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

  const handleCreateSosCase = async () => {
    try {
      await api.post("/api/student/sos", {
        summary: "นักศึกษาร้องขอความช่วยเหลือด่วนผ่านหน้าที่ปรึกษา",
      });
      setToast({
        open: true,
        tone: "success",
        title: "ส่งคำขอช่วยเหลือสำเร็จ",
        description: "ระบบได้รับเคส SOS ของคุณแล้วและจะเร่งประสานงานให้",
      });
    } catch (error) {
      setServerError(getApiErrorMessage(error, "ไม่สามารถส่งเคส SOS ได้"));
    }
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

          <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
            <div className="p-5">
              <p className="text-xs font-semibold text-slate-500">ทีมดูแล</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">{careTeam.length}</p>
            </div>
            <div className="p-5">
              <p className="text-xs font-semibold text-slate-500">คำขอที่เปิดอยู่</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">
                {consultationRequests.filter((request) => request.status !== "CLOSED").length}
              </p>
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
                  <p className="mt-1 text-sm text-slate-500">เลือกอาจารย์เพื่อส่งคำขอปรึกษาหรือนัดหมาย</p>
                </div>
                <button
                  type="button"
                  onClick={() => openConsultationRequestModal()}
                  className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100"
                >
                  <Plus className="h-4 w-4" />
                  ส่งคำขอใหม่
                </button>
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
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => openConsultationRequestModal(member.id)}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-800"
                        >
                          <MessageSquare className="h-4 w-4" />
                          ปรึกษา
                        </button>
                        <button
                          type="button"
                          onClick={() => openConsultationRequestModal(member.id)}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:border-blue-200 hover:text-blue-700"
                        >
                          <CalendarPlus className="h-4 w-4" />
                          นัดหมาย
                        </button>
                      </div>
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

            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5 sm:p-6">
                <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                  ประวัติคำขอปรึกษา
                </h2>
                <p className="mt-1 text-sm text-slate-500">ติดตามสถานะล่าสุดของคำขอและเวลานัดหมายจากอาจารย์</p>
              </div>

              {consultationRequests.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {consultationRequests.map((request) => {
                    const statusMeta = consultationStatusMeta[request.status];

                    return (
                      <div key={request.id} className="p-5 transition-colors hover:bg-slate-50/80">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900">{request.topic}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              ถึง {request.teacher.name} • {request.preferredChannelLabel}
                            </p>
                          </div>
                          <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold ${statusMeta.className}`}>
                            {statusMeta.label}
                          </span>
                        </div>
                        {request.note && (
                          <p className="mt-3 whitespace-pre-line border-l-4 border-slate-200 bg-slate-50 py-2 pl-3 text-sm text-slate-600">
                            {request.note}
                          </p>
                        )}
                        <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                          <p>ส่งคำขอ: {formatThaiDateTime(request.createdAt)}</p>
                          <p>อัปเดตล่าสุด: {formatThaiDateTime(request.updatedAt)}</p>
                          {request.scheduledAt && <p>เวลานัดหมาย: {formatThaiDateTime(request.scheduledAt)}</p>}
                          {request.advisorNote && <p className="sm:col-span-2">หมายเหตุจากอาจารย์: {request.advisorNote}</p>}
                        </div>
                      </div>
                    );
                  })}
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
            <StudentEmergencyHelpCard onConfirmSos={handleCreateSosCase} />

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
                  <CalendarClock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">การนัดหมายของฉัน</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    ระบบจะแสดงเวลานัดหมายในประวัติคำขอเมื่ออาจารย์กำหนดเวลาให้
                  </p>
                </div>
              </div>
              <div className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-500">
                <CalendarX2 className="h-4 w-4" />
                ไม่มีนัดหมายที่กำลังมาถึง
              </div>
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
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            style={{ inset: 0, position: "fixed" }}
            onClick={() => setConsultationModalOpen(false)}
          />

          <div
            className="fixed inset-0 grid place-items-center overflow-y-auto overscroll-contain p-3 sm:p-4"
            style={{ inset: 0, position: "fixed", zIndex: 1 }}
          >
            <div className="flex min-h-0 max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-600">Consultation</p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-950">ส่งคำขอปรึกษา</h2>
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

                  <div className="mt-3 max-h-[min(16rem,34dvh)] space-y-2 overflow-y-auto pr-1">
                    {isLoadingConsultationTeachers ? (
                      <div className="flex items-center justify-center rounded-xl border border-slate-100 bg-slate-50 px-4 py-6 text-sm font-medium text-slate-500">
                        <span className="loader mr-2 h-4 w-4"></span>
                        กำลังค้นหาอาจารย์...
                      </div>
                    ) : consultationTeachers.length > 0 ? (
                      consultationTeachers.map((teacher) => {
                        const selected = selectedTeacherId === teacher.id;

                        return (
                          <button
                            key={teacher.id}
                            type="button"
                            onClick={() => setSelectedTeacherId(teacher.id)}
                            aria-pressed={selected}
                            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                              selected
                                ? "border-blue-300 bg-blue-50 shadow-sm"
                                : "border-slate-100 bg-slate-50 hover:border-blue-200 hover:bg-white"
                            }`}
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                              {teacher.initials}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold text-slate-800">{teacher.name}</span>
                              <span className="mt-0.5 block text-xs text-slate-500">
                                {teacher.roleLabels.join(" / ") || "อาจารย์"} {teacher.employeeId ? `• ${teacher.employeeId}` : ""}
                              </span>
                            </span>
                            {teacher.isAssignedAdvisor && (
                              <span className="hidden shrink-0 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 text-[11px] font-bold text-cyan-700 sm:inline-flex">
                                ที่ปรึกษาของฉัน
                              </span>
                            )}
                            <span
                              className={`h-4 w-4 shrink-0 rounded-full border ${
                                selected ? "border-blue-600 bg-blue-600 shadow-[inset_0_0_0_3px_white]" : "border-slate-300"
                              }`}
                            />
                          </button>
                        );
                      })
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

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                  <div className="min-w-0">
                    <label htmlFor="consultation-channel" className="mb-2 block text-sm font-bold text-slate-800">
                      ช่องทางที่สะดวก
                    </label>
                    <select
                      id="consultation-channel"
                      value={preferredConsultationChannel}
                      onChange={(event) => setPreferredConsultationChannel(event.target.value)}
                      className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-800 outline-none transition-colors focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    >
                      {Object.entries(preferredChannels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
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
      {() => <StudentAdvisorContent />}
    </StudentPageShell>
  );
}
