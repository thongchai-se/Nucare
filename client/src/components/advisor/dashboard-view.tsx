"use client";

import {
  Activity,
  AlertCircle,
  CalendarDays,
  ClipboardList,
  Flag,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import { DashboardAlert } from "@/components/ui/dashboard-alert";
import { DashboardPanel } from "@/components/ui/dashboard-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { ScreeningReviewQueue } from "@/components/screening-review/screening-review-queue";
import { UI_ACTION_PRIMARY_COMPACT, UI_ACTION_SECONDARY_COMPACT, UI_TEXT_LINK } from "@/lib/ui-classes";
import type { UpcomingCalendarAppointment } from "./upcoming-week-calendar";
import { UpcomingWeekTimeline } from "./upcoming-week-timeline";
import type { AdvisorStudent, RiskMeta, StudentRiskLevel } from "./types";

type DashboardNavigateView = "advisees" | "consultations" | "referrals" | "academic" | "observations";

type UpcomingAppointmentPreview = UpcomingCalendarAppointment;

type DashboardViewProps = {
  studentsCount: number;
  highRiskStudents: AdvisorStudent[];
  pendingReferralsCount: number;
  pendingConsultationCount: number;
  waitingAdvisorOfferCount: number;
  otherNegotiationCount: number;
  upcomingAppointmentCount: number;
  upcomingAppointments: UpcomingAppointmentPreview[];
  scheduledConsultationCount: number;
  pendingInstructorSignalsCount: number;
  latestUpdatedStudents: AdvisorStudent[];
  riskMeta: Record<StudentRiskLevel, RiskMeta>;
  formatAssessmentSummary: (student: AdvisorStudent) => string;
  onNavigate: (
    view: DashboardNavigateView,
    options?: { tab?: "pending" | "accepted" | "scheduled" | "closed" }
  ) => void;
  onOpenStudent: (studentId: string) => void;
  onOpenSoap: (student: AdvisorStudent) => void;
};

type InboxItem = {
  key: string;
  title: string;
  detail: string;
  count: number;
  icon: typeof ClipboardList;
  onClick: () => void;
  urgent?: boolean;
};

/** หน้าหลักที่ปรึกษา — โครงเดียวกับแดชบอร์ดผู้เชี่ยวชาญ (MetricCard + DashboardPanel) */
export function DashboardView(props: DashboardViewProps) {
  const {
    studentsCount,
    highRiskStudents,
    pendingReferralsCount,
    pendingConsultationCount,
    waitingAdvisorOfferCount,
    otherNegotiationCount,
    upcomingAppointmentCount,
    upcomingAppointments,
    scheduledConsultationCount,
    pendingInstructorSignalsCount,
    latestUpdatedStudents,
    riskMeta,
    formatAssessmentSummary,
    onNavigate,
    onOpenStudent,
    onOpenSoap,
  } = props;

  const priorityStudents = highRiskStudents.length > 0 ? highRiskStudents : latestUpdatedStudents.slice(0, 4);

  const inboxItems: InboxItem[] = [
    {
      key: "offer-waiting",
      title: "ข้อเสนอรอคุณตอบ",
      detail: "นิสิตขอเปลี่ยนวัน/ที่ — ยอมรับหรือเสนอใหม่",
      count: waitingAdvisorOfferCount,
      icon: ClipboardList,
      urgent: true,
      onClick: () => onNavigate("consultations", { tab: "accepted" }),
    },
    {
      key: "consult-pending",
      title: "คำขอรอรับ",
      detail: "ยังไม่ได้กดรับคำขอ",
      count: pendingConsultationCount,
      icon: ClipboardList,
      onClick: () => onNavigate("consultations", { tab: "pending" }),
    },
    {
      key: "upcoming",
      title: "นัดใกล้ถึง",
      detail: "นัดที่ยืนยันแล้วใน 7 วันข้างหน้า",
      count: upcomingAppointmentCount,
      icon: CalendarDays,
      onClick: () => onNavigate("consultations", { tab: "scheduled" }),
    },
    {
      key: "negotiate-other",
      title: "รอเจรจานัด",
      detail: "ยังไม่เสนอนัด หรือรอนิสิตตอบ",
      count: otherNegotiationCount,
      icon: ClipboardList,
      onClick: () => onNavigate("consultations", { tab: "accepted" }),
    },
    {
      key: "signals",
      title: "สัญญาณเข้า",
      detail: "อาจารย์ผู้สอนแจ้งมา — รับเรื่องหรือส่งต่อ",
      count: pendingInstructorSignalsCount,
      icon: Flag,
      onClick: () => onNavigate("academic"),
    },
    {
      key: "referrals",
      title: "ส่งต่อคงค้าง",
      detail: "รอทีมปลายทางรับเคส",
      count: pendingReferralsCount,
      icon: Send,
      onClick: () => onNavigate("referrals"),
    },
  ].filter((item) => item.count > 0);

  return (
    <div className="space-y-6">
      <div className="inline-flex w-max items-center gap-2 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        เปิดการคุ้มครองข้อมูลส่วนบุคคล (PDPA)
      </div>

      {highRiskStudents.length > 0 ? (
        <DashboardAlert
          tone="amber"
          icon={AlertCircle}
          title={`มีนักศึกษาเสี่ยงสูง ${highRiskStudents.length} รายการ`}
          description="เปิดรายชื่อเพื่อวางแผนดูแลหรือส่งต่อ — กดการ์ดด้านล่างเพื่อทำงานต่อ"
          action={
            <button type="button" onClick={() => onNavigate("advisees")} className={UI_ACTION_PRIMARY_COMPACT}>
              ดูรายชื่อเสี่ยงสูง
            </button>
          }
        />
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
        <MetricCard
          tone="blue"
          icon={ClipboardList}
          subtitle="ยังไม่ได้กดรับ"
          label="คำขอรอรับ"
          value={pendingConsultationCount}
          onClick={() => onNavigate("consultations", { tab: "pending" })}
        />
        <MetricCard
          tone="rose"
          icon={ClipboardList}
          subtitle="นิสิตขอเปลี่ยนวัน/ที่"
          label="ข้อเสนอรอตอบ"
          value={waitingAdvisorOfferCount}
          emphasized={waitingAdvisorOfferCount > 0}
          onClick={() => onNavigate("consultations", { tab: "accepted" })}
        />
        <MetricCard
          tone="slate"
          icon={CalendarDays}
          subtitle="ใน 7 วันข้างหน้า"
          label="นัดใกล้ถึง"
          value={upcomingAppointmentCount}
          onClick={() => onNavigate("consultations", { tab: "scheduled" })}
        />
        <MetricCard
          tone="amber"
          icon={Flag}
          subtitle="จากอาจารย์ผู้สอน"
          label="สัญญาณเข้า"
          value={pendingInstructorSignalsCount}
          emphasized={pendingInstructorSignalsCount > 0}
          onClick={() => onNavigate("academic")}
        />
      </div>

      {inboxItems.length > 0 ? (
        <DashboardPanel title="ต้องทำก่อน" icon={Activity} description="กดรายการเพื่อไปทำต่อ">
          <div className="space-y-3">
            {inboxItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  className={`flex w-full items-start justify-between gap-3 rounded-xl px-4 py-3.5 text-left transition-colors ${
                    item.urgent ? "bg-rose-50/70 hover:bg-rose-50" : "bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        item.urgent ? "bg-rose-100 text-rose-700" : "bg-white text-slate-600"
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-600">{item.detail}</p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold ${
                      item.urgent ? "bg-rose-100 text-rose-800" : "bg-slate-200 text-slate-800"
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
        </DashboardPanel>
      ) : (
        <DashboardPanel title="ต้องทำก่อน" icon={Activity}>
          <EmptyState
            icon={Activity}
            title="คิวว่างแล้ว"
            description="เมื่อมีคำขอ สัญญาณ หรือส่งต่อค้าง ระบบจะแสดงที่นี่"
            className="py-6"
          />
        </DashboardPanel>
      )}

      <ScreeningReviewQueue basePath="/api/advisor/screening-reviews" viewer="advisor" />

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardPanel>
          <UpcomingWeekTimeline
            appointments={upcomingAppointments}
            onOpenAll={() => onNavigate("consultations", { tab: "scheduled" })}
          />
        </DashboardPanel>

        <DashboardPanel
          title="ภาพรวมที่ปรึกษา"
          icon={Users}
          action={
            <button type="button" onClick={() => onNavigate("advisees")} className={UI_TEXT_LINK}>
              เปิดรายชื่อ
            </button>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              tone="emerald"
              icon={CalendarDays}
              label="นัดที่ยืนยันแล้ว"
              value={scheduledConsultationCount}
              subtitle="ทั้งหมด"
              onClick={() => onNavigate("consultations", { tab: "scheduled" })}
            />
            <MetricCard
              tone="slate"
              icon={Users}
              label="นักศึกษาในที่ปรึกษา"
              value={studentsCount}
              subtitle="เปิดรายชื่อ"
              onClick={() => onNavigate("advisees")}
            />
          </div>
          {pendingReferralsCount > 0 || otherNegotiationCount > 0 ? (
            <div className="mt-4 space-y-2">
              {pendingReferralsCount > 0 ? (
                <button
                  type="button"
                  onClick={() => onNavigate("referrals")}
                  className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100"
                >
                  <span className="text-sm font-semibold text-slate-900">ส่งต่อคงค้าง</span>
                  <span className="rounded-md bg-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-800">
                    {pendingReferralsCount}
                  </span>
                </button>
              ) : null}
              {otherNegotiationCount > 0 ? (
                <button
                  type="button"
                  onClick={() => onNavigate("consultations", { tab: "accepted" })}
                  className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100"
                >
                  <span className="text-sm font-semibold text-slate-900">รอเจรจานัด</span>
                  <span className="rounded-md bg-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-800">
                    {otherNegotiationCount}
                  </span>
                </button>
              ) : null}
            </div>
          ) : null}
        </DashboardPanel>
      </div>

      <DashboardPanel
        title={highRiskStudents.length > 0 ? "รายชื่อที่ควรดูก่อน" : "อัปเดตล่าสุด"}
        icon={Users}
        description={
          highRiskStudents.length > 0
            ? "เรียงจากกลุ่มเสี่ยงสูง — กดเพื่อเปิดหน้ารายละเอียด"
            : "นักศึกษาที่มีการอัปเดตข้อมูลล่าสุด"
        }
        action={
          <button type="button" onClick={() => onNavigate("advisees")} className={UI_TEXT_LINK}>
            เปิดทั้งหมด
          </button>
        }
      >
        {priorityStudents.length > 0 ? (
          <div className="space-y-3">
            {priorityStudents.slice(0, 5).map((student) => {
              const meta = riskMeta[student.riskLevel];
              return (
                <div key={student.id} className="rounded-xl border border-slate-100 p-4">
                  <button
                    type="button"
                    onClick={() => onOpenStudent(student.id)}
                    className="flex w-full flex-col gap-3 text-left sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#278ACA]/15 text-sm font-semibold text-[#0057A8]">
                        {student.image}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{student.name}</p>
                        <p className="mt-1 text-xs text-slate-600">{formatAssessmentSummary(student)}</p>
                      </div>
                    </div>
                    <span className={`w-max shrink-0 rounded-md px-2.5 py-1 text-[10px] font-semibold ${meta.badgeClassName}`}>
                      {meta.label}
                    </span>
                  </button>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => onOpenSoap(student)}
                      className={`${UI_ACTION_SECONDARY_COMPACT} flex-1 py-2.5 text-sm`}
                    >
                      บันทึกดูแล
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenStudent(student.id)}
                      className={`${UI_ACTION_PRIMARY_COMPACT} flex-1 py-2.5 text-sm`}
                    >
                      เปิดรายละเอียด
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Activity}
            title="ยังไม่มีรายการที่ต้องติดตามด่วน"
            description="เมื่อมีผลประเมินหรือคำขอใหม่ ระบบจะแสดงที่นี่"
            className="py-6"
          />
        )}
      </DashboardPanel>
    </div>
  );
}
