"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Building2,
  ChevronRight,
  Clock,
  FileText,
  LayoutDashboard,
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
import { ExecutiveQuietExport } from "@/components/executive/executive-quiet-export";
import { ExecutiveStudentLookup } from "@/components/executive/executive-student-lookup";
import { StaffSidebarFooter } from "@/components/staff-sidebar-footer";
import { StaffSidebarNavButton } from "@/components/staff-sidebar-nav-item";
import { StaffSidebarSection } from "@/components/staff-sidebar-section";
import { ListPaginationFooter } from "@/components/ui/list-pagination-footer";
import { PageHeader } from "@/components/ui/page-header";
import { useListPagination } from "@/hooks/use-list-pagination";
import api from "@/lib/axios";
import { downloadCsv, pushCsvSection, pushKeyValueRows } from "@/lib/csv-export";
import { EXECUTIVE_SECTION_CLASS, EXECUTIVE_STAT_LABEL_CLASS } from "@/lib/executive-ui";
import {
  buildExecutivePath,
  parseExecutiveReportsPanel,
  parseExecutiveYearFilter,
  type ExecutiveReportsPanel,
} from "@/lib/executive-year-filter";
import { ghq28DistressMeta, ghq28DistressOrder } from "@/lib/ghq28-distress";
import {
  STAFF_SIDEBAR_ASIDE,
  STAFF_SIDEBAR_HEADER,
  STAFF_SIDEBAR_MOBILE_HEADER,
  STAFF_SIDEBAR_MOBILE_NAV_SCROLL,
  STAFF_SIDEBAR_NAV_SCROLL,
} from "@/lib/ui-classes";
import { getNameInitials } from "@/lib/name-prefix";
import { getRoleHomePath, hasRole } from "@/lib/roles";
import { UNAUTHENTICATED_PATH } from "@/lib/auth-routes";
import type {
  ExecutiveDashboardResponse,
  ExecutiveOperationsStats,
  ExecutiveYearFilter,
  StudyYearBucket,
  TrendItem,
} from "@/types/executive";

type ActiveView = "dashboard" | "reports" | "departments" | "trends" | "students";

const EMPTY_OPERATIONS: ExecutiveOperationsStats = {
  avgConsultationResponseHours: null,
  caseClosureRate: null,
  openReferrals: 0,
  openSos: 0,
};

const isExecutiveView = (value: string | null): value is ActiveView =>
  value === "dashboard" ||
  value === "reports" ||
  value === "departments" ||
  value === "trends" ||
  value === "students";

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
  operations: { ...EMPTY_OPERATIONS },
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
  const operations = bucket.operations ?? dashboard.operations;
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
    ["Referral ค้าง (ตามช่วง)", operations.openReferrals],
    ["SOS ค้าง (ตามช่วง)", operations.openSos],
    ["อัตราปิดเคส (%)", operations.caseClosureRate === null ? "-" : operations.caseClosureRate],
    ["เวลาตอบปรึกษาเฉลี่ย", formatHours(operations.avgConsultationResponseHours)],
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
      ["ตอน", "นักศึกษาทั้งหมด", "อัตราประเมิน (%)", "เสี่ยงสูง (%)"],
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

const getInitials = (name: string, fallback = "ผบ"): string => getNameInitials(name, fallback);

const getTrendMaxValue = (trends: TrendItem[]): number =>
  Math.max(...trends.flatMap((item) => [item.screened, item.highRisk, item.referrals, item.sos]), 1);

function ExecutiveDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [dashboard, setDashboard] = useState<ExecutiveDashboardResponse | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const requestedView = searchParams.get("view");
  const activeView: ActiveView = isExecutiveView(requestedView) ? requestedView : "dashboard";
  const yearFilter = parseExecutiveYearFilter(searchParams.get("year"));
  const reportsPanel = parseExecutiveReportsPanel(searchParams.get("panel"));
  const identityZoneActive =
    activeView === "students" || (activeView === "reports" && reportsPanel !== "summary");

  const setYearFilter = (next: ExecutiveYearFilter) => {
    router.replace(
      buildExecutivePath(activeView, next, activeView === "reports" ? { panel: reportsPanel } : {})
    );
  };

  const setReportsPanel = (panel: ExecutiveReportsPanel) => {
    router.replace(buildExecutivePath("reports", yearFilter, { panel }));
  };

  const dashboardRef = useRef<ExecutiveDashboardResponse | null>(null);
  dashboardRef.current = dashboard;

  const fetchDashboard = useCallback(async (mode: "initial" | "manual" = "initial") => {
    const hasCached = Boolean(dashboardRef.current);
    const showSpinner = mode === "manual" || !hasCached;
    if (showSpinner) {
      setDashboardLoading(true);
    }
    setDashboardError(null);

    try {
      const response = await api.get<ExecutiveDashboardResponse>("/api/executive/dashboard");
      setDashboard(response.data);
    } catch {
      setDashboardError("ไม่สามารถโหลดข้อมูลแดชบอร์ดได้ กรุณาลองใหม่อีกครั้ง");
      if (!hasCached) {
        setDashboard(null);
      }
    } finally {
      if (showSpinner) {
        setDashboardLoading(false);
      }
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

    if (!hasRole(user, "EXECUTIVE")) {
      router.replace(getRoleHomePath(user.role));
    }
  }, [loading, router, user]);

  // ผูกกับ user.id เท่านั้น — กันรีโหลดทั้งหน้าทุกครั้งที่ session poll คืน object ใหม่
  const executiveUserId = user && hasRole(user, "EXECUTIVE") ? user.id : null;
  useEffect(() => {
    if (!loading && executiveUserId) {
      void fetchDashboard("initial");
    }
  }, [executiveUserId, fetchDashboard, loading]);

  const isExecutive = useMemo(() => hasRole(user, "EXECUTIVE"), [user]);

  const executiveProfile = useMemo(
    () => ({
      name: user?.name || "ผู้บริหาร",
      role: "ผู้บริหาร",
      initials: getInitials(user?.name || ""),
    }),
    [user?.name]
  );

  const activeBucket = useMemo(
    () => (dashboard ? getActiveBucket(dashboard, yearFilter) : null),
    [dashboard, yearFilter]
  );

  const heatmapRows = useMemo(
    () => (dashboard ? getHeatmapRows(dashboard, yearFilter) : []),
    [dashboard, yearFilter]
  );

  const highestWatchIndex = useMemo(() => getHighestWatchRowIndex(heatmapRows), [heatmapRows]);
  const activeOperations = activeBucket?.operations ?? dashboard?.operations ?? EMPTY_OPERATIONS;
  const departmentSections = activeBucket?.sections ?? [];
  const departmentPagination = useListPagination(
    departmentSections,
    `${yearFilter}:${departmentSections.length}`,
    { fixedRowsPerPage: 9 }
  );

  const currentViewLabel =
    activeView === "dashboard"
      ? "แดชบอร์ดภาพรวม"
      : activeView === "reports"
        ? "รายงานเชิงลึก"
        : activeView === "departments"
          ? "สถิติรายกลุ่ม/ตอน"
          : activeView === "trends"
            ? "แนวโน้มรายเดือน"
            : "รายชื่อนิสิต";
  const resolvedViewLabel = currentViewLabel;

  const runSummaryExport = () => {
    if (dashboard) {
      exportExecutiveCsv(dashboard, yearFilter);
    }
  };

  const navigateTo = (view: ActiveView) => {
    setIsMobileMenuOpen(false);
    router.replace(
      buildExecutivePath(view, yearFilter, view === "reports" ? { panel: reportsPanel } : {})
    );
  };

  const handleLogout = async () => {
    await logout();
    router.replace(UNAUTHENTICATED_PATH);
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
        <StaffSidebarNavButton active={activeView === "students"} icon={<Users size={20} />} label="รายชื่อนิสิต" onClick={() => navigateTo("students")} />
        <StaffSidebarNavButton active={activeView === "departments"} icon={<Building2 size={20} />} label="สถิติรายกลุ่ม/ตอน" onClick={() => navigateTo("departments")} />
        <StaffSidebarNavButton active={activeView === "trends"} icon={<TrendingUp size={20} />} label="แนวโน้มรายเดือน" onClick={() => navigateTo("trends")} />
      </StaffSidebarSection>

    </>
  );

  const renderDataState = (children: React.ReactNode) => {
    if (dashboardLoading && !dashboard) {
      return (
        <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
          <span className="loader h-7 w-7 text-blue-600"></span>
        </div>
      );
    }

    if (dashboardError && !dashboard) {
      return (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-700">{dashboardError}</p>
          <button
            type="button"
            onClick={() => void fetchDashboard("manual")}
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

    return (
      <div className="space-y-4">
        {dashboardError ? (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-amber-900">
              อัปเดตล่าสุดไม่สำเร็จ — กำลังแสดงข้อมูลที่โหลดไว้ก่อนหน้า
            </p>
            <button
              type="button"
              onClick={() => void fetchDashboard("manual")}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-900"
            >
              <RefreshCw size={14} /> ลองใหม่
            </button>
          </div>
        ) : null}
        {children}
      </div>
    );
  };

  const renderDashboardView = () =>
    renderDataState(
      dashboard && activeBucket ? (
        <div className="space-y-6">
          <PageHeader
            title="สรุปสำหรับผู้บริหาร"
            description={
              dashboard.activeSurvey
                ? `แบบประเมินหลัก: ${dashboard.activeSurvey.title} • อัปเดต ${formatGeneratedAt(dashboard.generatedAt)} — สถิติภาพรวมไม่ระบุชื่อ`
                : `ยังไม่มีแบบสอบถามที่เปิดใช้งาน • อัปเดต ${formatGeneratedAt(dashboard.generatedAt)} — สถิติภาพรวมไม่ระบุชื่อ`
            }
          />

          <ExecutivePageToolbar
            title="ตัวกรองชั้นปี"
            subtitle="เลือกทั้งคณะหรือแยกรายชั้นปี"
            bucketLabel={activeBucket.label}
            yearFilter={yearFilter}
            onYearFilterChange={setYearFilter}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <ExecutiveStatCard
              label="นักศึกษา"
              value={activeBucket.totalStudents.toLocaleString()}
              description={`นักศึกษา (${activeBucket.label})`}
              icon={<Users size={18} />}
              badge={
                <span
                  className={`rounded-md px-2.5 py-1 text-[10px] font-semibold ${
                    activeBucket.screenedPercent > 0
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  ประเมินแล้ว {activeBucket.screenedPercent}%
                </span>
              }
            />
            <ExecutiveStatCard
              label="อัตราปิดเคส"
              value={
                activeOperations.caseClosureRate === null
                  ? "—"
                  : `${activeOperations.caseClosureRate}%`
              }
              description={`อัตราปิดเคส (${activeBucket.label})`}
              footnote="ส่งต่อ/ปรึกษา/ฉุกเฉินในช่วงที่เลือก — ใช้แทนอัตราการดีขึ้นหลังรับการดูแล"
              icon={<Target size={18} />}
              iconClassName="bg-slate-100 text-slate-600"
            />
            <ExecutiveStatCard
              label="เวลาตอบรับ"
              value={formatHours(activeOperations.avgConsultationResponseHours)}
              description={`เวลาตอบรับปรึกษาเฉลี่ย (${activeBucket.label})`}
              footnote={
                activeOperations.avgConsultationResponseHours === null ||
                activeOperations.avgConsultationResponseHours <= 0
                  ? "ยังไม่มีข้อมูลเพียงพอ"
                  : undefined
              }
              icon={<Clock size={18} />}
              iconClassName="bg-amber-50 text-amber-800"
            />
            <ExecutiveStatCard
              label="ความเสี่ยงสูง"
              value={`${activeBucket.highRiskPercent}%`}
              description="สัดส่วนกลุ่มเสี่ยงสูง"
              icon={<Activity size={18} />}
              iconClassName="bg-red-50 text-red-800"
              valueClassName={activeBucket.highRiskPercent > 0 ? "text-red-700" : "text-slate-950"}
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

          <div className="flex justify-end">
            <ExecutiveQuietExport onClick={runSummaryExport} label="ส่งออกสรุป CSV" />
          </div>
        </div>
      ) : null
    );

  const renderReportsView = () =>
    renderDataState(
      dashboard && activeBucket ? (
        <div className="space-y-6">
          <ExecutivePageToolbar
            title="รายงานเชิงลึก"
            subtitle="สรุปรวมไม่ระบุชื่อ หรือเทียบคะแนนรอบต่อรอบด้วยรหัสนักศึกษา"
            bucketLabel={activeBucket.label}
            yearFilter={yearFilter}
            onYearFilterChange={setYearFilter}
          />

          <div className="flex flex-wrap gap-2" role="tablist" aria-label="ชั้นรายงานเชิงลึก">
            {(
              [
                { id: "summary" as const, label: "สรุปรวม" },
                { id: "comparison" as const, label: "เทียบรอบ (รหัส)" },
              ] as const
            ).map((panel) => {
              const selected = reportsPanel === panel.id;
              return (
                <button
                  key={panel.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setReportsPanel(panel.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selected
                      ? "border-slate-800 bg-slate-800 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {panel.label}
                </button>
              );
            })}
          </div>

          {reportsPanel === "summary" ? (
            <ExecutiveSectionShell
              title={`สรุปข้อมูล ${activeBucket.label}`}
              subtitle={`นักศึกษา ${activeBucket.totalStudents.toLocaleString()} คน • ประเมินแล้ว ${activeBucket.screenedPercent}% • เสี่ยงสูง ${activeBucket.highRiskPercent}% — ไม่แสดงรายชื่อ`}
              action={<ExecutiveQuietExport onClick={runSummaryExport} />}
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                {ghq28DistressOrder.map((level) => (
                  <div key={level} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className={`text-xs font-bold ${ghq28DistressMeta[level].textClassName}`}>
                      {ghq28DistressMeta[level].label}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-800">
                      {activeBucket.distressCounts[level].toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </ExecutiveSectionShell>
          ) : null}

          {reportsPanel === "comparison" ? <ExecutiveScreeningComparison yearFilter={yearFilter} /> : null}
        </div>
      ) : null
    );

  const renderStudentsView = () =>
    renderDataState(
      dashboard && activeBucket ? (
        <div className="space-y-6">
          <ExecutivePageToolbar
            title="รายชื่อนิสิต"
            subtitle="ค้นหาและกรองความเสี่ยงร่วมกับชั้นปีด้านบน"
            bucketLabel={activeBucket.label}
            yearFilter={yearFilter}
            onYearFilterChange={setYearFilter}
          />
          <ExecutiveStudentLookup yearFilter={yearFilter} />
        </div>
      ) : null
    );

  const renderDepartmentsView = () =>
    renderDataState(
      dashboard && activeBucket ? (
        <div className="space-y-6">
          <ExecutivePageToolbar
            title="สถิติรายกลุ่ม/ตอน"
            subtitle="เปรียบเทียบสัดส่วนการประเมินและความเสี่ยงสูงตามกลุ่มเรียน"
            bucketLabel={activeBucket.label}
            yearFilter={yearFilter}
            onYearFilterChange={setYearFilter}
          />

          {departmentSections.length === 0 ? (
            <div className={`${EXECUTIVE_SECTION_CLASS} text-center`}>
              <Building2 className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm font-bold text-slate-600">ยังไม่มีข้อมูลตอนในช่วงที่เลือก</p>
              <p className="mt-2 text-sm text-slate-500">ลองเปลี่ยนชั้นปี หรือกลับไปดูแดชบอร์ดภาพรวม</p>
              <button
                type="button"
                onClick={() => navigateTo("dashboard")}
                className="mt-4 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                ไปแดชบอร์ด
              </button>
            </div>
          ) : (
            <>
              <div className="flex justify-end">
                <ExecutiveQuietExport onClick={runSummaryExport} label="ส่งออก CSV (รวมตอน)" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {departmentPagination.pageItems.map((section) => (
                  <div
                    key={section.section}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                  >
                    <div>
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
                        <Building2 size={24} />
                      </div>
                      <h3 className="text-lg font-semibold leading-tight text-slate-800">ตอน {section.section}</h3>
                      <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                        <Users size={16} /> {section.totalStudents.toLocaleString()} นักศึกษา
                      </p>

                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                          <p className={EXECUTIVE_STAT_LABEL_CLASS}>ประเมินแล้ว</p>
                          <p className="mt-2 text-2xl font-bold text-slate-800">{section.screenedPercent}%</p>
                        </div>
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                          <p className={EXECUTIVE_STAT_LABEL_CLASS}>ความเสี่ยงสูง</p>
                          <p
                            className={`mt-2 text-2xl font-bold ${
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
              {departmentPagination.total > departmentPagination.rowsPerPage ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <ListPaginationFooter
                    total={departmentPagination.total}
                    rangeStart={departmentPagination.rangeStart}
                    rangeEnd={departmentPagination.rangeEnd}
                    currentPage={departmentPagination.currentPage}
                    canGoPrev={departmentPagination.canGoPrev}
                    canGoNext={departmentPagination.canGoNext}
                    onPrev={() => departmentPagination.setCurrentPage((prev) => Math.max(1, prev - 1))}
                    onNext={() => departmentPagination.setCurrentPage((prev) => prev + 1)}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null
    );

  const renderTrendsView = () =>
    renderDataState(
      dashboard && activeBucket ? (
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
            subtitle="จำนวนการประเมิน กลุ่มเสี่ยงสูง Referral และ SOS รายเดือน"
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

              const chartMaxPx = 200;

              return (
                <div className="overflow-x-auto pb-2">
                  <div className="relative flex min-w-[560px] items-end justify-between gap-3 border-b border-slate-200 px-1 pt-2 sm:min-w-0 sm:gap-6">
                    {trends.map((data) => {
                      const screenedPx = data.screened <= 0 ? 0 : Math.max(8, Math.round((data.screened / maxVal) * chartMaxPx));
                      const highRiskPx = data.highRisk <= 0 ? 0 : Math.max(8, Math.round((data.highRisk / maxVal) * chartMaxPx));

                      return (
                        <div
                          key={data.month}
                          className="relative z-10 flex min-w-[72px] flex-1 flex-col items-center justify-end gap-1.5"
                          style={{ height: chartMaxPx + 56 }}
                        >
                          <div className="flex w-full items-end justify-center gap-1.5 sm:gap-2" style={{ height: chartMaxPx }}>
                            <div
                              aria-label={`ประเมิน ${data.screened}`}
                              style={{ height: screenedPx }}
                              className="w-4 rounded-t-md bg-blue-400 transition-[height] duration-500 sm:w-7"
                            />
                            <div
                              aria-label={`เสี่ยงสูง ${data.highRisk}`}
                              style={{ height: highRiskPx }}
                              className="w-4 rounded-t-md bg-red-500 transition-[height] duration-500 sm:w-7"
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-600">{data.label}</span>
                          <span className="text-[10px] tabular-nums text-slate-500">
                            {data.screened}/{data.highRisk}
                          </span>
                          <span className="text-[10px] tabular-nums text-slate-400">
                            ส่งต่อ {data.referrals} · SOS {data.sos}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-50 p-5">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
                <AlertTriangle size={16} className="text-amber-500" /> ข้อมูลเชิงปฏิบัติการ ({activeBucket.label})
              </h4>
              <p className="text-sm leading-relaxed text-slate-600">
                เปิด Referral ค้าง {activeOperations.openReferrals.toLocaleString()} รายการ • SOS ค้าง{" "}
                {activeOperations.openSos.toLocaleString()} รายการ — นับเฉพาะช่วงชั้นปีที่เลือก
              </p>
            </div>
          </ExecutiveSectionShell>
        </div>
      ) : null
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
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setIsMobileMenuOpen((current) => !current)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
              <Menu size={20} />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <span className="hidden sm:inline">พอร์ทัลผู้บริหาร</span>
                <ChevronRight size={14} className="hidden sm:block" />
                <span className="truncate font-bold text-slate-800">{resolvedViewLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => void fetchDashboard("manual")}
              disabled={dashboardLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
              aria-label="รีเฟรชข้อมูล"
            >
              <RefreshCw size={14} className={dashboardLoading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>
            <div
              className={`inline-flex max-w-[9.5rem] items-center gap-1.5 truncate rounded-full border px-2 py-1 text-[10px] font-bold sm:max-w-none sm:gap-2 sm:px-3 sm:text-xs ${
                identityZoneActive
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-emerald-100 bg-emerald-50 text-emerald-700"
              }`}
              title={identityZoneActive ? "โซนข้อมูลระบุตัวตน" : "สถิติภาพรวมไม่ระบุชื่อ"}
            >
              <ShieldCheck size={14} className="shrink-0" />
              <span className="truncate">{identityZoneActive ? "ระบุตัวตน" : "ไม่ระบุชื่อ"}</span>
            </div>
            <div className="hidden h-6 w-px bg-slate-200 sm:block" />
            <div className="flex items-center gap-3">
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

        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl pb-10">
            {activeView === "dashboard" ? renderDashboardView() : null}
            {activeView === "reports" ? renderReportsView() : null}
            {activeView === "students" ? renderStudentsView() : null}
            {activeView === "departments" ? renderDepartmentsView() : null}
            {activeView === "trends" ? renderTrendsView() : null}
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
