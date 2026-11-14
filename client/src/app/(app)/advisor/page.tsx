"use client";

import { FormEvent, ReactNode, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ChevronRight,
  ClipboardList,
  Flag,
  LayoutDashboard,
  Menu,
  Send,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth.context";
import { AppBrand } from "@/components/app-brand";
import { useDashboardToast } from "@/context/dashboard-toast.context";
import { StaffSidebarFooter } from "@/components/staff-sidebar-footer";
import { StaffSidebarNavButton } from "@/components/staff-sidebar-nav-item";
import { StaffSidebarSection } from "@/components/staff-sidebar-section";
import api from "@/lib/axios";
import { getApiErrorMessage } from "@/lib/api-error";
import { getNameInitials } from "@/lib/name-prefix";
import { getRoleHomePath, hasRole, roleLabelMap } from "@/lib/roles";
import { UNAUTHENTICATED_PATH } from "@/lib/auth-routes";
import { AcademicSignalsView } from "@/components/advisor/academic-signals-view";
import { AdviseeDetailView } from "@/components/advisor/advisee-detail-view";
import { AdviseesView } from "@/components/advisor/advisees-view";
import { ConsultationRequestsView } from "@/components/advisor/consultation-requests-view";
import { DashboardView } from "@/components/advisor/dashboard-view";
import {
  ObservationReportView,
  type ObservationRecord,
  type ObservationSeverity,
  type ObservationStatus,
  type ObservationStudentOption,
} from "@/components/advisor/observation-report-view";
import { StudentSearchPicker } from "@/components/advisor/student-search-picker";
import { ReferralHistoryView } from "@/components/advisor/referral-history-view";
import { pickReferralForStudent } from "@/components/advisor/referral-active";
import {
  countNegotiateLanes,
  isUpcomingAppointment,
  sortScheduledByAppointment,
} from "@/components/advisor/consultation-negotiate";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ConfirmSubmitLabel } from "@/components/ui/confirm-submit-label";
import { InlineAlert } from "@/components/ui/inline-alert";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import { StaffModalOverlay } from "@/components/ui/staff-modal-overlay";
import { formatSoapNotePayload } from "@/lib/clinical-note-display";
import {
  ADVISOR_CANCEL_REASONS,
  ADVISOR_CANCEL_REASON_OTHER,
} from "@/lib/consultation-close";
import {
  buildClientAdvisorBusySlots,
  findClientConsultationScheduleConflict,
} from "@/lib/consultation-schedule-conflict";
import {
  consultationStatusToastMessage,
  consultationStatusToastTone,
  resolveActionToastPresentation,
} from "@/lib/expandable-toast";
import { formatStudentIdDisplay } from "@/lib/student-id";
import { scheduleLocationPlaceholder } from "@/lib/student-dashboard";
import {
  STAFF_SIDEBAR_ASIDE,
  STAFF_SIDEBAR_HEADER,
  STAFF_SIDEBAR_MOBILE_HEADER,
  STAFF_SIDEBAR_MOBILE_NAV_SCROLL,
  STAFF_SIDEBAR_NAV_SCROLL,
  UI_BUTTON_GHOST,
  UI_BUTTON_PRIMARY,
  UI_CALLOUT_INFO,
  UI_CHIP_ACTIVE,
  UI_CHIP_INACTIVE,
  UI_CHOICE_CHIP,
  UI_CHOICE_CHIP_DANGER,
  UI_CHOICE_CHIP_PRIMARY,
  UI_CHOICE_CHIP_SELECTED,
  UI_CHOICE_CHIP_SUCCESS,
  UI_CHOICE_CHIP_UNSELECTED,
  UI_STATUS_ACTIVE,
  UI_STATUS_DANGER,
  UI_STATUS_DONE,
  UI_STATUS_PENDING,
  UI_STATUS_SCHEDULED,
} from "@/lib/ui-classes";

type StudentRiskLevel = "high" | "medium" | "normal";
type ActiveView =
  | "dashboard"
  | "advisees"
  | "consultations"
  | "referrals"
  | "academic"
  | "observations";
type ReferralTarget = "STUDENT_DEVELOPMENT" | "COUNSELING_CENTER";
type ReferralStatus = "PENDING" | "ACCEPTED" | "CLOSED";
type ConsultationRequestStatus =
  | "PENDING"
  | "ACCEPTED"
  | "SCHEDULED"
  | "CANCEL_REQUESTED"
  | "CLOSED"
  | "CANCELLED";
type ReferralUrgency = "normal" | "moderate" | "urgent";
type AssessmentInstrument = string | null;

const observationQuickCategories = [
  { id: "attendance", label: "ขาดเรียน/ฝึกงานบ่อย" },
  { id: "mood", label: "ซึมเศร้า/ร้องไห้บ่อย" },
  { id: "academic", label: "ผลการเรียนตกลงมาก" },
  { id: "social", label: "มีปัญหาความสัมพันธ์" },
] as const;

const observationStatusBadgeMap: Record<ObservationStatus, string> = {
  PENDING: UI_STATUS_PENDING,
  ACKNOWLEDGED: UI_STATUS_ACTIVE,
  COMPLETED: UI_STATUS_DONE,
};

const observationStatusLabelMap: Record<ObservationStatus, string> = {
  PENDING: "รอที่ปรึกษารับทราบ",
  ACKNOWLEDGED: "ที่ปรึกษารับเรื่องแล้ว",
  COMPLETED: "ที่ปรึกษาปิดเรื่องแล้ว",
};

const isAdvisorView = (value: string | null): value is ActiveView =>
  value === "dashboard" ||
  value === "advisees" ||
  value === "consultations" ||
  value === "referrals" ||
  value === "academic" ||
  value === "observations";

type WellnessSignalItem = {
  code: string;
  labelTh: string;
  shortLabelTh: string;
  occurrenceCount: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
};

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
  wellnessSignals?: WellnessSignalItem[];
  hasCrisisWellnessSignal?: boolean;
};

type AdvisorHistoryItem = {
  id: string;
  kind: "CARE" | "REFERRAL" | "BEHAVIOR" | "CONSULTATION";
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
  currentOwnerName: string | null;
  currentOwnerAssignedAt: string | null;
  careSessionCount: number;
  latestCareSessionAt: string | null;
  roadmap?: Array<{
    key: string;
    label: string;
    at: string;
    actorName?: string;
    detail?: string;
    kind?: "sent" | "accepted" | "care" | "closed";
  }>;
};

type ConsultationScheduleOfferItem = {
  id: string;
  proposedAt: string;
  location: string;
  note: string | null;
  status: "PENDING" | "ACCEPTED" | "SUPERSEDED" | "CANCELLED";
  createdAt: string;
  proposedById: string;
  proposedByName: string;
  proposedByRole: "ADVISOR" | "STUDENT";
  waitingOn: "ADVISOR" | "STUDENT" | null;
};

type ConsultationTab = "pending" | "accepted" | "scheduled" | "closed";

type AdvisorConsultationRequestItem = {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string | null;
  year: string;
  topic: string;
  preferredChannel: string;
  preferredChannelLabel: string;
  note: string | null;
  status: ConsultationRequestStatus;
  advisorNote: string | null;
  scheduledAt: string | null;
  scheduleLocation: string | null;
  acceptedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  alertId: string | null;
  latestPendingOffer?: ConsultationScheduleOfferItem | null;
  scheduleOffers?: ConsultationScheduleOfferItem[];
};

type AdvisorAlertItem = {
  id: string;
  type: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  message: string;
  status: "OPEN" | "ACKNOWLEDGED" | "CLOSED";
  sourceType: string | null;
  sourceId: string | null;
  studentId: string | null;
  createdAt: string;
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

type AdvisorConsultationRequestsResponse = {
  requests: AdvisorConsultationRequestItem[];
};

type AdvisorAlertsResponse = {
  alerts: AdvisorAlertItem[];
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
    badgeClassName: UI_STATUS_DANGER,
    dotClassName: "bg-red-500",
  },
  medium: {
    label: "ต้องติดตาม",
    badgeClassName: UI_STATUS_PENDING,
    dotClassName: "bg-amber-500",
  },
  normal: {
    label: "ต่ำ",
    badgeClassName: UI_STATUS_DONE,
    dotClassName: "bg-emerald-500",
  },
};

const assessmentLabelMap: Record<string, string> = {
  Q2: "2Q",
  ST5: "ST-5",
  Q9: "9Q",
  Q8: "8Q",
  "GHQ-28": "GHQ-28",
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
    className: UI_STATUS_PENDING,
  },
  ACCEPTED: {
    label: "กำลังดูแล",
    className: UI_STATUS_ACTIVE,
  },
  CLOSED: {
    label: "ปิดเคสแล้ว",
    className: UI_STATUS_DONE,
  },
};

