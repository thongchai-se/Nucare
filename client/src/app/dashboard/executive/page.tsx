"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Filter,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  PieChart,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth.context";
import { AppBrand } from '@/components/app-brand';
import { MenuSectionHeading } from '@/components/menu-section-heading';
import { ChangePasswordForm } from "@/components/change-password-form";

type ActiveView = "dashboard" | "reports" | "departments" | "trends" | "change-password";

const isExecutiveView = (value: string | null): value is ActiveView =>
  value === "dashboard" || value === "reports" || value === "departments" || value === "trends" || value === "change-password";

type KPISet = {
  totalStudents: number;
  screenedPercentage: number;
  avgResponseTime: string;
  successRate: string;
};

type HeatmapItem = {
  year: string;
  total: number;
  normal: number;
  risk: number;
  highRisk: number;
};

type CommonIssue = {
  label: string;
  percentage: number;
  color: string;
};

type ReportItem = {
  id: string;
  name: string;
  date: string;
  type: string;
  size: string;
};

type TrendItem = {
  month: string;
  risk: number;
  highRisk: number;
};

type DepartmentItem = {
  name: string;
  students: number;
  riskScore: number;
};

const redirectByRole: Record<string, string> = {
  ADMIN: "/dashboard/admin",
  ADVISOR: "/dashboard/advisor",
  INSTRUCTOR: "/dashboard/instructor",
  MENTAL_HEALTH: "/dashboard/mental-health",
  STUDENT: "/dashboard/student",
};

const kpis: KPISet = {
  totalStudents: 750,
  screenedPercentage: 92,
  avgResponseTime: "1.5 ชม.",
  successRate: "88%",
};

const heatmapData: HeatmapItem[] = [
  { year: "ชั้นปีที่ 1", total: 200, normal: 150, risk: 40, highRisk: 10 },
  { year: "ชั้นปีที่ 2", total: 180, normal: 100, risk: 60, highRisk: 20 },
  { year: "ชั้นปีที่ 3", total: 190, normal: 90, risk: 70, highRisk: 30 },
  { year: "ชั้นปีที่ 4", total: 180, normal: 130, risk: 40, highRisk: 10 },
];

const commonIssues: CommonIssue[] = [
  { label: "ปัญหาการเรียน / ฝึกปฏิบัติ", percentage: 45, color: "bg-blue-500" },
  { label: "ความสัมพันธ์และครอบครัว", percentage: 25, color: "bg-indigo-500" },
  { label: "ปัญหาการเงิน", percentage: 15, color: "bg-amber-500" },
  { label: "ปัญหาสุขภาพกาย", percentage: 10, color: "bg-emerald-500" },
  { label: "อื่นๆ", percentage: 5, color: "bg-slate-400" },
];

const reportsList: ReportItem[] = [
  { id: "REP-001", name: "รายงานสรุปภาวะซึมเศร้า (9Q) ประจำเดือน พ.ค.", date: "31 พ.ค. 2569", type: "ประจำเดือน", size: "2.4 MB" },
  { id: "REP-002", name: "รายงานสถิติเคสฉุกเฉิน (SOS) ภาคเรียนที่ 1/2569", date: "15 พ.ค. 2569", type: "วิกฤต", size: "1.1 MB" },
  { id: "REP-003", name: "สถิติการส่งต่อเคส (Referral) ระหว่างอาจารย์และผู้เชี่ยวชาญ", date: "01 พ.ค. 2569", type: "การทำงาน", size: "3.5 MB" },
  { id: "REP-004", name: "สรุปผลการคัดกรองความเครียด (ST-5) ภาพรวมคณะ", date: "28 เม.ย. 2569", type: "ประจำเดือน", size: "1.8 MB" },
];

const trendData: TrendItem[] = [
  { month: "ม.ค.", risk: 12, highRisk: 2 },
  { month: "ก.พ.", risk: 15, highRisk: 3 },
  { month: "มี.ค.", risk: 35, highRisk: 8 },
  { month: "เม.ย.", risk: 18, highRisk: 4 },
  { month: "พ.ค.", risk: 45, highRisk: 15 },
  { month: "มิ.ย.", risk: 10, highRisk: 1 },
];

