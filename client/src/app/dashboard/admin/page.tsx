"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  CheckCircle2,
  Database,
  Download,
  Lock,
  Server,
  ShieldAlert,
  UploadCloud,
  Users,
} from "lucide-react";
import { useAuth } from "@/context/auth.context";
import api from "@/lib/axios";
import { downloadCsv, pushCsvSection, pushKeyValueRows } from "@/lib/csv-export";
import { AdminShell } from "@/components/admin-shell";
import { ChangePasswordForm } from "@/components/change-password-form";
import type { Role } from "@/types/auth";

type AdminRootView = "dashboard" | "audit" | "reports" | "settings" | "change-password";

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

const adminOnlyViewSet = new Set<AdminRootView>(["dashboard", "audit", "reports", "settings", "change-password"]);

const roleRedirects: Partial<Record<Role, string>> = {
  STUDENT_DEVELOPMENT: "/dashboard/student-development",
  ADVISOR: "/dashboard/advisor",
  EXECUTIVE: "/dashboard/executive",
  INSTRUCTOR: "/dashboard/instructor",
  MENTAL_HEALTH: "/dashboard/mental-health",
  STUDENT: "/dashboard/student",
};

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

  return "System";
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

  const activeView = useMemo<AdminRootView>(() => {
    const value = searchParams.get("view");
    return value && adminOnlyViewSet.has(value as AdminRootView) ? (value as AdminRootView) : "dashboard";
  }, [searchParams]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    if (user.role !== "ADMIN") {
      router.replace(roleRedirects[user.role] ?? "/dashboard");
    }
  }, [loading, router, user]);

  useEffect(() => {
    router.prefetch("/dashboard/admin/manage-students");
    router.prefetch("/dashboard/admin/manage-staff");
    router.prefetch("/dashboard/admin/import-students");
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

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
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
        icon: <Users size={20} />,
        className: "border-blue-100 bg-blue-50 text-blue-600",
      },
      {
        title: "บัญชีผู้ใช้งานที่เปิดใช้",
        value: (activeStudentsCount + staffUsers.length).toLocaleString(),
        icon: <Activity size={20} />,
        className: "border-emerald-100 bg-emerald-50 text-emerald-600",
      },
      {
        title: "เหตุการณ์ผิดปกติใน Log",
        value: abnormalEventsCount.toLocaleString(),
        icon: <ShieldAlert size={20} />,
        className: "border-red-100 bg-red-50 text-red-600",
      },
      {
        title: "สถานะระบบ",
        value: systemOnline ? "Online" : "Offline",
        icon: <Server size={20} />,
        className: "border-slate-200 bg-slate-50 text-slate-600",
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

  const DashboardView = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">แดชบอร์ดผู้ดูแลระบบ</h2>
        <p className="mt-1 text-sm text-slate-500">ภาพรวมการทำงานของระบบ Nucare Management System และเครื่องมือดูแลข้อมูลหลัก</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {quickStats.map((stat) => (
          <div key={stat.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl border ${stat.className}`}>{stat.icon}</div>
            <h4 className="mb-1 text-2xl font-black text-slate-800">{stat.value}</h4>
            <p className="text-sm font-bold text-slate-700">{stat.title}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-slate-800">
              <Lock className="h-4 w-4 text-slate-500" /> แจ้งเตือนความปลอดภัยล่าสุด
            </h3>
            <Link href="/dashboard/admin?view=audit" className="text-sm font-bold text-blue-600 hover:text-blue-700">
              ดูทั้งหมด
            </Link>
          </div>
          <div className="space-y-3">
            {latestAuditLogs.length > 0 ? (
              latestAuditLogs.map((log) => {
                const status = getAuditStatus(log);
                return (
                  <div key={log.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">{getAuditActionLabel(log)}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {getAuditActorName(log)} • {getAuditTargetLabel(log)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">{formatThaiDateTime(log.createdAt)}</p>
                    </div>
                    <span
                      className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${
                        status === "Success"
                          ? "bg-emerald-100 text-emerald-700"
                          : status === "Partial"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {getAuditStatusLabel(status)}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                ยังไม่มีข้อมูล audit log
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">บุคลากรในระบบ</h3>
            <Link href="/dashboard/admin/manage-staff" className="text-sm font-bold text-blue-600 hover:text-blue-700">
              ไปหน้าจัดการ
            </Link>
          </div>
          <div className="space-y-3">
            {staffPreview.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-800">{item.name}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{item.employeeId || item.email || "-"}</p>
                </div>
                <span className={`rounded-md px-2.5 py-1 text-[10px] font-bold ${roleBadgeMap[item.role]}`}>
                  {roleLabelMap[item.role]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <UploadCloud size={32} />
          </div>
          <h3 className="mb-2 text-lg font-bold text-slate-800">อัปเดตฐานข้อมูลแบบกลุ่ม</h3>
          <p className="mb-6 max-w-sm text-sm text-slate-500">
            นำเข้าข้อมูลนักศึกษาหรือบุคลากรแบบกลุ่มผ่านไฟล์ CSV พร้อมตรวจสอบก่อนบันทึกเข้าสู่ระบบ
          </p>
          <div className="flex w-full max-w-sm flex-col gap-3">
            <Link
              href="/dashboard/admin/import-students"
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-center font-bold text-white shadow-md transition-colors hover:bg-blue-700"
            >
              นำเข้านักศึกษา
            </Link>
            <Link
              href="/dashboard/admin/import-staff"
              className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-center font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              นำเข้าบุคลากร
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 font-bold text-slate-800">
            <Database className="h-4 w-4 text-slate-500" />
            ระบบพร้อมใช้งาน
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-emerald-700">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-bold">เชื่อมต่อ API ปกติ</p>
                <p className="text-xs">สถานะล่าสุด: {systemOnline ? "System Online" : "System Offline"}</p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
              บัญชีนักศึกษาที่เปิดใช้งานอยู่ตอนนี้ {activeStudentsCount.toLocaleString()} รายการ และบุคลากรในระบบ {staffUsers.length.toLocaleString()} รายการ
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const AuditLogView = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">บันทึกระบบ (Audit Logs)</h2>
          <p className="mt-1 text-sm text-slate-500">ประวัติการใช้งานและการเข้าถึงข้อมูลทั้งหมดเพื่อตรวจสอบย้อนหลัง</p>
        </div>
        <button
          type="button"
          onClick={() => exportAuditLogsCsv(filteredAuditLogs)}
          disabled={filteredAuditLogs.length === 0}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={16} /> ส่งออก Log (.csv)
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 p-4">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="ค้นหาตาม User, IP, หรือกิจกรรม..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-32" />
              <col className="w-36" />
              <col className="w-[18%]" />
              <col className="w-[26%]" />
              <col className="w-[20%]" />
              <col className="w-28" />
              <col className="w-24" />
            </colgroup>
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="p-4 font-bold text-slate-600">Log ID</th>
                <th className="p-4 font-bold text-slate-600">วัน/เวลา</th>
                <th className="p-4 font-bold text-slate-600">ผู้ใช้งาน</th>
                <th className="p-4 font-bold text-slate-600">กิจกรรม</th>
                <th className="p-4 font-bold text-slate-600">เป้าหมาย</th>
                <th className="p-4 font-bold text-slate-600">IP Address</th>
                <th className="p-4 font-bold text-slate-600">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedAuditLogs.map((log) => {
                const status = getAuditStatus(log);
                return (
                  <tr key={log.id} className="transition-colors hover:bg-slate-50">
                    <td className="p-4 align-top">
                      <p className="font-mono text-xs leading-5 text-slate-600 break-all">
                        {log.id}
                      </p>
                    </td>
                    <td className="p-4 align-top text-slate-700">
                      <p className="font-medium">{formatThaiDate(log.createdAt)}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatThaiTime(log.createdAt)}</p>
                    </td>
                    <td className="p-4 align-top text-slate-800">
                      <p className="font-bold break-words">{getAuditActorName(log)}</p>
                      <p className="mt-1 text-xs text-slate-500">{log.actor?.role ? roleLabelMap[log.actor.role] : "ระบบ"}</p>
                    </td>
                    <td className="p-4 align-top text-slate-700">
                      <p className="font-semibold text-slate-800">{getAuditActionLabel(log)}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{getResolvedAuditActionDetail(log)}</p>
                      <p className="mt-1 font-mono text-[11px] leading-5 text-slate-400 break-all">{getNormalizedAuditAction(log)}</p>
                    </td>
                    <td className="p-4 align-top text-slate-600">
                      <p className="font-medium text-slate-700">{getAuditTargetLabel(log)}</p>
                      <p className="mt-1 font-mono text-xs leading-5 text-slate-500 break-all">
                        {log.entityId || "-"}
                      </p>
                    </td>
                    <td className="p-4 align-top">
                      <p className="font-mono text-xs leading-5 text-slate-600 break-all">{log.ipAddress || "-"}</p>
                    </td>
                    <td className="p-4 align-top">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          status === "Success"
                            ? "bg-emerald-100 text-emerald-700"
                            : status === "Partial"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {getAuditStatusLabel(status)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filteredAuditLogs.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-sm text-slate-500">
                    ไม่พบบันทึกที่ตรงกับคำค้นหา
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="text-sm tabular-nums text-slate-500">
            แสดง <span className="font-medium text-slate-800">{filteredAuditLogs.length === 0 ? 0 : auditStartItemIndex + 1}</span>-
            <span className="font-medium text-slate-800">{auditEndItemIndex}</span> จาก
            <span className="font-medium text-slate-800"> {filteredAuditLogs.length}</span> รายการ
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={!canGoPrevAudit}
              onClick={() => setAuditCurrentPage((prev) => Math.max(1, prev - 1))}
              className="min-w-[82px] rounded border border-slate-200 bg-white px-3 py-1 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              ก่อนหน้า
            </button>
            <button type="button" className="min-w-[42px] rounded border border-slate-200 bg-slate-900 px-3 py-1 text-center font-medium tabular-nums text-white">
              {auditCurrentPage}
            </button>
            <button
              type="button"
              disabled={!canGoNextAudit}
              onClick={() => setAuditCurrentPage((prev) => Math.min(auditTotalPages, prev + 1))}
              className="min-w-[82px] rounded border border-slate-200 bg-white px-3 py-1 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              ถัดไป
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const PlaceholderView = ({ description, title }: { description: string; title: string }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
      <h2 className="text-xl font-bold text-slate-800">{title}</h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );

  return (
    <AdminShell
      activeNav={activeView === "change-password" ? "changePassword" : activeView}
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
          {activeView === "dashboard" && <DashboardView />}
          {activeView === "audit" && <AuditLogView />}
          {activeView === "reports" && (
            <PlaceholderView
              title="สถิติและรายงาน"
              description="พื้นที่รายงานเชิงวิเคราะห์และ data export ยังอยู่ระหว่างพัฒนา รอบนี้ผมคงเมนูและโครงใหม่ให้พร้อมต่อยอดก่อน เพื่อไม่กระทบ flow จัดการผู้ใช้และนำเข้าข้อมูลที่ใช้งานอยู่แล้ว"
            />
          )}
          {activeView === "change-password" && (
            <div className="mx-auto max-w-3xl">
              <ChangePasswordForm
                cancelHref="/dashboard/admin?view=settings"
                description="อัปเดตรหัสผ่านของบัญชีผู้ดูแลระบบได้จากหน้านี้โดยตรง"
                onSuccessRedirect="/dashboard/admin?view=settings"
                title="เปลี่ยนรหัสผ่าน"
                tone="admin"
              />
            </div>
          )}
          {activeView === "settings" && (
            <PlaceholderView
              title="ตั้งค่าระบบพื้นฐาน"
              description="พื้นที่กำหนดค่าระบบ แบบประเมิน และการแจ้งเตือน จะต่อยอดจาก shell ใหม่นี้ได้เลยโดยไม่ต้องรื้อเมนูหรือโครงสร้างอีก"
            />
          )}
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

