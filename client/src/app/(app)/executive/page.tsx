"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Building2,
  Clock,
  FileText,
  GitBranch,
  LayoutDashboard,
  MessageCircle,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth.context";
import { AppBrand } from "@/components/app-brand";
import { EphemeralChatPanel } from "@/components/ephemeral-chat/ephemeral-chat-panel";
import { StaffMessagesView } from "@/components/ephemeral-chat/staff-messages-view";
import { ExecutiveCommonIssues } from "@/components/executive/executive-common-issues";
import { ExecutiveDistressHeatmap } from "@/components/executive/executive-distress-heatmap";
import { ExecutivePageToolbar } from "@/components/executive/executive-page-toolbar";
import { ExecutiveScreeningComparison } from "@/components/executive/executive-screening-comparison";
import { ExecutiveScreeningOverviewCharts } from "@/components/executive/executive-screening-overview-charts";
import { ExecutiveSectionShell } from "@/components/executive/executive-section-shell";
import { ExecutiveStatCard } from "@/components/executive/executive-stat-card";
import { ExecutiveQuietExport } from "@/components/executive/executive-quiet-export";
import { ExecutiveReferralCases } from "@/components/executive/executive-referral-cases";
import { ExecutiveStudentLookup } from "@/components/executive/executive-student-lookup";
import { MultiSeriesLineChart } from "@/components/executive/multi-series-line-chart";
import { StaffSidebarFooter } from "@/components/staff-sidebar-footer";
import { StaffSidebarNavButton } from "@/components/staff-sidebar-nav-item";
import { StaffSidebarSection } from "@/components/staff-sidebar-section";
import { StaffTopBar } from "@/components/staff-top-bar";
import { InlineAlert } from "@/components/ui/inline-alert";
import { PageHeader } from "@/components/ui/page-header";
import { useEphemeralChatUnread } from "@/hooks/use-ephemeral-chat-unread";
import api from "@/lib/axios";
import { downloadCsv, pushCsvSection, pushKeyValueRows } from "@/lib/csv-export";
import { EXECUTIVE_STAT_LABEL_CLASS } from "@/lib/executive-ui";
import {
  buildExecutivePath,
  parseExecutiveActiveView,
  parseExecutiveReportsPanel,
  parseExecutiveYearFilter,
  type ExecutiveActiveView,
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
import { getRoleHomePath, hasRole } from "@/lib/roles";
import { UNAUTHENTICATED_PATH } from "@/lib/auth-routes";
import type {
  ExecutiveDashboardResponse,
  ExecutiveOperationsStats,
  ExecutiveYearFilter,
  StudyYearBucket,
} from "@/types/executive";

const EMPTY_OPERATIONS: ExecutiveOperationsStats = {
  avgConsultationResponseHours: null,
  caseClosureRate: null,
  openReferrals: 0,
  openSos: 0,
};

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

function ExecutiveDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [dashboard, setDashboard] = useState<ExecutiveDashboardResponse | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [chatPeerId, setChatPeerId] = useState<string | null>(null);
  const { unreadCount: chatUnreadCount, refreshUnreadCount } = useEphemeralChatUnread(
    Boolean(user && isAuthenticated)
  );

  const activeView: ExecutiveActiveView = parseExecutiveActiveView(searchParams.get("view"));
  const yearFilter = parseExecutiveYearFilter(searchParams.get("year"));
  const reportsPanel = parseExecutiveReportsPanel(searchParams.get("panel"));
  const selectedReferralCaseId = searchParams.get("caseId");

  const selectedStudentId = searchParams.get("studentId");

  const setYearFilter = (next: ExecutiveYearFilter) => {
    router.replace(
      buildExecutivePath(activeView, next, {
        panel: activeView === "reports" ? reportsPanel : undefined,
        caseId: activeView === "referrals" ? selectedReferralCaseId : null,
        studentId: activeView === "students" ? selectedStudentId : null,
      })
    );
  };

  const setReportsPanel = (panel: ExecutiveReportsPanel) => {
    router.replace(buildExecutivePath("reports", yearFilter, { panel }));
  };

  const setSelectedReferralCaseId = (caseId: string | null) => {
    router.replace(buildExecutivePath("referrals", yearFilter, { caseId }));
  };

  const setSelectedStudentId = (studentId: string | null) => {
    router.replace(buildExecutivePath("students", yearFilter, { studentId }));
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

  const runSummaryExport = () => {
    if (dashboard) {
      exportExecutiveCsv(dashboard, yearFilter);
    }
  };

  const navigateTo = (view: ExecutiveActiveView) => {
    setIsMobileMenuOpen(false);
    router.replace(
      buildExecutivePath(view, yearFilter, {
        panel: view === "reports" ? reportsPanel : undefined,
      })
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
      <StaffSidebarSection title="ภาพรวมและการติดตาม">
        <StaffSidebarNavButton
          active={activeView === "dashboard"}
          icon={<LayoutDashboard size={20} />}
          label="ภาพรวม"
          onClick={() => navigateTo("dashboard")}
        />
        <StaffSidebarNavButton
          active={activeView === "referrals"}
          icon={<GitBranch size={20} />}
          label="เคสส่งต่อ"
          onClick={() => navigateTo("referrals")}
        />
        <StaffSidebarNavButton
          active={activeView === "reports"}
          icon={<FileText size={20} />}
          label="รายงานคัดกรอง"
          onClick={() => navigateTo("reports")}
        />
      </StaffSidebarSection>
      <StaffSidebarSection title="ค้นหาและติดต่อ">
        <StaffSidebarNavButton
          active={activeView === "students"}
          icon={<Users size={20} />}
          label="ค้นหานิสิต"
          onClick={() => navigateTo("students")}
        />
        <StaffSidebarNavButton
          active={activeView === "messages"}
          badge={chatUnreadCount || undefined}
          icon={<MessageCircle size={20} />}
          label="ข้อความ"
          onClick={() => navigateTo("messages")}
        />
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
        <InlineAlert className="rounded-2xl p-8">
          <p>{dashboardError}</p>
          <button
            type="button"
            onClick={() => void fetchDashboard("manual")}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white"
          >
            <RefreshCw size={16} /> ลองใหม่
          </button>
        </InlineAlert>
      );
    }

    if (!dashboard || !activeBucket) {
      return null;
    }

    return (
      <div className="space-y-4">
        {dashboardError ? (
          <InlineAlert tone="warning" className="sm:items-center">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p>อัปเดตล่าสุดไม่สำเร็จ — กำลังแสดงข้อมูลที่โหลดไว้ก่อนหน้า</p>
              <button
                type="button"
                onClick={() => void fetchDashboard("manual")}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-900"
              >
                <RefreshCw size={14} /> ลองใหม่
              </button>
            </div>
          </InlineAlert>
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

          <ExecutiveSectionShell
            icon={<TrendingUp className="text-indigo-600" size={20} />}
            title="แนวโน้มรายเดือน"
            subtitle="จำนวนการประเมิน กลุ่มเสี่ยงสูง การส่งต่อ และ SOS ย้อนหลัง 6 เดือน"
            className="w-full"
          >
            {(() => {
              const trends = activeBucket.trends;
              const hasTrendData = trends.some(
                (item) => item.screened > 0 || item.highRisk > 0 || item.referrals > 0 || item.sos > 0
              );

              if (!hasTrendData) {
                return (
                  <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
                    <TrendingUp className="mb-3 h-10 w-10 text-slate-300" />
                    <p className="text-sm font-bold text-slate-600">ยังไม่มีแนวโน้มในช่วง 6 เดือนที่เลือก</p>
                  </div>
                );
              }

              return (
                <MultiSeriesLineChart
                  labels={trends.map((item) => item.label)}
                  series={[
                    {
                      id: "screened",
                      label: "ประเมิน",
                      color: "#60a5fa",
                      values: trends.map((item) => item.screened),
                    },
                    {
                      id: "highRisk",
                      label: "เสี่ยงสูง",
                      color: "#ef4444",
                      values: trends.map((item) => item.highRisk),
                    },
                    {
                      id: "referrals",
                      label: "ส่งต่อ",
                      color: "#d97706",
                      values: trends.map((item) => item.referrals),
                    },
                    {
                      id: "sos",
                      label: "SOS",
                      color: "#7c3aed",
                      values: trends.map((item) => item.sos),
                    },
                  ]}
                  height={420}
                  yLabel="จำนวนรายเดือน"
                />
              );
            })()}

            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <h4 className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-800">
                  <AlertTriangle size={16} className="text-amber-500" /> ข้อมูลเชิงปฏิบัติการ ({activeBucket.label})
                </h4>
                <p className="text-sm leading-relaxed text-slate-600">
                  เปิด Referral ค้าง {activeOperations.openReferrals.toLocaleString()} รายการ • SOS ค้าง{" "}
                  {activeOperations.openSos.toLocaleString()} รายการ
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigateTo("referrals")}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <GitBranch size={14} /> เปิดรายการเคสส่งต่อ
              </button>
            </div>
          </ExecutiveSectionShell>

          <ExecutiveScreeningOverviewCharts yearFilter={yearFilter} />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ExecutiveDistressHeatmap
              rows={heatmapRows}
              yearFilter={yearFilter}
              highestWatchIndex={highestWatchIndex}
            />
            <ExecutiveCommonIssues issues={activeBucket.commonIssues} bucketLabel={activeBucket.label} />
          </div>

          <ExecutiveSectionShell
            icon={<Building2 className="text-blue-700" size={20} />}
            title="สถิติรายเซค"
            subtitle="เปรียบเทียบสัดส่วนการประเมินและความเสี่ยงสูงตามเซค (section)"
            action={<ExecutiveQuietExport onClick={runSummaryExport} label="ส่งออก CSV" />}
          >
            {departmentSections.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-10 text-center">
                <Building2 className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm font-bold text-slate-600">ยังไม่มีข้อมูลเซคในช่วงที่เลือก</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {departmentSections.map((section) => (
                  <div
                    key={section.section}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-5"
                  >
                    <h3 className="text-base font-semibold leading-tight text-slate-800">
                      เซค {section.section}
                    </h3>
                    <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                      <Users size={16} /> {section.totalStudents.toLocaleString()} นักศึกษา
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-white bg-white p-3">
                        <p className={EXECUTIVE_STAT_LABEL_CLASS}>ประเมินแล้ว</p>
                        <p className="mt-1 text-xl font-bold text-slate-800">{section.screenedPercent}%</p>
                      </div>
                      <div className="rounded-xl border border-white bg-white p-3">
                        <p className={EXECUTIVE_STAT_LABEL_CLASS}>ความเสี่ยงสูง</p>
                        <p
                          className={`mt-1 text-xl font-bold ${
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
                ))}
              </div>
            )}
          </ExecutiveSectionShell>
        </div>
      ) : null
    );

  const renderReportsView = () =>
    renderDataState(
      dashboard && activeBucket ? (
        <div className="space-y-6">
          <ExecutivePageToolbar
            title="รายงานคัดกรอง"
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
          {selectedStudentId ? null : (
            <ExecutivePageToolbar
              title="ค้นหานิสิต"
              subtitle="รายชื่อทั้งคณะแบบตาราง · กดดูรายละเอียด · กรองชั้นปีด้านบนได้"
              bucketLabel={activeBucket.label}
              yearFilter={yearFilter}
              onYearFilterChange={setYearFilter}
            />
          )}
          <ExecutiveStudentLookup
            yearFilter={yearFilter}
            onYearFilterChange={setYearFilter}
            selectedStudentId={selectedStudentId}
            onSelectStudent={setSelectedStudentId}
          />
        </div>
      ) : null
    );

  const renderReferralsView = () => (
    <ExecutiveReferralCases
      yearFilter={yearFilter}
      onYearFilterChange={setYearFilter}
      selectedCaseId={selectedReferralCaseId}
      onSelectCase={setSelectedReferralCaseId}
    />
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
        <StaffTopBar onOpenMenu={() => setIsMobileMenuOpen((current) => !current)} />

        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl pb-10">
            {activeView === "dashboard" ? renderDashboardView() : null}
            {activeView === "referrals" ? renderReferralsView() : null}
            {activeView === "reports" ? renderReportsView() : null}
            {activeView === "students" ? renderStudentsView() : null}
            {activeView === "messages" ? (
              <StaffMessagesView
                onOpenChat={(peerUserId) => setChatPeerId(peerUserId)}
                onUnreadCountChange={() => {
                  void refreshUnreadCount();
                }}
              />
            ) : null}
          </div>
        </main>
      </div>

      {user ? (
        <EphemeralChatPanel
          open={Boolean(chatPeerId)}
          currentUserId={user.id}
          peerUserId={chatPeerId}
          onClose={() => {
            setChatPeerId(null);
            void refreshUnreadCount();
          }}
        />
      ) : null}
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
