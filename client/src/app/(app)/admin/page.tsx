"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, Server, ShieldAlert, Users } from "lucide-react";
import { useAuth } from "@/context/auth.context";
import api from "@/lib/axios";
import { UNAUTHENTICATED_PATH } from "@/lib/auth-routes";
import { downloadCsv, pushCsvSection, pushKeyValueRows } from "@/lib/csv-export";
import { getRoleHomePath } from "@/lib/roles";
import { AdminShell } from "@/components/admin-shell";
import { AuditLogView } from "@/components/admin/audit-log-view";
import { DashboardView } from "@/components/admin/dashboard-view";
import { ReportsView, type AdminReportsSummary } from "@/components/admin/reports-view";
import { SettingsView } from "@/components/admin/settings-view";
import type { Role } from "@/types/auth";

type AdminRootView = "dashboard" | "audit" | "reports" | "settings";

type ManagedStudent = {
  id: string;
  studentId: string;
  name: string;
  email: string | null;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
};

type StaffUser = {
  id: string;
  name: string;
  email: string | null;
  employeeId: string | null;
  role: Role;
};

type AuditLogItem = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  description: string | null;
  ipAddress: string | null;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    role: Role;
  } | null;
};

type StudentsResponse = {
  students: ManagedStudent[];
  total: number;
};

type StaffResponse = {
  staff: StaffUser[];
};

type AuditLogsResponse = {
  logs: AuditLogItem[];
};

type HealthResponse = {
  message: string;
  ok: boolean;
};

const adminOnlyViewSet = new Set<AdminRootView>(["dashboard", "audit", "reports", "settings"]);

const roleBadgeMap: Record<Role, string> = {
  STUDENT_DEVELOPMENT: "bg-rose-100 text-rose-700",
  ADMIN: "bg-violet-100 text-violet-700",
  ADVISOR: "bg-amber-100 text-amber-700",
  EXECUTIVE: "bg-cyan-100 text-cyan-700",
  INSTRUCTOR: "bg-slate-100 text-slate-700",
  MENTAL_HEALTH: "bg-blue-100 text-blue-700",
  STUDENT: "bg-emerald-100 text-emerald-700",
};

const roleLabelMap: Record<Role, string> = {
  STUDENT_DEVELOPMENT: "ฝ่ายพัฒนานักศึกษา",
  ADMIN: "ผู้ดูแลระบบ",
  ADVISOR: "อาจารย์ที่ปรึกษา",
  EXECUTIVE: "ผู้บริหาร",
  INSTRUCTOR: "อาจารย์ผู้สอน",
  MENTAL_HEALTH: "ผู้เชี่ยวชาญ",
  STUDENT: "นักศึกษา",
};

const auditActionLabelMap: Record<string, string> = {
  "auth.login.success": "เข้าสู่ระบบสำเร็จ",
  "auth.login.failed": "เข้าสู่ระบบไม่สำเร็จ",
  "auth.logout": "ออกจากระบบ",
  "auth.password-reset.request": "ขอรีเซ็ตรหัสผ่าน",
  "auth.password-reset.complete": "รีเซ็ตรหัสผ่านสำเร็จ",
  "auth.password-change": "เปลี่ยนรหัสผ่านสำเร็จ",
  "auth.password-change.failed": "เปลี่ยนรหัสผ่านไม่สำเร็จ",
  "admin.student.create": "สร้างบัญชีนักศึกษา",
  "admin.user.create": "สร้างบัญชีบุคลากร",
  "admin.student.update": "แก้ไขบัญชีนักศึกษา",
  "admin.user.update": "แก้ไขบัญชีบุคลากร",
  "admin.student.delete": "ลบบัญชีนักศึกษา",
  "admin.user.delete": "ลบบัญชีบุคลากร",
  "admin.student.import": "นำเข้าข้อมูลนักศึกษา",
  "admin.user.import": "นำเข้าข้อมูลบุคลากร",
  "admin.student.study-year.bulk-update": "เลื่อนชั้นปีแบบกลุ่ม",
  "admin.advisor-assignment.assign": "มอบหมายอาจารย์ที่ปรึกษา",
  "advisor.student-history.view": "เปิดดูประวัตินักศึกษา",
  "advisor.referral.create": "สร้างรายการส่งต่อ",
  "alerts.acknowledge": "รับทราบการแจ้งเตือน",
  "instructor.behavior-record.create": "เพิ่มบันทึกพฤติกรรม",
  "mental-health.referral.update-status": "อัปเดตสถานะการส่งต่อ",
  "mental-health.specialized-care.create": "เพิ่มบันทึกการดูแลเฉพาะทาง",
  "mental-health.emergency.resolve": "ปิดเคสฉุกเฉิน",
  "student.assessment.submit": "ส่งแบบประเมิน",
  "student.sos.create": "แจ้งเหตุฉุกเฉิน",
};

