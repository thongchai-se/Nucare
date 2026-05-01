"use client";

import Link from "next/link";
import { FormEvent, ReactNode, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Phone,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth.context";
import { AppBrand } from "@/components/app-brand";
import { ChangePasswordForm } from "@/components/change-password-form";
import { MenuSectionHeading } from "@/components/menu-section-heading";
import api from "@/lib/axios";
import type { Role } from "@/types/auth";

type StudentRiskLevel = "high" | "medium" | "normal";
type ActiveView = "dashboard" | "advisees" | "referrals" | "academic" | "change-password";
type ReferralTarget = "STUDENT_DEVELOPMENT" | "COUNSELING_CENTER";
type ReferralStatus = "PENDING" | "ACCEPTED" | "CLOSED";
type ReferralUrgency = "normal" | "moderate" | "urgent";
type AssessmentInstrument = "Q2" | "ST5" | "Q9" | "Q8" | null;

const isAdvisorView = (value: string | null): value is ActiveView =>
  value === "dashboard" || value === "advisees" || value === "referrals" || value === "academic" || value === "change-password";

type AdvisorStudent = {
  id: string;
  studentId: string | null;
  name: string;
  year: string;
  riskLevel: StudentRiskLevel;
  lastAssessment: string | null;
  careRecordCount: number;
  behaviorRecordCount: number;
  image: string;
  latestScore: number | null;
  latestInstrument: AssessmentInstrument;
};

type AdvisorHistoryItem = {
  id: string;
  kind: "CARE" | "REFERRAL" | "BEHAVIOR";
  date: string;
  type: string;
  topic: string;
  action: string;
  outcome: string | null;
  actorName: string;
  isUrgent: boolean;
};

type AdvisorReferralItem = {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string | null;
  year: string;
  target: ReferralTarget;
  reason: string;
  isUrgent: boolean;
  status: ReferralStatus;
  createdAt: string;
  updatedAt: string;
};

type ToastState = {
  show: boolean;
  message: string;
  type: "success" | "info";
};

type AdvisorStudentsResponse = {
  students: AdvisorStudent[];
  total: number;
};

type StudentHistoryResponse = {
  student: AdvisorStudent;
  history: AdvisorHistoryItem[];
};

type AdvisorReferralsResponse = {
  referrals: AdvisorReferralItem[];
};

const advisorRoles = new Set<Role>(["ADVISOR"]);

const redirectByRole: Partial<Record<Role, string>> = {
  ADMIN: "/dashboard/admin",
  EXECUTIVE: "/dashboard/executive",
  MENTAL_HEALTH: "/dashboard/mental-health",
  INSTRUCTOR: "/dashboard/instructor",
  STUDENT: "/dashboard/student",
};

const riskMeta: Record<
  StudentRiskLevel,
  {
    label: string;
    badgeClassName: string;
    dotClassName: string;
  }
> = {
  high: {
    label: "เสี่ยงสูง",
    badgeClassName: "bg-red-100 text-red-700",
    dotClassName: "bg-red-500",
  },
  medium: {
    label: "ต้องติดตาม",
    badgeClassName: "bg-amber-100 text-amber-700",
    dotClassName: "bg-amber-500",
  },
  normal: {
    label: "ปกติ",
    badgeClassName: "bg-emerald-100 text-emerald-700",
    dotClassName: "bg-emerald-500",
  },
};

const assessmentLabelMap: Record<Exclude<AssessmentInstrument, null>, string> = {
  Q2: "2Q",
  ST5: "ST-5",
  Q9: "9Q",
  Q8: "8Q",
};

const referralStatusMap: Record<
  ReferralStatus,
  {
    label: string;
    className: string;
  }
> = {
  PENDING: {
    label: "รอผู้เชี่ยวชาญรับเคส",
    className: "bg-orange-100 text-orange-700",
  },
  ACCEPTED: {
    label: "กำลังดูแล",
    className: "bg-blue-100 text-blue-700",
  },
  CLOSED: {
    label: "ปิดเคสแล้ว",
    className: "bg-emerald-100 text-emerald-700",
  },
};

const referralTargetMap: Record<ReferralTarget, string> = {
  STUDENT_DEVELOPMENT: "ฝ่ายพัฒนานักศึกษา",
  COUNSELING_CENTER: "ทีมสุขภาพจิต",
};

const urgencyOptions: Array<{
  value: ReferralUrgency;
  label: string;
  className: string;
  activeClassName: string;
}> = [
  {
    value: "normal",
    label: "ปกติ",
    className: "border-slate-200 text-slate-600 hover:bg-slate-50",
    activeClassName: "border-slate-800 bg-slate-800 text-white",
  },
  {
    value: "moderate",
    label: "ปานกลาง",
    className: "border-blue-200 text-blue-700 hover:bg-blue-50",
    activeClassName: "border-blue-500 bg-blue-50 text-blue-700",
  },
  {
    value: "urgent",
    label: "วิกฤต (SOS)",
    className: "border-red-200 text-red-600 hover:bg-red-50",
    activeClassName: "border-red-500 bg-red-50 text-red-700",
  },
];

const formatThaiDate = (value: string | null): string => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
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
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getErrorMessage = (error: unknown): string => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
  ) {
    return (error as { response?: { data?: { message?: string } } }).response?.data?.message || "เกิดข้อผิดพลาด";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
};

