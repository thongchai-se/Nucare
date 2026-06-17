"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  BookHeart,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  ChevronDown,
  ClipboardEdit,
  Contact,
  FileSpreadsheet,
  HeartPulse,
  Headphones,
  Home,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { facultyFullName } from "@/lib/brand";
import { useAuth } from "@/context/auth.context";
import { OrientationSurveyModal } from "@/components/orientation-survey-modal";
import { RoleToast, type RoleToastTone } from "@/components/role-toast";
import { StudentCreditFooter } from "@/components/student-credit-footer";
import { StudentEmergencyHelpCard } from "@/components/student-emergency-help-card";
import { StudentMobileBottomNav } from "@/components/student-mobile-bottom-nav";
import api from "@/lib/axios";
import type { ActiveStudentSurveyResult, Survey } from "@/types/survey";
import { getStudentPreferredFirstName } from "@/lib/student-display-name";

type StudentCareTeamMember = {
  id: string;
  name: string;
  employeeId: string | null;
  initials: string;
  roleLabels: string[];
  isAssignedAdvisor: boolean;
};

type ConsultationTeachersResponse = {
  teachers: StudentCareTeamMember[];
  topics: string[];
  preferredChannels: Record<string, string>;
};

type ConsultationRequestStatus = "PENDING" | "ACCEPTED" | "SCHEDULED" | "CLOSED";

type StudentConsultationRequest = {
  id: string;
  topic: string;
  preferredChannel: string;
  preferredChannelLabel: string;
  note: string | null;
  status: ConsultationRequestStatus;
  advisorNote: string | null;
  scheduledAt: string | null;
  acceptedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  alertId: string | null;
  teacher: StudentCareTeamMember;
};

type ActiveStudentSurveyResponse = {
  survey: Survey | null;
  response: ActiveStudentSurveyResult | null;
  hasSubmitted: boolean;
};

type StudentToastState = {
  description: string;
  open: boolean;
  title: string;
  tone: RoleToastTone;
};

const defaultConsultationTopics = [
  "การเรียนและผลการเรียน",
  "การฝึกปฏิบัติ/ขึ้นวอร์ด",
  "สุขภาพใจและความเครียด",
  "ทุนการศึกษาและค่าใช้จ่าย",
  "ความสัมพันธ์และครอบครัว",
  "การปรับตัวในมหาวิทยาลัย",
  "อื่น ๆ",
];

const defaultPreferredChannels: Record<string, string> = {
  IN_PERSON: "พบที่คณะ/ห้องพักอาจารย์",
  ONLINE: "ออนไลน์",
  PHONE: "โทรศัพท์",
  MESSAGE: "ข้อความในระบบ",
};

const consultationStatusMeta: Record<
  ConsultationRequestStatus,
  {
    label: string;
    className: string;
  }