const auditActionDetailMap: Record<string, string> = {
  "auth.login.success": "สร้างเซสชันเข้าสู่ระบบใหม่ให้ผู้ใช้งาน",
  "auth.login.failed": "การยืนยันตัวตนไม่ผ่านหรือบัญชีไม่พร้อมใช้งาน",
  "auth.logout": "สิ้นสุดเซสชันของผู้ใช้งาน",
  "auth.password-reset.request": "บันทึกคำขอสำหรับตั้งรหัสผ่านใหม่",
  "auth.password-reset.complete": "ยืนยันการตั้งรหัสผ่านใหม่เรียบร้อย",
  "auth.password-change": "อัปเดตรหัสผ่านและออกโทเค็นการใช้งานใหม่",
  "auth.password-change.failed": "ปฏิเสธการเปลี่ยนรหัสผ่านจากข้อมูลเดิมไม่ถูกต้อง",
  "admin.student.create": "เพิ่มบัญชีนักศึกษาใหม่เข้าสู่ระบบ",
  "admin.user.create": "เพิ่มบัญชีบุคลากรใหม่เข้าสู่ระบบ",
  "admin.student.update": "ปรับปรุงข้อมูลนักศึกษาในระบบ",
  "admin.user.update": "ปรับปรุงข้อมูลบุคลากรในระบบ",
  "admin.student.delete": "ลบบัญชีนักศึกษาออกจากระบบ",
  "admin.user.delete": "ลบบัญชีบุคลากรออกจากระบบ",
  "admin.student.import": "นำเข้าข้อมูลนักศึกษาแบบกลุ่มจากไฟล์",
  "admin.user.import": "นำเข้าข้อมูลบุคลากรแบบกลุ่มจากไฟล์ CSV",
  "admin.student.study-year.bulk-update": "ปรับชั้นปีนักศึกษาแบบกลุ่มในครั้งเดียว",
  "admin.advisor-assignment.assign": "บันทึกการจับคู่นักศึกษากับอาจารย์ที่ปรึกษา",
  "advisor.student-history.view": "เข้าถึงหน้าประวัติและข้อมูลย้อนหลังของนักศึกษา",
  "advisor.referral.create": "สร้างคำขอส่งต่อไปยังหน่วยงานที่เกี่ยวข้อง",
  "alerts.acknowledge": "ผู้ใช้งานรับทราบเหตุแจ้งเตือนแล้ว",
  "instructor.behavior-record.create": "สร้างรายการบันทึกพฤติกรรมใหม่",
  "mental-health.referral.update-status": "อัปเดตสถานะการติดตามเคสส่งต่อ",
  "mental-health.specialized-care.create": "เพิ่มข้อมูลการดูแลเฉพาะทางในระบบ",
  "mental-health.emergency.resolve": "ปิดเคสฉุกเฉินหลังดำเนินการแล้ว",
  "student.assessment.submit": "นักศึกษาส่งแบบประเมินเข้าระบบ",
  "student.sos.create": "สร้างเหตุฉุกเฉินเพื่อขอความช่วยเหลือ",
};

const auditEntityLabelMap: Record<string, string> = {
  AuthSession: "เซสชันเข้าสู่ระบบ",
  User: "บัญชีผู้ใช้งาน",
  StudentAccount: "บัญชีนักศึกษา",
  StaffAccount: "บัญชีบุคลากร",
  Alert: "การแจ้งเตือน",
  StudentAssessment: "แบบประเมินนักศึกษา",
  EmergencyCase: "เคสฉุกเฉิน",
  CaseReferral: "รายการส่งต่อ",
  BehaviorRecord: "บันทึกพฤติกรรม",
  SpecializedCareRecord: "บันทึกการดูแลเฉพาะทาง",
  StudentAdvisorAssignment: "การมอบหมายอาจารย์ที่ปรึกษา",
};

