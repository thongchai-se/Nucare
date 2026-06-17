"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRightLeft,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Filter,
  Gift,
  LayoutDashboard,
  Lock,
  LogOut,
  Megaphone,
  Menu,
  PieChart,
  Search,
  Send,
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

type ActiveView = "dashboard" | "tracking" | "wellness" | "welfare" | "change-password";

type PendingStudent = {
  id: string;
  studentCode?: string;
  name: string;
  year: string;
  section?: string;
  advisorName?: string | null;
  latestReminderAt?: string | null;
  lastActive: string;
  status: string;
};

type WellnessActivity = {
  id: string;
  name: string;
  date: string;
  registered: number;
  max: number;
  status: "เปิดรับสมัคร" | "เต็มแล้ว";
  focus: string;
};

type WelfareTask = {
  id: string;
  title: string;
  owner: string;
  status: "กำลังประสานงาน" | "รอข้อมูลเพิ่มเติม" | "พร้อมดำเนินการ";
  updatedAt: string;
  note: string;
};

type ToastState = {
  show: boolean;
  message: string;
  tone: "success" | "info";
};

type ScreeningStats = {
  totalTarget: number;
  completed: number;
  pending: number;
  percentage: number;
  normalRiskCount: number;
  mediumRiskCount: number;
  highRiskCount: number;
};

type StudentDevelopmentDashboardResponse = {
  screeningStats: ScreeningStats;
  pendingStudents: Array<{
    id: string;
    studentCode: string;
    name: string;
    year: string;
    section: string;
    advisorName: string | null;
    latestReminderAt: string | null;
    status: string;
  }>;
  riskInsights: Array<{
    id: string;
    title: string;
    tone: "normal" | "attention" | "critical";
    count: number;
    description: string;
  }>;
  supportCases: Array<{
    id: string;
    status: "PENDING" | "ACCEPTED" | "CLOSED";
    isUrgent: boolean;
    reason: string;
    createdAt: string;
    updatedAt: string;
    advisorName: string;
    student: {
      id: string;
      name: string;
      studentCode: string;
      year: string;
      section: string;
      riskLevel: "high" | "medium" | "normal";
      latestAssessment: {
        totalScore: number;
        instrument: string;
        assessedAt: string;
      } | null;
    };
    latestCareRecord: {
      careDate: string;
      careType: string;
      outcome: string | null;
    } | null;
  }>;
};

const isStudentDevelopmentView = (value: string | null): value is ActiveView =>
  value === "dashboard" ||
  value === "tracking" ||
  value === "wellness" ||
  value === "welfare" ||
  value === "change-password";

const screeningStats = {
  totalTarget: 750,
  completed: 645,
  pending: 105,
  percentage: 86,
};

const pendingStudents: PendingStudent[] = [
  { id: "65010112", name: "นายวีระพล คนเก่ง", year: "ปี 2", lastActive: "3 วันที่แล้ว", status: "ยังไม่ทำประเมินรอบ พ.ค." },
  { id: "66010045", name: "นางสาวสุดา พารวย", year: "ปี 1", lastActive: "วันนี้", status: "ยังไม่ทำประเมินรอบ พ.ค." },
  { id: "64010233", name: "นายสมเกียรติ รักเรียน", year: "ปี 3", lastActive: "1 สัปดาห์ที่แล้ว", status: "ขาดการประเมิน 2 รอบ" },
  { id: "65010089", name: "นางสาววิไล สวยงาม", year: "ปี 2", lastActive: "เมื่อวาน", status: "ยังไม่ทำประเมินรอบ พ.ค." },
];

const wellnessActivities: WellnessActivity[] = [
  {
    id: "1",
    name: "Workshop: จัดการความเครียดช่วงสอบ",
    date: "20 พ.ค. 2569",
    registered: 45,
    max: 50,
    status: "เปิดรับสมัคร",
    focus: "สำหรับนักศึกษากลุ่มปกติที่ต้องการเครื่องมือดูแลตัวเอง",
  },
  {
    id: "2",
    name: "กิจกรรม Art Therapy ศิลปะบำบัดใจ",
    date: "25 พ.ค. 2569",
    registered: 30,
    max: 30,
    status: "เต็มแล้ว",
    focus: "กิจกรรม small group พร้อมวิทยากรภายนอก",
  },
];

