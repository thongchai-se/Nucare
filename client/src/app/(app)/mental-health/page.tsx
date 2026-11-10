"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRightLeft,
  CalendarDays,
  ChevronRight,
  LayoutDashboard,
  Menu,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth.context";
import { AppBrand } from "@/components/app-brand";
import { AppointmentsView } from "@/components/mental-health/appointments-view";
import { CasesView } from "@/components/mental-health/cases-view";
import { DashboardView } from "@/components/mental-health/dashboard-view";
import { RoleToast } from "@/components/role-toast";
import { resolveActionToastPresentation } from "@/lib/expandable-toast";
import { StaffSidebarFooter } from "@/components/staff-sidebar-footer";
import { StaffSidebarNavButton } from "@/components/staff-sidebar-nav-item";
import { StaffSidebarSection } from "@/components/staff-sidebar-section";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ConfirmSubmitLabel } from "@/components/ui/confirm-submit-label";
import api from "@/lib/axios";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatMhCareNotePayload } from "@/lib/clinical-note-display";
import { formatQueueWait } from "@/lib/format-queue-wait";
import { getNameInitials } from "@/lib/name-prefix";
import { getRoleHomePath, hasRole } from "@/lib/roles";
import { UNAUTHENTICATED_PATH } from "@/lib/auth-routes";
import {
  STAFF_SIDEBAR_ASIDE,
  STAFF_SIDEBAR_HEADER,
  STAFF_SIDEBAR_MOBILE_HEADER,
  STAFF_SIDEBAR_MOBILE_NAV_SCROLL,
  STAFF_SIDEBAR_NAV_SCROLL,
} from "@/lib/ui-classes";

type CareSession = {
  id: string;
  sessionDate: string;
  summary: string;
  interventionPlan: string;
  providerName: string;
  createdAt: string;
};

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
  recentCareSessions?: CareSession[];
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

type DashboardAlert = {
  id: string;
  type: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  message: string;
  status: "OPEN" | "ACKNOWLEDGED" | "CLOSED";
  createdAt: string;
};

type DashboardEmergencyCase = {
  id: string;
  summary: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  openedAt: string;
  student: {
    id: string;
    name: string;
    studentId: string | null;
    year: string;
  };
};

type ActiveView = "dashboard" | "queue" | "cases" | "appointments";

const isMentalHealthView = (value: string | null): value is ActiveView =>
  value === "dashboard" || value === "queue" || value === "cases" || value === "appointments";

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
  status: "PENDING" | "ACCEPTED" | "CLOSED";
  createdAt: string;
  lastUpdatedAt: string;
  currentOwnerName: string | null;
  currentOwnerAssignedAt: string | null;
  careSessionCount: number;
  latestCareSessionAt: string | null;
  recentCareSessions: CareSession[];
  latestAssessment: DashboardReferral["student"]["latestAssessment"];
};

const sortWorkspaceCases = (items: ActiveCase[]) =>
  [...items].sort((left, right) => {
    const riskRank = { high: 0, medium: 1, normal: 2 };
    const riskDiff = riskRank[left.riskLevel] - riskRank[right.riskLevel];
    if (riskDiff !== 0) {
      return riskDiff;
    }
    return new Date(right.lastUpdatedAt).getTime() - new Date(left.lastUpdatedAt).getTime();
  });

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
  status?: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  providerName?: string;
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