const formatThaiDateTime = (value: string): string => {
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

const formatThaiDate = (value: string): string => {
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

const formatThaiTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
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

type AuditStatus = "Success" | "Partial" | "Failed";

type ParsedImportAuditSummary = {
  outcome: "success" | "partial" | "failed" | null;
  total: number | null;
  created: number | null;
  updated: number | null;
  skipped: number | null;
  failed: number | null;
  issues: string | null;
  note: string | null;
};

const parseAuditNumericMetric = (description: string, key: string): number | null => {
  const match = new RegExp(`${key}=(\\d+)`, "i").exec(description);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseAuditTextMetric = (description: string, key: string): string | null => {
  const match = new RegExp(`${key}=([^|]+)`, "i").exec(description);
  return match?.[1]?.trim() || null;
};

const parseAuditImportSummary = (log: AuditLogItem): ParsedImportAuditSummary | null => {
  if (!log.action.endsWith(".import")) {
    return null;
  }

  const description = log.description || "";
  const created = parseAuditNumericMetric(description, "created");
  const updated = parseAuditNumericMetric(description, "updated");
  const skipped = parseAuditNumericMetric(description, "skipped");
  const failed = parseAuditNumericMetric(description, "failed");
  const total = parseAuditNumericMetric(description, "total");
  const outcome = parseAuditTextMetric(description, "outcome");
  const issues = parseAuditTextMetric(description, "issues");
  const note = parseAuditTextMetric(description, "note");

  if (
    created === null &&
    updated === null &&
    skipped === null &&
    failed === null &&
    total === null &&
    !outcome
  ) {
    return null;
  }

  return {
    outcome:
      outcome === "success" || outcome === "partial" || outcome === "failed" ? outcome : null,
    total,
    created,
    updated,
    skipped,
    failed,
    issues,
    note,
  };
};

const resolveAuditStatusFromImportSummary = (summary: ParsedImportAuditSummary): AuditStatus => {
  if (summary.outcome === "success") {
    return "Success";
  }

  if (summary.outcome === "partial") {
    return "Partial";
  }

  if (summary.outcome === "failed") {
    return "Failed";
  }

  const created = summary.created ?? 0;
  const updated = summary.updated ?? 0;
  const skipped = summary.skipped ?? 0;
  const failed = summary.failed ?? 0;
  const completedCount = created + updated + skipped;

  if (failed > 0 && completedCount > 0) {
    return "Partial";
  }

  if (failed > 0) {
    return "Failed";
  }

  return "Success";
};

const formatAuditImportDetail = (summary: ParsedImportAuditSummary): string => {
  const detailParts = [
    summary.total !== null ? `ทั้งหมด ${summary.total}` : null,
    `เพิ่มใหม่ ${summary.created ?? 0}`,
    `อัปเดต ${summary.updated ?? 0}`,
    `ข้าม ${summary.skipped ?? 0}`,
    `ไม่สำเร็จ ${summary.failed ?? 0}`,
  ].filter((item): item is string => Boolean(item));

  const extras = [summary.issues ? `ปัญหาหลัก: ${summary.issues}` : null, summary.note].filter(
    (item): item is string => Boolean(item)
  );

  return [`ผลการนำเข้า: ${detailParts.join(", ")}`, ...extras].join(" | ");
};

const getAuditStatus = (log: AuditLogItem): AuditStatus => {
  const importSummary = parseAuditImportSummary(log);
  if (importSummary) {
    return resolveAuditStatusFromImportSummary(importSummary);
  }

  const haystack = `${log.action} ${log.description || ""}`.toLowerCase();
  return haystack.includes("failed") || haystack.includes("error") ? "Failed" : "Success";
};

const getAuditTarget = (log: AuditLogItem): string => {
  if (log.entityId && log.entityType) {
    return `${log.entityType} • ${log.entityId}`;
  }

  if (log.entityType) {
    return log.entityType;
  }

  return "ระบบ";
};

const getAuditStatusLabel = (status: AuditStatus): string => {
  if (status === "Success") {
    return "สำเร็จ";
  }

  if (status === "Partial") {
    return "สำเร็จบางส่วน";
  }

  return "ไม่สำเร็จ";
};

const getNormalizedAuditAction = (log: AuditLogItem): string => {
  if (!log.action.startsWith("admin.user.")) {
    return log.action;
  }

  if ((log.description || "").toUpperCase().includes("STUDENT ACCOUNT")) {
    return log.action.replace("admin.user.", "admin.student.");
  }

  return log.action;
};

const getAuditActionLabel = (log: AuditLogItem): string => {
  const normalizedAction = getNormalizedAuditAction(log);
  return auditActionLabelMap[normalizedAction] ?? normalizedAction;
};

const getResolvedAuditActionDetail = (log: AuditLogItem): string => {
  const importSummary = parseAuditImportSummary(log);
  if (importSummary) {
    return formatAuditImportDetail(importSummary);
  }

  return getAuditActionDetail(log);
};

const getAuditActionDetail = (log: AuditLogItem): string =>
  auditActionDetailMap[getNormalizedAuditAction(log)] ?? log.description ?? "กิจกรรมภายในระบบ";

const getAuditActionScopedTargetLabel = (action: string): string | null => {
  if (action.startsWith("admin.student.")) {
    return "บัญชีนักศึกษา";
  }

  if (action.startsWith("admin.user.")) {
    return "บัญชีบุคลากร";
  }

  return null;
};

const getAuditTargetLabel = (log: AuditLogItem): string => {
  const actionScopedLabel = getAuditActionScopedTargetLabel(getNormalizedAuditAction(log));
  if (actionScopedLabel) {
    return actionScopedLabel;
  }

  if (log.entityType) {
    return auditEntityLabelMap[log.entityType] ?? log.entityType;
  }

  return "ระบบ";
};

const getAuditTargetReference = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  if (value.length <= 16) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
};

const getAuditActorName = (log: AuditLogItem): string => log.actor?.name || "ระบบ";

const getAuditSearchText = (log: AuditLogItem): string =>
  [
    log.id,
    getAuditActorName(log),
    log.actor?.role ? roleLabelMap[log.actor.role] : "",
    log.action,
    getAuditActionLabel(log),
    getResolvedAuditActionDetail(log),
    log.description || "",
    log.ipAddress || "",
    log.entityType || "",
    getAuditTarget(log),
    getAuditTargetLabel(log),
    log.entityId || "",
    getAuditTargetReference(log.entityId) || "",
  ]
    .join(" ")
    .toLowerCase();

const exportAuditLogsCsv = (logs: AuditLogItem[]): void => {
  const rows: unknown[][] = [];

  rows.push(["Metadata"]);
  rows.push(["รายการ", "ค่า"]);
  pushKeyValueRows(rows, [
    ["วันที่ export", new Date().toISOString().slice(0, 10)],
    ["จำนวนรายการ", logs.length],
  ]);

  pushCsvSection(
    rows,
    "AuditLogs",
    [
      "logId",
      "createdAt",
      "actorName",
      "actorRole",
      "action",
      "entityType",
      "entityId",
      "description",
      "ipAddress",
      "status",
    ],
    logs.map((log) => [
      log.id,
      formatThaiDateTime(log.createdAt),
      getAuditActorName(log),
      log.actor?.role ? roleLabelMap[log.actor.role] : "ระบบ",
      getAuditActionLabel(log),
      log.entityType ?? "",
      log.entityId ?? "",
      getResolvedAuditActionDetail(log),
      log.ipAddress ?? "",
      getAuditStatusLabel(getAuditStatus(log)),
    ])
  );

  downloadCsv(`audit-logs-${new Date().toISOString().slice(0, 10)}.csv`, rows);
};

function AdminDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, loading, logout } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [auditCurrentPage, setAuditCurrentPage] = useState(1);
  const [auditRowsPerPage, setAuditRowsPerPage] = useState(8);
  const [students, setStudents] = useState<ManagedStudent[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [systemOnline, setSystemOnline] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [serverError, setServerError] = useState("");
  const [reportsSummary, setReportsSummary] = useState<AdminReportsSummary | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);

  const activeView = useMemo<AdminRootView>(() => {
    const value = searchParams.get("view");
    return value && adminOnlyViewSet.has(value as AdminRootView) ? (value as AdminRootView) : "dashboard";
  }, [searchParams]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace(UNAUTHENTICATED_PATH);
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    if (user.role !== "ADMIN") {
      router.replace(getRoleHomePath(user.role));
    }
  }, [loading, router, user]);

  useEffect(() => {
    router.prefetch("/admin/manage-students");
    router.prefetch("/admin/manage-staff");
    router.prefetch("/admin/import-students");
  }, [router]);

  useEffect(() => {
    const updateAuditRowsPerPage = () => {
      const viewportHeight = window.innerHeight;
      const isMobileViewport = window.innerWidth < 768;
      const reservedHeight = isMobileViewport ? 540 : 420;
      const estimatedRowHeight = isMobileViewport ? 136 : 88;
      const minRows = isMobileViewport ? 4 : 5;
      const maxRows = isMobileViewport ? 8 : 10;
      const computedRows = Math.max(minRows, Math.floor((viewportHeight - reservedHeight) / estimatedRowHeight));

      setAuditRowsPerPage(Math.min(maxRows, computedRows));
    };

    updateAuditRowsPerPage();
    window.addEventListener("resize", updateAuditRowsPerPage);
    return () => window.removeEventListener("resize", updateAuditRowsPerPage);
  }, []);

  useEffect(() => {
    if (loading || user?.role !== "ADMIN") {
      return;
    }

    const loadDashboard = async () => {
      setLoadingData(true);
      setServerError("");

      try {
        const [studentsResponse, staffResponse, auditResponse, healthResponse] = await Promise.all([
          api.get<StudentsResponse>("/api/admin/students"),
          api.get<StaffResponse>("/api/admin/staff"),
          api.get<AuditLogsResponse>("/api/admin/audit-logs?limit=60"),
          api.get<HealthResponse>("/api/health"),
        ]);

        setStudents(studentsResponse.data.students);
        setStaffUsers(staffResponse.data.staff);
        setAuditLogs(auditResponse.data.logs);
        setSystemOnline(Boolean(healthResponse.data.ok));
      } catch (error) {
        setServerError(getErrorMessage(error));
      } finally {
        setLoadingData(false);
      }
    };

    void loadDashboard();
  }, [loading, user?.role]);

  const loadReportsSummary = async () => {
    setReportsLoading(true);
    setReportsError(null);
    try {
      const response = await api.get<AdminReportsSummary>("/api/admin/reports/summary");
      setReportsSummary(response.data);
    } catch (error) {
      setReportsError(getErrorMessage(error));
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    if (loading || user?.role !== "ADMIN" || activeView !== "reports") {
      return;
    }
    void loadReportsSummary();
  }, [activeView, loading, user?.role]);

  const handleLogout = async () => {
    await logout();
    router.replace(UNAUTHENTICATED_PATH);
  };

  const filteredAuditLogs = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) {
      return auditLogs;
    }

    return auditLogs.filter((log) => getAuditSearchText(log).includes(normalized));
  }, [auditLogs, searchQuery]);

  const auditTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredAuditLogs.length / auditRowsPerPage)),
    [filteredAuditLogs.length, auditRowsPerPage]
  );

  useEffect(() => {
    setAuditCurrentPage(1);
  }, [activeView, searchQuery]);

  useEffect(() => {
    setAuditCurrentPage((prev) => Math.min(prev, auditTotalPages));
  }, [auditTotalPages]);

  const paginatedAuditLogs = useMemo(() => {
    const start = (auditCurrentPage - 1) * auditRowsPerPage;
    return filteredAuditLogs.slice(start, start + auditRowsPerPage);
  }, [auditCurrentPage, auditRowsPerPage, filteredAuditLogs]);

  const auditStartItemIndex = filteredAuditLogs.length === 0 ? 0 : (auditCurrentPage - 1) * auditRowsPerPage;
  const auditEndItemIndex =
    filteredAuditLogs.length === 0 ? 0 : Math.min(auditStartItemIndex + paginatedAuditLogs.length, filteredAuditLogs.length);
  const canGoPrevAudit = auditCurrentPage > 1;
  const canGoNextAudit = auditCurrentPage < auditTotalPages;

  const filteredStaffUsers = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) {
      return staffUsers;
    }

    return staffUsers.filter((item) =>
      [item.name, item.email || "", item.employeeId || "", roleLabelMap[item.role]].join(" ").toLowerCase().includes(normalized)
    );
  }, [searchQuery, staffUsers]);

  const activeStudentsCount = useMemo(
    () => students.filter((student) => student.status === "active").length,
    [students]
  );

  const abnormalEventsCount = useMemo(
    () => auditLogs.filter((log) => getAuditStatus(log) === "Failed").length,
    [auditLogs]
  );

  const quickStats = useMemo(
    () => [
      {
        title: "นักศึกษาทั้งหมด",
        value: students.length.toLocaleString(),
        icon: Users,
        tone: "blue" as const,
      },
      {
        title: "บัญชีผู้ใช้งานที่เปิดใช้",
        value: (activeStudentsCount + staffUsers.length).toLocaleString(),
        icon: Activity,
        tone: "emerald" as const,
      },
      {
        title: "เหตุการณ์ผิดปกติในบันทึกระบบ",
        value: abnormalEventsCount.toLocaleString(),
        icon: ShieldAlert,
        tone: "rose" as const,
      },
      {
        title: "สถานะระบบ",
        value: systemOnline ? "พร้อมใช้งาน" : "ไม่พร้อมใช้งาน",
        icon: Server,
        tone: "slate" as const,
      },
    ],
    [abnormalEventsCount, activeStudentsCount, staffUsers.length, students.length, systemOnline]
  );

  const latestAuditLogs = filteredAuditLogs.slice(0, 4);
  const staffPreview = filteredStaffUsers.slice(0, 4);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <span className="loader h-7 w-7 text-blue-600"></span>
      </main>
    );
  }

  if (!user || user.role !== "ADMIN") {
    return null;
  }

  return (
    <AdminShell
      activeNav={activeView}
      headerSearch={{
        value: searchQuery,
        onChange: setSearchQuery,
        placeholder:
          activeView === "audit"
            ? "ค้นหา Log, ผู้ใช้งาน, หรือ IP..."
            : "ค้นหา Log, ผู้ใช้งาน, หรือรหัสประจำตัว...",
      }}
      onLogout={handleLogout}
      title="แดชบอร์ดผู้ดูแลระบบ"
      userName={user.name}
      userRoleLabel="ผู้ดูแลระบบ (System Admin)"
    >
      {serverError && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{serverError}</div>
      )}

      {loadingData ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500 shadow-sm">
            <span className="loader h-5 w-5 text-blue-600"></span>
            กำลังโหลดข้อมูลแดชบอร์ด...
          </div>
        </div>
      ) : (
        <>
          {activeView === "dashboard" && (
            <DashboardView
              activeStudentsCount={activeStudentsCount}
              formatThaiDateTime={formatThaiDateTime}
              getAuditActionLabel={getAuditActionLabel}
              getAuditActorName={getAuditActorName}
              getAuditStatus={getAuditStatus}
              getAuditStatusLabel={getAuditStatusLabel}
              getAuditTargetLabel={getAuditTargetLabel}
              latestAuditLogs={latestAuditLogs}
              quickStats={quickStats}
              roleBadgeMap={roleBadgeMap}
              roleLabelMap={roleLabelMap}
              staffCount={staffUsers.length}
              staffPreview={staffPreview}
              systemOnline={systemOnline}
            />
          )}
          {activeView === "audit" && (
            <AuditLogView
              auditCurrentPage={auditCurrentPage}
              auditEndItemIndex={auditEndItemIndex}
              auditStartItemIndex={auditStartItemIndex}
              canGoNextAudit={canGoNextAudit}
              canGoPrevAudit={canGoPrevAudit}
              filteredAuditLogs={filteredAuditLogs}
              formatThaiDate={formatThaiDate}
              formatThaiTime={formatThaiTime}
              getAuditActionLabel={getAuditActionLabel}
              getAuditActorName={getAuditActorName}
              getAuditStatus={getAuditStatus}
              getAuditStatusLabel={getAuditStatusLabel}
              getAuditTargetLabel={getAuditTargetLabel}
              getNormalizedAuditAction={getNormalizedAuditAction}
              getResolvedAuditActionDetail={getResolvedAuditActionDetail}
              onExport={() => exportAuditLogsCsv(filteredAuditLogs)}
              onNextPage={() => setAuditCurrentPage((prev) => Math.min(auditTotalPages, prev + 1))}
              onPrevPage={() => setAuditCurrentPage((prev) => Math.max(1, prev - 1))}
              onSearchQueryChange={setSearchQuery}
              paginatedAuditLogs={paginatedAuditLogs}
              roleLabelMap={roleLabelMap}
              searchQuery={searchQuery}
            />
          )}
          {activeView === "reports" && (
            <ReportsView
              error={reportsError}
              loading={reportsLoading}
              onOpenAudit={() => router.push("/admin?view=audit")}
              onRefresh={() => void loadReportsSummary()}
              summary={reportsSummary}
            />
          )}
          {activeView === "settings" && <SettingsView />}
        </>
      )}
    </AdminShell>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-100">
          <span className="loader h-7 w-7 text-blue-600"></span>
        </main>
      }
    >
      <AdminDashboardContent />
    </Suspense>
  );
}