const consultationStatusMap: Record<
  ConsultationRequestStatus,
  {
    label: string;
    className: string;
  }
> = {
  PENDING: {
    label: "รอรับคำขอ",
    className: UI_STATUS_PENDING,
  },
  ACCEPTED: {
    label: "รับคำขอแล้ว",
    className: UI_STATUS_ACTIVE,
  },
  SCHEDULED: {
    label: "นัดหมายแล้ว",
    className: UI_STATUS_SCHEDULED,
  },
  CANCEL_REQUESTED: {
    label: "นศขอยกเลิก",
    className: "bg-amber-100 text-amber-800",
  },
  CLOSED: {
    label: "ปิดเคสแล้ว",
    className: UI_STATUS_DONE,
  },
  CANCELLED: {
    label: "ยกเลิก",
    className: "bg-amber-100 text-amber-800",
  },
};

const referralTargetMap: Record<ReferralTarget, string> = {
  STUDENT_DEVELOPMENT: "ฝ่ายพัฒนานักศึกษา",
  COUNSELING_CENTER: "ทีมสุขภาพจิต",
};

const urgencyOptions: Array<{
  value: ReferralUrgency;
  label: string;
  toneClassName: string;
}> = [
  { value: "normal", label: "ต่ำ", toneClassName: UI_CHOICE_CHIP_SUCCESS },
  { value: "moderate", label: "ปานกลาง", toneClassName: UI_CHOICE_CHIP_PRIMARY },
  { value: "urgent", label: "วิกฤต (SOS)", toneClassName: UI_CHOICE_CHIP_DANGER },
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

const getErrorMessage = (error: unknown): string =>
  getApiErrorMessage(error, "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");

const getInitials = (name: string, fallback = "อจ"): string => getNameInitials(name, fallback);

const formatAssessmentSummary = (student: AdvisorStudent): string => {
  if (!student.latestInstrument) {
    return "ยังไม่มีผลประเมินล่าสุด";
  }

  const scoreText = student.latestScore !== null ? `คะแนน ${student.latestScore}` : "รอคะแนน";
  const instrumentLabel = assessmentLabelMap[student.latestInstrument] ?? student.latestInstrument;
  return `${instrumentLabel} • ${scoreText}`;
};


function AdvisorDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { pushToast } = useDashboardToast();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [showSoapModal, setShowSoapModal] = useState(false);
  const [referralUrgency, setReferralUrgency] = useState<ReferralUrgency>("moderate");

  const [students, setStudents] = useState<AdvisorStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<AdvisorHistoryItem[]>([]);
  const [referrals, setReferrals] = useState<AdvisorReferralItem[]>([]);
  const [consultationRequests, setConsultationRequests] = useState<AdvisorConsultationRequestItem[]>([]);
  const [advisorAlerts, setAdvisorAlerts] = useState<AdvisorAlertItem[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [serverError, setServerError] = useState("");
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [loadingConsultationRequests, setLoadingConsultationRequests] = useState(false);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [updatingAlertId, setUpdatingAlertId] = useState<string | null>(null);
  const [observationRecords, setObservationRecords] = useState<ObservationRecord[]>([]);
  const [loadingObservationRecords, setLoadingObservationRecords] = useState(false);
  const [observationSearch, setObservationSearch] = useState("");
  const [observationStudentOptions, setObservationStudentOptions] = useState<ObservationStudentOption[]>([]);
  const [observationStudentQuery, setObservationStudentQuery] = useState("");
  const [showObservationModal, setShowObservationModal] = useState(false);
  const [observationStudentId, setObservationStudentId] = useState("");
  const [observationSelectedStudent, setObservationSelectedStudent] = useState<ObservationStudentOption | null>(null);
  const [observationCategory, setObservationCategory] = useState("");
  const [observationDetails, setObservationDetails] = useState("");
  const [observationSeverity, setObservationSeverity] = useState<ObservationSeverity>("MEDIUM");
  const [observationObservedAt, setObservationObservedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [submittingObservation, setSubmittingObservation] = useState(false);
  const [observationError, setObservationError] = useState("");
  const [loadingObservationStudents, setLoadingObservationStudents] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelDetail, setCancelDetail] = useState("");
  const [consultationAction, setConsultationAction] = useState<null | {
    requestId: string;
    status: "PROPOSE" | "CLOSED" | "CANCELLED";
    /** ยืนยันคำขอยกเลิกของนิสิต หรืออาจารย์ยกเลิกเอง */
    cancelMode?: "confirm" | "direct";
    studentName?: string;
    preferredChannel?: string;
    preferredChannelLabel?: string;
    /** สถานะคำขอก่อนปิด/ยืนยันยกเลิก */
    currentStatus?: ConsultationRequestStatus;
  }>(null);
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");
  const [scheduleLocationLocal, setScheduleLocationLocal] = useState("");
  const [scheduleNoteLocal, setScheduleNoteLocal] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [isUpdatingConsultation, setIsUpdatingConsultation] = useState(false);
  const [pendingCloseConsultationId, setPendingCloseConsultationId] = useState<string | null>(null);
  const [pendingAlertCloseId, setPendingAlertCloseId] = useState<string | null>(null);
  const [closingAlert, setClosingAlert] = useState(false);

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
    const studentIds = new Set(referrals.map((referral) => referral.studentId));

    for (const studentId of studentIds) {
      const picked = pickReferralForStudent(referrals, studentId);
      if (picked) {
        map.set(studentId, picked);
      }
    }

    return map;
  }, [referrals]);

  const studentsWithActiveReferral = useMemo(() => {
    const ids = new Set<string>();
    for (const [studentId, referral] of latestReferralByStudent) {
      if (referral.status === "PENDING" || referral.status === "ACCEPTED") {
        ids.add(studentId);
      }
    }
    return ids;
  }, [latestReferralByStudent]);

  const highRiskStudents = useMemo(
    () => students.filter((student) => student.riskLevel === "high"),
    [students]
  );

  const pendingReferralsCount = useMemo(
    () => referrals.filter((referral) => referral.status === "PENDING").length,
    [referrals]
  );

  const pendingConsultationCount = useMemo(
    () => consultationRequests.filter((request) => request.status === "PENDING").length,
    [consultationRequests]
  );

  const acceptedConsultationCount = useMemo(
    () => consultationRequests.filter((request) => request.status === "ACCEPTED").length,
    [consultationRequests]
  );

  const cancellingConsultationCount = useMemo(
    () => consultationRequests.filter((request) => request.status === "CANCEL_REQUESTED").length,
    [consultationRequests]
  );

  const cancelRequestedInAcceptedCount = useMemo(
    () =>
      consultationRequests.filter(
        (request) => request.status === "CANCEL_REQUESTED" && Boolean(request.acceptedAt)
      ).length,
    [consultationRequests]
  );

  const negotiateLaneCounts = useMemo(
    () => countNegotiateLanes(consultationRequests),
    [consultationRequests]
  );

  const waitingAdvisorOfferCount = negotiateLaneCounts.waitingAdvisor;
  const otherNegotiationCount = negotiateLaneCounts.waitingStudent + negotiateLaneCounts.noOffer;

  const actionableConsultationCount =
    pendingConsultationCount + acceptedConsultationCount + cancellingConsultationCount;

  const scheduledConsultationCount = useMemo(
    () => consultationRequests.filter((request) => request.status === "SCHEDULED").length,
    [consultationRequests]
  );

  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    return sortScheduledByAppointment(
      consultationRequests.filter((request) => isUpcomingAppointment(request, now))
    )
      .slice(0, 5)
      .map((request) => ({
        id: request.id,
        studentName: request.studentName,
        topic: request.topic,
        location: request.scheduleLocation?.trim() || request.preferredChannelLabel || "-",
        scheduledAt: request.scheduledAt ?? "",
        scheduledAtLabel: formatThaiDateTime(request.scheduledAt),
      }));
  }, [consultationRequests]);

  const upcomingAppointmentCount = useMemo(() => {
    const now = new Date();
    return consultationRequests.filter((request) => isUpcomingAppointment(request, now)).length;
  }, [consultationRequests]);

  const proposeBusySlots = useMemo(() => {
    if (!consultationAction || consultationAction.status !== "PROPOSE") {
      return [];
    }
    return buildClientAdvisorBusySlots({
      excludeRequestId: consultationAction.requestId,
      requests: consultationRequests,
      formatLabel: formatThaiDateTime,
    });
  }, [consultationAction, consultationRequests]);

  const behaviorAlerts = useMemo(
    () =>
      advisorAlerts.filter(
        (alert) => alert.type === "BEHAVIOR_REPORTED" || alert.sourceType === "BehaviorRecord"
      ),
    [advisorAlerts]
  );

  const pendingInstructorSignalsCount = useMemo(
    () => behaviorAlerts.filter((alert) => alert.status === "OPEN").length,
    [behaviorAlerts]
  );
  const hasAdvisees = students.length > 0;
  const requestedView = searchParams.get("view");
  const studentQueryId = searchParams.get("student")?.trim() || null;
  const requestedConsultationTab = searchParams.get("tab");
  const consultationTab: ConsultationTab =
    requestedConsultationTab === "accepted" ||
    requestedConsultationTab === "scheduled" ||
    requestedConsultationTab === "closed" ||
    requestedConsultationTab === "pending"
      ? requestedConsultationTab
      : "pending";
  const rawActiveView: ActiveView = isAdvisorView(requestedView) ? requestedView : "dashboard";
  const activeView: ActiveView =
    rawActiveView === "advisees" && !hasAdvisees && !loadingStudents ? "dashboard" : rawActiveView;

  const showingAdviseeDetail = activeView === "advisees" && Boolean(studentQueryId);

  const currentViewLabel =
    activeView === "dashboard"
      ? "งานวันนี้"
      : showingAdviseeDetail
        ? "รายละเอียดนักศึกษา"
        : activeView === "advisees"
          ? "นักศึกษาในที่ปรึกษา"
          : activeView === "consultations"
            ? "คำขอปรึกษา"
            : activeView === "referrals"
              ? "ติดตามการส่งต่อ"
              : activeView === "observations"
                ? "ข้อสังเกตที่แจ้ง"
                : "สัญญาณเข้า";

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
          return null;
        }
        return nextStudents.some((student) => student.id === current) ? current : null;
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

  const fetchConsultationRequests = useCallback(async () => {
    setLoadingConsultationRequests(true);

    try {
      const response = await api.get<AdvisorConsultationRequestsResponse>("/api/advisor/consultation-requests");
      setConsultationRequests(response.data.requests);
    } catch (error) {
      setServerError(getErrorMessage(error));
    } finally {
      setLoadingConsultationRequests(false);
    }
  }, []);

  const fetchAdvisorAlerts = useCallback(async () => {
    setLoadingAlerts(true);

    try {
      const response = await api.get<AdvisorAlertsResponse>("/api/alerts/me");
      // สัญญาณแชท AI ไม่โชว์ในกล่องแจ้งเตือน — ดูได้ที่หน้ารายละเอียดนักศึกษาเท่านั้น
      setAdvisorAlerts(
        response.data.alerts.filter((alert) => alert.sourceType !== "StudentWellnessTrend")
      );
    } catch (error) {
      setServerError(getErrorMessage(error));
    } finally {
      setLoadingAlerts(false);
    }
  }, []);

  const fetchObservationRecords = useCallback(async () => {
    setLoadingObservationRecords(true);
    try {
      const response = await api.get<{ records: ObservationRecord[] }>("/api/advisor/observation-records");
      setObservationRecords(response.data.records);
    } catch (error) {
      setServerError(getErrorMessage(error));
    } finally {
      setLoadingObservationRecords(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace(UNAUTHENTICATED_PATH);
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    if (!hasRole(user, "ADVISOR")) {
      router.replace(getRoleHomePath(user.role));
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (loading || !user || !hasRole(user, "ADVISOR")) {
      return;
    }

    void Promise.all([
      fetchStudents(),
      fetchReferrals(),
      fetchConsultationRequests(),
      fetchAdvisorAlerts(),
      fetchObservationRecords(),
    ]);
  }, [
    fetchAdvisorAlerts,
    fetchConsultationRequests,
    fetchObservationRecords,
    fetchReferrals,
    fetchStudents,
    loading,
    user,
  ]);

  useEffect(() => {
    if (rawActiveView === "advisees" && !hasAdvisees && !loadingStudents) {
      router.replace("/advisor");
    }
  }, [hasAdvisees, loadingStudents, rawActiveView, router]);

  useEffect(() => {
    if (!showObservationModal || !hasRole(user, "ADVISOR")) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoadingObservationStudents(true);
        try {
          const response = await api.get<{ students: ObservationStudentOption[] }>(
            "/api/advisor/observation-students",
            {
              params: { search: observationStudentQuery.trim() || undefined },
              signal: controller.signal,
            }
          );
          setObservationStudentOptions(response.data.students);
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }
          setObservationError(getErrorMessage(error));
        } finally {
          if (!controller.signal.aborted) {
            setLoadingObservationStudents(false);
          }
        }
      })();
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [observationStudentQuery, showObservationModal, user]);

  useEffect(() => {
    if (!selectedStudentId) {
      setHistoryItems([]);
      return;
    }

    void fetchStudentHistory(selectedStudentId);
  }, [fetchStudentHistory, selectedStudentId]);

  useEffect(() => {
    if (activeView !== "advisees" || !studentQueryId) {
      return;
    }
    setSelectedStudentId(studentQueryId);
  }, [activeView, studentQueryId]);

  const navigateTo = (view: ActiveView, options?: { tab?: ConsultationTab }) => {
    setIsMobileMenuOpen(false);
    if (view === "dashboard") {
      router.replace("/advisor");
    } else {
      const params = new URLSearchParams({ view });
      if (view === "consultations" && options?.tab) {
        params.set("tab", options.tab);
      }
      router.replace(`/advisor?${params.toString()}`);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const setConsultationTab = (tab: ConsultationTab) => {
    router.replace(`/advisor?view=consultations&tab=${tab}`);
  };

  /** เปิดหน้ารายละเอียดนิสิตเต็มจอ (ผูกกับ ?student=) */
  const openAdviseeDetail = (studentId: string) => {
    setIsMobileMenuOpen(false);
    setSelectedStudentId(studentId);
    router.replace(`/advisor?view=advisees&student=${encodeURIComponent(studentId)}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** กลับรายชื่อ — เคลียร์ student ใน URL ก่อน เพื่อไม่ให้เปิดรายละเอียดซ้ำ */
  const closeAdviseeDetail = () => {
    setSelectedStudentId(null);
    router.replace("/advisor?view=advisees");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** ส่งเข้าสแต็กกลางอย่างเดียว — ห้าม setToast คู่กัน เพราะ RoleToast จะ push ซ้ำอีกครั้ง */
  const showToast = (
    message: string,
    type: "success" | "info" | "error" | "warning" = "success"
  ) => {
    const presentation = resolveActionToastPresentation({
      message,
      tone: type,
    });
    pushToast(presentation);
  };

  useEffect(() => {
    if (!serverError) {
      return;
    }
    pushToast({
      title: "ดำเนินการไม่สำเร็จ",
      description: serverError,
      tone: "error",
    });
    setServerError("");
  }, [pushToast, serverError]);

  const handleAlertStatusUpdate = async (
    alertId: string,
    action: "acknowledge" | "close",
    options?: { dismissOnly?: boolean }
  ): Promise<boolean> => {
    setUpdatingAlertId(alertId);
    setServerError("");

    try {
      if (action === "close") {
        if (options?.dismissOnly) {
          await api.patch(`/api/alerts/${alertId}/close`, { dismissOnly: true });
        } else {
          setPendingAlertCloseId(alertId);
          setUpdatingAlertId(null);
          return false;
        }
      } else {
        await api.patch(`/api/alerts/${alertId}/acknowledge`);
      }
      await fetchAdvisorAlerts();
      await fetchObservationRecords();
      showToast(
        action === "acknowledge"
          ? "รับเรื่องแล้ว"
          : options?.dismissOnly
            ? "ปิดการแจ้งเตือนแล้ว — สัญญาณยังอยู่ในประวัตินักศึกษา"
            : "ปิดเรื่องเรียบร้อยแล้ว",
        "success"
      );
      return true;
    } catch (error) {
      setServerError(getErrorMessage(error));
      return false;
    } finally {
      setUpdatingAlertId(null);
    }
  };

  const openObservationModal = () => {
    setObservationError("");
    setObservationStudentId("");
    setObservationSelectedStudent(null);
    setObservationCategory("");
    setObservationDetails("");
    setObservationSeverity("MEDIUM");
    setObservationObservedAt(new Date().toISOString().slice(0, 10));
    setObservationStudentQuery("");
    setShowObservationModal(true);
  };

  const handleSubmitObservation = async () => {
    if (!observationStudentId) {
      setObservationError("กรุณาเลือกนิสิตที่ต้องการแจ้ง");
      return;
    }
    if (!observationCategory.trim()) {
      setObservationError("กรุณาระบุประเภทข้อสังเกต");
      return;
    }
    if (!observationDetails.trim()) {
      setObservationError("กรุณาระบุรายละเอียดข้อสังเกต");
      return;
    }

    setSubmittingObservation(true);
    setObservationError("");
    setServerError("");

    try {
      await api.post("/api/advisor/observation-records", {
        studentId: observationStudentId,
        observedAt: observationObservedAt,
        category: observationCategory.trim(),
        details: observationDetails.trim(),
        severity: observationSeverity,
      });
      await fetchObservationRecords();
      setShowObservationModal(false);
      navigateTo("observations");
      showToast("ส่งสัญญาณข้อสังเกตถึงที่ปรึกษาของนิสิตแล้ว", "success");
    } catch (error) {
      setObservationError(getErrorMessage(error));
    } finally {
      setSubmittingObservation(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace(UNAUTHENTICATED_PATH);
  };

  const openSoapModal = (student: AdvisorStudent) => {
    setSelectedStudentId(student.id);
    setShowSoapModal(true);
    setShowReferralModal(false);
    setIsMobileMenuOpen(false);
  };

  const openReferralModal = (student: AdvisorStudent) => {
    const latestReferral = latestReferralByStudent.get(student.id);
    if (latestReferral?.status === "PENDING" || latestReferral?.status === "ACCEPTED") {
      showToast(
        latestReferral.status === "ACCEPTED"
          ? "นิสิตคนนี้มีเคสที่กำลังดูแลอยู่แล้ว ไม่สามารถส่งต่อซ้ำได้"
          : "นิสิตคนนี้มีเคสส่งต่อที่รอรับอยู่แล้ว ไม่สามารถส่งต่อซ้ำได้",
        "error"
      );
      return;
    }

    setSelectedStudentId(student.id);
    // ความเร่งด่วนเป็นดุลพินิจ — ไม่บังคับเป็นวิกฤตแม้เสี่ยงสูง
    setReferralUrgency("moderate");
    setShowReferralModal(true);
    setShowSoapModal(false);
    setIsMobileMenuOpen(false);
  };

  /**
   * จากคิวสัญญาณผู้สอน — ถ้ายังไม่รับเรื่องให้รับก่อน แล้วเปิดฟอร์มส่งต่อเดิม
   * ไม่เปลี่ยน flow การส่งต่อที่มีอยู่
   */
  const referFromInstructorAlert = async (studentId: string, alertId: string) => {
    const student = students.find((item) => item.id === studentId);
    if (!student) {
      showToast("ไม่พบนักศึกษาในที่ปรึกษาสำหรับรายการนี้", "error");
      return;
    }

    const alert = advisorAlerts.find((item) => item.id === alertId);
    if (alert?.status === "OPEN") {
      const acknowledged = await handleAlertStatusUpdate(alertId, "acknowledge");
      if (!acknowledged) {
        return;
      }
    }
    openReferralModal(student);
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
      const soapPayload = formatSoapNotePayload({
        subjective,
        objective,
        assessment,
        plan,
      });
      await api.post(`/api/advisor/students/${selectedStudent.id}/care-records`, {
        careDate: String(formData.get("careDate") || ""),
        careType: String(formData.get("careType") || "บันทึกดูแลเบื้องต้น"),
        topic: soapPayload.topic,
        action: soapPayload.action,
        outcome: soapPayload.outcome,
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
    const reason = String(formData.get("reason") || "").trim();
    if (reason.length < 20) {
      setServerError("กรุณาเขียนข้อมูลส่งต่ออย่างน้อย 20 ตัวอักษร ให้ผู้เชี่ยวชาญเข้าใจก่อนนัดนิสิต");
      return;
    }

    try {
      await api.post(`/api/advisor/students/${selectedStudent.id}/referrals`, {
        target: String(formData.get("target") || "COUNSELING_CENTER"),
        reason,
        isUrgent: referralUrgency === "urgent",
      });

      setShowReferralModal(false);
      showToast("ส่งต่อเคสเรียบร้อยแล้ว สามารถติดตามสถานะได้ในเมนูติดตามการส่งต่อ", "success");
      await Promise.all([
        fetchReferrals(),
        fetchStudentHistory(selectedStudent.id),
        fetchObservationRecords(),
        fetchAdvisorAlerts(),
      ]);
    } catch (error) {
      const message = getErrorMessage(error);
      const status =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { status?: number } }).response?.status === "number"
          ? (error as { response: { status: number } }).response.status
          : null;

      if (status === 409) {
        setShowReferralModal(false);
        showToast(message || "มีเคสส่งต่อที่ยังเปิดอยู่แล้ว ไม่สามารถส่งซ้ำได้", "error");
        await fetchReferrals();
        return;
      }

      setServerError(message);
    }
  };

  const closeConsultationActionModal = () => {
    if (isUpdatingConsultation) {
      return;
    }

    setConsultationAction(null);
    setScheduledAtLocal("");
    setScheduleLocationLocal("");
    setScheduleNoteLocal("");
    setCloseNote("");
    setCancelReason("");
    setCancelDetail("");
  };

  const applyConsultationStatusUpdate = async (
    requestId: string,
    status: ConsultationRequestStatus,
    payload?: {
      scheduledAt?: string;
      advisorNote?: string;
      cancelReason?: string;
      cancelDetail?: string;
    }
  ) => {
    setIsUpdatingConsultation(true);
    setServerError("");

    try {
      const response = await api.patch<{ request: AdvisorConsultationRequestItem }>(
        `/api/advisor/consultation-requests/${requestId}`,
        {
          status,
          scheduledAt: payload?.scheduledAt,
          advisorNote: payload?.advisorNote,
          cancelReason: payload?.cancelReason,
          cancelDetail: payload?.cancelDetail,
        }
      );

      setConsultationRequests((current) =>
        current.map((request) => (request.id === requestId ? response.data.request : request))
      );
      await fetchAdvisorAlerts();
      setConsultationAction(null);
      setScheduledAtLocal("");
      setCloseNote("");
      setCancelReason("");
      setCancelDetail("");
      showToast(consultationStatusToastMessage(status), consultationStatusToastTone(status));
    } catch (error) {
      setServerError(getErrorMessage(error));
    } finally {
      setIsUpdatingConsultation(false);
    }
  };

  const handleConsultationAccept = async (requestId: string) => {
    await applyConsultationStatusUpdate(requestId, "ACCEPTED");
  };

  const handleConsultationProposeOpen = (requestId: string) => {
    const request = consultationRequests.find((item) => item.id === requestId);
    setConsultationAction({
      requestId,
      status: "PROPOSE",
      studentName: request?.studentName,
      preferredChannel: request?.preferredChannel,
      preferredChannelLabel: request?.preferredChannelLabel,
      currentStatus: request?.status,
    });
    setScheduledAtLocal("");
    setScheduleLocationLocal("");
    setScheduleNoteLocal("");
  };

  const openConsultationCloseModal = (requestId: string) => {
    const request = consultationRequests.find((item) => item.id === requestId);
    setConsultationAction({
      requestId,
      status: "CLOSED",
      studentName: request?.studentName,
      currentStatus: request?.status,
    });
    setCloseNote("");
    setPendingCloseConsultationId(null);
  };

  const handleConsultationCloseOpen = (requestId: string) => {
    const request = consultationRequests.find((item) => item.id === requestId);
    if (request?.status !== "SCHEDULED") {
      setServerError("ปิดเคสได้เมื่อมีนัดยืนยันแล้ว — หากนิสิตต้องการเลิกคิว ให้รอให้นิสิตกดยกเลิกก่อน");
      return;
    }
    if (request.latestPendingOffer) {
      setPendingCloseConsultationId(requestId);
      return;
    }
    openConsultationCloseModal(requestId);
  };

  /** เปิดยืนยันยกเลิกเมื่อนิสิตขอยกเลิกแล้ว */
  const handleConsultationConfirmCancelOpen = (requestId: string) => {
    const request = consultationRequests.find((item) => item.id === requestId);
    if (request?.status !== "CANCEL_REQUESTED") {
      setServerError("ยืนยันยกเลิกได้เมื่อนิสิตขอยกเลิกแล้วเท่านั้น");
      return;
    }
    setConsultationAction({
      requestId,
      status: "CANCELLED",
      cancelMode: "confirm",
      studentName: request.studentName,
      currentStatus: request.status,
    });
    setCloseNote("");
    setCancelReason("");
    setCancelDetail("");
  };

  /** อาจารย์ยกเลิกคิวเองจาก PENDING/ACCEPTED — ต้องเลือกเหตุผล */
  const handleConsultationDirectCancelOpen = (requestId: string) => {
    const request = consultationRequests.find((item) => item.id === requestId);
    if (request?.status !== "PENDING" && request?.status !== "ACCEPTED") {
      setServerError("ยกเลิกคิวได้เมื่อยังไม่ยืนยันนัดเท่านั้น");
      return;
    }
    setConsultationAction({
      requestId,
      status: "CANCELLED",
      cancelMode: "direct",
      studentName: request.studentName,
      currentStatus: request.status,
    });
    setCloseNote("");
    setCancelReason("");
    setCancelDetail("");
  };

  const submitAlertCloseWithNote = async (resolutionNote: string) => {
    if (!pendingAlertCloseId) {
      return;
    }
    setClosingAlert(true);
    setServerError("");
    try {
      await api.patch(`/api/alerts/${pendingAlertCloseId}/close`, { resolutionNote });
      setPendingAlertCloseId(null);
      await fetchAdvisorAlerts();
      await fetchObservationRecords();
      showToast("บันทึกและปิดเคสเรียบร้อยแล้ว");
    } catch (error) {
      showToast(getErrorMessage(error), "error");
    } finally {
      setClosingAlert(false);
    }
  };

  const handleAcceptScheduleOffer = async (requestId: string, offerId: string) => {
    setIsUpdatingConsultation(true);
    setServerError("");
    try {
      await api.post(
        `/api/advisor/consultation-requests/${requestId}/schedule-offers/${offerId}/accept`
      );
      await fetchConsultationRequests();
      await fetchAdvisorAlerts();
      showToast("ยืนยันนัดหมายเรียบร้อยแล้ว", "success");
    } catch (error) {
      setServerError(getErrorMessage(error));
    } finally {
      setIsUpdatingConsultation(false);
    }
  };

  const handleConsultationActionSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!consultationAction) {
      return;
    }

    if (consultationAction.status === "PROPOSE") {
      if (!scheduledAtLocal) {
        setServerError("กรุณาเลือกวันเวลานัดหมาย");
        return;
      }
      if (!scheduleLocationLocal.trim()) {
        setServerError("กรุณาระบุสถานที่นัด");
        return;
      }

      const scheduledAt = new Date(scheduledAtLocal);
      if (Number.isNaN(scheduledAt.getTime())) {
        setServerError("วันเวลานัดหมายไม่ถูกต้อง");
        return;
      }

      const conflict = findClientConsultationScheduleConflict(scheduledAt, proposeBusySlots);
      if (conflict.conflict) {
        setServerError(conflict.message ?? "เวลานัดทับกับนัดอื่น");
        return;
      }

      setIsUpdatingConsultation(true);
      setServerError("");
      try {
        await api.post(`/api/advisor/consultation-requests/${consultationAction.requestId}/schedule-offers`, {
          proposedAt: scheduledAt.toISOString(),
          location: scheduleLocationLocal.trim(),
          note: scheduleNoteLocal.trim() || undefined,
        });
        await fetchConsultationRequests();
        await fetchAdvisorAlerts();
        setConsultationAction(null);
        setScheduledAtLocal("");
        setScheduleLocationLocal("");
        setScheduleNoteLocal("");
        setConsultationTab("accepted");
        showToast("ส่งข้อเสนอนัดแล้ว รอนิสิตตอบกลับ", "success");
      } catch (error) {
        setServerError(getErrorMessage(error));
      } finally {
        setIsUpdatingConsultation(false);
      }
      return;
    }

    if (consultationAction.status === "CANCELLED") {
      if (consultationAction.cancelMode === "direct") {
        if (!cancelReason.trim()) {
          setServerError("กรุณาเลือกเหตุผลการยกเลิก");
          return;
        }
        if (
          cancelReason === ADVISOR_CANCEL_REASON_OTHER &&
          cancelDetail.trim().length < 3
        ) {
          setServerError("กรุณาระบุรายละเอียดเพิ่มเติมเมื่อเลือกอื่นๆ");
          return;
        }
        await applyConsultationStatusUpdate(consultationAction.requestId, "CANCELLED", {
          cancelReason: cancelReason.trim(),
          cancelDetail:
            cancelReason === ADVISOR_CANCEL_REASON_OTHER
              ? cancelDetail.trim()
              : undefined,
        });
        return;
      }

      await applyConsultationStatusUpdate(consultationAction.requestId, "CANCELLED", {
        advisorNote: closeNote.trim() || undefined,
      });
      return;
    }

    await applyConsultationStatusUpdate(consultationAction.requestId, "CLOSED", {
      advisorNote: closeNote.trim() || undefined,
    });
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <span className="loader h-7 w-7 text-blue-600" aria-hidden="true"></span>
      </main>
    );
  }

  if (!user || !hasRole(user, "ADVISOR")) {
    return null;
  }

  const advisorInitials = getInitials(user.name);

  const openConsultationsPreferTab = (): ConsultationTab => {
    const cancelInPending = cancellingConsultationCount - cancelRequestedInAcceptedCount;
    if (pendingConsultationCount > 0 || cancelInPending > 0) return "pending";
    if (acceptedConsultationCount > 0 || cancelRequestedInAcceptedCount > 0) return "accepted";
    if (scheduledConsultationCount > 0) return "scheduled";
    return "pending";
  };

  const NavSections = () => (
    <>
      <StaffSidebarSection title="งานหลัก">
        <StaffSidebarNavButton
          active={activeView === "dashboard"}
          icon={<LayoutDashboard size={20} />}
          label="งานวันนี้"
          onClick={() => navigateTo("dashboard")}
        />
        {hasAdvisees ? (
          <StaffSidebarNavButton
            active={activeView === "advisees"}
            icon={<Users size={20} />}
            label="นักศึกษาในที่ปรึกษา"
            onClick={() => navigateTo("advisees")}
          />
        ) : null}
      </StaffSidebarSection>

      <StaffSidebarSection title="งานที่ต้องตอบ">
        {/* คำขอปรึกษา = นิสิตขอคุยกับคุณ · สัญญาณเข้า = อาจารย์ท่านอื่นแจ้งเกี่ยวกับนิสิตในดูแล */}
        <StaffSidebarNavButton
          active={activeView === "consultations"}
          badge={actionableConsultationCount || undefined}
          icon={<ClipboardList size={20} />}
          label="คำขอปรึกษา"
          onClick={() => navigateTo("consultations", { tab: openConsultationsPreferTab() })}
        />
        <StaffSidebarNavButton
          active={activeView === "academic"}
          badge={pendingInstructorSignalsCount || undefined}
          icon={<AlertCircle size={20} />}
          label="สัญญาณเข้า"
          onClick={() => navigateTo("academic")}
        />
      </StaffSidebarSection>

      <StaffSidebarSection title="ติดตามและแจ้ง">
        <StaffSidebarNavButton
          active={activeView === "referrals"}
          badge={pendingReferralsCount || undefined}
          icon={<Send size={20} />}
          label="ติดตามการส่งต่อ"
          onClick={() => navigateTo("referrals")}
        />
        <StaffSidebarNavButton
          active={activeView === "observations"}
          icon={<Flag size={20} />}
          label="ข้อสังเกตที่แจ้ง"
          onClick={() => navigateTo("observations")}
        />
      </StaffSidebarSection>
    </>
  );

  const Sidebar = () => (
    <aside className={STAFF_SIDEBAR_ASIDE}>
      <div className={STAFF_SIDEBAR_HEADER}>
        <AppBrand subtitle="คณะพยาบาลศาสตร์" size="compact" />
      </div>

      <div className={STAFF_SIDEBAR_NAV_SCROLL}>
        <NavSections />
      </div>

      <StaffSidebarFooter onLogout={handleLogout} />
    </aside>
  );

  const TopHeader = () => (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((current) => !current)}
          aria-label="เปิดหรือปิดเมนู"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        >
          <Menu size={20} />
        </button>

        <div className="hidden items-center gap-2 text-sm font-medium text-slate-500 lg:flex">
          <span>อาจารย์ที่ปรึกษา</span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
          <span className="font-bold text-slate-800">{currentViewLabel}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-5">
        <div className="flex items-center gap-3">
          <div className="hidden max-w-[12rem] overflow-hidden text-right sm:block">
            <p className="truncate whitespace-nowrap text-sm font-bold leading-none text-slate-800" title={user.name}>{user.name}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">อาจารย์ที่ปรึกษา</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-200 bg-blue-100 text-sm font-bold text-blue-700">
            {advisorInitials}
          </div>
        </div>
      </div>
    </header>
  );

  return (
    <div className="flex min-h-screen bg-[#F4F7FB] font-sans text-slate-800">
      <ConfirmDialog
        open={Boolean(pendingCloseConsultationId)}
        tone="danger"
        title="ปิดเคสที่มีข้อเสนอค้าง"
        description="มีข้อเสนอนัดค้างอยู่ — การปิดเคสจะยกเลิกข้อเสนอที่รอตอบด้วย ดำเนินการต่อหรือไม่?"
        confirmLabel="ปิดเคส"
        cancelLabel="ยกเลิก"
        onCancel={() => setPendingCloseConsultationId(null)}
        onConfirm={() => {
          if (pendingCloseConsultationId) {
            openConsultationCloseModal(pendingCloseConsultationId);
          }
        }}
      />

      <PromptDialog
        open={Boolean(pendingAlertCloseId)}
        loading={closingAlert}
        title="บันทึกและปิดเคส"
        description="สรุปสิ่งที่พูดคุยหรือผลติดตามสั้น ๆ — ผู้แจ้งจะเห็นในเส้นทางติดตาม"
        placeholder="เช่น พูดคุยแล้ว นิสิตรู้สึกดีขึ้น · นัดติดตามสัปดาห์หน้า · ส่งต่อแล้ว..."
        confirmLabel="บันทึกและปิดเคส"
        cancelLabel="ยกเลิก"
        onCancel={() => {
          if (!closingAlert) {
            setPendingAlertCloseId(null);
          }
        }}
        onConfirm={(value) => {
          void submitAlertCloseWithNote(value);
        }}
      />

      <Sidebar />

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="flex h-full w-72 flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className={STAFF_SIDEBAR_MOBILE_HEADER}>
              <AppBrand subtitle="คณะพยาบาลศาสตร์" size="compact" />
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="ปิดเมนู"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={20} className="text-slate-500" />
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
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {loadingStudents &&
            students.length === 0 &&
            (activeView === "dashboard" || activeView === "advisees") ? (
              <div className="flex min-h-[50vh] items-center justify-center">
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500 shadow-sm">
                  <span className="loader h-5 w-5 text-blue-600" aria-hidden="true"></span>
                  กำลังโหลดข้อมูลนักศึกษา...
                </div>
              </div>
            ) : (
              <>
                {activeView === "dashboard" && (
                  <DashboardView
                    formatAssessmentSummary={formatAssessmentSummary}
                    highRiskStudents={highRiskStudents}
                    latestUpdatedStudents={latestUpdatedStudents}
                    otherNegotiationCount={otherNegotiationCount}
                    pendingConsultationCount={pendingConsultationCount}
                    pendingInstructorSignalsCount={pendingInstructorSignalsCount}
                    pendingReferralsCount={pendingReferralsCount}
                    riskMeta={riskMeta}
                    scheduledConsultationCount={scheduledConsultationCount}
                    studentsCount={students.length}
                    upcomingAppointmentCount={upcomingAppointmentCount}
                    upcomingAppointments={upcomingAppointments}
                    waitingAdvisorOfferCount={waitingAdvisorOfferCount}
                    onNavigate={navigateTo}
                    onOpenSoap={openSoapModal}
                    onOpenStudent={openAdviseeDetail}
                  />
                )}
                {activeView === "advisees" && showingAdviseeDetail && selectedStudent && (
                  <AdviseeDetailView
                    formatAssessmentSummary={formatAssessmentSummary}
                    formatThaiDate={formatThaiDate}
                    formatThaiDateTime={formatThaiDateTime}
                    historyItems={historyItems}
                    latestReferral={latestReferralByStudent.get(selectedStudent.id)}
                    loadingHistory={loadingHistory}
                    queueSummary={{
                      openConsultationCount: consultationRequests.filter(
                        (request) =>
                          request.studentId === selectedStudent.id &&
                          (request.status === "PENDING" ||
                            request.status === "ACCEPTED" ||
                            request.status === "SCHEDULED" ||
                            request.status === "CANCEL_REQUESTED")
                      ).length,
                      pendingSignalCount: behaviorAlerts.filter(
                        (alert) =>
                          alert.studentId === selectedStudent.id && alert.status === "OPEN"
                      ).length,
                    }}
                    referralStatusMap={referralStatusMap}
                    riskMeta={riskMeta}
                    student={selectedStudent}
                    onBack={closeAdviseeDetail}
                    onOpenConsultations={() => {
                      const forStudent = consultationRequests.filter(
                        (request) => request.studentId === selectedStudent.id
                      );
                      const tab =
                        forStudent.some((request) => request.status === "PENDING")
                          ? "pending"
                          : forStudent.some((request) => request.status === "ACCEPTED")
                            ? "accepted"
                            : forStudent.some((request) => request.status === "SCHEDULED")
                              ? "scheduled"
                              : forStudent.some((request) => request.status === "CANCEL_REQUESTED")
                                ? "accepted"
                                : "closed";
                      navigateTo("consultations", { tab });
                    }}
                    onOpenReferral={() => openReferralModal(selectedStudent)}
                    onOpenReferrals={() => navigateTo("referrals")}
                    onOpenSignals={() => navigateTo("academic")}
                    onOpenSoap={() => openSoapModal(selectedStudent)}
                  />
                )}
                {activeView === "advisees" && showingAdviseeDetail && loadingStudents && !selectedStudent && (
                  <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                    <span className="loader h-7 w-7 text-blue-600" aria-hidden="true" />
                    <p className="text-sm font-medium text-slate-500">กำลังโหลดข้อมูลนิสิต...</p>
                  </div>
                )}
                {activeView === "advisees" && showingAdviseeDetail && !selectedStudent && !loadingStudents && (
                  <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                    <p className="text-sm font-semibold text-slate-800">ไม่พบนักศึกษาในที่ปรึกษา</p>
                    <p className="mt-1 text-xs text-slate-500">รายนี้อาจถูกถอนหรือไม่มีสิทธิ์เข้าถึง</p>
                    <button
                      type="button"
                      onClick={closeAdviseeDetail}
                      className="mt-4 rounded-xl bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100"
                    >
                      กลับรายชื่อ
                    </button>
                  </div>
                )}
                {activeView === "advisees" && !showingAdviseeDetail && (
                  <AdviseesView
                    filteredStudents={filteredStudents}
                    formatAssessmentSummary={formatAssessmentSummary}
                    latestReferralByStudent={latestReferralByStudent}
                    referralStatusMap={referralStatusMap}
                    riskMeta={riskMeta}
                    searchTerm={searchQuery}
                    onOpenReferral={openReferralModal}
                    onOpenSoap={openSoapModal}
                    onOpenStudent={openAdviseeDetail}
                    onSearchTermChange={setSearchQuery}
                  />
                )}
                {activeView === "consultations" && (
                  <ConsultationRequestsView
                    activeTab={consultationTab}
                    consultationRequests={consultationRequests}
                    consultationStatusMap={consultationStatusMap}
                    formatThaiDateTime={formatThaiDateTime}
                    loadingConsultationRequests={loadingConsultationRequests}
                    onAcceptOffer={(requestId, offerId) => {
                      void handleAcceptScheduleOffer(requestId, offerId);
                    }}
                    onAcceptRequest={(requestId) => {
                      void handleConsultationAccept(requestId);
                    }}
                    onCloseRequest={handleConsultationCloseOpen}
                    onConfirmCancel={handleConsultationConfirmCancelOpen}
                    onDirectCancel={handleConsultationDirectCancelOpen}
                    onProposeSchedule={handleConsultationProposeOpen}
                    onRefresh={() => {
                      void fetchConsultationRequests();
                    }}
                    onTabChange={setConsultationTab}
                  />
                )}
                {activeView === "referrals" && (
                  <ReferralHistoryView
                    formatThaiDate={formatThaiDate}
                    formatThaiDateTime={formatThaiDateTime}
                    loadingReferrals={loadingReferrals}
                    referralStatusMap={referralStatusMap}
                    referralTargetMap={referralTargetMap}
                    referrals={referrals}
                  />
                )}
                {activeView === "observations" && (
                  <ObservationReportView
                    formatThaiDateTime={formatThaiDateTime}
                    records={observationRecords}
                    refreshing={loadingObservationRecords}
                    search={observationSearch}
                    statusBadgeMap={observationStatusBadgeMap}
                    statusLabelMap={observationStatusLabelMap}
                    onOpenCompose={openObservationModal}
                    onRefresh={() => {
                      void fetchObservationRecords();
                    }}
                    onSearchChange={setObservationSearch}
                  />
                )}
                {activeView === "academic" && (
                  <AcademicSignalsView
                    behaviorAlerts={behaviorAlerts}
                    formatThaiDateTime={formatThaiDateTime}
                    students={students}
                    studentsWithActiveReferral={studentsWithActiveReferral}
                    updatingAlertId={updatingAlertId}
                    onAcknowledgeAlert={(alertId) => {
                      void handleAlertStatusUpdate(alertId, "acknowledge");
                    }}
                    onCloseAlert={(alertId, options) => {
                      void handleAlertStatusUpdate(alertId, "close", options);
                    }}
                    onOpenAdvisee={(studentId) => {
                      if (!hasAdvisees) {
                        return;
                      }
                      openAdviseeDetail(studentId);
                    }}
                    onReferStudent={(studentId, alertId) => {
                      void referFromInstructorAlert(studentId, alertId);
                    }}
                  />
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {showSoapModal && selectedStudent && (
        <StaffModalOverlay>
          <div className="flex items-center justify-between border-b border-slate-100 bg-[#F4F7FB] p-5">
            <div>
              <h3 className="text-lg font-bold text-slate-800">บันทึกดูแลเบื้องต้น</h3>
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

          <form onSubmit={handleSaveSoapNote} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
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
                    defaultValue="บันทึกดูแลเบื้องต้น"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="บันทึกดูแลเบื้องต้น">บันทึกดูแลเบื้องต้น</option>
                    <option value="ให้คำปรึกษาแบบตัวต่อตัว">ให้คำปรึกษาแบบตัวต่อตัว</option>
                    <option value="ติดตามทางโทรศัพท์ / ออนไลน์">ติดตามทางโทรศัพท์ / ออนไลน์</option>
                    <option value="ติดตามต่อเนื่องหลังส่งต่อ">ติดตามต่อเนื่องหลังส่งต่อ</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">นิสิตเล่า</label>
                <textarea
                  name="subjective"
                  rows={3}
                  required
                  placeholder="เช่น รู้สึกเครียด นอนไม่หลับ กังวลเรื่องการเรียน..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">สิ่งที่สังเกต</label>
                <textarea
                  name="objective"
                  rows={3}
                  required
                  placeholder="เช่น สีหน้ากังวล ขาดเรียนบ่อย พูดน้อยกว่าปกติ..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">ประเมินเบื้องต้น</label>
                <textarea
                  name="assessment"
                  rows={3}
                  required
                  placeholder="สรุปประเด็นหลัก ระดับความเสี่ยง และสิ่งที่ควรติดตามต่อ..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">แผนการดูแล</label>
                <textarea
                  name="plan"
                  rows={3}
                  required
                  placeholder="เช่น นัดติดตามอีกครั้ง ประสานผู้ปกครอง หรือวางแผนส่งต่อ..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse justify-end gap-2 border-t border-slate-100 bg-slate-50 p-5 sm:flex-row">
              <button type="button" onClick={() => setShowSoapModal(false)} className={`${UI_BUTTON_GHOST} w-full sm:w-auto`}>
                ยกเลิก
              </button>
              <button type="submit" className={`${UI_BUTTON_PRIMARY} w-full sm:w-auto`}>
                <ConfirmSubmitLabel>บันทึกข้อมูล</ConfirmSubmitLabel>
              </button>
            </div>
          </form>
        </StaffModalOverlay>
      )}

      {showReferralModal && selectedStudent && (
        <StaffModalOverlay>
          <div className="flex items-center justify-between border-b border-slate-100 bg-[#F4F7FB] p-5">
            <div className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="text-lg font-bold text-slate-800">ส่งต่อเคส</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  ส่งได้ตามดุลพินิจ — ไม่จำเป็นต้องเป็นเคสวิกฤต ควรเขียนข้อมูลให้ผู้เชี่ยวชาญอ่านก่อนนัดนิสิต
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowReferralModal(false)}
              className="rounded-full bg-white p-1.5 text-slate-400 shadow-sm"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleReferralSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
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
                <label className="text-xs font-semibold text-slate-600">ระดับความเร่งด่วน (ถ้าต้องการระบุ)</label>
                <div className="flex flex-wrap gap-2" role="group" aria-label="ระดับความเร่งด่วน">
                  {urgencyOptions.map((option) => {
                    const selected = referralUrgency === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setReferralUrgency(option.value)}
                        className={`${UI_CHOICE_CHIP} ${option.toneClassName} ${
                          selected ? UI_CHOICE_CHIP_SELECTED : UI_CHOICE_CHIP_UNSELECTED
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
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
                <label className="text-xs font-bold uppercase text-slate-700">
                  ข้อมูลส่งต่อให้ผู้เชี่ยวชาญ (จำเป็น)
                </label>
                <textarea
                  name="reason"
                  rows={5}
                  required
                  minLength={20}
                  placeholder="เขียนให้ผู้เชี่ยวชาญเข้าใจก่อนนัดนิสิต เช่น สังเกตอะไร / พูดคุยแล้วพบอะไร / ต้องการความช่วยเหลือด้านใด / สิ่งที่ควรระวัง..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-500">อย่างน้อย 20 ตัวอักษร — ใช้เป็นบริบทก่อนนัดจริง</p>
              </div>

              <div className={`flex items-start gap-2 ${UI_CALLOUT_INFO}`}>
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <p className="text-[11px] font-medium leading-5 text-slate-700">
                  ส่งต่อได้แม้ไม่ใช่เคสวิกฤต — ทีมรับช่วงจะอ่านข้อความนี้ก่อนติดต่อนิสิต และคุณติดตามสถานะได้ที่เมนูติดตามการส่งต่อ
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse justify-end gap-2 border-t border-slate-100 bg-slate-50 p-5 sm:flex-row">
              <button type="button" onClick={() => setShowReferralModal(false)} className={`${UI_BUTTON_GHOST} w-full sm:w-auto`}>
                ยกเลิก
              </button>
              <button type="submit" className={`${UI_BUTTON_PRIMARY} w-full sm:w-auto`}>
                <ConfirmSubmitLabel>ยืนยันการส่งต่อ</ConfirmSubmitLabel>
              </button>
            </div>
          </form>
        </StaffModalOverlay>
      )}

      {consultationAction && (
        <StaffModalOverlay>
          <div className="flex items-center justify-between border-b border-slate-100 bg-[#F4F7FB] p-5">
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                {consultationAction.status === "PROPOSE"
                  ? consultationAction.currentStatus === "SCHEDULED"
                    ? "เลื่อนนัด"
                    : "เสนอวัน/สถานที่นัด"
                  : consultationAction.status === "CANCELLED"
                    ? consultationAction.cancelMode === "direct"
                      ? "ยกเลิกคำขอปรึกษา"
                      : "นศขอยกเลิก — กดยืนยัน"
                    : "ปิดเคส"}
              </h3>
              {consultationAction.studentName && (
                <p className="mt-1 text-xs text-slate-500">นักศึกษา: {consultationAction.studentName}</p>
              )}
            </div>
            <button
              type="button"
              onClick={closeConsultationActionModal}
              disabled={isUpdatingConsultation}
              className="rounded-full bg-white p-1.5 text-slate-400 shadow-sm disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleConsultationActionSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              {consultationAction.status === "PROPOSE" ? (
                <>
                  <p className="text-xs text-slate-500">
                    {consultationAction.currentStatus === "SCHEDULED"
                      ? "ส่งวัน/สถานที่ใหม่ให้นิสิต — นัดจะอัปเดตเมื่ออีกฝ่ายกดยอมรับ"
                      : "ส่งข้อเสนอให้นิสิต — นัดจะยืนยันเมื่ออีกฝ่ายกดยอมรับ หรือขอเปลี่ยนวันจนกว่าจะตกลงกัน"}
                  </p>
                  {consultationAction.preferredChannelLabel ? (
                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      นิสิตสะดวกแบบ:{" "}
                      <span className="font-semibold text-slate-800">
                        {consultationAction.preferredChannelLabel}
                      </span>
                      {" — "}คุณระบุห้องหรือลิงก์ที่สะดวกด้านล่าง
                    </p>
                  ) : null}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                    <p className="text-xs font-bold text-slate-700">นัด/ข้อเสนอที่มีอยู่แล้ว</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500">
                      กันชนอย่างน้อย 1 ชั่วโมง — ถ้าคุยจบก่อน ปิดเคสก่อนหน้าได้ จึงนัดชิดขึ้นได้
                    </p>
                    {proposeBusySlots.length > 0 ? (
                      <ul className="mt-2 max-h-36 space-y-1.5 overflow-y-auto overscroll-contain">
                        {proposeBusySlots.map((slot) => (
                          <li
                            key={`${slot.source}-${slot.requestId}-${slot.atMs}`}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                          >
                            <span className="font-semibold tabular-nums text-[#C24712]">
                              {slot.scheduledAtLabel}
                            </span>
                            <span className="mt-0.5 block text-slate-600">{slot.label}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">ยังไม่มีนัดอื่นในช่วงนี้</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="consultation-scheduled-at" className="text-xs font-bold text-slate-700">
                      วันเวลานัดหมาย
                    </label>
                    <input
                      id="consultation-scheduled-at"
                      type="datetime-local"
                      required
                      value={scheduledAtLocal}
                      onChange={(event) => setScheduledAtLocal(event.target.value)}
                      disabled={isUpdatingConsultation}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="consultation-schedule-location" className="text-xs font-bold text-slate-700">
                      สถานที่ / ลิงก์ที่คุณสะดวก
                    </label>
                    <input
                      id="consultation-schedule-location"
                      type="text"
                      required
                      maxLength={200}
                      value={scheduleLocationLocal}
                      onChange={(event) => setScheduleLocationLocal(event.target.value)}
                      disabled={isUpdatingConsultation}
                      placeholder={scheduleLocationPlaceholder(
                        consultationAction.preferredChannel || "IN_PERSON"
                      )}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="consultation-schedule-note" className="text-xs font-bold text-slate-700">
                      หมายเหตุถึงนิสิต (ถ้ามี)
                    </label>
                    <textarea
                      id="consultation-schedule-note"
                      rows={3}
                      value={scheduleNoteLocal}
                      onChange={(event) => setScheduleNoteLocal(event.target.value)}
                      disabled={isUpdatingConsultation}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                    />
                  </div>
                </>
              ) : consultationAction.status === "CANCELLED" &&
                consultationAction.cancelMode === "direct" ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
                    ยกเลิกคิวได้เลยโดยไม่รอนิสิต — เลือกเหตุผลให้ชัดเจน นิสิตจะเห็นสถานะยกเลิกสีเหลือง
                  </p>
                  <div className="space-y-1">
                    <label htmlFor="consultation-cancel-reason" className="text-xs font-bold text-slate-700">
                      เหตุผลการยกเลิก
                    </label>
                    <select
                      id="consultation-cancel-reason"
                      required
                      value={cancelReason}
                      onChange={(event) => setCancelReason(event.target.value)}
                      disabled={isUpdatingConsultation}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                    >
                      <option value="">เลือกเหตุผล</option>
                      {ADVISOR_CANCEL_REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                  </div>
                  {cancelReason === ADVISOR_CANCEL_REASON_OTHER ? (
                    <div className="space-y-1">
                      <label htmlFor="consultation-cancel-detail" className="text-xs font-bold text-slate-700">
                        รายละเอียดเพิ่มเติม
                      </label>
                      <textarea
                        id="consultation-cancel-detail"
                        required
                        rows={3}
                        maxLength={500}
                        value={cancelDetail}
                        onChange={(event) => setCancelDetail(event.target.value)}
                        disabled={isUpdatingConsultation}
                        placeholder="ระบุเหตุผลสั้น ๆ..."
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">
                    {consultationAction.status === "CANCELLED"
                      ? "รับทราบคำขอยกเลิกของนิสิต แล้วยืนยันเพื่อปิดคิวเป็นสถานะยกเลิก"
                      : "บันทึกสรุปสั้น ๆ หลังพูดคุย แล้วปิดเคส"}
                  </p>
                  <label htmlFor="consultation-close-note" className="text-xs font-bold text-slate-700">
                    {consultationAction.status === "CANCELLED"
                      ? "หมายเหตุถึงนิสิต (ถ้ามี)"
                      : "สรุปการปรึกษา (ถ้ามี)"}
                  </label>
                  <textarea
                    id="consultation-close-note"
                    rows={4}
                    value={closeNote}
                    onChange={(event) => setCloseNote(event.target.value)}
                    disabled={isUpdatingConsultation}
                    placeholder={
                      consultationAction.status === "CANCELLED"
                        ? "เช่น รับทราบแล้ว หากต้องการคุยใหม่ส่งคำขอได้อีกครั้ง..."
                        : "สรุปประเด็นที่คุยและข้อเสนอแนะ..."
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse justify-end gap-2 border-t border-slate-100 bg-slate-50 p-5 sm:flex-row">
              <button
                type="button"
                onClick={closeConsultationActionModal}
                disabled={isUpdatingConsultation}
                className={`${UI_BUTTON_GHOST} w-full sm:w-auto`}
              >
                ปิด
              </button>
              <button type="submit" disabled={isUpdatingConsultation} className={`${UI_BUTTON_PRIMARY} w-full sm:w-auto`}>
                <ConfirmSubmitLabel busy={isUpdatingConsultation}>
                  {isUpdatingConsultation
                    ? "กำลังบันทึก..."
                    : consultationAction.status === "CANCELLED"
                      ? "ยกเลิก"
                      : "ยืนยัน"}
                </ConfirmSubmitLabel>
              </button>
            </div>
          </form>
        </StaffModalOverlay>
      )}

      {showObservationModal ? (
        <StaffModalOverlay>
          <div className="flex items-center justify-between border-b border-slate-100 bg-white p-5">
            <div>
              <h3 className="text-lg font-bold text-slate-800">แจ้งข้อสังเกตแนวโน้ม</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                เลือกนิสิตของอาจารย์ท่านอื่น — สัญญาณเข้าที่ปรึกษาของนิสิต (ค้นหาไม่รวมนิสิตในสังกัดคุณ)
              </p>
            </div>
            <button
              type="button"
              disabled={submittingObservation}
              onClick={() => setShowObservationModal(false)}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <StudentSearchPicker
              query={observationStudentQuery}
              onQueryChange={setObservationStudentQuery}
              options={observationStudentOptions}
              selectedId={observationStudentId}
              selectedStudent={observationSelectedStudent}
              onSelect={(student) => {
                setObservationSelectedStudent(student);
                setObservationStudentId(student?.id || "");
                if (student) {
                  setObservationStudentQuery("");
                }
              }}
              isLoading={loadingObservationStudents}
              emptyMessage={
                observationStudentQuery.trim()
                  ? "ไม่พบนิสิตที่ตรงคำค้น — รายชื่อในสังกัดคุณจะไม่โผล่ที่นี่"
                  : "ยังไม่มีรายชื่อนิสิตของอาจารย์ท่านอื่น"
              }
            />
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600">วันที่สังเกต</label>
              <input
                type="date"
                value={observationObservedAt}
                onChange={(event) => setObservationObservedAt(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">ประเภทข้อสังเกต</label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="ประเภทข้อสังเกต">
                {observationQuickCategories.map((item) => {
                  const selected = observationCategory === item.label;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setObservationCategory(item.label)}
                      className={selected ? UI_CHIP_ACTIVE : UI_CHIP_INACTIVE}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                value={observationCategory}
                onChange={(event) => setObservationCategory(event.target.value)}
                placeholder="หรือพิมพ์หัวข้อเอง..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">ความเร่งด่วน</label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="ความเร่งด่วน">
                {(["LOW", "MEDIUM", "HIGH"] as ObservationSeverity[]).map((severity) => {
                  const selected = observationSeverity === severity;
                  const tone =
                    severity === "HIGH"
                      ? UI_CHOICE_CHIP_DANGER
                      : severity === "MEDIUM"
                        ? UI_CHOICE_CHIP_PRIMARY
                        : UI_CHOICE_CHIP_SUCCESS;
                  return (
                    <button
                      key={severity}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setObservationSeverity(severity)}
                      className={`${UI_CHOICE_CHIP} ${tone} ${
                        selected ? UI_CHOICE_CHIP_SELECTED : UI_CHOICE_CHIP_UNSELECTED
                      }`}
                    >
                      {severity === "LOW" ? "ต่ำ" : severity === "MEDIUM" ? "ปานกลาง" : "เร่งด่วน"}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600">รายละเอียด</label>
              <textarea
                rows={4}
                value={observationDetails}
                onChange={(event) => setObservationDetails(event.target.value)}
                placeholder="เช่น ในคาบเรียนสังเกตเห็นแนวโน้ม..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {observationError ? <InlineAlert className="p-3">{observationError}</InlineAlert> : null}
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 p-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={submittingObservation}
              onClick={() => setShowObservationModal(false)}
              className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-200 disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              disabled={submittingObservation}
              onClick={() => {
                void handleSubmitObservation();
              }}
              className={UI_BUTTON_PRIMARY}
            >
              {submittingObservation ? "กำลังส่ง..." : "ส่งถึงที่ปรึกษาของนิสิต"}
            </button>
          </div>
        </StaffModalOverlay>
      ) : null}
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
