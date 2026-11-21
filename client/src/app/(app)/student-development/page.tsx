"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRightLeft,
  ClipboardCheck,
  LayoutDashboard,
  Images,
  Megaphone,
  MessageCircle,
  Send,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth.context";
import { AppBrand } from "@/components/app-brand";
import { EphemeralChatPanel } from "@/components/ephemeral-chat/ephemeral-chat-panel";
import { StaffMessagesView } from "@/components/ephemeral-chat/staff-messages-view";
import { RoleToast } from "@/components/role-toast";
import { InlineAlert } from "@/components/ui/inline-alert";
import { StaffModalOverlay } from "@/components/ui/staff-modal-overlay";
import { resolveActionToastPresentation } from "@/lib/expandable-toast";
import { StaffSidebarFooter } from "@/components/staff-sidebar-footer";
import { StaffSidebarNavButton } from "@/components/staff-sidebar-nav-item";
import { StaffSidebarSection } from "@/components/staff-sidebar-section";
import { StaffTopBar } from "@/components/staff-top-bar";
import { useEphemeralChatUnread } from "@/hooks/use-ephemeral-chat-unread";
import api from "@/lib/axios";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  STAFF_SIDEBAR_ASIDE,
  STAFF_SIDEBAR_HEADER,
  STAFF_SIDEBAR_MOBILE_HEADER,
  STAFF_SIDEBAR_MOBILE_NAV_SCROLL,
  STAFF_SIDEBAR_NAV_SCROLL,
  UI_DIALOG_CANCEL,
  UI_DIALOG_CLOSE,
  UI_DIALOG_PRIMARY,
} from "@/lib/ui-classes";
import { getRoleHomePath, hasRole } from "@/lib/roles";
import { UNAUTHENTICATED_PATH } from "@/lib/auth-routes";
import { DashboardView } from "@/components/student-development/dashboard-view";
import { PublicityView } from "@/components/student-development/publicity-view";
import { TrackingView } from "@/components/student-development/tracking-view";
import { WelfareView } from "@/components/student-development/welfare-view";
import { WellnessView } from "@/components/student-development/wellness-view";
import type {
  ActiveView,
  PendingStudent,
  RiskInsightCard,
  ScreeningMeta,
  ScreeningStats,
  StudentDevelopmentAlert,
  WelfareReferralStatus,
  WelfareTask,
} from "@/components/student-development/types";

type ToastState = {
  show: boolean;
  message: string;
  tone: "success" | "info" | "error";
};

type StudentDevelopmentDashboardResponse = {
  screeningStats: ScreeningStats;
  screeningMeta?: ScreeningMeta;
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
    acceptedByUserId?: string | null;
    acceptedByName?: string | null;
    staffNote?: string | null;
    closedReason?: string | null;
    advisorName: string;
    student: {
      id: string;
      name: string;
      studentCode: string;
      year: string;
      section: string;
      email?: string | null;
      phone?: string | null;
      guardianPhone?: string | null;
      riskLevel: "high" | "medium" | "normal";
      latestAssessment: {
        totalScore: number;
        instrument: string;
        assessedAt: string;
      } | null;
    };
  }>;
  alerts?: StudentDevelopmentAlert[];
};