const welfareTasks: WelfareTask[] = [
  {
    id: "WF-01",
    title: "ประสานทุนช่วยเหลือค่าเดินทางสำหรับนักศึกษาต่างจังหวัด",
    owner: "กานต์สินี ใจดี",
    status: "กำลังประสานงาน",
    updatedAt: "อัปเดตล่าสุด 2 ชั่วโมงที่แล้ว",
    note: "รอข้อมูลรายชื่อยืนยันจากอาจารย์ที่ปรึกษา",
  },
  {
    id: "WF-02",
    title: "ติดตามสิทธิ์พักอาศัยชั่วคราวสำหรับเคสฉุกเฉิน",
    owner: "งานสวัสดิการนักศึกษา",
    status: "พร้อมดำเนินการ",
    updatedAt: "อัปเดตล่าสุด เมื่อวาน",
    note: "สามารถส่งต่อเข้าที่ประชุมย่อยประจำสัปดาห์ได้ทันรอบ",
  },
  {
    id: "WF-03",
    title: "ตรวจความครบถ้วนของเอกสารเบิกอุปกรณ์การเรียน",
    owner: "เจ้าหน้าที่กลาง",
    status: "รอข้อมูลเพิ่มเติม",
    updatedAt: "อัปเดตล่าสุด 3 วันที่แล้ว",
    note: "ขาดเอกสารรับรองรายได้ครอบครัว 2 ราย",
  },
];

void { screeningStats, pendingStudents, wellnessActivities, welfareTasks };

const campaignHighlights = [
  {
    title: "Checklist ก่อนปิดรอบประเมิน",
    description: "ยืนยันรายชื่อนักศึกษาที่ค้างประเมิน, ส่ง reminder รอบสุดท้าย, และสรุปตัวเลขให้คณะผู้บริหาร",
    icon: <ClipboardCheck className="h-5 w-5" />,
  },
  {
    title: "Wellness เดือนนี้",
    description: "เน้นกิจกรรม low-intensity สำหรับกลุ่มปกติ เพื่อช่วยระบายความเครียดก่อนสอบกลางภาค",
    icon: <Gift className="h-5 w-5" />,
  },
  {
    title: "ประสานสวัสดิการเชิงรุก",
    description: "เตรียมรายชื่อเคสที่ต้องติดตามสิทธิ์ช่วยเหลือ และตั้งเจ้าของงานให้ชัดในแต่ละเคส",
    icon: <ArrowRightLeft className="h-5 w-5" />,
  },
];

const getInitials = (name: string, fallback = "SD"): string => {
  const parts = stripKnownNamePrefix(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return fallback;
  }

  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? "";
  return `${first}${second}`.toUpperCase();
};

const formatIdentifier = (employeeId?: string | null, email?: string | null): string => {
  if (employeeId) {
    return employeeId;
  }

  return email ?? "-";
};

const emptyScreeningStats: ScreeningStats = {
  totalTarget: 0,
  completed: 0,
  pending: 0,
  percentage: 0,
  normalRiskCount: 0,
  mediumRiskCount: 0,
  highRiskCount: 0,
};

const emptyPendingStudent: PendingStudent = {
  id: "",
  studentCode: "",
  name: "",
  year: "",
  section: "",
  advisorName: null,
  latestReminderAt: null,
  lastActive: "",
  status: "",
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

const formatThaiDate = (value: string | null | undefined): string => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
  }).format(date);
};

void formatThaiDate;

const formatThaiDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

function StudentDevelopmentDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, loading, logout } = useAuth();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [selectedReminderTarget, setSelectedReminderTarget] = useState<PendingStudent>(emptyPendingStudent);
  const [reminderMessage, setReminderMessage] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [yearFilter, setYearFilter] = useState<"ALL" | PendingStudent["year"]>("ALL");
  const [loadingData, setLoadingData] = useState(false);
  const [serverError, setServerError] = useState("");
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [dashboardData, setDashboardData] = useState<StudentDevelopmentDashboardResponse>({
    screeningStats: emptyScreeningStats,
    pendingStudents: [],
    riskInsights: [],
    supportCases: [],
  });
  const [toast, setToast] = useState<ToastState>({ show: false, message: "", tone: "success" });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    if (!hasRole(user, "STUDENT_DEVELOPMENT")) {
      router.replace(getRoleHomePath(user.role));
    }
  }, [loading, router, user]);

  const loadDashboard = useCallback(async () => {
    setLoadingData(true);
    setServerError("");

    try {
      const response = await api.get<StudentDevelopmentDashboardResponse>("/api/student-development/dashboard");
      setDashboardData(response.data);
    } catch (error) {
      setServerError(getErrorMessage(error));
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && hasRole(user, "STUDENT_DEVELOPMENT")) {
      void loadDashboard();
    }
  }, [loadDashboard, loading, user]);

  useEffect(() => {
    if (!toast.show) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToast((current) => ({ ...current, show: false }));
    }, 3200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toast.show]);

  const requestedView = searchParams.get("view");
  const activeView: ActiveView = isStudentDevelopmentView(requestedView) ? requestedView : "dashboard";

  const profile = useMemo(
    () => ({
      name: user?.name || "เจ้าหน้าที่ฝ่ายพัฒนานักศึกษา",
      roleLabel: "ฝ่ายพัฒนานักศึกษา",
      initials: getInitials(user?.name || ""),
      identifier: formatIdentifier(user?.employeeId, user?.email),
    }),
    [user?.email, user?.employeeId, user?.name]
  );

  const screeningStats = dashboardData.screeningStats;

  const pendingStudents = useMemo<PendingStudent[]>(
    () =>
      dashboardData.pendingStudents.map((student) => ({
        ...student,
        lastActive: student.latestReminderAt ? `แจ้งเตือนล่าสุด ${formatThaiDateTime(student.latestReminderAt)}` : "ยังไม่เคยแจ้งเตือน",
      })),
    [dashboardData.pendingStudents]
  );

  const wellnessActivities = useMemo<WellnessActivity[]>(
    () =>
      dashboardData.riskInsights.map((insight, index) => ({
        id: String(index + 1),
        name: insight.title,
        date: "อ้างอิงจากผลประเมินล่าสุด",
        registered: insight.count,
        max: Math.max(screeningStats.completed, 1),
        status: insight.tone === "critical" ? "เต็มแล้ว" : "เปิดรับสมัคร",
        focus: insight.description,
      })) as unknown as WellnessActivity[],
    [dashboardData.riskInsights, screeningStats.completed]
  );

  const welfareTasks = useMemo<WelfareTask[]>(
    () =>
      dashboardData.supportCases.map((caseItem) => ({
        id: caseItem.id,
        title: `${caseItem.student.name} (${caseItem.student.studentCode})`,
        owner: caseItem.advisorName,
        status:
          caseItem.status === "PENDING"
            ? "เธฃเธญเธเนเธญเธกเธนเธฅเน€เธเธดเนเธกเน€เธ•เธดเธก"
            : caseItem.status === "ACCEPTED"
              ? "เธเธณเธฅเธฑเธเธเธฃเธฐเธชเธฒเธเธเธฒเธ"
              : "เธเธฃเนเธญเธกเธ”เธณเน€เธเธดเธเธเธฒเธฃ",
        updatedAt: `อัปเดต ${formatThaiDateTime(caseItem.updatedAt)}`,
        note: caseItem.reason,
        isUrgent: caseItem.isUrgent,
      })) as unknown as WelfareTask[],
    [dashboardData.supportCases]
  );

  const yearOptions = useMemo(
    () => Array.from(new Set(pendingStudents.map((student) => student.year).filter(Boolean))),
    [pendingStudents]
  );

  void yearOptions;

  const sendViaAppNotification = true;
  const sendViaEmail = false;
  const setSendViaAppNotification = () => undefined;
  const setSendViaEmail = () => undefined;

  const filteredPendingStudents = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    return pendingStudents.filter((student) => {
      const matchesYear = yearFilter === "ALL" || student.year === yearFilter;
      if (!matchesYear) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      return [student.studentCode, student.name, student.year, student.section, student.advisorName || "", student.status, student.lastActive]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [pendingStudents, searchKeyword, yearFilter]);

  const openReminderModal = (student: PendingStudent | null) => {
    setSelectedReminderTarget(student ?? emptyPendingStudent);

    const defaultMessage = student
      ? `ประกาศจากฝ่ายพัฒนานักศึกษา: กรุณาเข้าสู่ระบบ Nucare เพื่อทำแบบประเมินสุขภาพจิต (9Q) ประจำเดือนพฤษภาคม โดยเร็วที่สุด หากต้องการความช่วยเหลือสามารถติดต่อเจ้าหน้าที่ได้ทันที`
      : "ประกาศจากฝ่ายพัฒนานักศึกษา: กรุณาเข้าสู่ระบบ Nucare เพื่อทำแบบประเมินสุขภาพจิต (9Q) ประจำเดือนพฤษภาคม เพื่อรักษาสิทธิ์ของท่าน ขอบคุณครับ";

    setReminderMessage(defaultMessage);
    setShowReminderModal(true);
  };

  const navigateTo = (view: ActiveView) => {
    setIsMobileMenuOpen(false);
    router.replace(view === "dashboard" ? "/dashboard/student-development" : `/dashboard/student-development?view=${view}`);
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const handleReminderSubmit = async () => {
    if (!reminderMessage.trim()) {
      return;
    }

    const hasSpecificTarget = Boolean(selectedReminderTarget.id);

    setIsSendingReminder(true);
    setServerError("");

    try {
      const response = await api.post<{ sentCount: number }>("/api/student-development/screening-reminders", {
        message: reminderMessage.trim(),
        studentUserIds: hasSpecificTarget ? [selectedReminderTarget.id] : undefined,
      });

      setShowReminderModal(false);
      setSelectedReminderTarget(emptyPendingStudent);
      setToast({
        show: true,
        message:
          response.data.sentCount > 1
            ? `ส่งแจ้งเตือนแล้ว ${response.data.sentCount} ราย`
            : hasSpecificTarget
              ? `ส่งแจ้งเตือนถึง ${selectedReminderTarget.name} เรียบร้อยแล้ว`
              : "ส่งแจ้งเตือนเรียบร้อยแล้ว",
        tone: "success",
      });
      await loadDashboard();
    } catch (error) {
      setServerError(getErrorMessage(error));
      setToast({
        show: true,
        message: "ไม่สามารถส่งแจ้งเตือนได้",
        tone: "info",
      });
    } finally {
      setIsSendingReminder(false);
    }

    return;

    setShowReminderModal(false);
    setSelectedReminderTarget(emptyPendingStudent);
    setToast({
      show: true,
      message: selectedReminderTarget
        ? `ส่งแจ้งเตือนถึง ${selectedReminderTarget.name} เรียบร้อยแล้ว`
        : "ส่งแจ้งเตือนให้นักศึกษากลุ่มค้างประเมินเรียบร้อยแล้ว",
      tone: "success",
    });
  };

  const currentViewLabel =
    activeView === "dashboard"
      ? "หน้าหลักฝ่ายพัฒนานักศึกษา"
      : activeView === "tracking"
        ? "ติดตามการคัดกรอง"
        : activeView === "wellness"
          ? "กิจกรรม Wellness"
          : activeView === "welfare"
            ? "ประสานงานสวัสดิการ"
            : "เปลี่ยนรหัสผ่าน";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <span className="loader h-7 w-7 text-blue-600"></span>
      </main>
    );
  }

  if (!user || !hasRole(user, "STUDENT_DEVELOPMENT")) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <span className="loader h-7 w-7 text-blue-600"></span>
      </main>
    );
  }

  const navButtonClassName = (view: ActiveView) =>
    `flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm transition-all ${
      activeView === view
        ? "border-rose-200 bg-rose-50 text-rose-700 shadow-sm"
        : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
    }`;

  const DashboardView = () => (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.9fr]">
          <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,0.18),transparent_38%),linear-gradient(135deg,#fff7f8_0%,#ffffff_45%,#fff4f6_100%)] px-6 py-7 sm:px-8 sm:py-8">
            <div className="absolute -right-6 -top-6 rounded-full bg-rose-100/60 p-7 text-rose-200">
              <PieChart className="h-24 w-24" />
            </div>
            <div className="relative max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white/90 px-3 py-1 text-xs font-bold text-rose-700 shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5" />
                รอบประเมิน พฤษภาคม 2569 กำลังเปิดดำเนินการ
              </div>
              <h1 className="text-2xl font-black leading-tight text-slate-900 sm:text-3xl">
                สวัสดี {profile.name}
                <span className="block text-lg font-bold text-slate-600 sm:text-xl">ศูนย์กลางดูภาพรวมการคัดกรอง กิจกรรม และงานช่วยเหลือนักศึกษา</span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-[15px]">
                หน้านี้ออกแบบให้เห็นงานเร่งด่วนก่อนเสมอ ทั้งนักศึกษาที่ค้างประเมิน, กิจกรรม Wellness สำหรับกลุ่มปกติ,
                และการประสานงานด้านสวัสดิการที่ยังค้างดำเนินการ
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white bg-white/80 p-4 shadow-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Completed</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{screeningStats.completed}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">นักศึกษาที่ทำแบบประเมินแล้ว</p>
                </div>
                <div className="rounded-2xl border border-white bg-white/80 p-4 shadow-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Pending</p>
                  <p className="mt-2 text-2xl font-black text-amber-600">{screeningStats.pending}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">นักศึกษาที่ยังต้องติดตาม</p>
                </div>
                <div className="rounded-2xl border border-white bg-white/80 p-4 shadow-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Support</p>
                  <p className="mt-2 text-2xl font-black text-emerald-600">{screeningStats.mediumRiskCount + screeningStats.highRiskCount}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">กิจกรรมที่เปิดอยู่ในรอบนี้</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 px-6 py-6 lg:border-l lg:border-t-0">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Today Focus</p>
            <div className="mt-4 space-y-3">
              {campaignHighlights.map((highlight) => (
                <div key={highlight.title} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <span className="rounded-xl bg-white p-2 text-rose-600 shadow-sm">{highlight.icon}</span>
                    {highlight.title}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{highlight.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <div className="mb-3 flex items-center gap-2 text-lg font-black text-slate-900">
              <ClipboardCheck className="h-5 w-5 text-blue-600" />
              ความคืบหน้าการคัดกรองประจำเดือน
            </div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-black text-slate-900">{screeningStats.percentage}%</p>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  ทำแบบประเมินแล้ว {screeningStats.completed} จาก {screeningStats.totalTarget} คน
                </p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-right">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-600">Pending Cases</p>
                <p className="mt-1 text-2xl font-black text-amber-700">{screeningStats.pending}</p>
              </div>
            </div>
            <div className="mt-4 h-4 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${screeningStats.percentage}%` }} />
            </div>
            <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              มีนักศึกษา {screeningStats.pending} คนที่ยังไม่ทำแบบประเมินในรอบนี้
            </p>
          </div>

          <button
            type="button"
            onClick={() => openReminderModal(null)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-700"
          >
            <Megaphone className="h-4 w-4" />
            ส่งแจ้งเตือนทั้งหมด
          </button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <h2 className="text-lg font-black text-slate-900">นักศึกษาที่ต้องติดตาม</h2>
              <p className="mt-1 text-sm text-slate-500">โฟกัสกับกลุ่มที่ค้างประเมินหรือขาดต่อเนื่องมากกว่า 1 รอบ</p>
            </div>
            <button type="button" onClick={() => navigateTo("tracking")} className="text-sm font-bold text-blue-600 hover:text-blue-700">
              ดูทั้งหมด
            </button>
          </div>
          <div className="p-3">
            {pendingStudents.slice(0, 3).map((student) => (
              <div key={student.id} className="flex flex-col gap-3 rounded-2xl border border-transparent px-3 py-3 transition-colors hover:border-slate-100 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-sm font-black text-amber-600">
                    {(student.studentCode || student.id).slice(-2)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{student.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{student.studentCode || student.id} • {student.year} • {student.lastActive}</p>
                    <span className={`mt-2 inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      student.status.includes("2 รอบ") ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {student.status}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openReminderModal(student)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100"
                >
                  <Send className="h-3.5 w-3.5" />
                  ส่งข้อความ
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <h2 className="text-lg font-black text-slate-900">กิจกรรม Wellness ที่กำลังเปิด</h2>
              <p className="mt-1 text-sm text-slate-500">พื้นที่กิจกรรมสำหรับกลุ่มปกติและนักศึกษาที่ต้องการดูแลใจเชิงป้องกัน</p>
            </div>
            <button type="button" onClick={() => navigateTo("wellness")} className="text-sm font-bold text-emerald-600 hover:text-emerald-700">
              จัดการกิจกรรม
            </button>
          </div>
          <div className="space-y-3 p-4">
            {wellnessActivities.map((activity) => (
              <div key={activity.id} className="rounded-2xl border border-slate-100 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{activity.name}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <Calendar className="h-3.5 w-3.5" />
                      {activity.date}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{activity.focus}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      activity.status === "เต็มแล้ว" ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700"
                    }`}>
                      {activity.status}
                    </span>
                    <p className="mt-2 text-sm font-bold text-slate-700">{activity.registered}/{activity.max} คน</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-black text-slate-900">ประสานงานสวัสดิการที่กำลังดำเนินการ</h2>
            <p className="mt-1 text-sm text-slate-500">ภาพรวมงานที่ต้องตามต่อกับหน่วยงานภายในคณะและส่วนกลาง</p>
          </div>
          <button type="button" onClick={() => navigateTo("welfare")} className="text-sm font-bold text-rose-600 hover:text-rose-700">
            เปิดมุมมองงานสวัสดิการ
          </button>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-3">
          {welfareTasks.map((task) => (
            <div key={task.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{task.id}</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-900">{task.title}</p>
                </div>
                <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  task.status === "พร้อมดำเนินการ"
                    ? "bg-emerald-100 text-emerald-700"
                    : task.status === "กำลังประสานงาน"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-amber-100 text-amber-700"
                }`}>
                  {task.status}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-600">{task.note}</p>
              <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-500">
                <span>{task.owner}</span>
                <span>{task.updatedAt}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const TrackingView = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">ติดตามการคัดกรอง</h1>
          <p className="mt-1 text-sm text-slate-500">จัดการรายชื่อนักศึกษาที่ค้างประเมินและส่ง reminder แบบเฉพาะรายหรือทั้งกลุ่ม</p>
        </div>
        <button
          type="button"
          onClick={() => openReminderModal(null)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-700"
        >
          <Megaphone className="h-4 w-4" />
          ส่งแจ้งเตือนทั้งหมด
        </button>
      </div>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-lg flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="ค้นหาชื่อหรือรหัสนักศึกษา..."
              className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={yearFilter}
                onChange={(event) => setYearFilter(event.target.value as "ALL" | PendingStudent["year"])}
                className="bg-transparent font-medium outline-none"
              >
                <option value="ALL">ทุกชั้นปี</option>
                <option value="ปี 1">ชั้นปีที่ 1</option>
                <option value="ปี 2">ชั้นปีที่ 2</option>
                <option value="ปี 3">ชั้นปีที่ 3</option>
              </select>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700">
              {filteredPendingStudents.length} รายการ
            </div>
          </div>
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-5 py-4 font-black text-slate-500">นักศึกษา</th>
                <th className="px-5 py-4 font-black text-slate-500">ชั้นปี</th>
                <th className="px-5 py-4 font-black text-slate-500">แจ้งเตือนล่าสุด</th>
                <th className="px-5 py-4 font-black text-slate-500">สถานะการประเมิน</th>
                <th className="px-5 py-4 text-center font-black text-slate-500">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPendingStudents.map((student) => (
                <tr key={student.id} className="transition-colors hover:bg-slate-50/80">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-sm font-black text-slate-500">
                        {(student.studentCode || student.id).slice(-2)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{student.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{student.studentCode || student.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-medium text-slate-600">{student.year}</td>
                  <td className="px-5 py-4 text-slate-500">{student.lastActive}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      student.status.includes("2 รอบ") ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {student.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button
                      type="button"
                      onClick={() => openReminderModal(student)}
                      className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100"
                    >
                      <Send className="h-3.5 w-3.5" />
                      ส่งข้อความ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 p-4 lg:hidden">
          {filteredPendingStudents.map((student) => (
            <div key={student.id} className="rounded-2xl border border-slate-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{student.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{student.studentCode || student.id} • {student.year}</p>
                </div>
                <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  student.status.includes("2 รอบ") ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                }`}>
                  {student.status}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-500">{student.lastActive}</p>
              <button
                type="button"
                onClick={() => openReminderModal(student)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100"
              >
                <Send className="h-4 w-4" />
                ส่งข้อความติดตาม
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const WellnessView = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">กิจกรรม Wellness</h1>
        <p className="mt-1 text-sm text-slate-500">จัดกิจกรรมเชิงป้องกันสำหรับนักศึกษากลุ่มปกติ พร้อมดูอัตราการลงทะเบียนแบบรวดเร็ว</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="text-lg font-black text-slate-900">ตารางกิจกรรมรอบปัจจุบัน</h2>
          </div>
          <div className="space-y-4 p-4">
            {wellnessActivities.map((activity) => (
              <div key={activity.id} className="rounded-2xl border border-slate-100 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-base font-black text-slate-900">{activity.name}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <Calendar className="h-3.5 w-3.5" />
                      {activity.date}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{activity.focus}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left sm:text-right">
                    <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      activity.status === "เต็มแล้ว" ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700"
                    }`}>
                      {activity.status}
                    </span>
                    <p className="mt-2 text-xl font-black text-slate-900">{activity.registered}/{activity.max}</p>
                    <p className="text-xs text-slate-500">จำนวนผู้ลงทะเบียน</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Activity Snapshot</p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-sm font-bold text-emerald-800">ลงทะเบียนรวมแล้ว</p>
                <p className="mt-2 text-3xl font-black text-emerald-700">{wellnessActivities.reduce((sum, item) => sum + item.registered, 0)}</p>
              </div>
              <div className="rounded-2xl bg-blue-50 p-4">
                <p className="text-sm font-bold text-blue-800">กิจกรรมที่ยังเปิดรับ</p>
                <p className="mt-2 text-3xl font-black text-blue-700">{wellnessActivities.filter((item) => item.status === "เปิดรับสมัคร").length}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">แนวทางรอบถัดไป</h2>
            <ul className="mt-4 space-y-3">
              {[
                "เพิ่มกิจกรรมสั้นหลังเลิกเรียนสำหรับปี 1 และปี 2",
                "เก็บ feedback หลังจบกิจกรรมทุกครั้งเพื่อนำไปจัดรอบใหม่",
                "คัดกิจกรรมที่ต่อยอดการดูแลตัวเองได้จริงในช่วงสอบ",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );

  const WelfareView = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">ประสานงานสวัสดิการ</h1>
        <p className="mt-1 text-sm text-slate-500">ติดตามงานช่วยเหลือนักศึกษาเชิงระบบและงานที่ต้องต่อกับหน่วยงานอื่น</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Open Tasks</p>
          <p className="mt-3 text-3xl font-black text-slate-900">{welfareTasks.length}</p>
          <p className="mt-1 text-sm text-slate-500">รายการที่ยังอยู่ในสายการติดตาม</p>
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Ready This Week</p>
          <p className="mt-3 text-3xl font-black text-emerald-600">{welfareTasks.filter((task) => task.status === "พร้อมดำเนินการ").length}</p>
          <p className="mt-1 text-sm text-slate-500">เคสที่พร้อมเข้าสู่ขั้นตอนถัดไป</p>
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Need Documents</p>
          <p className="mt-3 text-3xl font-black text-amber-600">{welfareTasks.filter((task) => task.status === "รอข้อมูลเพิ่มเติม").length}</p>
          <p className="mt-1 text-sm text-slate-500">รายการที่ต้องรอเอกสารหรือข้อมูลยืนยัน</p>
        </div>
      </div>

      <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-black text-slate-900">รายการงานที่ต้องประสานต่อ</h2>
        </div>
        <div className="space-y-4 p-4">
          {welfareTasks.map((task) => (
            <div key={task.id} className="rounded-2xl border border-slate-100 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black tracking-[0.14em] text-slate-600">{task.id}</span>
                    <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      task.status === "พร้อมดำเนินการ"
                        ? "bg-emerald-100 text-emerald-700"
                        : task.status === "กำลังประสานงาน"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-amber-100 text-amber-700"
                    }`}>
                      {task.status}
                    </span>
                  </div>
                  <p className="mt-3 text-base font-black text-slate-900">{task.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{task.note}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <p className="font-bold text-slate-800">{task.owner}</p>
                  <p className="mt-1">{task.updatedAt}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black text-slate-900">งานเอกสารที่ควรเตรียมไว้ล่วงหน้า</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            "แบบฟอร์มยืนยันการช่วยเหลือเบื้องต้น",
            "รายการเอกสารประกอบการขอรับทุน",
            "สรุปสถานะเคสประจำสัปดาห์สำหรับประชุมติดตาม",
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <FileText className="h-4 w-4 text-rose-500" />
                {item}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F4F7FB] font-sans text-slate-800">
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="flex h-16 items-center border-b border-slate-100 px-6">
          <AppBrand size="compact" subtitle="Student Affairs Portal" />
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
          <div>
            <MenuSectionHeading title="งานประจำวัน" />
            <div className="space-y-1.5">
              <button type="button" onClick={() => navigateTo("dashboard")} className={navButtonClassName("dashboard")}>
                <LayoutDashboard className={`h-5 w-5 ${activeView === "dashboard" ? "text-rose-600" : "text-slate-400"}`} />
                <span className="font-semibold">หน้าหลัก</span>
              </button>
              <button type="button" onClick={() => navigateTo("tracking")} className={navButtonClassName("tracking")}>
                <Users className={`h-5 w-5 ${activeView === "tracking" ? "text-rose-600" : "text-slate-400"}`} />
                <span className="font-semibold">ติดตามการคัดกรอง</span>
              </button>
            </div>
          </div>

          <div>
            <MenuSectionHeading title="กิจกรรมและสวัสดิการ" />
            <div className="space-y-1.5">
              <button type="button" onClick={() => navigateTo("wellness")} className={navButtonClassName("wellness")}>
                <Gift className={`h-5 w-5 ${activeView === "wellness" ? "text-rose-600" : "text-slate-400"}`} />
                <span className="font-semibold">กิจกรรม Wellness</span>
              </button>
              <button type="button" onClick={() => navigateTo("welfare")} className={navButtonClassName("welfare")}>
                <ArrowRightLeft className={`h-5 w-5 ${activeView === "welfare" ? "text-rose-600" : "text-slate-400"}`} />
                <span className="font-semibold">ประสานงานสวัสดิการ</span>
              </button>
            </div>
          </div>

          <div>
            <MenuSectionHeading title="บัญชีและระบบ" />
            <div className="space-y-1.5">
              <button type="button" onClick={() => navigateTo("change-password")} className={navButtonClassName("change-password")}>
                <Lock className={`h-5 w-5 ${activeView === "change-password" ? "text-rose-600" : "text-slate-400"}`} />
                <span className="font-semibold">เปลี่ยนรหัสผ่าน</span>
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-slate-50/80 p-4">
          <div className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <div className="flex items-center gap-2 font-bold">
              <ShieldCheck className="h-4 w-4" />
              รอบประเมินเดือนนี้กำลังดำเนินการ
            </div>
            <p className="mt-1 text-xs leading-relaxed text-rose-700">ตรวจสอบนักศึกษาที่ค้างประเมินและส่ง reminder ให้ครบก่อนปิดรอบ เพื่อให้ข้อมูลของคณะสมบูรณ์ที่สุด</p>
          </div>
          <StaffRoleSwitcher className="mb-3" />
          <button
            type="button"
            onClick={() => {
              void handleLogout();
            }}
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
              <AppBrand size="compact" subtitle="Student Affairs Portal" />
              <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-800">{profile.name}</p>
                <p className="mt-1 text-xs text-slate-500">{profile.roleLabel}</p>
                <p className="mt-2 text-xs font-medium text-slate-500">รหัสบุคลากร: {profile.identifier}</p>
              </div>

              <div>
                <MenuSectionHeading title="งานประจำวัน" />
                <div className="space-y-1.5">
                  <button type="button" onClick={() => navigateTo("dashboard")} className={navButtonClassName("dashboard")}>
                    <LayoutDashboard className={`h-5 w-5 ${activeView === "dashboard" ? "text-rose-600" : "text-slate-400"}`} />
                    <span className="font-semibold">หน้าหลัก</span>
                  </button>
                  <button type="button" onClick={() => navigateTo("tracking")} className={navButtonClassName("tracking")}>
                    <Users className={`h-5 w-5 ${activeView === "tracking" ? "text-rose-600" : "text-slate-400"}`} />
                    <span className="font-semibold">ติดตามการคัดกรอง</span>
                  </button>
                </div>
              </div>

              <div>
                <MenuSectionHeading title="กิจกรรมและสวัสดิการ" />
                <div className="space-y-1.5">
                  <button type="button" onClick={() => navigateTo("wellness")} className={navButtonClassName("wellness")}>
                    <Gift className={`h-5 w-5 ${activeView === "wellness" ? "text-rose-600" : "text-slate-400"}`} />
                    <span className="font-semibold">กิจกรรม Wellness</span>
                  </button>
                  <button type="button" onClick={() => navigateTo("welfare")} className={navButtonClassName("welfare")}>
                    <ArrowRightLeft className={`h-5 w-5 ${activeView === "welfare" ? "text-rose-600" : "text-slate-400"}`} />
                    <span className="font-semibold">ประสานงานสวัสดิการ</span>
                  </button>
                </div>
              </div>

              <div>
                <MenuSectionHeading title="บัญชีและระบบ" />
                <div className="space-y-1.5">
                  <button type="button" onClick={() => navigateTo("change-password")} className={navButtonClassName("change-password")}>
                    <Lock className={`h-5 w-5 ${activeView === "change-password" ? "text-rose-600" : "text-slate-400"}`} />
                    <span className="font-semibold">เปลี่ยนรหัสผ่าน</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 p-4">
              <StaffRoleSwitcher className="mb-3" onRoleSelect={() => setIsMobileMenuOpen(false)} />
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  void handleLogout();
                }}
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
              <span>Student Affairs Portal</span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
              <span className="font-bold text-slate-800">{currentViewLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <button type="button" className="relative rounded-full p-1 text-slate-500 transition-colors hover:text-slate-800">
              <Bell className="h-5 w-5" />
              <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full border border-white bg-red-500" />
            </button>

            <div className="hidden h-6 w-px bg-slate-200 sm:block"></div>

            <div className="flex items-center gap-3">
              <div className="hidden max-w-[12rem] overflow-hidden text-right sm:block">
                <p className="truncate whitespace-nowrap text-sm font-bold leading-none text-slate-800" title={profile.name}>{profile.name}</p>
                <p className="mt-0.5 truncate whitespace-nowrap text-[10px] text-slate-500" title={profile.roleLabel}>{profile.roleLabel}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-rose-100 text-sm font-bold text-rose-700">
                {profile.initials}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl pb-10">
            {serverError ? (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {serverError}
              </div>
            ) : null}

            {activeView === "dashboard" && <DashboardView />}
            {activeView === "tracking" && <TrackingView />}
            {activeView === "wellness" && <WellnessView />}
            {activeView === "welfare" && <WelfareView />}
            {activeView === "change-password" && (
              <div className="mx-auto max-w-3xl">
                <ChangePasswordForm
                  cancelHref="/dashboard/student-development"
                  description="อัปเดตรหัสผ่านของบัญชีฝ่ายพัฒนานักศึกษาได้จากหน้านี้โดยตรง"
                  onSuccessRedirect="/dashboard/student-development"
                  title="เปลี่ยนรหัสผ่าน"
                  tone="portal"
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {loadingData ? (
        <div className="pointer-events-none fixed bottom-20 right-6 z-40 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="loader h-4 w-4 text-blue-600"></span>
            กำลังอัปเดตข้อมูล...
          </div>
        </div>
      ) : null}

      <RoleToast
        description={toast.message}
        open={toast.show}
        title={toast.tone === "success" ? "ดำเนินการสำเร็จ" : "มีข้อมูลอัปเดต"}
        tone={toast.tone}
      />

      {showReminderModal ? (
        <div className="fixed inset-0 z-[220] grid place-items-center overflow-y-auto overscroll-contain bg-slate-900/60 p-3 backdrop-blur-sm sm:p-4">
          <div className="flex min-h-0 max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
                  <Megaphone className="h-5 w-5 text-blue-600" />
                  ส่งแจ้งเตือนนักศึกษา
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedReminderTarget.id ? `ผู้รับ: ${selectedReminderTarget.name}` : "ผู้รับ: นักศึกษาที่ค้างประเมินทั้งหมด"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReminderModal(false)}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-slate-50/70 px-6 py-6">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Channel</p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={sendViaAppNotification}
                      onChange={() => setSendViaAppNotification()}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    App Notification
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={sendViaEmail}
                      onChange={() => setSendViaEmail()}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Email มหาวิทยาลัย
                  </label>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Message</p>
                <textarea
                  rows={5}
                  value={reminderMessage}
                  onChange={(event) => setReminderMessage(event.target.value)}
                  className="mt-3 w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-100 px-6 py-5 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowReminderModal(false)}
                className="w-full rounded-2xl px-4 py-2.5 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100 sm:w-auto"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isSendingReminder || !sendViaAppNotification}
                onClick={handleReminderSubmit}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
              >
                <Send className="h-4 w-4" />
                ยืนยันการส่งข้อความ
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function StudentDevelopmentDashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-100">
          <span className="loader h-7 w-7 text-blue-600"></span>
        </main>
      }
    >
      <StudentDevelopmentDashboardContent />
    </Suspense>
  );
}