const departmentData: DepartmentItem[] = [
  { name: "หลักสูตรพยาบาลศาสตรบัณฑิต (ปกติ)", students: 600, riskScore: 18 },
  { name: "หลักสูตรพยาบาลศาสตรบัณฑิต (นานาชาติ)", students: 100, riskScore: 25 },
  { name: "หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล", students: 50, riskScore: 12 },
];

const getInitials = (name: string, fallback = "ผบ"): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return fallback;
  }

  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? "";
  return `${first}${second}`;
};

function ExecutiveDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [reportSearch, setReportSearch] = useState("");

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    if (user.role !== "EXECUTIVE") {
      router.replace(redirectByRole[user.role] ?? "/dashboard");
    }
  }, [loading, router, user]);

  const isExecutive = useMemo(() => user?.role === "EXECUTIVE", [user]);

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

  const currentViewLabel =
    activeView === "dashboard"
      ? "แดชบอร์ดภาพรวม"
      : activeView === "reports"
        ? "รายงานเชิงลึก"
        : activeView === "departments"
          ? "สถิติรายหลักสูตร"
          : "แนวโน้มรายปี";
  const resolvedViewLabel = activeView === "change-password" ? "เปลี่ยนรหัสผ่าน" : currentViewLabel;

  const filteredReports = useMemo(() => {
    const keyword = reportSearch.trim().toLowerCase();
    if (!keyword) {
      return reportsList;
    }

    return reportsList.filter((report) =>
      [report.id, report.name, report.date, report.type, report.size].join(" ").toLowerCase().includes(keyword)
    );
  }, [reportSearch]);

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

  const SidebarItem = ({
    active,
    icon,
    label,
    onClick,
  }: {
    active: boolean;
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
    </button>
  );

  const DashboardView = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">รายงานสรุปสุขภาวะนักศึกษา (Executive Summary)</h2>
          <p className="mt-1 text-sm text-slate-500">
            ข้อมูลถูกปกปิดตัวตนเพื่อความเป็นส่วนตัว แสดงเฉพาะสถิติภาพรวมระดับคณะ (เทอม 1/2569)
          </p>
        </div>
        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          <Download size={16} /> ส่งออกรายงาน PDF
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
          <div className="mb-2 flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
              <Users size={20} />
            </div>
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">ประเมินแล้ว {kpis.screenedPercentage}%</span>
          </div>
          <h4 className="mb-1 text-3xl font-black text-slate-800">{kpis.totalStudents}</h4>
          <p className="text-sm font-bold text-slate-700">นักศึกษาทั้งหมด</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
          <div className="mb-2 flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600">
              <Target size={20} />
            </div>
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">+5% จากปีที่แล้ว</span>
          </div>
          <h4 className="mb-1 text-3xl font-black text-slate-800">{kpis.successRate}</h4>
          <p className="text-sm font-bold text-slate-700">อัตราการดีขึ้นหลังรับการดูแล</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
          <div className="mb-2 flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-100 bg-amber-50 text-amber-600">
              <Clock size={20} />
            </div>
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">เร็วกว่าเกณฑ์ 30 นาที</span>
          </div>
          <h4 className="mb-1 text-3xl font-black text-slate-800">{kpis.avgResponseTime}</h4>
          <p className="text-sm font-bold text-slate-700">ระยะเวลาเข้าช่วยเหลือเฉลี่ย</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
          <div className="mb-2 flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-600">
              <Activity size={20} />
            </div>
          </div>
          <h4 className="mb-1 text-3xl font-black text-slate-800">9.3%</h4>
          <p className="text-sm font-bold text-slate-700">สัดส่วนกลุ่มเสี่ยงสูง (ทั้งคณะ)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <BarChart3 className="text-blue-600" size={20} /> Wellbeing Heatmap
            </h3>
            <p className="mt-1 text-xs text-slate-500">สถิติระดับความเครียด/สุขภาพจิตแยกตามชั้นปี</p>
          </div>

          <div className="space-y-5">
            {heatmapData.map((data, index) => {
              const normalPct = Math.round((data.normal / data.total) * 100);
              const riskPct = Math.round((data.risk / data.total) * 100);
              const highRiskPct = Math.round((data.highRisk / data.total) * 100);

              return (
                <div key={data.year}>
                  <div className="mb-2 flex justify-between text-sm font-bold text-slate-700">
                    <span>
                      {data.year} <span className="text-xs font-normal text-slate-400">({data.total} คน)</span>
                    </span>
                    {index === 2 ? (
                      <span className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-red-600 bg-red-50">
                        <AlertTriangle size={10} /> เฝ้าระวังสูงสุด
                      </span>
                    ) : null}
                  </div>
                  <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
                    <div style={{ width: `${normalPct}%` }} className="h-full bg-emerald-400 transition-all duration-1000"></div>
                    <div style={{ width: `${riskPct}%` }} className="h-full bg-amber-400 transition-all duration-1000"></div>
                    <div style={{ width: `${highRiskPct}%` }} className="h-full bg-red-500 transition-all duration-1000"></div>
                  </div>
                  <div className="mt-1 flex gap-4">
                    <span className="text-[10px] font-medium text-emerald-600">{normalPct}% ปกติ</span>
                    <span className="text-[10px] font-medium text-amber-600">{riskPct}% เสี่ยง</span>
                    <span className="text-[10px] font-medium text-red-600">{highRiskPct}% วิกฤต</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <PieChart className="text-indigo-600" size={20} /> Common Issues
            </h3>
            <p className="mt-1 text-xs text-slate-500">กราฟแสดงปัญหาที่พบบ่อยจากการให้คำปรึกษา</p>
          </div>

          <div className="flex-1 space-y-4">
            {commonIssues.map((issue) => (
              <div key={issue.label} className="flex items-center gap-4">
                <div className="w-32 shrink-0 truncate text-right text-xs font-bold text-slate-700 sm:w-40">{issue.label}</div>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div style={{ width: `${issue.percentage}%` }} className={`h-full rounded-full transition-all duration-1000 ease-out ${issue.color}`}></div>
                </div>
                <div className="w-10 text-right text-xs font-black text-slate-800">{issue.percentage}%</div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
            <p className="leading-relaxed text-indigo-800 text-xs font-medium">
              <span className="font-bold">บทวิเคราะห์:</span> ปัญหาด้านการเรียนยังคงเป็นปัจจัยหลักที่ก่อให้เกิดความเครียด คิดเป็นเกือบครึ่งหนึ่งของปัญหาทั้งหมด
              แนะนำให้มีการจัดกิจกรรมเสริมทักษะการเรียนหรือการจัดการเวลา
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const ReportsView = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">รายงานเชิงลึก (Data Export & Reports)</h2>
          <p className="mt-1 text-sm text-slate-500">ดาวน์โหลดรายงานสรุปสำหรับการประชุมผู้บริหารหรือการประกันคุณภาพ (QA)</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
            <Filter size={20} />
          </button>
          <button type="button" className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700">
            <Calendar size={16} /> เลือกช่วงเวลา
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex gap-4 border-b border-slate-100 bg-slate-50/50 p-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={reportSearch}
              onChange={(event) => setReportSearch(event.target.value)}
              placeholder="ค้นหาชื่อรายงาน..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {filteredReports.map((report) => (
            <div key={report.id} className="group flex flex-col gap-4 p-5 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600">
                  <FileText size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 transition-colors group-hover:text-blue-600">{report.name}</h4>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>{report.date}</span>
                    <span className="h-1 w-1 rounded-full bg-slate-300"></span>
                    <span className="font-bold uppercase text-slate-400">{report.type}</span>
                    <span className="h-1 w-1 rounded-full bg-slate-300"></span>
                    <span>{report.size}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-blue-600"
              >
                <Download size={14} /> ดาวน์โหลด PDF
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const DepartmentsView = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">สถิติรายหลักสูตร (Program Comparison)</h2>
        <p className="mt-1 text-sm text-slate-500">เปรียบเทียบระดับความเสี่ยงด้านสุขภาพจิตระหว่างหลักสูตรต่างๆ ในคณะ</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {departmentData.map((dept) => (
          <div key={dept.name} className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-bl-full bg-blue-50 opacity-50"></div>
            <div className="relative z-10">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600">
                <Building2 size={24} />
              </div>
              <h3 className="mb-2 text-lg font-bold leading-tight text-slate-800">{dept.name}</h3>
              <p className="mb-6 flex items-center gap-2 text-sm text-slate-500">
                <Users size={16} /> {dept.students} นักศึกษา
              </p>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="mb-1 text-[10px] font-bold uppercase text-slate-400">ดัชนีความเสี่ยง (Risk Score)</p>
                <div className="flex items-end gap-2">
                  <span className={`text-3xl font-black ${dept.riskScore > 20 ? "text-red-600" : dept.riskScore > 15 ? "text-amber-600" : "text-emerald-600"}`}>
                    {dept.riskScore}%
                  </span>
                  <span className="mb-1.5 text-xs font-medium text-slate-500">ของนักศึกษาทั้งหมด</span>
                </div>

                <button type="button" className="mt-4 flex w-full items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-blue-600 transition-colors hover:bg-blue-50">
                  ดูรายละเอียด <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const TrendsView = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">แนวโน้มรายเดือน (Monthly Trends)</h2>
        <p className="mt-1 text-sm text-slate-500">วิเคราะห์แนวโน้มการเกิดความเครียดและเคสวิกฤตย้อนหลัง 6 เดือน</p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-8 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-bold text-slate-800">
            <TrendingUp className="text-indigo-600" size={20} /> กราฟแนวโน้มความเสี่ยง (Risk Trends)
          </h3>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-amber-400"></div>
              <span className="text-xs font-medium text-slate-600">เสี่ยง (Risk)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500"></div>
              <span className="text-xs font-medium text-slate-600">วิกฤต (High Risk)</span>
            </div>
          </div>
        </div>

        <div className="relative mt-4 flex h-64 items-end justify-between gap-4 border-b border-slate-200 pb-2 sm:gap-8">
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between opacity-20">
            <div className="h-1/4 border-b border-dashed border-slate-400"></div>
            <div className="h-1/4 border-b border-dashed border-slate-400"></div>
            <div className="h-1/4 border-b border-dashed border-slate-400"></div>
            <div className="h-1/4"></div>
          </div>

          {trendData.map((data) => {
            const maxVal = 60;
            const riskHeight = `${(data.risk / maxVal) * 100}%`;
            const highRiskHeight = `${(data.highRisk / maxVal) * 100}%`;

            return (
              <div key={data.month} className="group relative z-10 flex flex-1 flex-col items-center gap-2">
                <div className="pointer-events-none absolute -top-12 rounded-lg bg-slate-800 p-2 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100 whitespace-nowrap z-20">
                  เสี่ยง: {data.risk} คน
                  <br />
                  วิกฤต: {data.highRisk} คน
                </div>

                <div className="flex h-full w-full items-end justify-center gap-1 sm:gap-2">
                  <div style={{ height: riskHeight }} className="w-1/3 rounded-t-sm bg-amber-400 transition-all duration-1000 ease-out hover:brightness-110 sm:w-10"></div>
                  <div style={{ height: highRiskHeight }} className="w-1/3 rounded-t-sm bg-red-500 transition-all duration-1000 ease-out hover:brightness-110 sm:w-10"></div>
                </div>
                <span className="mt-2 text-xs font-bold text-slate-600">{data.month}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-50 p-5">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
            <AlertTriangle size={16} className="text-amber-500" /> ข้อสังเกตเชิงบริหาร
          </h4>
          <p className="text-sm leading-relaxed text-slate-600">
            จากกราฟแนวโน้มย้อนหลัง 6 เดือน พบว่า <span className="font-bold text-red-600">ในเดือน มีนาคม และ พฤษภาคม มีอัตราความเครียดพุ่งสูงขึ้นอย่างมีนัยสำคัญ</span>
            ซึ่งตรงกับช่วงเวลาการสอบกลางภาคและการเริ่มขึ้นฝึกปฏิบัติงานบนหอผู้ป่วยของชั้นปีที่ 3 แนะนำให้มีการจัดกิจกรรมเตรียมความพร้อมล่วงหน้าในเดือนก่อนหน้า
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F7FB] font-sans text-slate-800">
      <aside className="sticky top-0 hidden h-screen w-72 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-slate-100 px-6">
          <AppBrand subtitle="คณะพยาบาลศาสตร์" size="compact" />
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
          <div className="space-y-1">
            <MenuSectionHeading title="เมนูหลัก" />
            <SidebarItem icon={<LayoutDashboard size={20} />} label="แดชบอร์ดภาพรวม" active={activeView === "dashboard"} onClick={() => navigateTo("dashboard")} />
            <SidebarItem icon={<FileText size={20} />} label="รายงานเชิงลึก" active={activeView === "reports"} onClick={() => navigateTo("reports")} />
            <SidebarItem icon={<Building2 size={20} />} label="สถิติรายหลักสูตร" active={activeView === "departments"} onClick={() => navigateTo("departments")} />
            <SidebarItem icon={<TrendingUp size={20} />} label="แนวโน้มรายปี" active={activeView === "trends"} onClick={() => navigateTo("trends")} />
          </div>

          <div className="space-y-1">
            <MenuSectionHeading title="ระบบและความปลอดภัย" />
            <Link
              href="/dashboard/executive?view=change-password"
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
            onClick={() => {
              void handleLogout();
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={18} /> ออกจากระบบ
          </button>
        </div>
      </aside>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="flex h-full w-72 flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4">
              <AppBrand subtitle="คณะพยาบาลศาสตร์" size="compact" />
              <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
              <div className="space-y-1">
                <MenuSectionHeading title="เมนูหลัก" />
                <SidebarItem icon={<LayoutDashboard size={20} />} label="แดชบอร์ดภาพรวม" active={activeView === "dashboard"} onClick={() => navigateTo("dashboard")} />
                <SidebarItem icon={<FileText size={20} />} label="รายงานเชิงลึก" active={activeView === "reports"} onClick={() => navigateTo("reports")} />
                <SidebarItem icon={<Building2 size={20} />} label="สถิติรายหลักสูตร" active={activeView === "departments"} onClick={() => navigateTo("departments")} />
                <SidebarItem icon={<TrendingUp size={20} />} label="แนวโน้มรายปี" active={activeView === "trends"} onClick={() => navigateTo("trends")} />
              </div>

              <div className="space-y-1">
                <MenuSectionHeading title="ระบบและความปลอดภัย" />
                <Link
                  href="/dashboard/executive?view=change-password"
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
                onClick={() => {
                  void handleLogout();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <LogOut size={18} /> ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setIsMobileMenuOpen((current) => !current)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
              <Menu size={20} />
            </button>

            <div className="hidden lg:block">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <span>Executive Portal</span>
                <ChevronRight size={14} />
                <span className="font-bold text-slate-800">{resolvedViewLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 sm:flex">
              <ShieldCheck size={14} /> PDPA Anonymized Mode
            </div>
            <div className="hidden h-6 w-px bg-slate-200 sm:block"></div>
            <div className="flex items-center gap-3">
              <button type="button" className="relative rounded-full bg-slate-100 p-2 text-slate-500 transition-colors hover:text-slate-700 sm:hidden">
                <Bell size={20} />
              </button>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-bold leading-none text-slate-800">{executiveProfile.name}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{executiveProfile.role}</p>
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