const isStudentDevelopmentView = (value: string | null): value is ActiveView =>
  value === "dashboard" ||
  value === "tracking" ||
  value === "wellness" ||
  value === "welfare" ||
  value === "publicity" ||
  value === "messages";

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
  const [yearFilter, setYearFilter] = useState<"ALL" | string>("ALL");
  const [loadingData, setLoadingData] = useState(false);
  const [serverError, setServerError] = useState("");
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [isUpdatingWelfare, setIsUpdatingWelfare] = useState(false);
  const [dashboardData, setDashboardData] = useState<StudentDevelopmentDashboardResponse>({
    screeningStats: emptyScreeningStats,
    screeningMeta: { hasOpenSurveyWave: false, openWaveLabel: null },
    pendingStudents: [],
    riskInsights: [],
    supportCases: [],
    alerts: [],
  });
  const [toast, setToast] = useState<ToastState>({ show: false, message: "", tone: "success" });
  const [sendViaAppNotification, setSendViaAppNotification] = useState(true);
  const [sendViaEmail, setSendViaEmail] = useState(false);
  const [chatPeerId, setChatPeerId] = useState<string | null>(null);
  const { unreadCount: chatUnreadCount, refreshUnreadCount } = useEphemeralChatUnread(
    Boolean(user && isAuthenticated)
  );

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace(UNAUTHENTICATED_PATH);
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
      setServerError(getApiErrorMessage(error, "โหลดแดชบอร์ดไม่สำเร็จ กรุณาลองใหม่"));
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && hasRole(user, "STUDENT_DEVELOPMENT")) {
      void loadDashboard();
    }
  }, [loadDashboard, loading, user]);

  const requestedView = searchParams.get("view");
  const activeView: ActiveView = isStudentDevelopmentView(requestedView) ? requestedView : "dashboard";

  const screeningStats = dashboardData.screeningStats;
  const screeningMeta = dashboardData.screeningMeta ?? {
    hasOpenSurveyWave: false,
    openWaveLabel: null,
  };

  const pendingStudents = useMemo<PendingStudent[]>(
    () =>
      dashboardData.pendingStudents.map((student) => ({
        ...student,
        lastActive: student.latestReminderAt
          ? `แจ้งเตือนล่าสุด ${formatThaiDateTime(student.latestReminderAt)}`
          : "ยังไม่เคยแจ้งเตือน",
      })),
    [dashboardData.pendingStudents]
  );

  const riskInsightCards = useMemo<RiskInsightCard[]>(
    () =>
      dashboardData.riskInsights.map((insight, index) => ({
        id: String(index + 1),
        name: insight.title,
        date: "อ้างอิงจากผลประเมินล่าสุด",
        registered: insight.count,
        status:
          insight.tone === "critical"
            ? "กลุ่มเสี่ยงสูง"
            : insight.tone === "attention"
              ? "กลุ่มเสี่ยงปานกลาง"
              : "กลุ่มปกติ",
        focus: insight.description,
      })),
    [dashboardData.riskInsights]
  );

  const welfareTasks = useMemo<WelfareTask[]>(
    () =>
      dashboardData.supportCases.map((caseItem) => ({
        id: caseItem.id,
        title: `${caseItem.student.name} (${caseItem.student.studentCode})`,
        studentName: caseItem.student.name,
        studentCode: caseItem.student.studentCode,
        year: caseItem.student.year || "-",
        owner: caseItem.advisorName,
        referralStatus: caseItem.status,
        status:
          caseItem.status === "PENDING"
            ? "รอประสานงาน"
            : caseItem.status === "ACCEPTED"
              ? "กำลังประสานงาน"
              : "ปิดเคสแล้ว",
        updatedAt: `อัปเดต ${formatThaiDateTime(caseItem.updatedAt)}`,
        updatedAtRaw: caseItem.updatedAt,
        note: caseItem.reason,
        studentUserId: caseItem.student.id,
        isUrgent: caseItem.isUrgent,
        acceptedByUserId: caseItem.acceptedByUserId ?? null,
        acceptedByName: caseItem.acceptedByName ?? null,
        staffNote: caseItem.staffNote ?? null,
        closedReason: caseItem.closedReason ?? null,
        phone: caseItem.student.phone ?? null,
        guardianPhone: caseItem.student.guardianPhone ?? null,
        email: caseItem.student.email ?? null,
      })),
    [dashboardData.supportCases]
  );

  const yearOptions = useMemo(() => {
    const years = pendingStudents.map((student) => student.year).filter((year) => year && year !== "-");
    return Array.from(new Set(years)).sort((left, right) => Number(left) - Number(right) || left.localeCompare(right));
  }, [pendingStudents]);

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

      return [
        student.studentCode,
        student.name,
        student.year,
        student.section,
        student.advisorName || "",
        student.status,
        student.lastActive,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [pendingStudents, searchKeyword, yearFilter]);

  const openReminderModal = (student: PendingStudent | null) => {
    setSelectedReminderTarget(student ?? emptyPendingStudent);

    const waveHint = screeningMeta.openWaveLabel ? ` (${screeningMeta.openWaveLabel})` : "";
    const defaultMessage = student
      ? `ประกาศจากฝ่ายพัฒนานักศึกษา: กรุณาเข้าสู่ระบบ NuCare เพื่อทำแบบประเมินสุขภาพจิต${waveHint} โดยเร็วที่สุด หากต้องการความช่วยเหลือสามารถติดต่อเจ้าหน้าที่ได้`
      : `ประกาศจากฝ่ายพัฒนานักศึกษา: กรุณาเข้าสู่ระบบ NuCare เพื่อทำแบบประเมินสุขภาพจิต${waveHint} ให้ครบถ้วน ขอบคุณครับ/ค่ะ`;

    setReminderMessage(defaultMessage);
    setShowReminderModal(true);
  };

  const navigateTo = (view: ActiveView) => {
    setIsMobileMenuOpen(false);
    router.replace(view === "dashboard" ? "/student-development" : `/student-development?view=${view}`);
  };

  const handleLogout = async () => {
    await logout();
    router.replace(UNAUTHENTICATED_PATH);
  };

  const handleReminderSubmit = async () => {
    if (!reminderMessage.trim()) {
      return;
    }

    const hasSpecificTarget = Boolean(selectedReminderTarget.id);

    setIsSendingReminder(true);
    setServerError("");

    try {
      if (!sendViaAppNotification && !sendViaEmail) {
        setToast({
          show: true,
          message: "เลือกอย่างน้อยหนึ่งช่องทางแจ้งเตือน",
          tone: "info",
        });
        return;
      }

      const response = await api.post<{ sentCount: number; emailSentCount?: number }>(
        "/api/student-development/screening-reminders",
        {
          message: reminderMessage.trim(),
          studentUserIds: hasSpecificTarget ? [selectedReminderTarget.id] : undefined,
          sendInApp: sendViaAppNotification,
          sendEmail: sendViaEmail,
        }
      );

      setShowReminderModal(false);
      setSelectedReminderTarget(emptyPendingStudent);
      const emailPart =
        sendViaEmail && typeof response.data.emailSentCount === "number"
          ? ` · อีเมล ${response.data.emailSentCount} ฉบับ`
          : "";
      setToast({
        show: true,
        message:
          response.data.sentCount > 1
            ? `ส่งแจ้งเตือนแล้ว ${response.data.sentCount} ราย${emailPart}`
            : hasSpecificTarget
              ? `ส่งแจ้งเตือนถึง ${selectedReminderTarget.name} เรียบร้อยแล้ว${emailPart}`
              : `ส่งแจ้งเตือนเรียบร้อยแล้ว${emailPart}`,
        tone: "success",
      });
      await loadDashboard();
    } catch (error) {
      const message = getApiErrorMessage(error, "ไม่สามารถส่งแจ้งเตือนได้");
      setServerError(message);
      setToast({
        show: true,
        message,
        tone: "error",
      });
    } finally {
      setIsSendingReminder(false);
    }
  };

  const handleUpdateWelfareStatus = async (
    referralId: string,
    status: WelfareReferralStatus,
    extras?: { staffNote?: string; closedReason?: string }
  ) => {
    if (isUpdatingWelfare) {
      return;
    }

    setIsUpdatingWelfare(true);
    setServerError("");

    try {
      await api.patch(`/api/student-development/referrals/${referralId}/status`, {
        status,
        ...(extras?.staffNote ? { staffNote: extras.staffNote } : {}),
        ...(extras?.closedReason ? { closedReason: extras.closedReason } : {}),
      });
      await loadDashboard();
      setToast({
        show: true,
        message:
          status === "ACCEPTED"
            ? "รับประสานสวัสดิการแล้ว"
            : status === "CLOSED"
              ? "ปิดเคสสวัสดิการแล้ว"
              : "บันทึกสถานะสวัสดิการแล้ว",
        tone: "success",
      });
    } catch (error) {
      const message = getApiErrorMessage(error, "ไม่สามารถบันทึกสถานะสวัสดิการได้");
      setServerError(message);
      setToast({
        show: true,
        message,
        tone: "error",
      });
    } finally {
      setIsUpdatingWelfare(false);
    }
  };

  /** รับช่วงเคสสวัสดิการจากเพื่อนร่วมทีม */
  const handleClaimWelfare = async (referralId: string) => {
    if (isUpdatingWelfare) {
      return;
    }

    setIsUpdatingWelfare(true);
    setServerError("");

    try {
      await api.post(`/api/student-development/referrals/${referralId}/claim`);
      await loadDashboard();
      setToast({
        show: true,
        message: "รับช่วงเคสสวัสดิการแล้ว",
        tone: "success",
      });
    } catch (error) {
      const message = getApiErrorMessage(error, "ไม่สามารถรับช่วงเคสได้");
      setServerError(message);
      setToast({
        show: true,
        message,
        tone: "error",
      });
    } finally {
      setIsUpdatingWelfare(false);
    }
  };

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

  const NavSections = () => (
    <>
      <StaffSidebarSection title="งานประจำวัน">
        <StaffSidebarNavButton
          active={activeView === "dashboard"}
          icon={<LayoutDashboard size={20} />}
          label="หน้าหลัก"
          onClick={() => navigateTo("dashboard")}
        />
        <StaffSidebarNavButton
          active={activeView === "tracking"}
          icon={<Users size={20} />}
          label="ติดตามการคัดกรอง"
          onClick={() => navigateTo("tracking")}
        />
      </StaffSidebarSection>

      <StaffSidebarSection title="วิเคราะห์และสวัสดิการ">
        <StaffSidebarNavButton
          active={activeView === "wellness"}
          icon={<ClipboardCheck size={20} />}
          label="สรุปกลุ่มเสี่ยง"
          onClick={() => navigateTo("wellness")}
        />
        <StaffSidebarNavButton
          active={activeView === "welfare"}
          icon={<ArrowRightLeft size={20} />}
          label="ประสานงานสวัสดิการ"
          onClick={() => navigateTo("welfare")}
        />
      </StaffSidebarSection>

      <StaffSidebarSection title="สื่อและประชาสัมพันธ์">
        <StaffSidebarNavButton
          active={activeView === "publicity"}
          icon={<Images size={20} />}
          label="ประชาสัมพันธ์ให้นิสิต"
          onClick={() => navigateTo("publicity")}
        />
      </StaffSidebarSection>

      <StaffSidebarSection title="ติดต่อ">
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

  const actionToast = resolveActionToastPresentation({
    message: toast.message,
    tone: toast.tone,
  });

  return (
    <div className="flex min-h-screen bg-[#F4F7FB] font-sans text-slate-800">
      <aside className={STAFF_SIDEBAR_ASIDE}>
        <div className={STAFF_SIDEBAR_HEADER}>
          <AppBrand size="compact" subtitle="คณะพยาบาลศาสตร์" />
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
              <AppBrand size="compact" subtitle="คณะพยาบาลศาสตร์" />
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className={STAFF_SIDEBAR_MOBILE_NAV_SCROLL}>
              <NavSections />
            </div>

            <StaffSidebarFooter
              onLogout={() => {
                setIsMobileMenuOpen(false);
                void handleLogout();
              }}
              onRoleSelect={() => setIsMobileMenuOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <StaffTopBar onOpenMenu={() => setIsMobileMenuOpen((current) => !current)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl pb-10">
            {serverError ? <InlineAlert className="mb-6 rounded-2xl">{serverError}</InlineAlert> : null}

            {activeView === "dashboard" && (
              <DashboardView
                alerts={dashboardData.alerts ?? []}
                pendingStudents={pendingStudents}
                screeningMeta={screeningMeta}
                screeningStats={screeningStats}
                welfareTasks={welfareTasks}
                wellnessActivities={riskInsightCards}
                onNavigate={navigateTo}
                onOpenReminder={openReminderModal}
              />
            )}
            {activeView === "tracking" && (
              <TrackingView
                filteredPendingStudents={filteredPendingStudents}
                searchKeyword={searchKeyword}
                yearFilter={yearFilter}
                yearOptions={yearOptions}
                onOpenReminder={openReminderModal}
                onSearchKeywordChange={setSearchKeyword}
                onYearFilterChange={setYearFilter}
              />
            )}
            {activeView === "wellness" && <WellnessView wellnessActivities={riskInsightCards} />}
            {activeView === "welfare" && (
              <WelfareView
                currentUserId={user.id}
                welfareTasks={welfareTasks}
                onUpdateStatus={handleUpdateWelfareStatus}
                onClaimOwnership={handleClaimWelfare}
                onOpenChat={(studentUserId) => setChatPeerId(studentUserId)}
              />
            )}
            {activeView === "publicity" && <PublicityView />}
            {activeView === "messages" && (
              <StaffMessagesView
                onOpenChat={(peerUserId) => setChatPeerId(peerUserId)}
                onUnreadCountChange={() => {
                  void refreshUnreadCount();
                }}
              />
            )}
          </div>
        </main>
      </div>

      <EphemeralChatPanel
        open={Boolean(chatPeerId)}
        currentUserId={user.id}
        peerUserId={chatPeerId}
        onClose={() => {
          setChatPeerId(null);
          void refreshUnreadCount();
        }}
      />

      {loadingData ? (
        <div className="pointer-events-none fixed bottom-20 right-6 z-40 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="loader h-4 w-4 text-blue-600"></span>
            กำลังโหลดข้อมูล...
          </div>
        </div>
      ) : null}

      <RoleToast
        description={actionToast.description}
        open={toast.show}
        onClose={() => setToast((current) => ({ ...current, show: false }))}
        title={actionToast.title}
        tone={toast.tone}
      />

      {showReminderModal ? (
        <StaffModalOverlay
          panelClassName="max-w-xl"
          onBackdropClick={() => setShowReminderModal(false)}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-sky-50 to-white" />
          <button
            type="button"
            onClick={() => setShowReminderModal(false)}
            className={UI_DIALOG_CLOSE}
            aria-label="ปิด"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>

          <div className="relative px-6 pb-2 pt-8 sm:px-8 sm:pt-9">
            <div className="flex flex-col items-center text-center">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0057A8] text-white shadow-[0_10px_20px_-8px_rgba(0,87,168,0.4)]"
                aria-hidden
              >
                <Megaphone className="h-5 w-5" strokeWidth={2.25} />
              </div>
              <h2 className="mt-4 text-lg font-bold text-slate-900 sm:text-xl">ส่งแจ้งเตือนนิสิต</h2>
              <p className="mt-2 text-sm text-slate-600">
                {selectedReminderTarget.id
                  ? `ผู้รับ: ${selectedReminderTarget.name}`
                  : "ผู้รับ: นิสิตที่ค้างประเมินทั้งหมด"}
              </p>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4 sm:px-8">
            <div>
              <p className="text-xs font-semibold text-slate-500">ช่องทาง</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={sendViaAppNotification}
                    onChange={(event) => setSendViaAppNotification(event.target.checked)}
                    className="rounded border-slate-300 text-[#0057A8] focus:ring-[#0057A8]"
                  />
                  แจ้งเตือนในแอป
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={sendViaEmail}
                    onChange={(event) => setSendViaEmail(event.target.checked)}
                    className="rounded border-slate-300 text-[#0057A8] focus:ring-[#0057A8]"
                  />
                  อีเมลมหาวิทยาลัย
                </label>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500">ข้อความ</p>
              <textarea
                rows={5}
                value={reminderMessage}
                onChange={(event) => setReminderMessage(event.target.value)}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700 outline-none transition focus:border-[#0057A8]/40 focus:ring-4 focus:ring-[#0057A8]/10"
              />
            </div>
          </div>

          <div className="relative flex flex-col-reverse gap-2.5 px-6 pb-6 pt-2 sm:flex-row sm:justify-center sm:px-8 sm:pb-7">
            <button
              type="button"
              onClick={() => setShowReminderModal(false)}
              className={`${UI_DIALOG_CANCEL} sm:min-w-[7rem]`}
            >
              ยกเลิก
            </button>
            <button
              type="button"
              disabled={isSendingReminder || (!sendViaAppNotification && !sendViaEmail)}
              onClick={() => void handleReminderSubmit()}
              className={UI_DIALOG_PRIMARY}
            >
              <Send className="h-4 w-4" />
              ยืนยันการส่งข้อความ
            </button>
          </div>
        </StaffModalOverlay>
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