> = {
  PENDING: {
    label: "รออาจารย์รับคำขอ",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  ACCEPTED: {
    label: "อาจารย์รับคำขอแล้ว",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  SCHEDULED: {
    label: "นัดหมายแล้ว",
    className: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
  CLOSED: {
    label: "ปิดคำขอแล้ว",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
  ) {
    return (error as { response: { data: { message: string } } }).response.data.message;
  }

  return error instanceof Error ? error.message : fallback;
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
  const [consultationModalOpen, setConsultationModalOpen] = useState(false);
  const [isSubmittingConsultation, setIsSubmittingConsultation] = useState(false);
  const [isLoadingConsultationTeachers, setIsLoadingConsultationTeachers] = useState(false);
  const [studentToast, setStudentToast] = useState<StudentToastState>({
    open: false,
    tone: "success",
    title: "",
    description: "",
  });
  const [studentServerError, setStudentServerError] = useState("");
  const [activeSurvey, setActiveSurvey] = useState<Survey | null>(null);
  const [activeSurveySubmittedAt, setActiveSurveySubmittedAt] = useState<string | null>(null);
  const [hasSubmittedActiveSurvey, setHasSubmittedActiveSurvey] = useState(false);
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
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuCloseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (!loading && user?.role === "ADMIN") {
      router.replace("/dashboard/admin");
    }
  }, [loading, router, user?.role]);

  useEffect(() => {
    if (!loading && user?.role === "EXECUTIVE") {
      router.replace("/dashboard/executive");
    }
  }, [loading, router, user?.role]);

  useEffect(() => {
    if (!loading && user?.role === "ADVISOR") {
      router.replace("/dashboard/advisor");
    }
  }, [loading, router, user?.role]);

  useEffect(() => {
    if (!loading && user?.role === "STUDENT_DEVELOPMENT") {
      router.replace("/dashboard/student-development");
    }
  }, [loading, router, user?.role]);

  useEffect(() => {
    if (!loading && user?.role === "MENTAL_HEALTH") {
      router.replace("/dashboard/mental-health");
    }
  }, [loading, router, user?.role]);

  useEffect(() => {
    if (!loading && user?.role === "INSTRUCTOR") {
      router.replace("/dashboard/instructor");
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
    if (!consultationModalOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [consultationModalOpen]);

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
          }>("/api/student/dashboard"),
          api.get<ActiveStudentSurveyResponse>("/api/student/surveys/active"),
        ]);
        setCareTeam(response.data.careTeam || []);
        setConsultationRequests(response.data.consultationRequests || []);
        setActiveSurvey(surveyResponse.data.survey);
        setHasSubmittedActiveSurvey(surveyResponse.data.hasSubmitted);
        setActiveSurveySubmittedAt(surveyResponse.data.response?.submittedAt || null);
      } catch (error) {
        setStudentServerError(error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลนักศึกษาได้");
      }
    };

    void loadStudentDashboard();
  }, [loading, user?.role]);

  useEffect(() => {
    if (!consultationModalOpen || loading || user?.role !== "STUDENT") {
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
              : defaultPreferredChannels
          );
        } catch (error) {
          if (isCurrent) {
            setStudentServerError(getApiErrorMessage(error, "ไม่สามารถค้นหาอาจารย์ได้"));
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
  }, [consultationModalOpen, loading, teacherSearchQuery, user?.role]);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
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
  const selectedConsultationTeacher =
    consultationTeachers.find((teacher) => teacher.id === selectedTeacherId) ||
    careTeam.find((teacher) => teacher.id === selectedTeacherId) ||
    null;
  const openConsultationCount = consultationRequests.filter((request) => request.status !== "CLOSED").length;
  const latestConsultationRequest = consultationRequests[0] || null;
  const pendingTaskCount = activeSurvey && !hasSubmittedActiveSurvey ? 1 : 0;
  const firstName = getStudentPreferredFirstName(user.name);

  const closeStudentMobileMenu = () => {
    setStudentMobileMenuOpen(false);
    setProfileMenuOpen(false);
  };

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

  const handleSubmitConsultationRequest = async () => {
    if (isSubmittingConsultation) {
      return;
    }

    if (!selectedTeacherId) {
      setStudentServerError("กรุณาเลือกอาจารย์ที่ต้องการปรึกษา");
      return;
    }

    if (!selectedConsultationTopic) {
      setStudentServerError("กรุณาเลือกประเด็นที่จะปรึกษา");
      return;
    }

    setIsSubmittingConsultation(true);
    setStudentServerError("");

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
      setConsultationRequests((current) => [response.data.request, ...current.filter((item) => item.id !== response.data.request.id)]);
      setStudentToast({
        open: true,
        tone: "success",
        title: "ส่งคำขอปรึกษาสำเร็จ",
        description: "ระบบแจ้งอาจารย์ที่เลือกแล้ว กรุณารอตอบกลับหรือนัดหมายจากอาจารย์",
      });
    } catch (error) {
      setStudentServerError(getApiErrorMessage(error, "ไม่สามารถส่งคำขอรับคำปรึกษาได้"));
    } finally {
      setIsSubmittingConsultation(false);
    }
  };

  const handleCreateSosCase = async () => {
    try {
      await api.post("/api/student/sos", {
        summary: "นักศึกษาร้องขอความช่วยเหลือด่วนผ่านปุ่ม SOS จาก dashboard",
      });
      setStudentToast({
        open: true,
        tone: "success",
        title: "ส่งคำขอช่วยเหลือสำเร็จ",
        description: "ระบบได้รับเคส SOS ของคุณแล้วและจะเร่งประสานงานให้",
      });
    } catch (error) {
      setStudentServerError(error instanceof Error ? error.message : "ไม่สามารถส่งเคส SOS ได้");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <RoleToast
        description={studentToast.description}
        open={studentToast.open}
        title={studentToast.title}
        tone={studentToast.tone}
        zIndexClassName="z-[300]"
      />
      {studentServerError && (
        <div className="fixed left-1/2 top-24 z-[310] w-[min(92vw,36rem)] -translate-x-1/2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg">
          {studentServerError}
        </div>
      )}

      <nav className="fixed z-50 w-full border-b border-white/70 bg-white/85 backdrop-blur-md transition-all duration-300">
        <div className="mx-auto max-w-[116rem] px-3 sm:px-4 lg:px-5">
          <div className="flex h-16 items-center justify-between sm:h-20">
            <Link href="/" className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white shadow-md shadow-blue-500/30 sm:h-10 sm:w-10">
                <HeartPulse className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
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
                  href="/dashboard/student"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-white px-3 text-sm font-bold text-blue-700 shadow-sm"
                  aria-current="page"
                >
                  <Home className="h-4 w-4" />
                  หน้าหลัก
                </Link>
                <Link
                  href="/dashboard/student/assessment"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-500 transition-colors hover:bg-white/70 hover:text-blue-700"
                >
                  <ClipboardEdit className="h-4 w-4" />
                  ประเมิน
                </Link>
                <Link
                  href="/dashboard/student/advisor"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-500 transition-colors hover:bg-white/70 hover:text-blue-700"
                >
                  <MessageSquare className="h-4 w-4" />
                  ที่ปรึกษา
                </Link>
                <Link
                  href="/dashboard/student/profile"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-500 transition-colors hover:bg-white/70 hover:text-blue-700"
                >
                  <Contact className="h-4 w-4" />
                  โปรไฟล์
                </Link>
              </div>
            </div>

            <div className="hidden items-center gap-4 xl:flex">
              <button
                type="button"
                className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-blue-700"
                aria-label="notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-white bg-red-500" />
              </button>

              <div className="h-7 border-l border-slate-200" />

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
                  <Link
                    href="/dashboard/student/profile"
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-slate-50"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <Contact className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">ประวัติส่วนตัว</p>
                    </div>
                  </Link>
                  <Link
                    href="/dashboard/student/profile#security"
                    className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-slate-50"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <Lock className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">เปลี่ยนรหัสผ่าน</p>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-1 flex w-full items-center gap-3 rounded-xl border-t border-slate-100 px-3 py-2.5 text-left transition-all hover:bg-red-50/80"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                      <LogOut className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-red-600">ออกจากระบบ</p>
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
            studentMobileMenuOpen ? "max-h-[420px] pb-4" : "max-h-0"
          }`}
        >
          <div className="space-y-3 px-4 py-3">
            <div className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-100 font-bold text-cyan-700">
                {userInitials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-slate-900">{user.name}</p>
                <p className="truncate text-xs font-medium text-slate-500">{user.studentId ? `รหัสนักศึกษา: ${identifier}` : identifier}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/dashboard/student"
                className="flex items-center justify-center gap-2 rounded-[1.05rem] border border-blue-200 bg-blue-50 px-3 py-3 text-sm font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-100"
                onClick={closeStudentMobileMenu}
              >
                <Home className="h-4 w-4" />
                หน้าหลัก
              </Link>
              <Link
                href="/dashboard/student/assessment"
                className="flex items-center justify-center gap-2 rounded-[1.05rem] border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 hover:text-blue-700"
                onClick={closeStudentMobileMenu}
              >
                <ClipboardEdit className="h-4 w-4 text-blue-700" />
                ประเมิน
              </Link>
              <Link
                href="/dashboard/student/advisor"
                className="flex items-center justify-center gap-2 rounded-[1.05rem] border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 hover:text-blue-700"
                onClick={closeStudentMobileMenu}
              >
                <MessageSquare className="h-4 w-4 text-cyan-700" />
                ที่ปรึกษา
              </Link>
              <Link
                href="/dashboard/student/profile"
                className="flex items-center justify-center gap-2 rounded-[1.05rem] border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 hover:text-blue-700"
                onClick={closeStudentMobileMenu}
              >
                <Contact className="h-4 w-4 text-slate-700" />
                โปรไฟล์
              </Link>
              <Link
                href="/dashboard/student/profile#security"
                className="flex items-center justify-center gap-2 rounded-[1.05rem] border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 hover:text-blue-700"
                onClick={closeStudentMobileMenu}
              >
                <Lock className="h-4 w-4 text-slate-700" />
                รหัสผ่าน
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-[1.05rem] border border-red-200 bg-red-50/60 px-3 py-3 text-sm font-semibold text-red-600 shadow-sm transition-colors hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      </nav>

      <section className="px-4 pb-28 pt-28 sm:px-6 lg:px-8 xl:pb-12">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="bg-[linear-gradient(135deg,#f8fafc_0%,#eef6ff_58%,#ecfeff_100%)] p-5 sm:p-7 lg:p-8">
                <div className="flex w-fit items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  ข้อมูลส่วนตัวถูกเก็บเป็นความลับ
                </div>
                <div className="mt-6 max-w-3xl">
                  <h1 className="font-display text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
                    สวัสดี {firstName}
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                    พื้นที่ติดตามสุขภาพใจ นัดหมาย และติดต่อทีมดูแลของคุณในที่เดียว
                  </p>
                </div>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  {activeSurvey && !hasSubmittedActiveSurvey && (
                    <Link
                      href="/dashboard/student/assessment"
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-800"
                    >
                      <ClipboardEdit className="h-4 w-4" />
                      ทำแบบประเมินที่เปิดอยู่
                    </Link>
                  )}
                  <Link
                    href="/dashboard/student/advisor"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition-colors hover:border-blue-200 hover:text-blue-700"
                  >
                    <MessageSquare className="h-4 w-4" />
                    ขอรับคำปรึกษา
                  </Link>
                </div>
              </div>

              <div className="divide-y divide-slate-100 border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
                <div className="flex items-start justify-between gap-4 p-5">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">งานที่ควรทำ</p>
                    <p className="mt-1 text-2xl font-bold text-slate-950">{pendingTaskCount}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <Bell className="h-5 w-5" />
                  </div>
                </div>
                <div className="flex items-start justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-500">แบบสอบถามล่าสุด</p>
                    <p className="mt-1 line-clamp-2 text-lg font-bold text-slate-950">
                      {activeSurvey ? activeSurvey.title : "ยังไม่มีข้อมูล"}
                    </p>
                  </div>
                  <span className={`mt-1 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold ${
                    hasSubmittedActiveSurvey
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : activeSurvey
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}>
                    <span className={`h-2 w-2 rounded-full ${
                      hasSubmittedActiveSurvey ? "bg-emerald-500" : activeSurvey ? "bg-amber-500" : "bg-slate-400"
                    }`} />
                    {hasSubmittedActiveSurvey ? "ทำแล้ว" : activeSurvey ? "รอทำ" : "ไม่มีข้อมูล"}
                  </span>
                </div>
                <div className="grid grid-cols-2 divide-x divide-slate-100">
                  <div className="p-5">
                    <p className="text-xs font-semibold text-slate-500">คำขอที่เปิดอยู่</p>
                    <p className="mt-1 text-2xl font-bold text-slate-950">{openConsultationCount}</p>
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-semibold text-slate-500">ทีมดูแล</p>
                    <p className="mt-1 text-2xl font-bold text-slate-950">{careTeam.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {activeSurvey && (
            <section id="orientation-survey" className="scroll-mt-24">
              <div className="flex min-h-36 flex-col justify-between gap-4 rounded-lg border border-blue-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:gap-5">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                    hasSubmittedActiveSurvey ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                  }`}>
                    {hasSubmittedActiveSurvey ? <ShieldCheck className="h-5 w-5" /> : <FileSpreadsheet className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h2 className="min-w-0 text-base font-bold text-slate-950">{activeSurvey.title}</h2>
                      {hasSubmittedActiveSurvey && (
                        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          ทำแล้ว
                        </span>
                      )}
                    </div>
                    {activeSurvey.description ? (
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{activeSurvey.description}</p>
                    ) : null}
                    {!hasSubmittedActiveSurvey && (
                      <p className="mt-2 text-sm font-bold text-blue-700">
                        {activeSurvey.questionCount} คำถามที่เปิดรับคำตอบอยู่
                      </p>
                    )}
                  </div>
                </div>
                {!hasSubmittedActiveSurvey && (
                  <Link
                    href="/dashboard/student/assessment"
                    className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-800 sm:w-auto"
                  >
                    <ClipboardEdit className="h-4 w-4" />
                    ทำแบบสอบถาม
                  </Link>
                )}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
            <div className="space-y-6">
              <section id="appointments" className="scroll-mt-24">
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
                        <CalendarClock className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">การนัดหมายของฉัน</h2>
                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          ยังไม่มีนัดหมายในขณะนี้ หากต้องการพูดคุยกับอาจารย์หรือทีมดูแลสามารถส่งคำขอใหม่ได้
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
                      <Link
                        href="/dashboard/student/advisor"
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-800"
                      >
                        <CalendarPlus className="h-4 w-4" />
                        ขอรับคำปรึกษา
                      </Link>
                      <div className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-500">
                        <CalendarX2 className="h-4 w-4" />
                        ไม่มีนัดหมาย
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section id="consultation-history" className="scroll-mt-24">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                      <MessageSquare className="h-5 w-5 text-blue-600" />
                      ประวัติคำขอปรึกษา
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      ติดตามสถานะล่าสุดของคำขอและเวลานัดหมายจากอาจารย์
                    </p>
                  </div>
                  <Link
                    href="/dashboard/student/advisor"
                    className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100"
                  >
                    <Plus className="h-4 w-4" />
                    ส่งคำขอใหม่
                  </Link>
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
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
                </div>
              </section>
            </div>

            <aside className="space-y-6">
              <StudentEmergencyHelpCard
                description="หากรู้สึกไม่ปลอดภัยหรือมีความคิดอยากทำร้ายตนเอง ติดต่อทีมดูแลทันที"
                onConfirmSos={handleCreateSosCase}
              />

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 font-bold text-slate-900">
                    <Users className="h-5 w-5 text-blue-600" />
                    ทีมดูแลของฉัน
                  </h3>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                    {careTeam.length} คน
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {careTeam.length > 0 ? (
                    careTeam.map((member) => (
                      <div key={member.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                          {member.initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-blue-700">
                            {member.roleLabels.join(" / ") || "อาจารย์"}
                          </p>
                          <p className="truncate text-sm font-bold text-slate-900">{member.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{member.employeeId || "ไม่มีรหัสบุคลากร"}</p>
                          <div className="mt-2 flex gap-2">
                            <Link
                              href="/dashboard/student/advisor"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-blue-200 hover:text-blue-700"
                              title="ส่งคำขอปรึกษา"
                              aria-label={`ส่งคำขอปรึกษาถึง ${member.name}`}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Link>
                            <Link
                              href="/dashboard/student/advisor"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-blue-200 hover:text-blue-700"
                              title="นัดหมาย"
                              aria-label={`นัดหมายกับ ${member.name}`}
                            >
                              <CalendarPlus className="h-4 w-4" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                      ยังไม่มีข้อมูลอาจารย์ที่ปรึกษาในระบบ สามารถค้นหาอาจารย์เพื่อส่งคำขอปรึกษาได้
                      <Link
                        href="/dashboard/student/advisor"
                        className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-50"
                      >
                        <Search className="h-3.5 w-3.5" />
                        ค้นหาอาจารย์
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 font-bold text-slate-900">
                    <BookHeart className="h-5 w-5 text-indigo-500" />
                    เกร็ดความรู้ฮีลใจ
                  </h3>
                  <button type="button" className="text-xs font-bold text-indigo-600 transition-colors hover:text-indigo-800">
                    ดูทั้งหมด
                  </button>
                </div>
                <ul className="space-y-3">
                  <li>
                    <a href="#" className="group flex items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500 transition-colors group-hover:bg-indigo-100">
                        <Headphones className="h-4 w-4" />
                      </span>
                      <span className="line-clamp-2 text-sm font-medium text-slate-700 transition-colors group-hover:text-indigo-700">
                        พอดแคสต์: เทคนิคผ่อนคลายความเครียดก่อนสอบไฟนอล
                      </span>
                    </a>
                  </li>
                  <li>
                    <a href="#" className="group flex items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-500 transition-colors group-hover:bg-emerald-100">
                        <FileSpreadsheet className="h-4 w-4" />
                      </span>
                      <span className="line-clamp-2 text-sm font-medium text-slate-700 transition-colors group-hover:text-emerald-700">
                        บทความ: วิธีจัดการความกังวลเมื่อต้องขึ้นวอร์ดครั้งแรก
                      </span>
                    </a>
                  </li>
                </ul>
                {latestConsultationRequest && (
                  <div className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">
                    คำขอล่าสุด: {formatThaiDateTime(latestConsultationRequest.createdAt)}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </section>

      <StudentCreditFooter />
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
              <div className="flex shrink-0 items-start justify-between gap-4 bg-blue-700 px-5 py-4 text-white sm:px-6">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-bold">
                    <CalendarPlus className="h-5 w-5 text-blue-200" /> ขอรับคำปรึกษา
                  </h3>
                  <p className="mt-1 text-sm text-blue-100">
                    {selectedConsultationTeacher
                      ? `ส่งคำขอถึง ${selectedConsultationTeacher.name}`
                      : "ค้นหาและเลือกอาจารย์ที่ต้องการปรึกษา"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConsultationModalOpen(false)}
                  className="rounded-md p-1 text-blue-200 transition-colors hover:bg-blue-600 hover:text-white"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-slate-50 p-5 sm:p-6">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <label htmlFor="teacher-search" className="mb-2 block text-sm font-bold text-slate-800">
                    ค้นหาอาจารย์
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="teacher-search"
                      type="search"
                      value={teacherSearchQuery}
                      onChange={(event) => setTeacherSearchQuery(event.target.value)}
                      placeholder="ค้นหาด้วยชื่อ รหัสบุคลากร หรืออีเมล"
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

    </main>
  );
}
