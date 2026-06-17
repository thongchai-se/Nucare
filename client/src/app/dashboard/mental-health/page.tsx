"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  LayoutDashboard,
  Lock,
  LogOut,
  MapPin,
  Menu,
  Phone,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth.context";
import { AppBrand } from "@/components/app-brand";
import { ChangePasswordForm } from "@/components/change-password-form";
import { MenuSectionHeading } from "@/components/menu-section-heading";
import { RoleToast } from "@/components/role-toast";
import { StaffRoleSwitcher } from "@/components/staff-role-switcher";
import api from "@/lib/axios";
import { stripKnownNamePrefix } from "@/lib/name-prefix";
import { getRoleHomePath, hasRole } from "@/lib/roles";

type DashboardReferral = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "CLOSED";
  reason: string;
  isUrgent: boolean;
  createdAt: string;
  updatedAt: string;
  advisorName: string;
  currentOwnerName: string | null;
  currentOwnerAssignedAt: string | null;
  careSessionCount: number;
  latestCareSessionAt: string | null;
  student: {
    id: string;
    studentId: string | null;
    name: string;
    year: string;
    riskLevel: "high" | "medium" | "normal";
    latestAssessment: {
      totalScore: number | null;
      instrument: string;
      assessedAt: string;
    } | null;
  };
};

type EmergencyCase = {
  id: string;
  summary: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  openedAt: string;
  student: {
    id: string;
    name: string;
    studentId: string | null;
  };
};

type DashboardAlert = {
  id: string;
  type: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  message: string;
  status: "OPEN" | "ACKNOWLEDGED" | "CLOSED";
  createdAt: string;
};

type ActiveView = "dashboard" | "referrals" | "cases" | "appointments" | "settings" | "change-password";

const isMentalHealthView = (value: string | null): value is ActiveView =>
  value === "dashboard" || value === "referrals" || value === "cases" || value === "appointments" || value === "settings" || value === "change-password";

type ActiveCase = {
  referralId: string;
  studentId: string;
  name: string;
  maskedStudentId: string;
  year: string;
  riskLevel: "high" | "medium" | "normal";
  advisorName: string;
  reason: string;
  isUrgent: boolean;
  lastUpdatedAt: string;
  currentOwnerName: string | null;
  currentOwnerAssignedAt: string | null;
  careSessionCount: number;
  latestCareSessionAt: string | null;
  latestAssessment: DashboardReferral["student"]["latestAssessment"];
};

type CareModalState = {
  sessionDate: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  confidentialNotes: string;
};

type AppointmentDraft = {
  id: string;
  studentId: string;
  studentName: string;
  date: string;
  time: string;
  location: string;
  note: string;
};

type AppointmentModalState = {
  studentId: string;
  date: string;
  time: string;
  location: string;
  note: string;
};

type Notice = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

const emptyCareModalState = (): CareModalState => ({
  sessionDate: new Date().toISOString().slice(0, 10),
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
  confidentialNotes: "",
});

const emptyAppointmentModalState = (): AppointmentModalState => ({
  studentId: "",
  date: new Date().toISOString().slice(0, 10),
  time: "",
  location: "",
  note: "",
});

const getInitials = (name: string): string => {
  const parts = stripKnownNamePrefix(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "NU";
  }

  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? "";
  return `${first}${second}`.toUpperCase();
};

const formatThaiDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
  }).format(date);
};

const formatThaiDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatTime = (value: string): string => (value ? `${value} น.` : "-");

const getRiskClasses = (riskLevel: ActiveCase["riskLevel"] | DashboardReferral["student"]["riskLevel"]) => {
  if (riskLevel === "high") {
    return {
      badge: "bg-red-100 text-red-700",
      chip: "border-red-200 bg-red-50 text-red-700",
      label: "High",
    };
  }

  if (riskLevel === "medium") {
    return {
      badge: "bg-amber-100 text-amber-700",
      chip: "border-amber-200 bg-amber-50 text-amber-700",
      label: "Moderate",
    };
  }

  return {
    badge: "bg-emerald-100 text-emerald-700",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
    label: "Low",
  };
};

const formatLatestAssessment = (assessment: ActiveCase["latestAssessment"]): string => {
  if (!assessment) {
    return "ยังไม่มีข้อมูล";
  }

  return assessment.totalScore === null
    ? assessment.instrument
    : `${assessment.instrument} คะแนน ${assessment.totalScore}`;
};

