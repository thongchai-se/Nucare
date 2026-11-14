"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CalendarPlus,
  ChevronDown,
  ClipboardEdit,
  Contact,
  FileSpreadsheet,
  HeartPulse,
  Home,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  Users,
  X,
} from "lucide-react";
import { getApiErrorMessage } from "@/lib/api-error";
import { FacultyLogo } from "@/components/faculty-logo";
import { facultyFullName } from "@/lib/brand";
import { useAuth } from "@/context/auth.context";
import { PersonaCardGrid } from "@/components/student-chat/persona-card-grid";
import { OrientationSurveyModal } from "@/components/orientation-survey-modal";
import { RoleToast, type RoleToastTone } from "@/components/role-toast";
import { InlineAlert } from "@/components/ui/inline-alert";
import { StudentEmergencyHelpCard } from "@/components/student-emergency-help-card";
import { StudentMobileBottomNav } from "@/components/student-mobile-bottom-nav";
import { ConsultationScheduleActions } from "@/components/student/consultation-schedule-actions";
import { StudentDevCarousel } from "@/components/student/student-dev-carousel";
import api from "@/lib/axios";
import {
  STUDENT_LOGOUT_LABEL,
  STUDENT_NAV_ADVISOR,
  STUDENT_NAV_ASSESSMENT,
  STUDENT_NAV_HOME,
  STUDENT_NAV_PROFILE,
} from "@/lib/student-chrome";
import {
  STUDENT_HOME_UPCOMING_LIMIT,
  hasOpenStudentConsultation,
  listAwaitingStudentResponses,
  listUpcomingConsultations,
  listUpcomingTimedAppointments,
  resolveAppointmentLocation,
} from "@/lib/student-consultation-inbox";
import type { ConsultationScheduleOfferItem } from "@/lib/student-dashboard";
import type { ActiveStudentSurveyResult, StudentFacingSurvey, Survey } from "@/types/survey";

type DashboardSurvey = Survey | StudentFacingSurvey;

/** จำนวนคำถามของแบบประเมินที่ส่งมาในรูปแบบเต็มหรือแบบสำหรับนักศึกษา */
const getDashboardSurveyQuestionCount = (survey: DashboardSurvey): number =>
  Array.isArray(survey.questions) ? survey.questions.length : Number((survey as Survey).questionCount || 0);

const HOME_CHAT_PERSONAS = [
  {
    id: "peer-male" as const,
    href: "/student/chat?persona=peer-male",
    label: "คุยกับพี่ต้น",
  },
  {
    id: "peer-female" as const,
    href: "/student/chat?persona=peer-female",
    label: "คุยกับพี่เมย์",
  },
];

type StudentCareTeamMember = {
  id: string;
  name: string;
  employeeId: string | null;
  image: string | null;
  initials: string;
  roleLabels: string[];
  isAssignedAdvisor: boolean;
};

type ConsultationRequestStatus =
  | "PENDING"
  | "ACCEPTED"
  | "SCHEDULED"
  | "CANCEL_REQUESTED"
  | "CLOSED"
  | "CANCELLED";

type StudentConsultationRequest = {
  id: string;
  topic: string;
  preferredChannel: string;
  preferredChannelLabel: string;
  note: string | null;
  status: ConsultationRequestStatus;
  advisorNote: string | null;
  scheduledAt: string | null;
  scheduleLocation?: string | null;
  acceptedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  alertId: string | null;
  teacher: StudentCareTeamMember;
  latestPendingOffer?: ConsultationScheduleOfferItem | null;
  scheduleOffers?: ConsultationScheduleOfferItem[];
};

type StudentMentalHealthAppointment = {
  id: string;
  kind: "MENTAL_HEALTH";
  scheduledAt: string;
  location: string | null;
  note: string | null;
  providerName: string;
};

type ActiveStudentSurveyResponse = {
  survey: DashboardSurvey | null;
  surveys?: DashboardSurvey[];
  response: ActiveStudentSurveyResult | null;
  hasSubmitted: boolean;
};

