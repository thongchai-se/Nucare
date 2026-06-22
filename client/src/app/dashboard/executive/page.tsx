"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  ChevronRight,
  Clock,
  Download,
  FileText,
  LayoutDashboard,
  Lock,
  Menu,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth.context";
import { AppBrand } from "@/components/app-brand";
import { ExecutiveCommonIssues } from "@/components/executive/executive-common-issues";
import { ExecutiveDistressHeatmap } from "@/components/executive/executive-distress-heatmap";
import { ExecutivePageToolbar } from "@/components/executive/executive-page-toolbar";
import { ExecutiveScreeningComparison } from "@/components/executive/executive-screening-comparison";
import { ExecutiveSectionShell } from "@/components/executive/executive-section-shell";
import { ExecutiveStatCard } from "@/components/executive/executive-stat-card";
import { StaffSidebarFooter } from "@/components/staff-sidebar-footer";
import { StaffSidebarMobileProfile } from "@/components/staff-sidebar-mobile-profile";
import { StaffSidebarNavButton, StaffSidebarNavLink } from "@/components/staff-sidebar-nav-item";
import { StaffSidebarSection } from "@/components/staff-sidebar-section";
import { ChangePasswordForm } from "@/components/change-password-form";
import api from "@/lib/axios";
import { downloadCsv, pushCsvSection, pushKeyValueRows } from "@/lib/csv-export";
import { EXECUTIVE_HERO_CLASS, EXECUTIVE_SECTION_CLASS, EXECUTIVE_STAT_LABEL_CLASS } from "@/lib/executive-ui";
import { ghq28DistressMeta, ghq28DistressOrder } from "@/lib/ghq28-distress";
import {
  STAFF_SIDEBAR_ASIDE,
  STAFF_SIDEBAR_HEADER,
  STAFF_SIDEBAR_MOBILE_HEADER,
  STAFF_SIDEBAR_MOBILE_NAV_SCROLL,
  STAFF_SIDEBAR_NAV_SCROLL,
} from "@/lib/ui-classes";
import { stripKnownNamePrefix } from "@/lib/name-prefix";
import { getRoleHomePath, hasRole } from "@/lib/roles";
import type {
  ExecutiveDashboardResponse,
  ExecutiveYearFilter,
  StudyYearBucket,
  TrendItem,
} from "@/types/executive";

type ActiveView = "dashboard" | "reports" | "departments" | "trends" | "change-password";

const isExecutiveView = (value: string | null): value is ActiveView =>
  value === "dashboard" ||
  value === "reports" ||
  value === "departments" ||
  value === "trends" ||
  value === "change-password";

const createEmptyBucket = (studyYear: number | null, label: string): StudyYearBucket => ({
  studyYear,
  label,
  totalStudents: 0,
  screenedCount: 0,
  screenedPercent: 0,
  distressCounts: { NORMAL: 0, MILD: 0, MODERATE: 0, SEVERE: 0, unscreened: 0 },
  riskCounts: { NORMAL: 0, MEDIUM: 0, HIGH: 0, unscreened: 0 },
  highRiskPercent: 0,
  avgGhq28Score: null,
  commonIssues: [],
  trends: [],
  sections: [],
});

const getActiveBucket = (
  dashboard: ExecutiveDashboardResponse,
  yearFilter: ExecutiveYearFilter
): StudyYearBucket => {
  if (yearFilter === "ALL") {
    return dashboard.overall;
  }

  const studyYear = Number(yearFilter);
  return (
    dashboard.byStudyYear.find((bucket) => bucket.studyYear === studyYear) ??
    createEmptyBucket(studyYear, `ชั้นปีที่ ${studyYear}`)
  );
};

const getHeatmapRows = (
  dashboard: ExecutiveDashboardResponse,
  yearFilter: ExecutiveYearFilter
): StudyYearBucket[] => {
  if (yearFilter !== "ALL") {
    const studyYear = Number(yearFilter);
    const bucket = dashboard.byStudyYear.find((row) => row.studyYear === studyYear);
    return bucket ? [bucket] : [createEmptyBucket(studyYear, `ชั้นปีที่ ${studyYear}`)];
  }

  return dashboard.byStudyYear.filter((row) => row.totalStudents > 0);
};