const getInitials = (name: string, fallback = "อจ"): string => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return fallback;
  }

  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? "";

  return `${first}${second}`.toUpperCase();
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

const formatAssessmentSummary = (student: AdvisorStudent): string => {
  if (!student.latestInstrument) {
    return "ยังไม่มีผลประเมินล่าสุด";
  }

  const scoreText = student.latestScore !== null ? `คะแนน ${student.latestScore}` : "รอคะแนน";
  return `${assessmentLabelMap[student.latestInstrument]} • ${scoreText}`;
};

const stripStatusPrefix = (value: string | null): string => {
  if (!value) {
    return "-";
  }

  return value.replace(/^สถานะ:\s*/u, "").trim();
};

const formatHistoryOutcome = (item: AdvisorHistoryItem): string | null => {
  if (!item.outcome) {
    return null;
  }

  if (item.kind !== "REFERRAL") {
    return item.outcome;
  }

  const status = stripStatusPrefix(item.outcome) as ReferralStatus;
  const statusMeta = referralStatusMap[status];
  return statusMeta ? `สถานะ: ${statusMeta.label}` : item.outcome;
};

function AdvisorDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, isAuthenticated, logout } = useAuth();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [showSoapModal, setShowSoapModal] = useState(false);
  const [referralUrgency, setReferralUrgency] = useState<ReferralUrgency>("moderate");

  const [students, setStudents] = useState<AdvisorStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<AdvisorHistoryItem[]>([]);
  const [referrals, setReferrals] = useState<AdvisorReferralItem[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [serverError, setServerError] = useState("");
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [toast, setToast] = useState<ToastState>({ show: false, message: "", type: "success" });

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) ?? null,
    [selectedStudentId, students]
  );

  const filteredStudents = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) {
      return students;
    }

    return students.filter((student) => {
      const fullText = [student.name, formatStudentIdDisplay(student.studentId), student.year].join(" ").toLowerCase();
      return fullText.includes(normalized);
    });
  }, [searchQuery, students]);

  const latestReferralByStudent = useMemo(() => {
    const map = new Map<string, AdvisorReferralItem>();

    for (const referral of referrals) {
      if (!map.has(referral.studentId)) {
        map.set(referral.studentId, referral);
      }
    }

    return map;
  }, [referrals]);

  const highRiskStudents = useMemo(
    () => students.filter((student) => student.riskLevel === "high"),
    [students]
  );

  const pendingReferralsCount = useMemo(
    () => referrals.filter((referral) => referral.status === "PENDING").length,
    [referrals]
  );

  const behaviorReportsCount = useMemo(
    () => students.reduce((total, student) => total + student.behaviorRecordCount, 0),
    [students]
  );
  const requestedView = searchParams.get("view");
  const activeView: ActiveView = isAdvisorView(requestedView) ? requestedView : "dashboard";


  const currentViewLabel =
    activeView === "dashboard"
      ? "หน้าหลัก"
      : activeView === "advisees"
        ? "นักศึกษาในที่ปรึกษา"
        : activeView === "referrals"
          ? "ติดตามการส่งต่อ"
          : "แจ้งปัญหาจากผู้สอน";

  const latestUpdatedStudents = useMemo(() => {
    return [...students]
      .sort((left, right) => {
        const leftTime = left.lastAssessment ? new Date(left.lastAssessment).getTime() : 0;
        const rightTime = right.lastAssessment ? new Date(right.lastAssessment).getTime() : 0;
        return rightTime - leftTime;
      })
      .slice(0, 3);
  }, [students]);

  const fetchStudents = useCallback(async () => {
    setLoadingStudents(true);
    setServerError("");

    try {
      const response = await api.get<AdvisorStudentsResponse>("/api/advisor/students");
      const nextStudents = response.data.students;

      setStudents(nextStudents);
      setSelectedStudentId((current) => {
        if (!current) {
          return nextStudents[0]?.id ?? null;
        }

        return nextStudents.some((student) => student.id === current) ? current : (nextStudents[0]?.id ?? null);
      });
    } catch (error) {
      setServerError(getErrorMessage(error));
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  const fetchStudentHistory = useCallback(async (studentId: string) => {
    setLoadingHistory(true);

    try {
      const response = await api.get<StudentHistoryResponse>(`/api/advisor/students/${studentId}/history`);
      setHistoryItems(response.data.history);
      setStudents((current) =>
        current.map((student) => (student.id === response.data.student.id ? response.data.student : student))
      );
    } catch (error) {
      setHistoryItems([]);
      setServerError(getErrorMessage(error));
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const fetchReferrals = useCallback(async () => {
    setLoadingReferrals(true);

    try {
      const response = await api.get<AdvisorReferralsResponse>("/api/advisor/referrals");
      setReferrals(response.data.referrals);
    } catch (error) {
      setServerError(getErrorMessage(error));
    } finally {
      setLoadingReferrals(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    if (!advisorRoles.has(user.role)) {
      router.replace(redirectByRole[user.role] ?? "/dashboard");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (loading || !user || !advisorRoles.has(user.role)) {
      return;
    }

    void Promise.all([fetchStudents(), fetchReferrals()]);
  }, [fetchReferrals, fetchStudents, loading, user]);

  useEffect(() => {
    if (!selectedStudentId) {
      setHistoryItems([]);
      return;
    }

    void fetchStudentHistory(selectedStudentId);
  }, [fetchStudentHistory, selectedStudentId]);

  useEffect(() => {
    if (!toast.show) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [toast.show]);

  const navigateTo = (view: ActiveView) => {
    setIsMobileMenuOpen(false);
    router.replace(view === "dashboard" ? "/dashboard/advisor" : `/dashboard/advisor?view=${view}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showToast = (message: string, type: "success" | "info" = "success") => {
    setToast({ show: true, message, type });
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const openSoapModal = (student: AdvisorStudent) => {
    setSelectedStudentId(student.id);
    setShowSoapModal(true);
    setShowReferralModal(false);
    setIsMobileMenuOpen(false);
  };

  const openReferralModal = (student: AdvisorStudent) => {
    setSelectedStudentId(student.id);
    setReferralUrgency(student.riskLevel === "high" ? "urgent" : "moderate");
    setShowReferralModal(true);
    setShowSoapModal(false);
    setIsMobileMenuOpen(false);
  };

  const handleSaveSoapNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedStudent) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const subjective = String(formData.get("subjective") || "").trim();
    const objective = String(formData.get("objective") || "").trim();
    const assessment = String(formData.get("assessment") || "").trim();
    const plan = String(formData.get("plan") || "").trim();

    try {
      await api.post(`/api/advisor/students/${selectedStudent.id}/care-records`, {
        careDate: String(formData.get("careDate") || ""),
        careType: String(formData.get("careType") || "บันทึกดูแลเบื้องต้น (SOAP)"),
        topic: `S: ${subjective}`,
        action: `O: ${objective}\nA: ${assessment}`,
        outcome: `P: ${plan}`,
      });

      setShowSoapModal(false);
      showToast("บันทึกข้อมูลการดูแลเรียบร้อยแล้ว");
      await Promise.all([fetchStudents(), fetchStudentHistory(selectedStudent.id)]);
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  };

  const handleReferralSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedStudent) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    try {
      await api.post(`/api/advisor/students/${selectedStudent.id}/referrals`, {
        target: String(formData.get("target") || "COUNSELING_CENTER"),
        reason: String(formData.get("reason") || ""),
        isUrgent: referralUrgency === "urgent",
      });

      setShowReferralModal(false);
      showToast("ส่งต่อเคสเรียบร้อยแล้ว สามารถติดตามสถานะได้ในเมนูติดตามการส่งต่อ", "info");
      await Promise.all([fetchReferrals(), fetchStudentHistory(selectedStudent.id)]);
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <span className="loader h-7 w-7 text-blue-600" aria-hidden="true"></span>
      </main>
    );
  }

  if (!user || !advisorRoles.has(user.role)) {
    return null;
  }

  const advisorInitials = getInitials(user.name);

  const SidebarItem = ({
    active,
    icon,
    label,
    onClick,
  }: {
    active: boolean;
    icon: ReactNode;
    label: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left font-medium transition-colors ${
        active
          ? "border-blue-100 bg-blue-50 text-blue-700"
          : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className={active ? "text-blue-600" : "text-slate-400"}>{icon}</span>
        <span className="truncate text-sm">{label}</span>
      </span>
    </button>
  );

  const Sidebar = () => (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="flex h-16 items-center border-b border-slate-100 px-6">
        <AppBrand subtitle="คณะพยาบาลศาสตร์" size="compact" />
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
        <div className="space-y-1">
          <MenuSectionHeading title="เมนูหลัก" />
          <SidebarItem
            active={activeView === "dashboard"}
            icon={<LayoutDashboard size={20} />}
            label="หน้าหลัก"
            onClick={() => navigateTo("dashboard")}
          />
          <SidebarItem
            active={activeView === "advisees"}
            icon={<Users size={20} />}
            label="นักศึกษาในที่ปรึกษา"
            onClick={() => navigateTo("advisees")}
          />
          <SidebarItem
            active={activeView === "referrals"}
            icon={<Send size={20} />}
            label="ติดตามการส่งต่อ"
            onClick={() => navigateTo("referrals")}
          />
          <SidebarItem
            active={activeView === "academic"}
            icon={<BookOpen size={20} />}
            label="แจ้งปัญหาจากผู้สอน"
            onClick={() => navigateTo("academic")}
          />
        </div>

        <div className="space-y-1">
          <MenuSectionHeading title="ระบบและความปลอดภัย" />
          <Link
            href="/dashboard/advisor?view=change-password"
            className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
          >
            <Lock size={20} className="text-slate-400" />
            <span className="truncate">เปลี่ยนรหัสผ่าน</span>
          </Link>
        </div>
      </div>

      <div className="border-t border-slate-100 bg-slate-50/80 p-4">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={18} /> ออกจากระบบ
        </button>
      </div>
    </aside>
  );

  const TopHeader = () => (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={() => setIsMobileMenuOpen((current) => !current)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
          <Menu size={20} />
        </button>

        <div className="hidden items-center gap-2 text-sm font-medium text-slate-500 lg:flex">
          <span>Advisor Portal</span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
          <span className="font-bold text-slate-800">{activeView === "change-password" ? "เปลี่ยนรหัสผ่าน" : currentViewLabel}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        <button type="button" className="relative text-slate-500 transition-colors hover:text-slate-700">
          <Bell size={20} />
          {pendingReferralsCount > 0 && (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />
          )}
        </button>
        <div className="hidden h-6 w-px bg-slate-200 sm:block" />
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-bold leading-none text-slate-800">{user.name}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">อาจารย์ที่ปรึกษา</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-200 bg-blue-100 text-sm font-bold text-blue-700">
            {advisorInitials}
          </div>
        </div>
      </div>
    </header>
  );

  const StatCard = ({
    color,
    icon,
    subtitle,
    title,
    value,
  }: {
    color: "blue" | "red" | "orange" | "indigo";
    icon: ReactNode;
    subtitle: string;
    title: string;
    value: string;
  }) => {
    const colors = {
      blue: "border-blue-100 bg-blue-50 text-blue-600",
      red: "border-red-100 bg-red-50 text-red-600",
      orange: "border-orange-100 bg-orange-50 text-orange-600",
      indigo: "border-indigo-100 bg-indigo-50 text-indigo-600",
    };

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl border ${colors[color]}`}>{icon}</div>
        <h4 className="mb-1 text-2xl font-black text-slate-800">{value}</h4>
        <p className="text-sm font-bold text-slate-700">{title}</p>
        <p className="mt-0.5 text-[10px] text-slate-500">{subtitle}</p>
      </div>
    );
  };

  const StudentDetailPanel = () => {
    if (!selectedStudent) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          ยังไม่ได้เลือกนักศึกษา
        </div>
      );
    }

    const studentRiskMeta = riskMeta[selectedStudent.riskLevel];
    const latestReferral = latestReferralByStudent.get(selectedStudent.id);

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700">
              {selectedStudent.image}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{selectedStudent.name}</h3>
              <p className="text-sm text-slate-500">
                รหัส {formatStudentIdDisplay(selectedStudent.studentId)} • ชั้นปีที่ {selectedStudent.year || "-"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${studentRiskMeta.badgeClassName}`}>
                  {studentRiskMeta.label}
                </span>
                {latestReferral && latestReferral.status !== "CLOSED" && (
                  <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${referralStatusMap[latestReferral.status].className}`}>
                    {referralStatusMap[latestReferral.status].label}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openSoapModal(selectedStudent)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              บันทึกดูแล
            </button>
            <button
              type="button"
              onClick={() => openReferralModal(selectedStudent)}
              disabled={latestReferral?.status === "PENDING" || latestReferral?.status === "ACCEPTED"}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                latestReferral?.status === "PENDING" || latestReferral?.status === "ACCEPTED"
                  ? "cursor-not-allowed bg-slate-100 text-slate-400"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
            >
              ส่งต่อเคส
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">ผลประเมินล่าสุด</p>
            <p className="mt-2 text-sm font-bold text-slate-800">{formatAssessmentSummary(selectedStudent)}</p>
            <p className="mt-1 text-xs text-slate-500">{formatThaiDate(selectedStudent.lastAssessment)}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">บันทึกการดูแล</p>
            <p className="mt-2 text-sm font-bold text-slate-800">{selectedStudent.careRecordCount} รายการ</p>
            <p className="mt-1 text-xs text-slate-500">ติดตามต่อเนื่องโดยอาจารย์ที่ปรึกษา</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">สัญญาณจากผู้สอน</p>
            <p className="mt-2 text-sm font-bold text-slate-800">{selectedStudent.behaviorRecordCount} รายการ</p>
            <p className="mt-1 text-xs text-slate-500">ใช้ประกอบการติดตามและประเมินความเสี่ยง</p>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <ClipboardList className="h-4 w-4 text-blue-600" />
              ประวัติการติดตามล่าสุด
            </h4>
            {loadingHistory && <span className="text-xs text-slate-400">กำลังโหลด...</span>}
          </div>

          {historyItems.length > 0 ? (
            <div className="space-y-3">
              {historyItems.slice(0, 5).map((item) => {
                const isReferral = item.kind === "REFERRAL";
                const isBehavior = item.kind === "BEHAVIOR";

                return (
                  <div key={item.id} className="rounded-xl border border-slate-100 p-4 transition-colors hover:bg-slate-50">
                    <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            isReferral
                              ? "bg-blue-100 text-blue-700"
                              : isBehavior
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {item.kind === "CARE" ? "บันทึกดูแล" : item.kind === "REFERRAL" ? "ส่งต่อเคส" : "แจ้งจากผู้สอน"}
                        </span>
                        {item.isUrgent && (
                          <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700">เร่งด่วน</span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">{formatThaiDateTime(item.date)}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800">{item.topic}</p>
                    <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{item.action}</p>
                    {formatHistoryOutcome(item) && (
                      <p className="mt-2 text-xs font-medium text-slate-500">{formatHistoryOutcome(item)}</p>
                    )}
                    <p className="mt-2 text-xs text-slate-400">ผู้บันทึก: {item.actorName}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              ยังไม่มีประวัติการติดตามสำหรับนักศึกษาคนนี้
            </div>
          )}
        </div>
      </div>
    );
  };

  const DashboardView = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">สวัสดี, {user.name}</h2>
        <p className="mt-1 text-sm text-slate-500">ภาพรวมนักศึกษาในความดูแลของท่าน พร้อมงานที่ต้องติดตามต่อ</p>
      </div>

      {highRiskStudents.length > 0 && (
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <AlertCircle size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-800">อัปเดตผลประเมินล่าสุด</h3>
              <p className="mt-0.5 text-xs text-amber-700">
                พบ {highRiskStudents.length} ราย ที่อยู่ในกลุ่มเสี่ยงสูง กรุณาตรวจสอบและวางแผนดูแลต่อเนื่อง
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigateTo("advisees")}
            className="whitespace-nowrap rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-amber-700"
          >
            ตรวจสอบรายชื่อ
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          color="blue"
          icon={<Users size={20} />}
          title="นักศึกษาทั้งหมด"
          value={String(students.length)}
          subtitle="คนในที่ปรึกษา"
        />
        <StatCard
          color="red"
          icon={<AlertTriangle size={20} />}
          title="กลุ่มเสี่ยงสูง"
          value={String(highRiskStudents.length)}
          subtitle="ต้องดูแลเป็นพิเศษ"
        />
        <StatCard
          color="orange"
          icon={<Send size={20} />}
          title="เคสส่งต่อคงค้าง"
          value={String(pendingReferralsCount)}
          subtitle="รอผู้เชี่ยวชาญรับเคส"
        />
        <StatCard
          color="indigo"
          icon={<Phone size={20} />}
          title="สัญญาณจากผู้สอน"
          value={String(behaviorReportsCount)}
          subtitle="ใช้ประกอบการติดตาม"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-slate-800">
              <Activity className="h-4 w-4 text-blue-600" /> อัปเดตล่าสุดจากนักศึกษา
            </h3>
            <button
              type="button"
              onClick={() => navigateTo("advisees")}
              className="text-sm font-bold text-blue-600 transition-colors hover:text-blue-700"
            >
              ดูทั้งหมด
            </button>
          </div>

          <div className="space-y-3">
            {latestUpdatedStudents.length > 0 ? (
              latestUpdatedStudents.map((student) => {
                const studentRiskMeta = riskMeta[student.riskLevel];

                return (
                  <div
                    key={student.id}
                    className="flex items-center justify-between rounded-xl border border-transparent p-3 transition-colors hover:border-slate-100 hover:bg-slate-50"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudentId(student.id);
                        navigateTo("advisees");
                      }}
                      className="flex items-center gap-3 text-left"
                    >
                      <div className={`h-2 w-2 rounded-full ${studentRiskMeta.dotClassName}`}></div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{student.name}</p>
                        <p className="text-xs text-slate-500">
                          ผลล่าสุด: <span className="font-medium text-slate-700">{formatAssessmentSummary(student)}</span>
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => openSoapModal(student)}
                      className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600 transition-colors hover:bg-blue-100"
                    >
                      บันทึกดูแล
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                ยังไม่มีผลประเมินล่าสุดในระบบ
              </div>
            )}
          </div>
        </div>

        <StudentDetailPanel />
      </div>
    </div>
  );

  const AdviseesView = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">นักศึกษาในที่ปรึกษา</h2>
          <p className="mt-1 text-sm text-slate-500">ดูผลประเมิน บันทึกการดูแล และส่งต่อเคสจากหน้าจอเดียว</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="ค้นหาชื่อ, รหัส..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 sm:w-72"
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredStudents.map((student) => {
          const studentRiskMeta = riskMeta[student.riskLevel];
          const latestReferral = latestReferralByStudent.get(student.id);
          const hasActiveReferral = latestReferral?.status === "PENDING" || latestReferral?.status === "ACCEPTED";

          return (
            <div
              key={student.id}
              className={`rounded-2xl border bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                selectedStudentId === student.id ? "border-blue-200 ring-2 ring-blue-100" : "border-slate-200"
              }`}
            >
              <button type="button" onClick={() => setSelectedStudentId(student.id)} className="w-full text-left">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                      {student.image}
                    </div>
                    <div>
                      <h3 className="font-bold leading-tight text-slate-800">{student.name}</h3>
                      <p className="text-xs text-slate-500">{formatStudentIdDisplay(student.studentId)}</p>
                    </div>
                  </div>
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${studentRiskMeta.badgeClassName}`}>
                    {studentRiskMeta.label}
                  </span>
                </div>

                <div className="mb-4 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">ผลการคัดกรอง</span>
                    <span className="text-[10px] font-bold text-slate-400">ชั้นปี {student.year || "-"}</span>
                  </div>
                  <p className="text-xs font-medium text-slate-700">{formatAssessmentSummary(student)}</p>
                  <p className="text-[11px] text-slate-500">อัปเดตเมื่อ {formatThaiDate(student.lastAssessment)}</p>

                  {latestReferral && (
                    <div className="mt-2 border-t border-slate-200 pt-2">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">สถานะการส่งต่อ</p>
                      <p
                        className={`flex items-center gap-1 text-xs font-bold ${
                          latestReferral.status === "PENDING" ? "text-orange-600" : latestReferral.status === "ACCEPTED" ? "text-blue-600" : "text-emerald-600"
                        }`}
                      >
                        <ArrowRight size={12} /> {referralStatusMap[latestReferral.status].label}
                      </p>
                    </div>
                  )}
                </div>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openSoapModal(student)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  บันทึกดูแล
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!hasActiveReferral) {
                      openReferralModal(student);
                    }
                  }}
                  disabled={hasActiveReferral}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold transition-colors ${
                    hasActiveReferral ? "cursor-not-allowed bg-slate-100 text-slate-400" : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                  }`}
                >
                  <Send size={14} /> ส่งต่อเคส
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredStudents.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          ไม่พบรายชื่อนักศึกษาที่ตรงกับคำค้นหา
        </div>
      )}

      <StudentDetailPanel />
    </div>
  );

  const ReferralHistoryView = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">ติดตามการส่งต่อ</h2>
        <p className="mt-1 text-sm text-slate-500">ตรวจสอบสถานะเคสที่ส่งต่อไปยังผู้เชี่ยวชาญ และติดตาม feedback loop ของการดูแล</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-bold text-slate-800">Referral Tracking</h3>
            <p className="mt-0.5 text-xs text-slate-500">รวมเคสที่อาจารย์ที่ปรึกษาส่งต่อทั้งหมด</p>
          </div>
          {loadingReferrals && <span className="text-xs text-slate-400">กำลังโหลด...</span>}
        </div>

        {referrals.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[860px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-32" />
                  <col className="w-[28%]" />
                  <col className="w-[20%]" />
                  <col className="w-40" />
                  <col className="w-[24%]" />
                </colgroup>
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-5 py-4 font-bold">รหัสส่งต่อ</th>
                    <th className="px-5 py-4 font-bold">นักศึกษา</th>
                    <th className="px-5 py-4 font-bold">ส่งถึง</th>
                    <th className="px-5 py-4 font-bold">วันที่ส่งเรื่อง</th>
                    <th className="px-5 py-4 font-bold">สถานะล่าสุด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {referrals.map((referral) => (
                    <tr key={referral.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-5 py-4 font-medium text-slate-700 whitespace-nowrap">{referral.id}</td>
                      <td className="px-5 py-4">
                        <p className="truncate font-bold text-blue-600">{referral.studentName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatStudentIdDisplay(referral.studentCode)} • ชั้นปี {referral.year || "-"}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        <p className="truncate">{referralTargetMap[referral.target]}</p>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">{formatThaiDateTime(referral.createdAt)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${referralStatusMap[referral.status].className}`}>
                            {referralStatusMap[referral.status].label}
                          </span>
                          {referral.isUrgent && (
                            <span className="rounded-md bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">SOS</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 lg:hidden">
              {referrals.map((referral) => (
                <div key={referral.id} className="rounded-xl border border-slate-100 p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{referral.studentName}</p>
                      <p className="text-xs text-slate-500">{referral.id}</p>
                    </div>
                    <span className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${referralStatusMap[referral.status].className}`}>
                      {referralStatusMap[referral.status].label}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{referralTargetMap[referral.target]}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatThaiDateTime(referral.createdAt)}</p>
                  <p className="mt-3 text-xs text-slate-500">{referral.reason}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="p-10 text-center text-sm text-slate-500">ยังไม่มีประวัติการส่งต่อในขณะนี้</div>
        )}
      </div>
    </div>
  );

  const AcademicPlaceholderView = () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        <BookOpen className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-xl font-bold text-slate-800">พื้นที่ติดตามสัญญาณจากผู้สอน</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
        ระบบมีข้อมูลพฤติกรรมจากผู้สอนรวมอยู่ในประวัตินักศึกษาแล้ว หน้าแยกสำหรับจัดการประเด็นด้านการเรียนและการฝึกปฏิบัติกำลังอยู่ระหว่างพัฒนา
      </p>
    </div>
  );

  const ModalOverlay = ({ children }: { children: ReactNode }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {children}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F4F7FB] font-sans text-slate-800">
      <Sidebar />

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="flex h-full w-72 flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4">
              <AppBrand subtitle="คณะพยาบาลศาสตร์" size="compact" />
              <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
              <div className="space-y-1">
                <MenuSectionHeading title="เมนูหลัก" />
                <SidebarItem
                  active={activeView === "dashboard"}
                  icon={<LayoutDashboard size={20} />}
                  label="หน้าหลัก"
                  onClick={() => navigateTo("dashboard")}
                />
                <SidebarItem
                  active={activeView === "advisees"}
                  icon={<Users size={20} />}
                  label="นักศึกษาในที่ปรึกษา"
                  onClick={() => navigateTo("advisees")}
                />
                <SidebarItem
                  active={activeView === "referrals"}
                  icon={<Send size={20} />}
                  label="ติดตามการส่งต่อ"
                  onClick={() => navigateTo("referrals")}
                />
                <SidebarItem
                  active={activeView === "academic"}
                  icon={<BookOpen size={20} />}
                  label="แจ้งปัญหาจากผู้สอน"
                  onClick={() => navigateTo("academic")}
                />
              </div>

              <div className="space-y-1">
                <MenuSectionHeading title="ระบบและความปลอดภัย" />
                <Link
                  href="/dashboard/advisor?view=change-password"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                >
                  <Lock size={20} className="text-slate-400" />
                  <span className="truncate">เปลี่ยนรหัสผ่าน</span>
                </Link>
              </div>
            </div>

            <div className="border-t border-slate-100 p-4">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <LogOut size={18} /> ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {serverError && (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {serverError}
              </div>
            )}

            {loadingStudents && students.length === 0 ? (
              <div className="flex min-h-[50vh] items-center justify-center">
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500 shadow-sm">
                  <span className="loader h-5 w-5 text-blue-600" aria-hidden="true"></span>
                  กำลังโหลดข้อมูลนักศึกษา...
                </div>
              </div>
            ) : (
              <>
                {activeView === "dashboard" && <DashboardView />}
                {activeView === "advisees" && <AdviseesView />}
                {activeView === "referrals" && <ReferralHistoryView />}
                {activeView === "academic" && <AcademicPlaceholderView />}
                {activeView === "change-password" && (
                  <div className="mx-auto max-w-3xl">
                    <ChangePasswordForm
                      cancelHref="/dashboard/advisor"
                      description="อัปเดตรหัสผ่านของบัญชีอาจารย์ที่ปรึกษาได้จากหน้านี้โดยตรง"
                      onSuccessRedirect="/dashboard/advisor"
                      title="เปลี่ยนรหัสผ่าน"
                      tone="portal"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      <div
        className={`fixed right-4 top-4 z-[60] transform transition-all duration-300 sm:right-6 ${
          toast.show ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-4 opacity-0"
        }`}
      >
        <div
          className={`flex min-w-[280px] items-center gap-3 rounded-2xl border bg-white p-4 shadow-xl ${
            toast.type === "info" ? "border-blue-100" : "border-emerald-100"
          }`}
        >
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full ${
              toast.type === "info" ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
            }`}
          >
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-slate-700">{toast.message}</p>
        </div>
      </div>

      {showSoapModal && selectedStudent && (
        <ModalOverlay>
          <div className="flex items-center justify-between border-b border-slate-100 bg-[#F4F7FB] p-5">
            <div>
              <h3 className="text-lg font-bold text-slate-800">บันทึกดูแลเบื้องต้น (SOAP Note)</h3>
              <p className="mt-1 text-xs text-slate-500">นักศึกษา: {selectedStudent.name}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowSoapModal(false)}
              className="rounded-full bg-white p-1.5 text-slate-400 shadow-sm"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSaveSoapNote} className="flex flex-1 flex-col">
            <div className="space-y-4 overflow-y-auto p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">วันที่บันทึก</label>
                  <input
                    name="careDate"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">รูปแบบการดูแล</label>
                  <select
                    name="careType"
                    defaultValue="บันทึกดูแลเบื้องต้น (SOAP)"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="บันทึกดูแลเบื้องต้น (SOAP)">บันทึกดูแลเบื้องต้น (SOAP)</option>
                    <option value="ให้คำปรึกษาแบบตัวต่อตัว">ให้คำปรึกษาแบบตัวต่อตัว</option>
                    <option value="ติดตามทางโทรศัพท์ / ออนไลน์">ติดตามทางโทรศัพท์ / ออนไลน์</option>
                    <option value="ติดตามต่อเนื่องหลังส่งต่อ">ติดตามต่อเนื่องหลังส่งต่อ</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">S (Subjective) - สิ่งที่นักศึกษาเล่า</label>
                <textarea
                  name="subjective"
                  rows={3}
                  required
                  placeholder="เช่น รู้สึกเครียด นอนไม่หลับ กังวลเรื่องการเรียน..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">O (Objective) - สิ่งที่อาจารย์สังเกตเห็น</label>
                <textarea
                  name="objective"
                  rows={3}
                  required
                  placeholder="เช่น สีหน้ากังวล ขาดเรียนบ่อย พูดน้อยกว่าปกติ..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">A (Assessment) - การประเมินเบื้องต้น</label>
                <textarea
                  name="assessment"
                  rows={3}
                  required
                  placeholder="สรุปประเด็นหลัก ระดับความเสี่ยง และสิ่งที่ควรติดตามต่อ..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">P (Plan) - แผนการดูแล</label>
                <textarea
                  name="plan"
                  rows={3}
                  required
                  placeholder="เช่น นัดติดตามอีกครั้ง ประสานผู้ปกครอง หรือวางแผนส่งต่อ..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 p-5">
              <button
                type="button"
                onClick={() => setShowSoapModal(false)}
                className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-200"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700"
              >
                บันทึกข้อมูล
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}

      {showReferralModal && selectedStudent && (
        <ModalOverlay>
          <div className="flex items-center justify-between border-b border-slate-100 bg-[#F4F7FB] p-5">
            <div className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-bold text-slate-800">ส่งต่อเคส (Internal Referral)</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowReferralModal(false)}
              className="rounded-full bg-white p-1.5 text-slate-400 shadow-sm"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleReferralSubmit} className="flex flex-1 flex-col">
            <div className="space-y-5 overflow-y-auto p-5">
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-600">
                  {selectedStudent.image}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{selectedStudent.name}</p>
                  <p className="text-xs text-slate-500">รหัส: {formatStudentIdDisplay(selectedStudent.studentId)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-700">ระดับความเร่งด่วน</label>
                <div className="grid grid-cols-3 gap-2">
                  {urgencyOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setReferralUrgency(option.value)}
                      className={`rounded-lg border py-2 text-xs font-bold transition-colors ${
                        referralUrgency === option.value ? option.activeClassName : option.className
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold uppercase text-slate-700">หน่วยงานที่ต้องการส่งต่อ</label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50">
                  <input
                    type="radio"
                    name="target"
                    value="COUNSELING_CENTER"
                    defaultChecked
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-800">ทีมสุขภาพจิต / ศูนย์ให้คำปรึกษา</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      เหมาะสำหรับเคสที่มีความเครียดสูง ซึมเศร้า เสี่ยงทำร้ายตนเอง หรือควรรับการประเมินเชิงลึก
                    </p>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50">
                  <input
                    type="radio"
                    name="target"
                    value="STUDENT_DEVELOPMENT"
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-800">ฝ่ายพัฒนานักศึกษา</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      เหมาะสำหรับประเด็นการปรับตัว สวัสดิการ ทุน หรือความช่วยเหลือเชิงระบบอื่น ๆ
                    </p>
                  </div>
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-slate-700">เหตุผลในการส่งต่อ / ข้อมูลเบื้องต้น</label>
                <textarea
                  name="reason"
                  rows={4}
                  required
                  placeholder="อธิบายอาการเบื้องต้น เหตุผลในการส่งต่อ และสิ่งที่ต้องการให้ทีมผู้เชี่ยวชาญช่วยติดตาม..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <p className="text-[11px] font-medium leading-5 text-blue-800">
                  ข้อมูลนักศึกษาจะถูกส่งต่อภายในระบบเพื่อให้ทีมที่เกี่ยวข้องรับช่วงดูแลต่อ และอาจารย์สามารถติดตามสถานะได้จากเมนูติดตามการส่งต่อ
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 p-5">
              <button
                type="button"
                onClick={() => setShowReferralModal(false)}
                className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-200"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-md transition-colors hover:bg-blue-700"
              >
                ยืนยันการส่งต่อ <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}
    </div>
  );
}

export default function AdvisorDashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-100">
          <span className="loader h-7 w-7 text-blue-600"></span>
        </main>
      }
    >
      <AdvisorDashboardContent />
    </Suspense>
  );
}