type StudentToastState = {
  description: string;
  open: boolean;
  title: string;
  tone: RoleToastTone;
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

export default function StudentDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [studentMobileMenuOpen, setStudentMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [orientationSurveyModalOpen, setOrientationSurveyModalOpen] = useState(false);
  const [studentToast, setStudentToast] = useState<StudentToastState>({
    open: false,
    tone: "success",
    title: "",
    description: "",
  });
  const [studentServerError, setStudentServerError] = useState("");
  const [activeSurvey, setActiveSurvey] = useState<DashboardSurvey | null>(null);
  const [pendingSurveyCount, setPendingSurveyCount] = useState(0);
  const [activeSurveySubmittedAt, setActiveSurveySubmittedAt] = useState<string | null>(null);
  const [hasSubmittedActiveSurvey, setHasSubmittedActiveSurvey] = useState(false);
  const [careTeam, setCareTeam] = useState<StudentCareTeamMember[]>([]);
  const [consultationRequests, setConsultationRequests] = useState<StudentConsultationRequest[]>([]);
  const [mentalHealthAppointments, setMentalHealthAppointments] = useState<StudentMentalHealthAppointment[]>([]);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuCloseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/?auth=login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (!loading && user?.role === "ADMIN") {
      router.replace("/admin");
    }
  }, [loading, router, user?.role]);

  useEffect(() => {
    if (!loading && user?.role === "EXECUTIVE") {
      router.replace("/executive");
    }
  }, [loading, router, user?.role]);

  useEffect(() => {
    if (!loading && user?.role === "ADVISOR") {
      router.replace("/advisor");
    }
  }, [loading, router, user?.role]);

  useEffect(() => {
    if (!loading && user?.role === "STUDENT_DEVELOPMENT") {
      router.replace("/student-development");
    }
  }, [loading, router, user?.role]);

  useEffect(() => {
    if (!loading && user?.role === "MENTAL_HEALTH") {
      router.replace("/mental-health");
    }
  }, [loading, router, user?.role]);

  useEffect(() => {
    if (!loading && (user?.role === "INSTRUCTOR" || user?.roles?.includes("INSTRUCTOR"))) {
      router.replace("/advisor");
    }
  }, [loading, router, user?.role]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (profileMenuCloseTimerRef.current !== null) {
        window.clearTimeout(profileMenuCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!studentToast.open) {
      return;
    }

    const timer = window.setTimeout(() => {
      setStudentToast((current) => ({ ...current, open: false }));
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [studentToast.open]);

  useEffect(() => {
    if (loading || user?.role !== "STUDENT") {
      return;
    }

    const loadStudentDashboard = async () => {
      try {
        const [response, surveyResponse] = await Promise.all([
          api.get<{
            careTeam?: StudentCareTeamMember[];
            consultationRequests?: StudentConsultationRequest[];
            mentalHealthAppointments?: StudentMentalHealthAppointment[];
          }>("/api/student/dashboard"),
          api.get<ActiveStudentSurveyResponse>("/api/student/surveys/active"),
        ]);
        setCareTeam(response.data.careTeam || []);
        setConsultationRequests(response.data.consultationRequests || []);
        setMentalHealthAppointments(response.data.mentalHealthAppointments || []);
        // surveys[] ที่ค้างทำ (ว่างเมื่อทำครบแล้ว) — ใช้รายการแรกเป็น CTA และรองรับ API เดิมที่ส่งแค่ survey เดี่ยว
        const surveyPayload = surveyResponse.data;
        const pendingSurveys = surveyPayload.hasSubmitted
          ? []
          : surveyPayload.surveys ?? (surveyPayload.survey ? [surveyPayload.survey] : []);
        setActiveSurvey(pendingSurveys[0] ?? surveyPayload.survey);
        setPendingSurveyCount(pendingSurveys.length);
        setHasSubmittedActiveSurvey(pendingSurveys.length === 0 && surveyPayload.hasSubmitted);
        setActiveSurveySubmittedAt(surveyResponse.data.response?.submittedAt || null);
      } catch (error) {
        setStudentServerError(getApiErrorMessage(error, "ไม่สามารถโหลดข้อมูลนักศึกษาได้"));
      }
    };

    void loadStudentDashboard();
  }, [loading, user?.role]);

  const handleLogout = async () => {
    await logout();
    router.replace("/?auth=login");
  };

  const formatStudentIdDisplay = (studentId: string | null | undefined): string => {
    if (!studentId) {
      return "-";
    }

    if (/^\d{9}-\d$/.test(studentId)) {
      return studentId;
    }

    if (/^\d{10}$/.test(studentId)) {
      return `${studentId.slice(0, 9)}-${studentId.slice(9)}`;
    }

    return studentId;
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <span className="loader h-7 w-7  text-blue-600"></span>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const identifier = formatStudentIdDisplay(user.studentId) || user.employeeId || user.email || "-";
  const userInitials = user.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "NU";
  const awaitingResponses = listAwaitingStudentResponses(consultationRequests);
  const upcomingConsultations = listUpcomingConsultations(consultationRequests);
  const upcomingMentalHealth = listUpcomingTimedAppointments(mentalHealthAppointments);
  const upcomingPreview = [
    ...upcomingMentalHealth.map((appointment) => ({ kind: "mh" as const, appointment })),
    ...upcomingConsultations.map((request) => ({ kind: "consult" as const, request })),
  ].slice(0, STUDENT_HOME_UPCOMING_LIMIT);
  const upcomingTotal = upcomingMentalHealth.length + upcomingConsultations.length;
  const hasUpcomingAppointments = upcomingTotal > 0;
  const hasOpenConsultation = hasOpenStudentConsultation(consultationRequests);

  const openProfileMenu = () => {
    if (profileMenuCloseTimerRef.current !== null) {
      window.clearTimeout(profileMenuCloseTimerRef.current);
      profileMenuCloseTimerRef.current = null;
    }

    setProfileMenuOpen(true);
  };

  const closeProfileMenuWithDelay = () => {
    if (profileMenuCloseTimerRef.current !== null) {
      window.clearTimeout(profileMenuCloseTimerRef.current);
    }

    profileMenuCloseTimerRef.current = window.setTimeout(() => {
      setProfileMenuOpen(false);
      profileMenuCloseTimerRef.current = null;
    }, 180);
  };

  /** ส่งเคส SOS — โยน error ต่อเพื่อไม่ให้การ์ดปิด dialog แบบสำเร็จปลอม */
  const handleCreateSosCase = async () => {
    await api.post("/api/student/sos", {
      summary: "นักศึกษาร้องขอความช่วยเหลือด่วนผ่านปุ่ม SOS จาก dashboard",
    });
    setStudentToast({
      open: true,
      tone: "success",
      title: "ส่งคำขอช่วยเหลือสำเร็จ",
      description: "ระบบบันทึกคำขอแล้ว หากฉุกเฉินโทร 1323 ได้ทันที",
    });
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <RoleToast
        description={studentToast.description}
        open={studentToast.open}
        onClose={() => setStudentToast((current) => ({ ...current, open: false }))}
        title={studentToast.title}
        tone={studentToast.tone}
        zIndexClassName="z-[300]"
      />
      {studentServerError ? (
        <InlineAlert className="fixed left-1/2 top-24 z-[310] w-[min(92vw,36rem)] -translate-x-1/2 shadow-lg">
          {studentServerError}
        </InlineAlert>
      ) : null}

      <nav className="fixed z-50 w-full border-b border-white/70 bg-white/85 backdrop-blur-md transition-all duration-300">
        <div className="mx-auto max-w-[116rem] px-3 sm:px-4 lg:px-5">
          <div className="flex h-16 items-center justify-between sm:h-20">
            <Link href="/student" className="flex items-center gap-2.5 sm:gap-3">
              <FacultyLogo size={40} className="h-9 w-9 sm:h-10 sm:w-10" priority />
              <div className="flex flex-col justify-center">
                <span className="mb-0.5 block text-lg font-bold leading-none text-blue-900 sm:text-xl">
                  Nucare<span className="text-cyan-500">.</span>
                </span>
                <span className="block max-w-[11rem] truncate text-[11px] font-medium leading-none text-slate-500 sm:max-w-[18rem]">
                  {facultyFullName}
                </span>
              </div>
            </Link>

            <div className="hidden min-w-0 flex-1 items-center justify-center xl:flex">
              <div className="grid grid-cols-4 gap-1 rounded-2xl border border-slate-200 bg-slate-100/70 p-1">
                <Link
                  href="/student"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-white px-3 text-sm font-bold text-blue-700 shadow-sm"
                  aria-current="page"
                >
                  <Home className="h-4 w-4" />
                  {STUDENT_NAV_HOME}
                </Link>
                <Link
                  href="/student/assessment"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-500 transition-colors hover:bg-white/70 hover:text-blue-700"
                >
                  <ClipboardEdit className="h-4 w-4" />
                  {STUDENT_NAV_ASSESSMENT}
                </Link>
                <Link
                  href="/student/advisor"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-500 transition-colors hover:bg-white/70 hover:text-blue-700"
                >
                  <MessageSquare className="h-4 w-4" />
                  {STUDENT_NAV_ADVISOR}
                </Link>
                <Link
                  href="/student/profile"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-500 transition-colors hover:bg-white/70 hover:text-blue-700"
                >
                  <Contact className="h-4 w-4" />
                  {STUDENT_NAV_PROFILE}
                </Link>
              </div>
            </div>

            <div className="hidden items-center gap-4 xl:flex">
              <div
                className="relative w-[15.5rem]"
                ref={profileMenuRef}
                onMouseEnter={openProfileMenu}
                onMouseLeave={closeProfileMenuWithDelay}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (profileMenuCloseTimerRef.current !== null) {
                      window.clearTimeout(profileMenuCloseTimerRef.current);
                      profileMenuCloseTimerRef.current = null;
                    }

                    setProfileMenuOpen((prev) => !prev);
                  }}
                  onFocus={openProfileMenu}
                  className={`flex w-full items-center justify-between gap-2.5 border border-slate-200 bg-white px-3 py-1.5 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50/90 ${
                    profileMenuOpen ? "rounded-b-none rounded-t-[1.35rem] border-b-transparent" : "rounded-[1.35rem]"
                  }`}
                  aria-expanded={profileMenuOpen}
                  aria-haspopup="menu"
                >
                  <div className="hidden min-w-0 flex-1 overflow-hidden text-right lg:block">
                    <p className="truncate whitespace-nowrap text-sm font-bold leading-tight text-blue-900" title={user.name}>{user.name}</p>
                    <p className="truncate whitespace-nowrap text-[11px] text-slate-500">{user.studentId ? `รหัสนักศึกษา: ${identifier}` : identifier}</p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-100 font-bold text-cyan-700">
                    {userInitials}
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>
                <div
                  className={`absolute inset-x-0 top-[calc(100%-1px)] z-50 origin-top overflow-hidden rounded-b-[1.35rem] border border-slate-200/90 border-t-0 bg-white p-1.5 shadow-[0_20px_36px_-28px_rgba(15,23,42,0.32)] transition-all duration-200 ${
                    profileMenuOpen
                      ? "pointer-events-auto visible translate-y-0 scale-100 opacity-100"
                      : "pointer-events-none invisible -translate-y-2 scale-95 opacity-0"
                  }`}
                  role="menu"
                >
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-red-50/80"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                      <LogOut className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-red-600">{STUDENT_LOGOUT_LABEL}</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center xl:hidden">
              <button
                type="button"
                onClick={() => setStudentMobileMenuOpen((prev) => !prev)}
                className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-50 hover:text-blue-700"
                aria-label="toggle mobile menu"
              >
                {studentMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        <div
          className={`overflow-hidden border-t border-slate-100 bg-white transition-all duration-300 xl:hidden ${
            studentMobileMenuOpen ? "max-h-[16rem] pb-4" : "max-h-0"
          }`}
        >
          <div className="space-y-3 px-4 py-3">
            <div className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-100 font-bold text-cyan-700">
                {userInitials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-slate-900">{user.name}</p>
                <p className="truncate text-xs font-medium text-slate-500">
                  {user.studentId ? `รหัสนักศึกษา: ${identifier}` : identifier}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-[1.05rem] border border-red-200 bg-red-50/60 px-3 py-3 text-sm font-semibold text-red-600 shadow-sm transition-colors hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              {STUDENT_LOGOUT_LABEL}
            </button>
          </div>
        </div>
      </nav>

      <section className="px-4 pb-28 pt-28 sm:px-6 lg:px-8 xl:pb-12">
        <div className="mx-auto max-w-7xl space-y-6">
          <StudentDevCarousel />

          {activeSurvey && !hasSubmittedActiveSurvey ? (
            <section id="orientation-survey" className="scroll-mt-24">
              <div className="flex min-h-32 flex-col justify-between gap-4 rounded-[1.35rem] border border-blue-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:gap-5 sm:p-6">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h2 className="min-w-0 text-lg font-bold text-slate-950 sm:text-xl">{activeSurvey.title}</h2>
                      <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        รอทำ
                      </span>
                    </div>
                    {activeSurvey.description ? (
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{activeSurvey.description}</p>
                    ) : null}
                    <p className="mt-2 text-sm font-bold text-blue-700">
                      {getDashboardSurveyQuestionCount(activeSurvey)} คำถามที่เปิดรับคำตอบอยู่
                      {pendingSurveyCount > 1 ? ` · มีแบบประเมินรอทำอีก ${pendingSurveyCount - 1} รายการ` : ""}
                    </p>
                  </div>
                </div>
                <Link
                  href="/student/assessment"
                  className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-800 sm:w-auto"
                >
                  <ClipboardEdit className="h-4 w-4" />
                  ทำแบบสอบถาม
                </Link>
              </div>
            </section>
          ) : null}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            <div className="order-2 space-y-6 lg:order-1">
              <section aria-label="เลือกเพื่อนคุยในระบบ">
                <PersonaCardGrid density="compact" variant="image" items={HOME_CHAT_PERSONAS} />
              </section>

              <section id="action-needed" className="scroll-mt-24">
                <div className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-[15px] font-bold text-slate-900 sm:text-base">ต้องตอบจากคุณ</h2>
                      <p className="mt-1 text-sm text-slate-500">ข้อเสนอนัดที่รอคุณยืนยันหรือขอเปลี่ยน</p>
                    </div>
                    {awaitingResponses.length > 0 ? (
                      <span className="inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                        {awaitingResponses.length} รายการ
                      </span>
                    ) : null}
                  </div>

                  {awaitingResponses.length > 0 ? (
                    <div className="space-y-3">
                      {awaitingResponses.map((request) => {
                        const offer = request.latestPendingOffer;
                        return (
                          <div
                            key={request.id}
                            id={`request-${request.id}`}
                            className="rounded-xl border border-amber-100 bg-amber-50/40 px-4 py-3"
                          >
                            <p className="text-sm font-bold tabular-nums text-slate-900">
                              {offer ? formatThaiDateTime(offer.proposedAt) : "—"}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {request.topic}
                              {offer?.location ? ` · ${offer.location}` : ""} · {request.teacher.name}
                            </p>
                            <ConsultationScheduleActions
                              request={request}
                              onUpdated={(updated) => {
                                setConsultationRequests((current) =>
                                  current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
                                );
                              }}
                              onError={setStudentServerError}
                              onToast={(title, description) =>
                                setStudentToast({ open: true, tone: "success", title, description })
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">ไม่มีข้อเสนอที่รอคุณตอบในตอนนี้</p>
                  )}
                </div>
              </section>

              <section id="appointments" className="scroll-mt-24">
                <div className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
                        <CalendarClock className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-[15px] font-bold text-slate-900 sm:text-base">นัดใกล้ถึง</h2>
                        <p className="mt-1 text-sm text-slate-500">ยืนยันแล้ว · ภายใน 7 วัน</p>
                      </div>
                    </div>
                    {hasOpenConsultation ? (
                      <Link
                        href="/student/advisor#consultation-history"
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:border-blue-200 hover:text-blue-700"
                      >
                        <MessageSquare className="h-4 w-4" />
                        ดูคำขอที่เปิดอยู่
                      </Link>
                    ) : (
                      <Link
                        href="/student/advisor"
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-800"
                      >
                        <CalendarPlus className="h-4 w-4" />
                        ขอรับคำปรึกษา
                      </Link>
                    )}
                  </div>

                  {hasUpcomingAppointments ? (
                    <div className="space-y-3">
                      {upcomingPreview.map((item) => {
                        if (item.kind === "mh") {
                          const appointment = item.appointment;
                          return (
                            <div
                              key={appointment.id}
                              className="rounded-xl border border-cyan-100 bg-cyan-50/40 px-4 py-3"
                            >
                              <p className="text-sm font-bold tabular-nums text-slate-900">
                                {formatThaiDateTime(appointment.scheduledAt)}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                ทีมสุขภาพจิต · {appointment.providerName}
                                {appointment.location ? ` · ${appointment.location}` : ""}
                              </p>
                            </div>
                          );
                        }
                        const request = item.request;
                        const location = resolveAppointmentLocation(request);
                        return (
                          <div
                            key={request.id}
                            className="rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-3"
                          >
                            <p className="text-sm font-bold tabular-nums text-slate-900">
                              {formatThaiDateTime(request.scheduledAt)}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {request.topic}
                              {location ? ` · ${location}` : ""} · {request.teacher.name}
                            </p>
                          </div>
                        );
                      })}
                      {upcomingTotal > STUDENT_HOME_UPCOMING_LIMIT ? (
                        <p className="text-xs text-slate-500">
                          แสดง {STUDENT_HOME_UPCOMING_LIMIT} จาก {upcomingTotal} นัด ·{" "}
                          <Link href="/student/advisor" className="font-semibold text-blue-700 hover:underline">
                            ดูทั้งหมดที่ที่ปรึกษา
                          </Link>
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">ยังไม่มีนัดใน 7 วันข้างหน้า</p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                    <Link
                      href="/student/advisor#consultation-history"
                      className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-blue-700 hover:underline"
                    >
                      <MessageSquare className="h-4 w-4" />
                      ดูประวัติคำขอ
                    </Link>
                  </div>
                </div>
              </section>
            </div>

            <aside className="order-1 space-y-6 lg:order-2">
              <StudentEmergencyHelpCard
                id="emergency-help"
                description="หากรู้สึกไม่ปลอดภัยหรือมีความคิดอยากทำร้ายตนเอง ติดต่อทีมดูแลทันที"
                onConfirmSos={handleCreateSosCase}
              />

              <Link
                href="/student/advisor#expert-counseling"
                className="block rounded-[1.35rem] border border-violet-200 bg-white p-5 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50/40 sm:p-6"
              >
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <HeartPulse className="h-5 w-5 text-violet-700" />
                  ขอพบผู้เชี่ยวชาญสุขภาพจิต
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  ส่งคำตรงถึงศูนย์ให้คำปรึกษา — แยกจากการนัดกับที่ปรึกษา
                </p>
              </Link>

              <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                    <Users className="h-4 w-4 text-blue-600" />
                    ทีมดูแลของฉัน
                  </h3>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                    {careTeam.length} คน
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {careTeam.length > 0 ? (
                    careTeam.map((member) => (
                      <div key={member.id} className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                          {member.initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-blue-700">
                            {member.roleLabels.join(" / ") || "อาจารย์"}
                          </p>
                          <p className="truncate text-sm font-bold text-slate-900">{member.name}</p>
                          {hasOpenConsultation ? (
                            <Link
                              href="/student/advisor#consultation-history"
                              className="mt-1.5 inline-flex min-h-7 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 transition-colors hover:bg-amber-100"
                            >
                              มีคำขอเปิดอยู่
                            </Link>
                          ) : (
                            <Link
                              href={`/student/advisor?teacher=${encodeURIComponent(member.id)}`}
                              className="mt-1.5 inline-flex min-h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 transition-colors hover:border-blue-200 hover:text-blue-700"
                            >
                              <MessageSquare className="h-3 w-3" />
                              ส่งคำขอปรึกษา
                            </Link>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                      ยังไม่มีข้อมูลอาจารย์ที่ปรึกษาในระบบ
                      <Link
                        href="/student/advisor"
                        className="mt-2 inline-flex min-h-8 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-50"
                      >
                        <Search className="h-3.5 w-3.5" />
                        ค้นหาอาจารย์
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <StudentMobileBottomNav />

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
          setStudentToast({
            open: true,
            tone: "success",
            title: "ส่งแบบสอบถามสำเร็จ",
            description: "ระบบบันทึกคำตอบของคุณเรียบร้อยแล้ว",
          });
        }}
      />

    </main>
  );
}