const SidebarItem = ({
  active,
  badge,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  badge?: number;
  icon: React.ReactNode;
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
    {badge ? <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">{badge}</span> : null}
  </button>
);

const StatCard = ({
  color,
  icon,
  subtitle,
  title,
  value,
}: {
  color: "blue" | "red" | "indigo" | "emerald";
  icon: React.ReactNode;
  subtitle: string;
  title: string;
  value: string | number;
}) => {
  const colors = {
    blue: "border-blue-100 bg-blue-50 text-blue-600",
    red: "border-red-100 bg-red-50 text-red-600",
    indigo: "border-indigo-100 bg-indigo-50 text-indigo-600",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div className={`rounded-xl border p-3 ${colors[color]}`}>{icon}</div>
      </div>
      <div>
        <p className="mb-1 text-2xl font-black text-slate-800">{value}</p>
        <p className="text-sm font-bold text-slate-700">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
};

const ModalShell = ({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) => (
  <div className="fixed inset-0 z-[220] grid place-items-center overflow-y-auto overscroll-contain bg-slate-950/40 p-3 backdrop-blur-sm sm:p-4">
    <div className="flex min-h-0 max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]">{children}</div>
    <button type="button" onClick={onClose} className="sr-only">
      ปิดหน้าต่าง
    </button>
  </div>
);

function MentalHealthDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const mainContentRef = useRef<HTMLElement | null>(null);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [referrals, setReferrals] = useState<DashboardReferral[]>([]);
  const [emergencyCases, setEmergencyCases] = useState<EmergencyCase[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [appointments, setAppointments] = useState<AppointmentDraft[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [showCareModal, setShowCareModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<ActiveCase | null>(null);
  const [careForm, setCareForm] = useState<CareModalState>(emptyCareModalState);
  const [appointmentForm, setAppointmentForm] = useState<AppointmentModalState>(emptyAppointmentModalState);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (!loading && user && !hasRole(user, "MENTAL_HEALTH")) {
      router.replace(getRoleHomePath(user.role));
    }
  }, [isAuthenticated, loading, router, user]);

  const loadDashboard = useCallback(async () => {
    setLoadingData(true);

    try {
      const response = await api.get<{
        referrals: DashboardReferral[];
        emergencyCases: EmergencyCase[];
        alerts: DashboardAlert[];
      }>("/api/mental-health/dashboard");

      setReferrals(response.data.referrals);
      setEmergencyCases(response.data.emergencyCases);
      setAlerts(response.data.alerts);
      setNotice(null);
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลของทีมนักจิตได้",
      });
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && hasRole(user, "MENTAL_HEALTH")) {
      void loadDashboard();
    }
  }, [loadDashboard, loading, user]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 4200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [notice]);

  const pendingReferrals = useMemo(
    () => referrals.filter((item) => item.status === "PENDING"),
    [referrals]
  );

  const acceptedReferrals = useMemo(
    () => referrals.filter((item) => item.status === "ACCEPTED"),
    [referrals]
  );

  const activeCases = useMemo<ActiveCase[]>(() => {
    const byStudent = new Map<string, ActiveCase>();

    acceptedReferrals.forEach((referral) => {
      const current = byStudent.get(referral.student.id);
      if (current && new Date(current.lastUpdatedAt).getTime() > new Date(referral.createdAt).getTime()) {
        return;
      }

      byStudent.set(referral.student.id, {
        referralId: referral.id,
        studentId: referral.student.id,
        name: referral.student.name,
        maskedStudentId: referral.student.studentId || "-",
        year: referral.student.year,
        riskLevel: referral.student.riskLevel,
        advisorName: referral.advisorName,
        reason: referral.reason,
        isUrgent: referral.isUrgent,
        lastUpdatedAt: referral.latestCareSessionAt || referral.updatedAt || referral.createdAt,
        currentOwnerName: referral.currentOwnerName,
        currentOwnerAssignedAt: referral.currentOwnerAssignedAt,
        careSessionCount: referral.careSessionCount,
        latestCareSessionAt: referral.latestCareSessionAt,
        latestAssessment: referral.student.latestAssessment,
      });
    });

    return Array.from(byStudent.values()).sort((left, right) => {
      const riskRank = { high: 0, medium: 1, normal: 2 };
      const riskDiff = riskRank[left.riskLevel] - riskRank[right.riskLevel];
      if (riskDiff !== 0) {
        return riskDiff;
      }

      return new Date(right.lastUpdatedAt).getTime() - new Date(left.lastUpdatedAt).getTime();
    });
  }, [acceptedReferrals]);

  const activeCaseByReferralId = useMemo(
    () => new Map(activeCases.map((item) => [item.referralId, item])),
    [activeCases]
  );

  const todayIso = new Date().toISOString().slice(0, 10);

  const todayAppointments = useMemo(
    () => appointments.filter((item) => item.date === todayIso).sort((left, right) => left.time.localeCompare(right.time)),
    [appointments, todayIso]
  );

  const upcomingAppointments = useMemo(
    () =>
      [...appointments].sort((left, right) => {
        const leftValue = `${left.date}T${left.time || "00:00"}`;
        const rightValue = `${right.date}T${right.time || "00:00"}`;
        return new Date(leftValue).getTime() - new Date(rightValue).getTime();
      }),
    [appointments]
  );

  const casesWithoutAppointments = useMemo(
    () => activeCases.filter((item) => !appointments.some((appointment) => appointment.studentId === item.studentId)),
    [activeCases, appointments]
  );

  const filteredReferrals = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) {
      return referrals;
    }

    return referrals.filter((item) =>
      [
        item.student.name,
        item.student.studentId || "",
        item.advisorName,
        item.currentOwnerName || "",
        item.reason,
        item.student.year,
        item.id,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [referrals, searchQuery]);

  const filteredActiveCases = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) {
      return activeCases;
    }

    return activeCases.filter((item) =>
      [item.name, item.maskedStudentId, item.advisorName, item.currentOwnerName || "", item.reason, item.year]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [activeCases, searchQuery]);

  const filteredAppointments = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) {
      return upcomingAppointments;
    }

    return upcomingAppointments.filter((item) =>
      [item.studentName, item.location, item.note, item.date, item.time].join(" ").toLowerCase().includes(normalized)
    );
  }, [searchQuery, upcomingAppointments]);

  const unreadSignalCount = pendingReferrals.length + emergencyCases.length + alerts.length;
  const requestedView = searchParams.get("view");
  const activeView: ActiveView = isMentalHealthView(requestedView) ? requestedView : "dashboard";

  const currentViewLabel =
    activeView === "dashboard"
      ? "หน้าหลัก"
      : activeView === "referrals"
        ? "รายการส่งต่อ"
        : activeView === "cases"
          ? "เคสในการดูแล"
          : activeView === "appointments"
            ? "ปฏิทินนัดหมาย"
            : "ตั้งค่าระบบ";
  const resolvedViewLabel = activeView === "change-password" ? "เปลี่ยนรหัสผ่าน" : currentViewLabel;
  const userInitials = useMemo(() => getInitials(user?.name || ""), [user?.name]);

  const navigateTo = (view: ActiveView) => {
    setIsMobileMenuOpen(false);
    router.replace(view === "dashboard" ? "/dashboard/mental-health" : `/dashboard/mental-health?view=${view}`);
    window.requestAnimationFrame(() => {
      mainContentRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
  };

  const getCaseStatusLabel = useCallback(
    (item: ActiveCase): string => {
      if (emergencyCases.some((emergency) => emergency.student.id === item.studentId)) {
        return "เฝ้าระวังเร่งด่วน";
      }

      if (item.riskLevel === "high" || item.isUrgent) {
        return "ติดตามใกล้ชิด";
      }

      if (appointments.some((appointment) => appointment.studentId === item.studentId)) {
        return "มีนัดหมายแล้ว";
      }

      return "กำลังดูแล";
    },
    [appointments, emergencyCases]
  );

  const getNextAppointmentLabel = useCallback(
    (studentId: string): string => {
      const nextAppointment = upcomingAppointments.find((item) => item.studentId === studentId);
      if (!nextAppointment) {
        return "ยังไม่มีนัดหมาย";
      }

      return `${formatThaiDate(nextAppointment.date)} • ${formatTime(nextAppointment.time)}`;
    },
    [upcomingAppointments]
  );

  const openCareModal = (item: ActiveCase) => {
    setSelectedCase(item);
    setCareForm({
      ...emptyCareModalState(),
      sessionDate: new Date().toISOString().slice(0, 10),
    });
    setShowCareModal(true);
  };

  const openAppointmentModal = (item?: ActiveCase) => {
    const target = item || activeCases[0] || null;
    setSelectedCase(target);
    setAppointmentForm({
      ...emptyAppointmentModalState(),
      studentId: target?.studentId || "",
    });
    setShowAppointmentModal(true);
  };

  const closeCareModal = () => {
    setShowCareModal(false);
    setSelectedCase(null);
    setCareForm(emptyCareModalState());
  };

  const closeAppointmentModal = () => {
    setShowAppointmentModal(false);
    setSelectedCase(null);
    setAppointmentForm(emptyAppointmentModalState());
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const handleUpdateReferral = async (referralId: string, status: DashboardReferral["status"]) => {
    try {
      await api.patch(`/api/mental-health/referrals/${referralId}/status`, { status });
      await loadDashboard();
      setNotice({
        tone: "success",
        message: status === "ACCEPTED" ? "รับเคสเรียบร้อยแล้ว" : "อัปเดตสถานะ referral เรียบร้อยแล้ว",
      });
      if (status === "ACCEPTED") {
        navigateTo("cases");
      }
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "ไม่สามารถอัปเดตสถานะ referral ได้",
      });
    }
  };

  const handleResolveEmergency = async (caseId: string) => {
    try {
      await api.patch(`/api/mental-health/emergency-cases/${caseId}/resolve`);
      await loadDashboard();
      setNotice({
        tone: "success",
        message: "ปิดเคสฉุกเฉินเรียบร้อยแล้ว",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "ไม่สามารถปิดเคสฉุกเฉินได้",
      });
    }
  };

  const handleSubmitCareRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCase) {
      return;
    }

    try {
      await api.post("/api/mental-health/care-records", {
        studentId: selectedCase.studentId,
        referralId: selectedCase.referralId,
        sessionDate: careForm.sessionDate,
        summary: [`S: ${careForm.subjective}`, `O: ${careForm.objective}`, `A: ${careForm.assessment}`].join("\n\n"),
        interventionPlan: `P: ${careForm.plan}`,
        confidentialNotes: careForm.confidentialNotes.trim() || undefined,
      });

      closeCareModal();
      await loadDashboard();
      setNotice({
        tone: "success",
        message: "บันทึก SOAP note เรียบร้อยแล้ว",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "ไม่สามารถบันทึกข้อมูลการดูแลได้",
      });
    }
  };

  const handleCreateAppointment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const targetCase = activeCases.find((item) => item.studentId === appointmentForm.studentId);
    if (!targetCase) {
      setNotice({
        tone: "error",
        message: "กรุณาเลือกนักศึกษาก่อนสร้างนัดหมาย",
      });
      return;
    }

    setAppointments((current) => [
      ...current,
      {
        id: `APT-${Date.now()}`,
        studentId: targetCase.studentId,
        studentName: targetCase.name,
        date: appointmentForm.date,
        time: appointmentForm.time,
        location: appointmentForm.location.trim(),
        note: appointmentForm.note.trim(),
      },
    ]);

    closeAppointmentModal();
    setNotice({
      tone: "info",
      message: "สร้างนัดหมายในหน้าจอเรียบร้อยแล้ว",
    });
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <span className="loader h-7 w-7 text-blue-600"></span>
      </main>
    );
  }

  if (!user || !hasRole(user, "MENTAL_HEALTH")) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-slate-800">
      <RoleToast
        description={notice?.message}
        open={Boolean(notice)}
        title={
          notice?.tone === "error"
            ? "ไม่สามารถดำเนินการได้"
            : notice?.tone === "info"
              ? "มีข้อมูลอัปเดต"
              : "ดำเนินการสำเร็จ"
        }
        tone={notice?.tone || "success"}
      />

      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <div className="flex h-16 items-center border-b border-slate-100 px-6">
            <Link href="/">
              <AppBrand subtitle="คณะพยาบาลศาสตร์" size="compact" />
            </Link>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
            <div className="space-y-1">
              <MenuSectionHeading title="เมนูหลัก" />
              <SidebarItem
                active={activeView === "dashboard"}
                icon={<LayoutDashboard className="h-5 w-5" />}
                label="หน้าหลัก"
                onClick={() => navigateTo("dashboard")}
              />
              <SidebarItem
                active={activeView === "referrals"}
                badge={pendingReferrals.length}
                icon={<ArrowRightLeft className="h-5 w-5" />}
                label="รายการส่งต่อ"
                onClick={() => navigateTo("referrals")}
              />
              <SidebarItem
                active={activeView === "cases"}
                icon={<Users className="h-5 w-5" />}
                label="เคสในการดูแล"
                onClick={() => navigateTo("cases")}
              />
              <SidebarItem
                active={activeView === "appointments"}
                icon={<CalendarDays className="h-5 w-5" />}
                label="ปฏิทินนัดหมาย"
                onClick={() => navigateTo("appointments")}
              />
            </div>

            <div className="space-y-1">
              <MenuSectionHeading title="ระบบและความปลอดภัย" />
              <SidebarItem
                active={activeView === "settings"}
                icon={<Settings className="h-5 w-5" />}
                label="ตั้งค่าระบบ"
                onClick={() => navigateTo("settings")}
              />
              <Link
                href="/dashboard/mental-health?view=change-password"
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              >
                <Lock className="h-5 w-5 text-slate-400" />
                <span className="truncate">เปลี่ยนรหัสผ่าน</span>
              </Link>
            </div>
          </div>

          <div className="border-t border-slate-100 p-4">
            <StaffRoleSwitcher className="mb-3" />
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />
              ออกจากระบบ
            </button>
          </div>
        </aside>

        {isMobileMenuOpen ? (
          <div className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="flex h-full w-72 flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4">
                <AppBrand subtitle="คณะพยาบาลศาสตร์" size="compact" />
                <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
                <div className="space-y-1">
                  <MenuSectionHeading title="เมนูหลัก" />
                  <SidebarItem
                    active={activeView === "dashboard"}
                    icon={<LayoutDashboard className="h-5 w-5" />}
                    label="หน้าหลัก"
                    onClick={() => navigateTo("dashboard")}
                  />
                  <SidebarItem
                    active={activeView === "referrals"}
                    badge={pendingReferrals.length}
                    icon={<ArrowRightLeft className="h-5 w-5" />}
                    label="รายการส่งต่อ"
                    onClick={() => navigateTo("referrals")}
                  />
                  <SidebarItem
                    active={activeView === "cases"}
                    icon={<Users className="h-5 w-5" />}
                    label="เคสในการดูแล"
                    onClick={() => navigateTo("cases")}
                  />
                  <SidebarItem
                    active={activeView === "appointments"}
                    icon={<CalendarDays className="h-5 w-5" />}
                    label="ปฏิทินนัดหมาย"
                    onClick={() => navigateTo("appointments")}
                  />
                </div>

                <div className="space-y-1">
                  <MenuSectionHeading title="ระบบและความปลอดภัย" />
                  <SidebarItem
                    active={activeView === "settings"}
                    icon={<Settings className="h-5 w-5" />}
                    label="ตั้งค่าระบบ"
                    onClick={() => navigateTo("settings")}
                  />
                  <Link
                    href="/dashboard/mental-health?view=change-password"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                  >
                    <Lock className="h-5 w-5 text-slate-400" />
                    <span className="truncate">เปลี่ยนรหัสผ่าน</span>
                  </Link>
                </div>
              </div>

              <div className="border-t border-slate-100 p-4">
                <StaffRoleSwitcher className="mb-3" onRoleSelect={() => setIsMobileMenuOpen(false)} />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <LogOut className="h-4 w-4" />
                  ออกจากระบบ
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((current) => !current)}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="hidden items-center gap-2 text-sm font-medium text-slate-500 lg:flex">
                <span>Expert Portal</span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
                <span className="font-bold text-slate-800">{resolvedViewLabel}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 sm:gap-6">
              <button
                type="button"
                onClick={() => navigateTo("referrals")}
                className="relative rounded-full p-1 text-slate-500 transition-colors hover:text-slate-800"
              >
                <Bell className="h-5 w-5" />
                {unreadSignalCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadSignalCount > 9 ? "9+" : unreadSignalCount}
                  </span>
                ) : null}
              </button>

              <div className="hidden h-6 w-px bg-slate-200 sm:block"></div>

              <div className="flex items-center gap-3">
                <div className="hidden max-w-[12rem] overflow-hidden text-right sm:block">
                  <p className="truncate whitespace-nowrap text-sm font-bold leading-none text-slate-800" title={user.name}>{user.name}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">ผู้เชี่ยวชาญสุขภาพจิต</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200 bg-indigo-100 text-sm font-bold text-indigo-700">
                  {userInitials}
                </div>
              </div>
            </div>
          </header>

          <main
            ref={mainContentRef}
            className="flex-1 overflow-y-scroll p-4 sm:p-6 lg:p-8"
            style={{ scrollbarGutter: "stable" }}
          >
            <div className="mx-auto max-w-7xl">
              {activeView === "dashboard" ? (
                <div className="space-y-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-800">สวัสดี, {user.name}</h2>
                      <p className="mt-1 text-sm text-slate-500">สรุปภาพรวมงานดูแลนักศึกษาที่ถูกส่งต่อมายังทีมสุขภาพจิต</p>
                    </div>
                    <div className="flex w-max items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700">
                      <ShieldCheck className="h-4 w-4" />
                      PDPA Protection Active
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                    <StatCard
                      color="blue"
                      icon={<ArrowRightLeft className="h-5 w-5" />}
                      subtitle="รอการตอบรับจากคุณ"
                      title="เคสส่งต่อใหม่"
                      value={pendingReferrals.length}
                    />
                    <StatCard
                      color="red"
                      icon={<AlertTriangle className="h-5 w-5" />}
                      subtitle={`${emergencyCases.length} เคสฉุกเฉินที่ยังเปิดอยู่`}
                      title="เคสความเสี่ยงสูง"
                      value={activeCases.filter((item) => item.riskLevel === "high").length}
                    />
                    <StatCard
                      color="indigo"
                      icon={<CalendarDays className="h-5 w-5" />}
                      subtitle="นัดที่สร้างในหน้านี้"
                      title="นัดหมายวันนี้"
                      value={todayAppointments.length}
                    />
                    <StatCard
                      color="emerald"
                      icon={<CheckCircle2 className="h-5 w-5" />}
                      subtitle="เคสที่อยู่ในมือและเปิดดูแลอยู่"
                      title="เคสกำลังดูแล"
                      value={activeCases.length}
                    />
                  </div>

                  <div className="overflow-hidden rounded-3xl bg-[#B91C1C] p-6 shadow-lg">
                    <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="absolute -bottom-12 -right-6 hidden opacity-10 sm:block">
                        <Phone className="h-40 w-40 text-white" />
                      </div>
                      <div className="relative z-10 flex items-start gap-4 text-white">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                          <AlertTriangle className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold">แจ้งเตือนเคสฉุกเฉิน</h3>
                          <p className="mt-1 text-sm text-red-100">
                            {emergencyCases.length > 0
                              ? `มีเคสฉุกเฉิน ${emergencyCases.length} รายที่ยังต้องติดตามในตอนนี้`
                              : "ยังไม่มีเคสฉุกเฉินค้างอยู่ในระบบตอนนี้"}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigateTo("referrals")}
                        className="relative z-10 w-full rounded-xl bg-white px-6 py-3 text-sm font-bold text-red-700 shadow-md transition-colors hover:bg-red-50 sm:w-auto"
                      >
                        ตรวจสอบรายละเอียดทันที
                      </button>
                    </div>
                  </div>

                  {emergencyCases.length > 0 ? (
                    <section className="rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
                      <div className="mb-4 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                        <h3 className="font-bold text-slate-800">เคสฉุกเฉินที่ยังเปิดอยู่</h3>
                      </div>
                      <div className="space-y-3">
                        {emergencyCases.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-red-100 bg-red-50 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-red-900">
                                  {item.student.name} ({item.student.studentId || "-"})
                                </p>
                                <p className="mt-1 text-sm text-red-800">{item.summary}</p>
                                <p className="mt-2 text-xs text-red-700">เปิดเคสเมื่อ {formatThaiDateTime(item.openedAt)}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleResolveEmergency(item.id)}
                                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-red-700"
                              >
                                ปิดเคสฉุกเฉิน
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  <div className="grid gap-6 xl:grid-cols-2">
                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
                          <ArrowRightLeft className="h-4 w-4 text-blue-600" />
                          รายการส่งต่อรอดำเนินการ
                        </h3>
                        <button type="button" onClick={() => navigateTo("referrals")} className="text-sm font-bold text-blue-600 hover:underline">
                          ดูทั้งหมด
                        </button>
                      </div>
                      <div className="space-y-3">
                        {pendingReferrals.slice(0, 3).map((item) => {
                          const risk = getRiskClasses(item.student.riskLevel);
                          return (
                            <div key={item.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-800">ข้อมูลนักศึกษาถูกปกปิดจนกว่าจะรับเคส</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {item.id} • {item.student.year} • ส่งต่อโดย {item.advisorName}
                                </p>
                                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.reason}</p>
                              </div>
                              <span className={`shrink-0 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase ${risk.badge}`}>
                                {risk.label}
                              </span>
                            </div>
                          );
                        })}
                        {pendingReferrals.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                            ไม่มี referral ใหม่ในคิวตอนนี้
                          </div>
                        ) : null}
                      </div>
                    </section>

                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
                          <CalendarDays className="h-4 w-4 text-indigo-600" />
                          นัดหมายวันนี้
                        </h3>
                        <button
                          type="button"
                          onClick={() => openAppointmentModal()}
                          className="text-sm font-bold text-blue-600 hover:underline"
                        >
                          เพิ่มนัดหมาย
                        </button>
                      </div>
                      <div className="space-y-3">
                        {todayAppointments.slice(0, 3).map((item) => (
                          <div key={item.id} className="flex gap-4 rounded-r-2xl border-l-4 border-indigo-500 bg-indigo-50/40 p-4">
                            <div className="text-center">
                              <p className="text-sm font-bold text-indigo-700">{item.time || "--:--"}</p>
                              <p className="text-[10px] text-slate-500">น.</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-800">{item.studentName}</p>
                              <p className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                                <MapPin className="h-3.5 w-3.5" />
                                {item.location || "ยังไม่ระบุสถานที่"}
                              </p>
                            </div>
                          </div>
                        ))}
                        {todayAppointments.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                            วันนี้ยังไม่มีนัดหมายที่ถูกสร้างในหน้าจอนี้
                          </div>
                        ) : null}
                      </div>
                    </section>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
                          <Users className="h-4 w-4 text-blue-600" />
                          เคสที่กำลังดูแล
                        </h3>
                        <button type="button" onClick={() => navigateTo("cases")} className="text-sm font-bold text-blue-600 hover:underline">
                          เปิดทั้งหมด
                        </button>
                      </div>
                      <div className="space-y-4">
                        {activeCases.slice(0, 4).map((item) => {
                          const risk = getRiskClasses(item.riskLevel);
                          return (
                            <div key={item.referralId} className="rounded-2xl border border-slate-200 p-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-slate-800">{item.name}</p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    รหัส: {item.maskedStudentId} • {item.year} • โดย {item.advisorName}
                                  </p>
                                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.reason}</p>
                                </div>
                                <span className={`w-max rounded-md px-2.5 py-1 text-[10px] font-bold uppercase ${risk.badge}`}>
                                  {risk.label}
                                </span>
                              </div>

                              <div className="mt-4 grid gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-3">
                                <div>
                                  <p className="text-[10px] font-bold uppercase text-slate-400">สถานะ</p>
                                  <p className="mt-1 text-xs font-bold text-blue-700">{getCaseStatusLabel(item)}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold uppercase text-slate-400">ประเมินล่าสุด</p>
                                  <p className="mt-1 text-xs font-medium text-slate-700">
                                    {formatLatestAssessment(item.latestAssessment)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold uppercase text-slate-400">นัดหมายถัดไป</p>
                                  <p className="mt-1 text-xs font-medium text-slate-700">{getNextAppointmentLabel(item.studentId)}</p>
                                </div>
                              </div>

                              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                                <button
                                  type="button"
                                  onClick={() => openCareModal(item)}
                                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-700"
                                >
                                  <FileText className="h-4 w-4" />
                                  บันทึก SOAP
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openAppointmentModal(item)}
                                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100"
                                >
                                  <CalendarDays className="h-4 w-4" />
                                  สร้างนัดหมาย
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {activeCases.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                            ยังไม่มีเคสที่ถูกตอบรับเข้ามาในความดูแล
                          </div>
                        ) : null}
                      </div>
                    </section>

                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
                          <Activity className="h-4 w-4 text-amber-500" />
                          สัญญาณและการแจ้งเตือน
                        </h3>
                        <button type="button" onClick={() => void loadDashboard()} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="space-y-3">
                        {alerts.slice(0, 4).map((item) => (
                          <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-800">{item.title}</p>
                                <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                                <p className="mt-2 text-xs text-slate-500">{formatThaiDateTime(item.createdAt)}</p>
                              </div>
                              <span
                                className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                                  item.priority === "CRITICAL" || item.priority === "HIGH"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {item.priority}
                              </span>
                            </div>
                          </div>
                        ))}
                        {alerts.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                            ยังไม่มี alert ใหม่จากระบบ
                          </div>
                        ) : null}
                      </div>
                    </section>
                  </div>
                </div>
              ) : null}

              {activeView === "referrals" ? (
                <div className="space-y-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-800">รายการส่งต่อ</h2>
                      <p className="mt-1 text-sm text-slate-500">เคสที่ยังไม่รับงานจะยังไม่แสดงชื่อและข้อมูลนักศึกษาเต็มรูปแบบบนหน้าจอนี้</p>
                    </div>
                    <div className="w-full sm:w-80">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(event) => setSearchQuery(event.target.value)}
                          placeholder="ค้นหา referral, ผู้ส่งต่อ..."
                          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:block">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] table-fixed text-left">
                        <colgroup>
                          <col className="w-[34%]" />
                          <col className="w-[14%]" />
                          <col className="w-[16%]" />
                          <col className="w-[16%]" />
                          <col className="w-[20%]" />
                        </colgroup>
                        <thead className="bg-slate-50 text-sm text-slate-600">
                          <tr>
                            <th className="px-5 py-4 font-bold">รหัสอ้างอิง / ข้อมูลนักศึกษา</th>
                            <th className="px-5 py-4 font-bold">ความเสี่ยง</th>
                            <th className="px-5 py-4 font-bold">ผู้ส่งต่อ</th>
                            <th className="px-5 py-4 font-bold">วันที่ส่งเรื่อง</th>
                            <th className="px-5 py-4 font-bold text-right">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredReferrals.map((item) => {
                            const risk = getRiskClasses(item.student.riskLevel);
                            return (
                              <tr key={item.id} className="align-top hover:bg-slate-50/70">
                                <td className="px-5 py-4">
                                  {item.status === "PENDING" ? (
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-slate-800">ข้อมูลนักศึกษาถูกปกปิดจนกว่าจะรับเคส</p>
                                      <p className="mt-1 text-xs text-slate-500">
                                        {item.id} • {item.student.year}
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-blue-700">
                                        {item.student.name} ({item.student.studentId || "-"})
                                      </p>
                                      <p className="mt-1 text-xs text-slate-500">
                                        {item.id} • {item.student.year}
                                      </p>
                                    </div>
                                  )}
                                </td>
                                <td className="px-5 py-4">
                                  <span className={`rounded-md px-2.5 py-1 text-xs font-bold uppercase ${risk.badge}`}>{risk.label}</span>
                                </td>
                                <td className="px-5 py-4 text-sm text-slate-600">
                                  <p className="truncate">{item.advisorName}</p>
                                  {item.currentOwnerName ? <p className="mt-1 text-xs text-slate-500">Owner: {item.currentOwnerName}</p> : null}
                                </td>
                                <td className="px-5 py-4 text-sm text-slate-600 whitespace-nowrap">{formatThaiDateTime(item.createdAt)}</td>
                                <td className="px-5 py-4">
                                  <div className="flex justify-end gap-2">
                                    {item.status === "PENDING" ? (
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateReferral(item.id, "ACCEPTED")}
                                        className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700"
                                      >
                                        ยืนยันรับเคส
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const target = activeCaseByReferralId.get(item.id);
                                          if (target) {
                                            openCareModal(target);
                                          }
                                        }}
                                        className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
                                      >
                                        บันทึก SOAP
                                      </button>
                                    )}
                                    {item.status !== "CLOSED" ? (
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateReferral(item.id, "CLOSED")}
                                        className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
                                      >
                                        ปิดเคส
                                      </button>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-4 lg:hidden">
                    {filteredReferrals.map((item) => {
                      const risk = getRiskClasses(item.student.riskLevel);
                      return (
                        <article key={item.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-800">
                                {item.status === "PENDING" ? "ข้อมูลนักศึกษาถูกปกปิดจนกว่าจะรับเคส" : item.student.name}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {item.id} • {item.student.year} • {item.advisorName}
                              </p>
                            </div>
                            <span className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase ${risk.badge}`}>{risk.label}</span>
                          </div>
                          <p className="mt-3 text-sm text-slate-600">{item.reason}</p>
                          {item.currentOwnerName ? <p className="mt-2 text-xs text-slate-500">Owner: {item.currentOwnerName}</p> : null}
                          <div className="mt-4 flex flex-wrap gap-2">
                            {item.status === "PENDING" ? (
                              <button
                                type="button"
                                onClick={() => handleUpdateReferral(item.id, "ACCEPTED")}
                                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white"
                              >
                                ยืนยันรับเคส
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const target = activeCaseByReferralId.get(item.id);
                                  if (target) {
                                    openCareModal(target);
                                  }
                                }}
                                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700"
                              >
                                บันทึก SOAP
                              </button>
                            )}
                            {item.status !== "CLOSED" ? (
                              <button
                                type="button"
                                onClick={() => handleUpdateReferral(item.id, "CLOSED")}
                                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
                              >
                                ปิดเคส
                              </button>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                    {filteredReferrals.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
                        ไม่พบรายการส่งต่อที่ตรงกับคำค้นหา
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {activeView === "cases" ? (
                <div className="space-y-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-800">เคสในการดูแล</h2>
                      <p className="mt-1 text-sm text-slate-500">รายชื่อนักศึกษาที่คุณรับเคสแล้ว พร้อม action สำหรับ SOAP และการนัดหมาย</p>
                    </div>
                    <div className="w-full sm:w-80">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(event) => setSearchQuery(event.target.value)}
                          placeholder="ค้นหาชื่อ, รหัส, ปีการศึกษา..."
                          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {filteredActiveCases.map((item) => {
                      const risk = getRiskClasses(item.riskLevel);
                      return (
                        <article key={item.referralId} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                          <div className="flex items-start gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-lg font-bold text-blue-700">
                              {item.name.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="break-words text-base font-bold leading-tight text-slate-800">{item.name}</h3>
                              <p className="mt-1 text-xs text-slate-500">รหัส: {item.maskedStudentId}</p>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                            <div>
                              <p className="text-[10px] font-bold uppercase text-slate-400">ความเสี่ยง</p>
                              <p className={`mt-1 text-xs font-bold ${risk.badge.split(" ").at(-1)}`}>{risk.label}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase text-slate-400">สถานะ</p>
                              <p className="mt-1 text-xs font-bold text-blue-700">{getCaseStatusLabel(item)}</p>
                            </div>
                            <div className="col-span-2 border-t border-slate-200 pt-2">
                              <p className="text-[10px] font-bold uppercase text-slate-400">Case Owner</p>
                              <p className="mt-1 text-xs font-medium text-slate-700">{item.currentOwnerName || "Unassigned"}</p>
                            </div>
                            <div className="col-span-2 border-t border-slate-200 pt-2">
                              <p className="text-[10px] font-bold uppercase text-slate-400">นัดหมายถัดไป</p>
                              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-slate-700">
                                <CalendarDays className="h-3.5 w-3.5" />
                                {getNextAppointmentLabel(item.studentId)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 space-y-3">
                            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                              <p className="text-[10px] font-bold uppercase text-slate-400">ผู้ส่งต่อและเหตุผล</p>
                              <p className="mt-1 text-xs font-medium text-slate-700">{item.advisorName}</p>
                              <p className="mt-2 line-clamp-3 text-sm text-slate-600">{item.reason}</p>
                              <p className="mt-2 text-xs text-slate-500">
                                {item.careSessionCount > 0
                                  ? `SOAP ${item.careSessionCount} ครั้ง ล่าสุด ${formatThaiDate(item.latestCareSessionAt || item.lastUpdatedAt)}`
                                  : `ยังไม่มี SOAP ล่าสุด อัปเดต ${formatThaiDate(item.lastUpdatedAt)}`}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => openCareModal(item)}
                                className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-700"
                              >
                                <FileText className="h-4 w-4" />
                                บันทึก SOAP
                              </button>
                              <button
                                type="button"
                                onClick={() => openAppointmentModal(item)}
                                className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-blue-50 py-2.5 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100"
                              >
                                <CalendarDays className="h-4 w-4" />
                                นัดหมาย
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                    {filteredActiveCases.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">
                        ยังไม่พบเคสที่ตรงกับคำค้นหา หรือยังไม่มีเคสที่ตอบรับแล้ว
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {activeView === "appointments" ? (
                <div className="space-y-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-800">ปฏิทินนัดหมาย</h2>
                      <p className="mt-1 text-sm text-slate-500">จัดการคิวติดตามนักศึกษาที่คุณรับเคสไว้แล้ว</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openAppointmentModal()}
                      className="w-full rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-blue-700 sm:w-auto"
                    >
                      เพิ่มนัดหมายใหม่
                    </button>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="mb-4 flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-indigo-600" />
                        <h3 className="font-bold text-slate-800">รายการนัดหมายที่สร้างแล้ว</h3>
                      </div>
                      <div className="space-y-3">
                        {filteredAppointments.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-800">{item.studentName}</p>
                                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                                  <Clock3 className="h-3.5 w-3.5" />
                                  {formatThaiDate(item.date)} • {formatTime(item.time)}
                                </p>
                                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {item.location || "ยังไม่ระบุสถานที่"}
                                </p>
                              </div>
                              <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-bold text-blue-700">
                                ติดตามอาการ
                              </span>
                            </div>
                            {item.note ? <p className="mt-3 text-sm text-slate-600">{item.note}</p> : null}
                          </div>
                        ))}
                        {filteredAppointments.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                            ยังไม่มีนัดหมายที่สร้างในหน้านี้
                          </div>
                        ) : null}
                      </div>
                    </section>

                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="mb-4 flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-600" />
                        <h3 className="font-bold text-slate-800">เคสที่ยังไม่มีนัดหมาย</h3>
                      </div>
                      <div className="space-y-3">
                        {casesWithoutAppointments.map((item) => {
                          const risk = getRiskClasses(item.riskLevel);
                          return (
                            <div key={item.referralId} className="rounded-2xl border border-slate-200 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-slate-800">{item.name}</p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {item.maskedStudentId} • {item.year}
                                  </p>
                                </div>
                                <span className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase ${risk.badge}`}>{risk.label}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => openAppointmentModal(item)}
                                className="mt-4 flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-700"
                              >
                                สร้างนัดหมาย
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </div>
                          );
                        })}
                        {casesWithoutAppointments.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                            ทุกเคสที่รับแล้วมีนัดหมายในหน้าจอนี้ครบแล้ว
                          </div>
                        ) : null}
                      </div>
                    </section>
                  </div>
                </div>
              ) : null}

              {activeView === "settings" ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">ตั้งค่าระบบ</h2>
                    <p className="mt-1 text-sm text-slate-500">เครื่องมือช่วยเช็กสถานะข้อมูลและแนวปฏิบัติการคุ้มครองข้อมูลภายในหน้าของนักจิต</p>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="mb-4 flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-emerald-600" />
                        <h3 className="font-bold text-slate-800">การคุ้มครองข้อมูล</h3>
                      </div>
                      <ul className="space-y-3 text-sm text-slate-600">
                        <li className="rounded-2xl border border-slate-100 bg-slate-50 p-4">Referral ที่ยังไม่รับงานจะไม่แสดงชื่อจริงบนรายการคิว</li>
                        <li className="rounded-2xl border border-slate-100 bg-slate-50 p-4">การบันทึก SOAP ถูกส่งผ่าน endpoint สำหรับ specialized care records เท่านั้น</li>
                        <li className="rounded-2xl border border-slate-100 bg-slate-50 p-4">การรีเฟรชข้อมูลจะดึงเฉพาะ dashboard ของ role นักจิตที่ล็อกอินอยู่</li>
                      </ul>
                    </section>

                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="mb-4 flex items-center gap-2">
                        <Settings className="h-5 w-5 text-blue-600" />
                        <h3 className="font-bold text-slate-800">เครื่องมือดูแลระบบหน้าจอ</h3>
                      </div>
                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={() => void loadDashboard()}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          <RefreshCw className="h-4 w-4" />
                          รีโหลดข้อมูล dashboard
                        </button>
                        <button
                          type="button"
                          onClick={() => setAppointments([])}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          <CalendarDays className="h-4 w-4" />
                          ล้างนัดหมายที่สร้างในหน้านี้
                        </button>
                      </div>
                    </section>
                  </div>
                </div>
              ) : null}

              {activeView === "change-password" ? (
                <div className="mx-auto max-w-3xl">
                  <ChangePasswordForm
                    cancelHref="/dashboard/mental-health?view=settings"
                    description="อัปเดตรหัสผ่านของบัญชีผู้เชี่ยวชาญได้จากหน้านี้โดยตรง"
                    onSuccessRedirect="/dashboard/mental-health?view=settings"
                    title="เปลี่ยนรหัสผ่าน"
                    tone="portal"
                  />
                </div>
              ) : null}

              {loadingData ? (
                <div className="pointer-events-none fixed bottom-4 right-4 z-40 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-lg">
                  <div className="flex items-center gap-2">
                    <span className="loader h-4 w-4 text-blue-600"></span>
                    กำลังอัปเดตข้อมูล...
                  </div>
                </div>
              ) : null}
            </div>
          </main>
        </div>
      </div>

      {showCareModal && selectedCase ? (
        <ModalShell onClose={closeCareModal}>
          <div className="border-b border-slate-100 bg-[#F4F7FB] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-800">บันทึกความก้าวหน้า (SOAP Note)</h3>
                <p className="mt-1 text-sm text-slate-500">
                  นักศึกษา: <span className="font-bold text-blue-700">{selectedCase.name}</span> ({selectedCase.maskedStudentId})
                </p>
              </div>
              <button type="button" onClick={closeCareModal} className="rounded-full bg-white p-2 shadow-sm transition-colors hover:bg-slate-50">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmitCareRecord} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">วันที่ให้บริการ</label>
                <input
                  type="date"
                  value={careForm.sessionDate}
                  onChange={(event) => setCareForm((current) => ({ ...current, sessionDate: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">S (Subjective)</label>
                <textarea
                  rows={3}
                  value={careForm.subjective}
                  onChange={(event) => setCareForm((current) => ({ ...current, subjective: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="นักศึกษาบอกเล่าความรู้สึก อาการ หรือสิ่งที่กำลังกังวล..."
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">O (Objective)</label>
                <textarea
                  rows={3}
                  value={careForm.objective}
                  onChange={(event) => setCareForm((current) => ({ ...current, objective: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="สิ่งที่สังเกตเห็นจากการพูดคุย สีหน้า ท่าทาง หรือพฤติกรรม..."
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">A (Assessment)</label>
                <textarea
                  rows={3}
                  value={careForm.assessment}
                  onChange={(event) => setCareForm((current) => ({ ...current, assessment: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="สรุปการประเมินของผู้เชี่ยวชาญ ระดับความเสี่ยง และประเด็นหลัก..."
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">P (Plan)</label>
                <textarea
                  rows={3}
                  value={careForm.plan}
                  onChange={(event) => setCareForm((current) => ({ ...current, plan: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="แผนการช่วยเหลือ นัดครั้งถัดไป หรือ intervention ที่ควรทำ..."
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">Confidential Notes</label>
                <textarea
                  rows={3}
                  value={careForm.confidentialNotes}
                  onChange={(event) => setCareForm((current) => ({ ...current, confidentialNotes: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="บันทึกภายในที่ต้องการจำกัดการเข้าถึงเพิ่มเติม"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-100 bg-slate-50 p-6 sm:flex-row">
              <button
                type="button"
                onClick={closeCareModal}
                className="w-full rounded-xl px-6 py-2.5 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-200 sm:w-auto"
              >
                ยกเลิก
              </button>
              <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-blue-700 sm:w-auto">
                <CheckCircle2 className="h-4 w-4" />
                บันทึกข้อมูล
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {showAppointmentModal ? (
        <ModalShell onClose={closeAppointmentModal}>
          <div className="border-b border-slate-100 bg-[#F4F7FB] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 text-xl font-bold text-slate-800">
                  <CalendarDays className="h-5 w-5 text-blue-600" />
                  สร้างนัดหมายใหม่
                </h3>
                <p className="mt-1 text-sm text-slate-500">เลือกนักศึกษาจากเคสที่คุณรับไว้แล้ว เพื่อจัดตารางติดตาม</p>
              </div>
              <button type="button" onClick={closeAppointmentModal} className="rounded-full bg-white p-2 shadow-sm transition-colors hover:bg-slate-50">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
          </div>

          <form onSubmit={handleCreateAppointment} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-slate-500">นักศึกษา</label>
                <select
                  value={appointmentForm.studentId}
                  onChange={(event) => setAppointmentForm((current) => ({ ...current, studentId: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">-- เลือกนักศึกษาที่รับเคสแล้ว --</option>
                  {activeCases.map((item) => (
                    <option key={item.referralId} value={item.studentId}>
                      {item.name} ({item.maskedStudentId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-slate-500">วันที่</label>
                  <input
                    type="date"
                    value={appointmentForm.date}
                    onChange={(event) => setAppointmentForm((current) => ({ ...current, date: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-slate-500">เวลา</label>
                  <input
                    type="time"
                    value={appointmentForm.time}
                    onChange={(event) => setAppointmentForm((current) => ({ ...current, time: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-slate-500">สถานที่</label>
                <input
                  type="text"
                  value={appointmentForm.location}
                  onChange={(event) => setAppointmentForm((current) => ({ ...current, location: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="เช่น ห้องให้คำปรึกษา 1 หรือออนไลน์"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-slate-500">หมายเหตุ</label>
                <textarea
                  rows={3}
                  value={appointmentForm.note}
                  onChange={(event) => setAppointmentForm((current) => ({ ...current, note: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="เช่น เตรียมประเด็นที่อยากคุย หรือสิ่งที่นักศึกษาควรทราบก่อนเข้าพบ"
                />
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                รายการนัดหมายชุดนี้ใช้สำหรับการจัดคิวภายในหน้าจอนักจิต เพื่อช่วยวาง workflow การติดตามเคสในรอบนี้
              </div>
            </div>

            <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-100 bg-slate-50 p-6 sm:flex-row">
              <button
                type="button"
                onClick={closeAppointmentModal}
                className="w-full rounded-xl px-6 py-2.5 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-200 sm:w-auto"
              >
                ยกเลิก
              </button>
              <button type="submit" className="w-full rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-blue-700 sm:w-auto">
                บันทึกนัดหมาย
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}
    </div>
  );
}

export default function MentalHealthDashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-100">
          <span className="loader h-7 w-7 text-blue-600"></span>
        </main>
      }
    >
      <MentalHealthDashboardContent />
    </Suspense>
  );
}