const getInitials = (name: string): string => getNameInitials(name, "MH");

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
      badge: "bg-red-700 text-white",
      chip: "bg-red-700 text-white",
      text: "text-red-800",
      label: "เสี่ยงสูง",
    };
  }

  if (riskLevel === "medium") {
    return {
      badge: "bg-amber-700 text-white",
      chip: "bg-amber-700 text-white",
      text: "text-amber-900",
      label: "เสี่ยงปานกลาง",
    };
  }

  return {
    badge: "bg-emerald-700 text-white",
    chip: "bg-emerald-700 text-white",
    text: "text-emerald-900",
    label: "ปกติ",
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

const ModalShell = ({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) => (
  <div className="fixed inset-0 z-[220] flex items-center justify-center overflow-hidden bg-slate-950/40 p-3 sm:p-4">
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
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [emergencyCases, setEmergencyCases] = useState<DashboardEmergencyCase[]>([]);
  const [appointments, setAppointments] = useState<AppointmentDraft[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dashboardError, setDashboardError] = useState(false);
  const [busyReferralId, setBusyReferralId] = useState<string | null>(null);
  const [busyEmergencyCaseId, setBusyEmergencyCaseId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [showCareModal, setShowCareModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<ActiveCase | null>(null);
  const [careForm, setCareForm] = useState<CareModalState>(emptyCareModalState);
  const [appointmentForm, setAppointmentForm] = useState<AppointmentModalState>(emptyAppointmentModalState);
  const [pendingConfirm, setPendingConfirm] = useState<
    | {
        kind: "referral-close";
        referralId: string;
        title: string;
        description: string;
        confirmLabel: string;
      }
    | {
        kind: "emergency";
        caseId: string;
        status: DashboardEmergencyCase["status"];
        title: string;
        description: string;
        confirmLabel: string;
        tone: "danger" | "primary";
      }
    | null
  >(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace(UNAUTHENTICATED_PATH);
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
        alerts: DashboardAlert[];
        emergencyCases?: DashboardEmergencyCase[];
        appointments?: AppointmentDraft[];
      }>("/api/mental-health/dashboard");

      setReferrals(response.data.referrals);
      setAlerts(response.data.alerts);
      setEmergencyCases(response.data.emergencyCases ?? []);
      setAppointments(response.data.appointments ?? []);
      setDashboardError(false);
      setNotice(null);
    } catch (error) {
      setDashboardError(true);
      setNotice({
        tone: "error",
        message: getApiErrorMessage(error, "ไม่สามารถโหลดข้อมูลของทีมนักจิตได้"),
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

  const pendingReferrals = useMemo(
    () => referrals.filter((item) => item.status === "PENDING"),
    [referrals]
  );

  const mapReferralToCase = useCallback((referral: DashboardReferral): ActiveCase => {
    return {
      referralId: referral.id,
      studentId: referral.student.id,
      name: referral.student.name,
      maskedStudentId: referral.student.studentId || "-",
      year: referral.student.year,
      riskLevel: referral.student.riskLevel,
      advisorName: referral.advisorName,
      reason: referral.reason,
      isUrgent: referral.isUrgent,
      status: referral.status,
      createdAt: referral.createdAt,
      lastUpdatedAt: referral.latestCareSessionAt || referral.updatedAt || referral.createdAt,
      currentOwnerName: referral.currentOwnerName,
      currentOwnerAssignedAt: referral.currentOwnerAssignedAt,
      careSessionCount: referral.careSessionCount,
      latestCareSessionAt: referral.latestCareSessionAt,
      recentCareSessions: referral.recentCareSessions ?? [],
      latestAssessment: referral.student.latestAssessment,
    };
  }, []);

  /** คิวส่งต่อที่ยังไม่รับเข้าดูแล */
  const queueCases = useMemo<ActiveCase[]>(
    () =>
      sortWorkspaceCases(
        referrals.filter((item) => item.status === "PENDING").map(mapReferralToCase)
      ),
    [mapReferralToCase, referrals]
  );

  /** เคสที่รับไว้และกำลังดูแล */
  const activeCases = useMemo<ActiveCase[]>(
    () =>
      sortWorkspaceCases(
        referrals.filter((item) => item.status === "ACCEPTED").map(mapReferralToCase)
      ),
    [mapReferralToCase, referrals]
  );

  const todayIso = new Date().toISOString().slice(0, 10);

  const normalizedAppointments = useMemo(
    () =>
      appointments.map((item) => ({
        ...item,
        status: item.status ?? "SCHEDULED",
      })),
    [appointments]
  );

  const scheduledAppointments = useMemo(
    () => normalizedAppointments.filter((item) => item.status === "SCHEDULED"),
    [normalizedAppointments]
  );

  const todayAppointments = useMemo(
    () =>
      scheduledAppointments
        .filter((item) => item.date === todayIso)
        .sort((left, right) => left.time.localeCompare(right.time)),
    [scheduledAppointments, todayIso]
  );

  const upcomingAppointments = useMemo(
    () =>
      [...scheduledAppointments].sort((left, right) => {
        const leftValue = `${left.date}T${left.time || "00:00"}`;
        const rightValue = `${right.date}T${right.time || "00:00"}`;
        return new Date(leftValue).getTime() - new Date(rightValue).getTime();
      }),
    [scheduledAppointments]
  );

  const casesWithoutAppointments = useMemo(
    () =>
      activeCases.filter(
        (item) => !scheduledAppointments.some((appointment) => appointment.studentId === item.studentId)
      ),
    [activeCases, scheduledAppointments]
  );

  const filterCaseList = useCallback(
    (items: ActiveCase[]) => {
      const normalized = searchQuery.trim().toLowerCase();
      if (!normalized) {
        return items;
      }

      return items.filter((item) =>
        [item.name, item.maskedStudentId, item.advisorName, item.currentOwnerName || "", item.reason, item.year]
          .join(" ")
          .toLowerCase()
          .includes(normalized)
      );
    },
    [searchQuery]
  );

  const filteredQueueCases = useMemo(() => filterCaseList(queueCases), [filterCaseList, queueCases]);
  const filteredActiveCases = useMemo(() => filterCaseList(activeCases), [activeCases, filterCaseList]);

  const filteredAppointments = useMemo(() => {
    const sorted = [...normalizedAppointments].sort((left, right) => {
      const leftValue = `${left.date}T${left.time || "00:00"}`;
      const rightValue = `${right.date}T${right.time || "00:00"}`;
      return new Date(rightValue).getTime() - new Date(leftValue).getTime();
    });
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) {
      return sorted;
    }

    return sorted.filter((item) =>
      [item.studentName, item.location, item.note, item.date, item.time, item.status, item.providerName || ""]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [normalizedAppointments, searchQuery]);

  const requestedView = searchParams.get("view");
  // ลิงก์เก่า ?view=referrals → คิวรอรับ
  const activeView: ActiveView =
    requestedView === "referrals"
      ? "queue"
      : isMentalHealthView(requestedView)
        ? requestedView
        : "dashboard";

  const currentViewLabel =
    activeView === "dashboard"
      ? "หน้าหลัก"
      : activeView === "queue"
        ? "คิวรอรับ"
        : activeView === "cases"
          ? "เคสที่ดูแล"
          : "นัดหมาย";
  const resolvedViewLabel = currentViewLabel;
  const userInitials = useMemo(() => getInitials(user?.name || ""), [user?.name]);

  const navigateTo = (view: ActiveView, referralId?: string) => {
    setIsMobileMenuOpen(false);
    setSearchQuery("");
    const params = new URLSearchParams();
    if (view !== "dashboard") {
      params.set("view", view);
    }
    if (referralId) {
      params.set("referral", referralId);
    }
    const query = params.toString();
    router.replace(query ? `/mental-health?${query}` : "/mental-health");
    window.requestAnimationFrame(() => {
      mainContentRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
  };

  const focusReferralId = searchParams.get("referral");

  const getCaseStatusLabel = useCallback(
    (item: ActiveCase): string => {
      if (item.status === "PENDING") {
        return "รอรับ";
      }

      if (item.riskLevel === "high" || item.isUrgent) {
        return "ติดตามใกล้ชิด";
      }

      if (scheduledAppointments.some((appointment) => appointment.studentId === item.studentId)) {
        return "มีนัดหมายแล้ว";
      }

      return "กำลังดูแล";
    },
    [scheduledAppointments]
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
    if (item.status !== "ACCEPTED") {
      setNotice({
        tone: "info",
        message: "รับเคสก่อน จึงจะบันทึกผลการปรึกษาได้",
      });
      return;
    }
    setSelectedCase(item);
    setCareForm({
      ...emptyCareModalState(),
      sessionDate: new Date().toISOString().slice(0, 10),
    });
    setShowCareModal(true);
  };

  const openAppointmentModal = (item?: ActiveCase) => {
    if (item && item.status !== "ACCEPTED") {
      setNotice({
        tone: "info",
        message: "รับเคสก่อน จึงจะสร้างนัดหมายได้",
      });
      return;
    }
    // ไม่เลือกให้อัตโนมัติ — ต้องเลือกนิสิตเองถ้าไม่ได้กดจากเคส
    setSelectedCase(item ?? null);
    setAppointmentForm({
      ...emptyAppointmentModalState(),
      studentId: item?.studentId || "",
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
    router.replace(UNAUTHENTICATED_PATH);
  };

  const executeReferralStatusUpdate = async (
    referralId: string,
    status: DashboardReferral["status"]
  ) => {
    if (busyReferralId) {
      return;
    }

    setBusyReferralId(referralId);
    try {
      await api.patch(`/api/mental-health/referrals/${referralId}/status`, { status });
      await loadDashboard();
      setNotice({
        tone: "success",
        message:
          status === "ACCEPTED"
            ? "รับเคสเรียบร้อยแล้ว — ไปต่อที่เมนูเคสที่ดูแลเพื่อนัดคุยหรือบันทึกผล"
            : status === "CLOSED"
              ? "ปิด/ปฏิเสธคิวเรียบร้อยแล้ว ที่ปรึกษาจะได้รับการแจ้ง"
              : "บันทึกสถานะเคสแล้ว",
      });
      if (status === "ACCEPTED") {
        navigateTo("cases");
      }
    } catch (error) {
      await loadDashboard();
      setNotice({
        tone: "error",
        message: getApiErrorMessage(error, "ไม่สามารถบันทึกสถานะเคสได้"),
      });
    } finally {
      setBusyReferralId(null);
      setPendingConfirm(null);
    }
  };

  const handleUpdateReferral = async (referralId: string, status: DashboardReferral["status"]) => {
    if (busyReferralId) {
      return;
    }

    if (status === "CLOSED") {
      const current = referrals.find((item) => item.id === referralId);
      const isQueueReject = current?.status === "PENDING";
      setPendingConfirm({
        kind: "referral-close",
        referralId,
        title: isQueueReject ? "ปฏิเสธคิว" : "ปิดเคส",
        description: isQueueReject
          ? "ปฏิเสธคิวนี้หรือไม่? ที่ปรึกษาจะได้รับการแจ้ง และรายการจะออกจากคิว"
          : "ปิดเคสนี้หรือไม่? จะออกจากรายการกำลังดูแล และไม่สามารถย้อนกลับได้",
        confirmLabel: isQueueReject ? "ปฏิเสธคิว" : "ปิดเคส",
      });
      return;
    }

    await executeReferralStatusUpdate(referralId, status);
  };

  const executeEmergencyCaseUpdate = async (
    caseId: string,
    status: DashboardEmergencyCase["status"]
  ) => {
    if (busyEmergencyCaseId) {
      return;
    }

    setBusyEmergencyCaseId(caseId);
    try {
      await api.patch(`/api/mental-health/emergency-cases/${caseId}/status`, { status });
      setNotice({
        tone: "success",
        message:
          status === "IN_PROGRESS"
            ? "รับดำเนินการเคสช่วยเหลือด่วนแล้ว"
            : status === "RESOLVED"
              ? "ปิดเคสช่วยเหลือด่วนแล้ว"
              : "บันทึกสถานะเคสช่วยเหลือด่วนแล้ว",
      });
      await loadDashboard();
    } catch (error) {
      setNotice({
        tone: "error",
        message: getApiErrorMessage(error, "ไม่สามารถบันทึกเคสช่วยเหลือด่วนได้"),
      });
    } finally {
      setBusyEmergencyCaseId(null);
      setPendingConfirm(null);
    }
  };

  const handleUpdateEmergencyCase = async (
    caseId: string,
    status: DashboardEmergencyCase["status"]
  ) => {
    if (busyEmergencyCaseId) {
      return;
    }

    setPendingConfirm({
      kind: "emergency",
      caseId,
      status,
      title:
        status === "IN_PROGRESS"
          ? "รับดำเนินการ"
          : status === "RESOLVED"
            ? "ปิดเคสช่วยเหลือด่วน"
            : "ยืนยันการดำเนินการ",
      description:
        status === "IN_PROGRESS"
          ? "รับดำเนินการเคสช่วยเหลือด่วนนี้หรือไม่?"
          : status === "RESOLVED"
            ? "ปิดเคสช่วยเหลือด่วนนี้หรือไม่?"
            : "ดำเนินการกับเคสนี้หรือไม่?",
      confirmLabel:
        status === "IN_PROGRESS" ? "รับดำเนินการ" : status === "RESOLVED" ? "ปิดเคส" : "ยืนยัน",
      tone: status === "RESOLVED" ? "danger" : "primary",
    });
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await api.patch(`/api/alerts/${alertId}/acknowledge`);
      await loadDashboard();
      setNotice({
        tone: "success",
        message: "รับทราบการแจ้งเตือนแล้ว",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: getApiErrorMessage(error, "ไม่สามารถรับทราบการแจ้งเตือนได้"),
      });
    }
  };

  const handleUpdateAppointmentStatus = async (
    appointmentId: string,
    status: "COMPLETED" | "CANCELLED" | "NO_SHOW"
  ) => {
    try {
      const targetAppointment = appointments.find((item) => item.id === appointmentId);
      const careTarget =
        status === "COMPLETED" && targetAppointment
          ? activeCases.find((item) => item.studentId === targetAppointment.studentId) ?? null
          : null;
      await api.patch(`/api/mental-health/appointments/${appointmentId}/status`, { status });
      await loadDashboard();
      setNotice({
        tone: "success",
        message:
          status === "COMPLETED"
            ? "บันทึกว่าพบตามนัดแล้ว — เปิดฟอร์มบันทึกผลได้เลย"
            : status === "NO_SHOW"
              ? "บันทึกว่าไม่มาตามนัดแล้ว"
              : "ยกเลิกนัดหมายแล้ว",
      });
      if (careTarget) {
        openCareModal(careTarget);
      }
    } catch (error) {
      setNotice({
        tone: "error",
        message: getApiErrorMessage(error, "ไม่สามารถบันทึกสถานะนัดหมายได้"),
      });
    }
  };

  const handleSubmitCareRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCase) {
      return;
    }

    try {
      const note = formatMhCareNotePayload({
        subjective: careForm.subjective,
        objective: careForm.objective,
        assessment: careForm.assessment,
        plan: careForm.plan,
      });
      await api.post("/api/mental-health/care-records", {
        studentId: selectedCase.studentId,
        referralId: selectedCase.referralId,
        sessionDate: careForm.sessionDate,
        summary: note.summary,
        interventionPlan: note.interventionPlan,
        confidentialNotes: careForm.confidentialNotes.trim() || undefined,
      });

      closeCareModal();
      await loadDashboard();
      setNotice({
        tone: "success",
        message: "บันทึกผลการปรึกษาเรียบร้อยแล้ว",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: getApiErrorMessage(error, "ไม่สามารถบันทึกข้อมูลการดูแลได้"),
      });
    }
  };

  const handleCreateAppointment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const targetCase = activeCases.find((item) => item.studentId === appointmentForm.studentId);
    if (!targetCase) {
      setNotice({
        tone: "error",
        message: "กรุณาเลือกนักศึกษาก่อนสร้างนัดหมาย",
      });
      return;
    }

    try {
      await api.post("/api/mental-health/appointments", {
        studentId: targetCase.studentId,
        referralId: targetCase.referralId,
        date: appointmentForm.date,
        time: appointmentForm.time,
        location: appointmentForm.location.trim(),
        note: appointmentForm.note.trim() || undefined,
      });

      closeAppointmentModal();
      await loadDashboard();
      setNotice({
        tone: "success",
        message: "บันทึกนัดหมายเรียบร้อยแล้ว นิสิตจะเห็นในหน้าการนัดหมาย",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: getApiErrorMessage(error, "ไม่สามารถสร้างนัดหมายได้"),
      });
    }
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

  const NavSections = () => (
    <>
      <StaffSidebarSection title="เมนูหลัก">
        <StaffSidebarNavButton active={activeView === "dashboard"} icon={<LayoutDashboard size={20} />} label="หน้าหลัก" onClick={() => navigateTo("dashboard")} />
        <StaffSidebarNavButton
          active={activeView === "queue"}
          badge={pendingReferrals.length || undefined}
          icon={<ArrowRightLeft size={20} />}
          label="คิวรอรับ"
          onClick={() => navigateTo("queue")}
        />
        <StaffSidebarNavButton
          active={activeView === "cases"}
          icon={<Users size={20} />}
          label="เคสที่ดูแล"
          onClick={() => navigateTo("cases")}
        />
        <StaffSidebarNavButton
          active={activeView === "appointments"}
          icon={<CalendarDays size={20} />}
          label="นัดหมาย"
          onClick={() => navigateTo("appointments")}
        />
      </StaffSidebarSection>
    </>
  );

  const noticeToast = notice
    ? resolveActionToastPresentation({
        message: notice.message,
        tone: notice.tone,
        errorTitle: "ไม่สามารถดำเนินการได้",
      })
    : null;

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-slate-800">
      <RoleToast
        description={noticeToast?.description}
        open={Boolean(notice)}
        onClose={() => setNotice(null)}
        title={noticeToast?.title || ""}
        tone={notice?.tone || "success"}
      />

      <ConfirmDialog
        open={Boolean(pendingConfirm)}
        loading={
          pendingConfirm?.kind === "referral-close"
            ? busyReferralId === pendingConfirm.referralId
            : pendingConfirm?.kind === "emergency"
              ? busyEmergencyCaseId === pendingConfirm.caseId
              : false
        }
        tone={pendingConfirm?.kind === "emergency" ? pendingConfirm.tone : "danger"}
        title={pendingConfirm?.title || ""}
        description={pendingConfirm?.description || ""}
        confirmLabel={pendingConfirm?.confirmLabel || "ยืนยัน"}
        cancelLabel="ยกเลิก"
        onCancel={() => {
          if (!busyReferralId && !busyEmergencyCaseId) {
            setPendingConfirm(null);
          }
        }}
        onConfirm={() => {
          if (!pendingConfirm) {
            return;
          }
          if (pendingConfirm.kind === "referral-close") {
            void executeReferralStatusUpdate(pendingConfirm.referralId, "CLOSED");
            return;
          }
          void executeEmergencyCaseUpdate(pendingConfirm.caseId, pendingConfirm.status);
        }}
      />

      <div className="flex min-h-screen">
        <aside className={STAFF_SIDEBAR_ASIDE}>
          <div className={STAFF_SIDEBAR_HEADER}>
            <Link href="/">
              <AppBrand subtitle="คณะพยาบาลศาสตร์" size="compact" />
            </Link>
          </div>

          <div className={STAFF_SIDEBAR_NAV_SCROLL}>
            <NavSections />
          </div>

          <StaffSidebarFooter onLogout={handleLogout} />
        </aside>

        {isMobileMenuOpen ? (
          <div className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="flex h-full w-72 flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className={STAFF_SIDEBAR_MOBILE_HEADER}>
                <AppBrand subtitle="คณะพยาบาลศาสตร์" size="compact" />
                <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                  <X size={20} />
                </button>
              </div>

              <div className={STAFF_SIDEBAR_MOBILE_NAV_SCROLL}>
                <NavSections />
              </div>

              <StaffSidebarFooter
                onLogout={handleLogout}
                onRoleSelect={() => setIsMobileMenuOpen(false)}
              />
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((current) => !current)}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="hidden items-center gap-2 text-sm font-medium text-slate-500 lg:flex">
                <span>พอร์ทัลผู้เชี่ยวชาญ</span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
                <span className="font-bold text-slate-800">{resolvedViewLabel}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 sm:gap-6">
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
              {dashboardError && !loadingData ? (
                <div className="mb-6 flex flex-col items-center justify-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-6 py-10 text-center">
                  <p className="text-sm font-medium text-rose-800">โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่</p>
                  <button
                    type="button"
                    onClick={() => void loadDashboard()}
                    className="inline-flex items-center gap-2 rounded-full bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800"
                  >
                    ลองโหลดอีกครั้ง
                  </button>
                </div>
              ) : null}

              {activeView === "dashboard" ? (
                <DashboardView
                  activeCases={activeCases}
                  alerts={alerts}
                  busyEmergencyCaseId={busyEmergencyCaseId}
                  emergencyCases={emergencyCases}
                  formatLatestAssessment={formatLatestAssessment}
                  formatThaiDateTime={formatThaiDateTime}
                  getCaseStatusLabel={getCaseStatusLabel}
                  getNextAppointmentLabel={getNextAppointmentLabel}
                  getRiskClasses={getRiskClasses}
                  handleAcknowledgeAlert={handleAcknowledgeAlert}
                  loadDashboard={loadDashboard}
                  navigateTo={navigateTo}
                  onUpdateEmergencyCase={handleUpdateEmergencyCase}
                  openAppointmentModal={openAppointmentModal}
                  openCareModal={openCareModal}
                  pendingReferrals={pendingReferrals}
                  todayAppointments={todayAppointments}
                />
              ) : null}

              {activeView === "queue" ? (
                <CasesView
                  busyReferralId={busyReferralId}
                  filteredActiveCases={filteredQueueCases}
                  formatQueueWait={formatQueueWait}
                  formatThaiDate={formatThaiDate}
                  formatThaiDateTime={formatThaiDateTime}
                  getCaseStatusLabel={getCaseStatusLabel}
                  getNextAppointmentLabel={getNextAppointmentLabel}
                  getRiskClasses={getRiskClasses}
                  initialReferralId={focusReferralId}
                  mode="queue"
                  onAcceptCase={(referralId) => void handleUpdateReferral(referralId, "ACCEPTED")}
                  onCloseCase={(referralId) => void handleUpdateReferral(referralId, "CLOSED")}
                  openAppointmentModal={openAppointmentModal}
                  openCareModal={openCareModal}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                />
              ) : null}

              {activeView === "cases" ? (
                <CasesView
                  busyReferralId={busyReferralId}
                  filteredActiveCases={filteredActiveCases}
                  formatQueueWait={formatQueueWait}
                  formatThaiDate={formatThaiDate}
                  formatThaiDateTime={formatThaiDateTime}
                  getCaseStatusLabel={getCaseStatusLabel}
                  getNextAppointmentLabel={getNextAppointmentLabel}
                  getRiskClasses={getRiskClasses}
                  initialReferralId={focusReferralId}
                  mode="cases"
                  onAcceptCase={(referralId) => void handleUpdateReferral(referralId, "ACCEPTED")}
                  onCloseCase={(referralId) => void handleUpdateReferral(referralId, "CLOSED")}
                  openAppointmentModal={openAppointmentModal}
                  openCareModal={openCareModal}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                />
              ) : null}

              {activeView === "appointments" ? (
                <AppointmentsView
                  casesWithoutAppointments={casesWithoutAppointments}
                  filteredAppointments={filteredAppointments}
                  formatThaiDate={formatThaiDate}
                  formatTime={formatTime}
                  getRiskClasses={getRiskClasses}
                  onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
                  openAppointmentModal={openAppointmentModal}
                />
              ) : null}

              {loadingData ? (
                <div className="pointer-events-none fixed bottom-4 right-4 z-40 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-lg">
                  <div className="flex items-center gap-2">
                    <span className="loader h-4 w-4 text-blue-600"></span>
                    กำลังโหลดข้อมูล...
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
                <h3 className="text-xl font-bold text-slate-800">บันทึกหลังพบ</h3>
                <p className="mt-1 text-sm text-slate-500">
                  นิสิต: <span className="font-bold text-blue-700">{selectedCase.name}</span> ({selectedCase.maskedStudentId})
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
                <label className="text-sm font-bold text-slate-700">วันที่พบ</label>
                <input
                  type="date"
                  value={careForm.sessionDate}
                  onChange={(event) => setCareForm((current) => ({ ...current, sessionDate: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">นิสิตเล่าอะไร</label>
                <textarea
                  rows={3}
                  value={careForm.subjective}
                  onChange={(event) => setCareForm((current) => ({ ...current, subjective: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ความรู้สึก อาการ หรือสิ่งที่กังวล..."
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">สิ่งที่สังเกต</label>
                <textarea
                  rows={3}
                  value={careForm.objective}
                  onChange={(event) => setCareForm((current) => ({ ...current, objective: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="สีหน้า ท่าทาง การพูดคุย..."
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">สรุปของคุณ</label>
                <textarea
                  rows={3}
                  value={careForm.assessment}
                  onChange={(event) => setCareForm((current) => ({ ...current, assessment: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ประเด็นหลักและความเสี่ยง..."
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">แผนต่อไป</label>
                <textarea
                  rows={3}
                  value={careForm.plan}
                  onChange={(event) => setCareForm((current) => ({ ...current, plan: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="นัดครั้งถัดไป หรือสิ่งที่แนะนำ..."
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">บันทึกภายใน (ไม่บังคับ)</label>
                <textarea
                  rows={2}
                  value={careForm.confidentialNotes}
                  onChange={(event) => setCareForm((current) => ({ ...current, confidentialNotes: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ข้อความที่เห็นได้เฉพาะทีมสุขภาพจิต"
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
                <ConfirmSubmitLabel>บันทึก</ConfirmSubmitLabel>
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

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                นัดหมายจะถูกบันทึกในระบบ และนิสิตจะเห็นรายการในหน้าการนัดหมายของตนเอง
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
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-blue-700 sm:w-auto"
              >
                <ConfirmSubmitLabel>บันทึกนัดหมาย</ConfirmSubmitLabel>
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