const getHighestWatchRowIndex = (rows: StudyYearBucket[]): number => {
  let bestIndex = -1;
  let bestScore = -1;

  rows.forEach((row, index) => {
    const score = row.distressCounts.SEVERE * 3 + row.distressCounts.MODERATE * 2 + row.distressCounts.MILD;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestScore > 0 ? bestIndex : -1;
};

const formatGeneratedAt = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatHours = (hours: number | null): string => {
  if (hours === null || hours <= 0) {
    return "—";
  }

  if (hours < 1) {
    return `${Math.round(hours * 60)} นาที`;
  }

  return `${hours.toLocaleString()} ชม.`;
};

const exportExecutiveCsv = (dashboard: ExecutiveDashboardResponse, yearFilter: ExecutiveYearFilter) => {
  const bucket = getActiveBucket(dashboard, yearFilter);
  const { operations } = dashboard;
  const rows: unknown[][] = [];

  rows.push(["Summary"]);
  rows.push(["รายการ", "ค่า"]);
  pushKeyValueRows(rows, [
    ["วันที่ export", new Date().toISOString().slice(0, 10)],
    ["อัปเดตล่าสุด", formatGeneratedAt(dashboard.generatedAt)],
    ["แบบประเมินหลัก", dashboard.activeSurvey?.title ?? "ไม่มี"],
    ["ช่วงข้อมูล", bucket.label],
    ["นักศึกษาทั้งหมด", bucket.totalStudents],
    ["ประเมินแล้ว", bucket.screenedCount],
    ["อัตราประเมิน (%)", bucket.screenedPercent],
    ["กลุ่มเสี่ยงสูง (%)", bucket.highRiskPercent],
    ["คะแนน GHQ-28 เฉลี่ย", bucket.avgGhq28Score === null ? "-" : bucket.avgGhq28Score],
    ["ความทุกข์: ปกติ", bucket.distressCounts.NORMAL],
    ["ความทุกข์: ระดับน้อย", bucket.distressCounts.MILD],
    ["ความทุกข์: ระดับปานกลาง", bucket.distressCounts.MODERATE],
    ["ความทุกข์: ระดับรุนแรง", bucket.distressCounts.SEVERE],
    ["ความทุกข์: ยังไม่ประเมิน", bucket.distressCounts.unscreened],
    ["ความเสี่ยง: ปกติ", bucket.riskCounts.NORMAL],
    ["ความเสี่ยง: ปานกลาง", bucket.riskCounts.MEDIUM],
    ["ความเสี่ยง: สูง", bucket.riskCounts.HIGH],
    ["ความเสี่ยง: ยังไม่ประเมิน", bucket.riskCounts.unscreened],
    ["Referral ค้าง", operations.openReferrals],
    ["SOS ค้าง", operations.openSos],
    ["อัตราปิดเคส (%)", operations.caseClosureRate === null ? "-" : operations.caseClosureRate],
    ["เวลาตอบ consultation เฉลี่ย", formatHours(operations.avgConsultationResponseHours)],
  ]);

  bucket.commonIssues.forEach((issue) => {
    rows.push([`ปัญหา: ${issue.label}`, `${issue.count} (${issue.percent}%)`]);
  });

  if (yearFilter === "ALL") {
    pushCsvSection(
      rows,
      "ByStudyYear",
      [
        "ชั้นปี",
        "นักศึกษาทั้งหมด",
        "ประเมินแล้ว",
        "อัตราประเมิน (%)",
        "เสี่ยงสูง (%)",
        "คะแนน GHQ-28 เฉลี่ย",
        "ปกติ",
        "น้อย",
        "ปานกลาง",
        "รุนแรง",
        "ยังไม่ประเมิน",
      ],
      dashboard.byStudyYear
        .filter((row) => row.totalStudents > 0)
        .map((row) => [
          row.label,
          row.totalStudents,
          row.screenedCount,
          row.screenedPercent,
          row.highRiskPercent,
          row.avgGhq28Score === null ? "-" : row.avgGhq28Score,
          row.distressCounts.NORMAL,
          row.distressCounts.MILD,
          row.distressCounts.MODERATE,
          row.distressCounts.SEVERE,
          row.distressCounts.unscreened,
        ])
    );
  }

  if (bucket.sections.length > 0) {
    pushCsvSection(
      rows,
      "BySection",
      ["Section", "นักศึกษาทั้งหมด", "อัตราประเมิน (%)", "เสี่ยงสูง (%)"],
      bucket.sections.map((section) => [
        section.section,
        section.totalStudents,
        section.screenedPercent,
        section.highRiskPercent,
      ])
    );
  }

  if (bucket.trends.length > 0) {
    pushCsvSection(
      rows,
      "Trends",
      ["เดือน", "ชื่อเดือน", "ประเมินแล้ว", "เสี่ยงสูง", "Referral", "SOS"],
      bucket.trends.map((trend) => [
        trend.month,
        trend.label,
        trend.screened,
        trend.highRisk,
        trend.referrals,
        trend.sos,
      ])
    );
  }

  downloadCsv(`executive-summary-${yearFilter.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
};

const getInitials = (name: string, fallback = "ผบ"): string => {
  const parts = stripKnownNamePrefix(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return fallback;
  }

  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? "";
  return `${first}${second}`;
};

const getTrendMaxValue = (trends: TrendItem[]): number =>
  Math.max(...trends.flatMap((item) => [item.screened, item.highRisk, item.referrals, item.sos]), 1);

const exportButtonClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:w-auto";

const exportButtonPrimaryClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700 sm:w-auto";

function ExecutiveDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [yearFilter, setYearFilter] = useState<ExecutiveYearFilter>("ALL");
  const [dashboard, setDashboard] = useState<ExecutiveDashboardResponse | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError(null);

    try {
      const response = await api.get<ExecutiveDashboardResponse>("/api/executive/dashboard");
      setDashboard(response.data);
    } catch {
      setDashboardError("ไม่สามารถโหลดข้อมูลแดชบอร์ดได้ กรุณาลองใหม่อีกครั้ง");
      setDashboard(null);
    } finally {
      setDashboardLoading(false);
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

    if (!hasRole(user, "EXECUTIVE")) {
      router.replace(getRoleHomePath(user.role));
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!loading && user && hasRole(user, "EXECUTIVE")) {
      void fetchDashboard();
    }
  }, [fetchDashboard, loading, user]);

  const isExecutive = useMemo(() => hasRole(user, "EXECUTIVE"), [user]);

  const executiveProfile = useMemo(
    () => ({
      name: user?.name || "ผู้บริหาร",
      role: "คณบดี / คณะผู้บริหาร",
      initials: getInitials(user?.name || ""),
    }),
    [user?.name]
  );

  const requestedView = searchParams.get("view");
  const activeView: ActiveView = isExecutiveView(requestedView) ? requestedView : "dashboard";

  const activeBucket = useMemo(
    () => (dashboard ? getActiveBucket(dashboard, yearFilter) : null),
    [dashboard, yearFilter]
  );

  const heatmapRows = useMemo(
    () => (dashboard ? getHeatmapRows(dashboard, yearFilter) : []),
    [dashboard, yearFilter]
  );

  const highestWatchIndex = useMemo(() => getHighestWatchRowIndex(heatmapRows), [heatmapRows]);

  const currentViewLabel =
    activeView === "dashboard"
      ? "แดชบอร์ดภาพรวม"
      : activeView === "reports"
        ? "รายงานเชิงลึก"
        : activeView === "departments"
          ? "สถิติรายกลุ่ม/Section"
          : "แนวโน้มรายปี";
  const resolvedViewLabel = activeView === "change-password" ? "เปลี่ยนรหัสผ่าน" : currentViewLabel;

  const navigateTo = (view: ActiveView) => {
    setIsMobileMenuOpen(false);
    router.replace(view === "dashboard" ? "/dashboard/executive" : `/dashboard/executive?view=${view}`);
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <span className="loader h-7 w-7 text-blue-600"></span>
      </main>
    );
  }

  if (!user || !isExecutive) {
    return null;
  }

  const NavSections = () => (
    <>
      <StaffSidebarSection title="เมนูหลัก">
        <StaffSidebarNavButton active={activeView === "dashboard"} icon={<LayoutDashboard size={20} />} label="แดชบอร์ดภาพรวม" onClick={() => navigateTo("dashboard")} />
        <StaffSidebarNavButton active={activeView === "reports"} icon={<FileText size={20} />} label="รายงานเชิงลึก" onClick={() => navigateTo("reports")} />
        <StaffSidebarNavButton active={activeView === "departments"} icon={<Building2 size={20} />} label="สถิติรายกลุ่ม/Section" onClick={() => navigateTo("departments")} />
        <StaffSidebarNavButton active={activeView === "trends"} icon={<TrendingUp size={20} />} label="แนวโน้มรายปี" onClick={() => navigateTo("trends")} />
      </StaffSidebarSection>

      <StaffSidebarSection title="ระบบและความปลอดภัย">
        <StaffSidebarNavLink
          href="/dashboard/executive?view=change-password"
          icon={<Lock size={20} />}
          isActive={activeView === "change-password"}
          label="เปลี่ยนรหัสผ่าน"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      </StaffSidebarSection>
    </>
  );

  const DataState = ({ children }: { children: React.ReactNode }) => {
    if (dashboardLoading) {
      return (
        <div className="flex min-h-[320px] items-center justify-center rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <span className="loader h-7 w-7 text-blue-600"></span>
        </div>
      );
    }

    if (dashboardError) {
      return (
        <div className="rounded-[2rem] border border-red-100 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-700">{dashboardError}</p>
          <button
            type="button"
            onClick={() => void fetchDashboard()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white"
          >
            <RefreshCw size={16} /> ลองใหม่
          </button>
        </div>
      );
    }

    if (!dashboard || !activeBucket) {
      return null;
    }

    return <>{children}</>;
  };

  const renderExportButton = (primary = false) =>
    dashboard ? (
      <button
        type="button"
        onClick={() => exportExecutiveCsv(dashboard, yearFilter)}
        className={primary ? exportButtonPrimaryClass : exportButtonClass}
      >
        <Download size={16} /> {primary ? "ดาวน์โหลด CSV" : "ส่งออก CSV"}
      </button>
    ) : null;

  const DashboardView = () => (
    <DataState>
      {dashboard && activeBucket ? (
        <div className="space-y-6">
          <section className={EXECUTIVE_HERO_CLASS}>
            <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_40%),linear-gradient(135deg,#eff6ff_0%,#ffffff_50%,#f0f9ff_100%)] px-5 py-6 sm:px-7 sm:py-8">
              <div className="absolute -right-8 -top-8 rounded-full bg-blue-100/70 p-8 text-blue-200">
                <BarChart3 className="h-24 w-24" />
              </div>
              <div className="relative max-w-3xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  PDPA Anonymized — สถิติภาพรวมไม่ระบุตัวตน
                </div>
                <h2 className="text-xl font-black leading-tight text-slate-900 sm:text-2xl">
                  รายงานสรุปสุขภาวะนักศึกษา
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-[15px]">
                  {dashboard.activeSurvey
                    ? `แบบประเมินหลัก: ${dashboard.activeSurvey.title}`
                    : "ยังไม่มีแบบสอบถามที่เปิดใช้งาน"}{" "}
                  • อัปเดต {formatGeneratedAt(dashboard.generatedAt)}
                </p>
              </div>
            </div>
          </section>

          <ExecutivePageToolbar
            title="Executive Summary"
            subtitle="เลือกชั้นปีเพื่อดูภาพรวมทั้งคณะหรือแยกรายชั้นปี"
            bucketLabel={activeBucket.label}
            yearFilter={yearFilter}
            onYearFilterChange={setYearFilter}
            actions={renderExportButton()}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ExecutiveStatCard
              label="Students"
              value={activeBucket.totalStudents.toLocaleString()}
              description={`นักศึกษา (${activeBucket.label})`}
              icon={<Users size={20} />}
              iconClassName="border-blue-100 bg-blue-50 text-blue-600"
              badge={
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    activeBucket.screenedPercent > 0
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  ประเมินแล้ว {activeBucket.screenedPercent}%
                </span>
              }
            />
            <ExecutiveStatCard
              label="Case Closure"
              value={
                dashboard.operations.caseClosureRate === null
                  ? "—"
                  : `${dashboard.operations.caseClosureRate}%`
              }
              description="อัตราปิดเคส (Referral/Consult/SOS)"
              footnote="ใช้แทนอัตราการดีขึ้นหลังรับการดูแล"
              icon={<Target size={20} />}
              iconClassName="border-indigo-100 bg-indigo-50 text-indigo-600"
            />
            <ExecutiveStatCard
              label="Response Time"
              value={formatHours(dashboard.operations.avgConsultationResponseHours)}
              description="เวลาตอบรับคำขอปรึกษาเฉลี่ย"
              footnote={
                dashboard.operations.avgConsultationResponseHours === null ||
                dashboard.operations.avgConsultationResponseHours <= 0
                  ? "ยังไม่มีข้อมูลเพียงพอ"
                  : undefined
              }
              icon={<Clock size={20} />}
              iconClassName="border-amber-100 bg-amber-50 text-amber-600"
            />
            <ExecutiveStatCard
              label="High Risk"
              value={`${activeBucket.highRiskPercent}%`}
              description="สัดส่วนกลุ่มเสี่ยงสูง"
              icon={<Activity size={20} />}
              iconClassName="border-red-100 bg-red-50 text-red-600"
              valueClassName={activeBucket.highRiskPercent > 0 ? "text-red-600" : "text-slate-900"}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ExecutiveDistressHeatmap
              rows={heatmapRows}
              yearFilter={yearFilter}
              highestWatchIndex={highestWatchIndex}
            />
            <ExecutiveCommonIssues issues={activeBucket.commonIssues} bucketLabel={activeBucket.label} />
          </div>
        </div>
      ) : null}
    </DataState>
  );

  const ReportsView = () => (
    <DataState>
      {dashboard && activeBucket ? (
        <div className="space-y-6">
          <ExecutivePageToolbar
            title="รายงานเชิงลึก"
            subtitle="ดาวน์โหลดสรุปสถิติสำหรับการประชุมผู้บริหาร (ไม่มีรายชื่อนักศึกษา)"
            bucketLabel={activeBucket.label}
            yearFilter={yearFilter}
            onYearFilterChange={setYearFilter}
            actions={renderExportButton(true)}
          />

          <ExecutiveSectionShell title={`สรุปข้อมูล ${activeBucket.label}`}>
            <p className="-mt-2 mb-6 text-sm text-slate-500">
              นักศึกษา {activeBucket.totalStudents.toLocaleString()} คน • ประเมินแล้ว{" "}
              {activeBucket.screenedPercent}% • เสี่ยงสูง {activeBucket.highRiskPercent}%
            </p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {ghq28DistressOrder.map((level) => (
                <div key={level} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className={`text-xs font-bold ${ghq28DistressMeta[level].textClassName}`}>
                    {ghq28DistressMeta[level].label}
                  </p>
                  <p className="mt-2 text-2xl font-black text-slate-800">
                    {activeBucket.distressCounts[level].toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-6 text-xs leading-5 text-slate-500">
              รายงาน PDF จะพร้อมในรอบถัดไป — ขณะนี้สามารถส่งออก CSV สรุปได้จากปุ่มด้านบน
            </p>
          </ExecutiveSectionShell>

          <ExecutiveScreeningComparison yearFilter={yearFilter} />
        </div>
      ) : null}
    </DataState>
  );

  const DepartmentsView = () => (
    <DataState>
      {dashboard && activeBucket ? (
        <div className="space-y-6">
          <ExecutivePageToolbar
            title="สถิติรายกลุ่ม/Section"
            subtitle="เปรียบเทียบสัดส่วนการประเมินและความเสี่ยงสูงตามกลุ่มเรียน"
            bucketLabel={activeBucket.label}
            yearFilter={yearFilter}
            onYearFilterChange={setYearFilter}
          />

          {activeBucket.sections.length === 0 ? (
            <div className={`${EXECUTIVE_SECTION_CLASS} text-center`}>
              <Building2 className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm font-bold text-slate-600">ยังไม่มีข้อมูล Section ในช่วงที่เลือก</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {activeBucket.sections.map((section) => (
                <div
                  key={section.section}
                  className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                >
                  <div className="absolute -right-4 -top-4 h-24 w-24 rounded-bl-full bg-blue-50 opacity-50" />
                  <div className="relative z-10">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600">
                      <Building2 size={24} />
                    </div>
                    <h3 className="text-lg font-black leading-tight text-slate-800">Section {section.section}</h3>
                    <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                      <Users size={16} /> {section.totalStudents.toLocaleString()} นักศึกษา
                    </p>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <p className={EXECUTIVE_STAT_LABEL_CLASS}>Screened</p>
                        <p className="mt-2 text-2xl font-black text-slate-800">{section.screenedPercent}%</p>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <p className={EXECUTIVE_STAT_LABEL_CLASS}>High Risk</p>
                        <p
                          className={`mt-2 text-2xl font-black ${
                            section.highRiskPercent > 20
                              ? "text-red-600"
                              : section.highRiskPercent > 10
                                ? "text-amber-600"
                                : section.highRiskPercent > 0
                                  ? "text-emerald-600"
                                  : "text-slate-800"
                          }`}
                        >
                          {section.highRiskPercent}%
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </DataState>
  );

  const TrendsView = () => (
    <DataState>
      {dashboard && activeBucket ? (
        <div className="space-y-6">
          <ExecutivePageToolbar
            title="แนวโน้มรายเดือน"
            subtitle="วิเคราะห์แนวโน้มการประเมินและเคสวิกฤตย้อนหลัง 6 เดือน"
            bucketLabel={activeBucket.label}
            yearFilter={yearFilter}
            onYearFilterChange={setYearFilter}
          />

          <ExecutiveSectionShell
            icon={<TrendingUp className="text-indigo-600" size={20} />}
            title="กราฟแนวโน้ม"
            subtitle="แสดงจำนวนการประเมินและกลุ่มเสี่ยงสูงรายเดือน"
          >
            <div className="mb-6 flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-blue-400" />
                <span className="text-xs font-medium text-slate-600">ประเมิน</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span className="text-xs font-medium text-slate-600">เสี่ยงสูง</span>
              </div>
            </div>

            {(() => {
              const trends = activeBucket.trends;
              const maxVal = getTrendMaxValue(trends);
              const hasTrendData = trends.some(
                (item) => item.screened > 0 || item.highRisk > 0 || item.referrals > 0 || item.sos > 0
              );

              if (!hasTrendData) {
                return (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
                    <TrendingUp className="mb-3 h-10 w-10 text-slate-300" />
                    <p className="text-sm font-bold text-slate-600">ยังไม่มีแนวโน้มในช่วง 6 เดือนที่เลือก</p>
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto pb-2">
                  <div className="relative flex h-64 min-w-[560px] items-end justify-between gap-3 border-b border-slate-200 px-1 sm:min-w-0 sm:gap-6">
                    {trends.map((data) => {
                      const screenedHeight = `${(data.screened / maxVal) * 100}%`;
                      const highRiskHeight = `${(data.highRisk / maxVal) * 100}%`;

                      return (
                        <div key={data.month} className="group relative z-10 flex min-w-[72px] flex-1 flex-col items-center gap-2">
                          <div className="pointer-events-none absolute -top-16 z-20 whitespace-nowrap rounded-lg bg-slate-800 p-2 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                            ประเมิน: {data.screened}
                            <br />
                            เสี่ยงสูง: {data.highRisk}
                            <br />
                            Referral: {data.referrals} • SOS: {data.sos}
                          </div>

                          <div className="flex h-full w-full items-end justify-center gap-1.5 sm:gap-2">
                            <div
                              style={{ height: screenedHeight }}
                              className="w-4 rounded-t-md bg-blue-400 transition-all duration-700 sm:w-8"
                            />
                            <div
                              style={{ height: highRiskHeight }}
                              className="w-4 rounded-t-md bg-red-500 transition-all duration-700 sm:w-8"
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-600">{data.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-50 p-5">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
                <AlertTriangle size={16} className="text-amber-500" /> ข้อมูลเชิงปฏิบัติการ
              </h4>
              <p className="text-sm leading-relaxed text-slate-600">
                เปิด Referral ค้าง {dashboard.operations.openReferrals.toLocaleString()} รายการ • SOS ค้าง{" "}
                {dashboard.operations.openSos.toLocaleString()} รายการ • ใช้ตัวกรองชั้นปีเพื่อดูภาพรวมหรือแยกรายชั้นปี
              </p>
            </div>
          </ExecutiveSectionShell>
        </div>
      ) : null}
    </DataState>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F7FB] font-sans text-slate-800">
      <aside className={STAFF_SIDEBAR_ASIDE}>
        <div className={STAFF_SIDEBAR_HEADER}>
          <AppBrand subtitle="คณะพยาบาลศาสตร์" size="compact" />
        </div>

        <div className={STAFF_SIDEBAR_NAV_SCROLL}>
          <NavSections />
        </div>

        <StaffSidebarFooter onLogout={handleLogout} />
      </aside>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="flex h-full w-72 flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className={STAFF_SIDEBAR_MOBILE_HEADER}>
              <AppBrand subtitle="คณะพยาบาลศาสตร์" size="compact" />
              <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className={STAFF_SIDEBAR_MOBILE_NAV_SCROLL}>
              <StaffSidebarMobileProfile roleLabel={executiveProfile.role} userName={executiveProfile.name} />
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
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setIsMobileMenuOpen((current) => !current)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
              <Menu size={20} />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <span className="hidden sm:inline">Executive Portal</span>
                <ChevronRight size={14} className="hidden sm:block" />
                <span className="truncate font-bold text-slate-800">{resolvedViewLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 md:flex">
              <ShieldCheck size={14} /> PDPA Anonymized
            </div>
            <div className="hidden h-6 w-px bg-slate-200 md:block" />
            <div className="flex items-center gap-3">
              <button type="button" className="relative rounded-full bg-slate-100 p-2 text-slate-500 transition-colors hover:text-slate-700 md:hidden">
                <Bell size={20} />
              </button>
              <div className="hidden max-w-[12rem] overflow-hidden text-right sm:block">
                <p className="truncate whitespace-nowrap text-sm font-bold leading-none text-slate-800" title={executiveProfile.name}>
                  {executiveProfile.name}
                </p>
                <p className="mt-0.5 truncate whitespace-nowrap text-[10px] text-slate-500" title={executiveProfile.role}>
                  {executiveProfile.role}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-sm font-bold text-white shadow-sm">
                {executiveProfile.initials}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl pb-10">
            {activeView === "dashboard" && <DashboardView />}
            {activeView === "reports" && <ReportsView />}
            {activeView === "departments" && <DepartmentsView />}
            {activeView === "trends" && <TrendsView />}
            {activeView === "change-password" && (
              <div className="mx-auto max-w-3xl">
                <ChangePasswordForm
                  cancelHref="/dashboard/executive"
                  description="อัปเดตรหัสผ่านของบัญชีผู้บริหารได้จากหน้านี้โดยตรง"
                  onSuccessRedirect="/dashboard/executive"
                  title="เปลี่ยนรหัสผ่าน"
                  tone="portal"
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function ExecutiveDashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-100">
          <span className="loader h-7 w-7 text-blue-600"></span>
        </main>
      }
    >
      <ExecutiveDashboardContent />
    </Suspense>
  );
}
