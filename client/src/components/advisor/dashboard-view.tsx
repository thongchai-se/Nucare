"use client";

import {
  Activity,
  AlertCircle,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Flag,
  Send,
  Users,
} from "lucide-react";
import { DashboardAlert } from "@/components/ui/dashboard-alert";
import { DashboardPanel } from "@/components/ui/dashboard-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { ScreeningReviewQueue } from "@/components/screening-review/screening-review-queue";
import { UI_INLINE_ACTION, UI_TEXT_LINK } from "@/lib/ui-classes";
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

/** หน้าหลักที่ปรึกษา — แยกข้อเสนอรอตอบและนัดใกล้ถึงออกจากคิวรวม */
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

  const totalInbox = inboxItems.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">งานวันนี้</h2>
        <p className="mt-1 text-sm text-slate-500">
          {totalInbox > 0 ? `มี ${totalInbox} รายการในคิว` : "คิวว่างแล้ว — เปิดเมนูซ้ายเมื่อต้องการดูรายชื่อ"}
        </p>
      </div>

      {highRiskStudents.length > 0 ? (
        <DashboardAlert
          tone="amber"
          icon={AlertCircle}
          title="มีนักศึกษาเสี่ยงสูงต้องดูแล"
          description={`พบ ${highRiskStudents.length} ราย — เปิดรายชื่อเพื่อวางแผนดูแลหรือส่งต่อ`}
          action={
            <button
              type="button"
              onClick={() => onNavigate("advisees")}
              className="whitespace-nowrap rounded-full bg-[#C24712] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#A33B0F]"
            >
              ดูรายชื่อเสี่ยงสูง
            </button>
          }
        />
      ) : null}

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">ต้องทำก่อน</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {inboxItems.length > 0 ? "กดการ์ดเพื่อไปทำต่อ" : "เมื่อมีคำขอ สัญญาณ หรือส่งต่อค้าง จะขึ้นที่นี่"}
          </p>
        </div>
        {inboxItems.length > 0 ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {inboxItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={item.onClick}
                    className={`flex w-full min-w-0 items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-[0_10px_28px_-24px_rgba(15,23,42,0.45)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_14px_32px_-22px_rgba(15,23,42,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0057A8]/40 ${
                      item.urgent ? "border-red-200/90" : "border-slate-200/90"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        item.urgent ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-bold leading-snug text-slate-900">{item.title}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${
                            item.urgent ? "bg-red-600" : "bg-red-500"
                          }`}
                        >
                          {item.count}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">{item.detail}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_10px_28px_-24px_rgba(15,23,42,0.45)] sm:p-6">
            <EmptyState
              icon={Activity}
              title="คิวว่างแล้ว"
              description="กลับมาที่นี่เมื่อมีงานใหม่ หรือไปที่นักศึกษาในที่ปรึกษาเพื่อดูรายชื่อ"
            />
          </div>
        )}
      </section>

      <ScreeningReviewQueue basePath="/api/advisor/screening-reviews" viewer="advisor" />

      <DashboardPanel>
        <UpcomingWeekTimeline
          appointments={upcomingAppointments}
          onOpenAll={() => onNavigate("consultations", { tab: "scheduled" })}
        />
      </DashboardPanel>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetricCard
          tone="emerald"
          icon={CalendarDays}
          label="นัดหมายแล้วทั้งหมด"
          value={String(scheduledConsultationCount)}
          subtitle="รวมนัดที่ยืนยันแล้ว"
          onClick={() => onNavigate("consultations", { tab: "scheduled" })}
        />
        <MetricCard
          tone="slate"
          icon={Users}
          label="นักศึกษาในที่ปรึกษา"
          value={String(studentsCount)}
          subtitle="เปิดรายชื่อทั้งหมด"
          onClick={() => onNavigate("advisees")}
        />
      </div>

      <DashboardPanel
        flush
        title={highRiskStudents.length > 0 ? "รายชื่อที่ควรดูก่อน" : "อัปเดตล่าสุด"}
        description={
          highRiskStudents.length > 0
            ? "เรียงจากกลุ่มเสี่ยงสูง — กดเพื่อเปิดหน้ารายละเอียด"
            : "นักศึกษาที่มีการอัปเดตข้อมูลล่าสุด"
        }
        action={
          <button type="button" onClick={() => onNavigate("advisees")} className={UI_TEXT_LINK}>
            ดูทั้งหมด
          </button>
        }
      >
        {priorityStudents.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {priorityStudents.slice(0, 5).map((student) => {
              const meta = riskMeta[student.riskLevel];
              return (
                <li
                  key={student.id}
                  className="flex min-w-0 flex-col gap-3 px-4 py-4 transition-colors hover:bg-slate-50/80 sm:flex-row sm:items-start sm:gap-3 sm:px-6"
                >
                  <button
                    type="button"
                    onClick={() => onOpenStudent(student.id)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#278ACA]/15 text-sm font-semibold text-[#0057A8]">
                      {student.image}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words text-sm font-semibold text-[#0057A8]">{student.name}</p>
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.badgeClassName}`}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{formatAssessmentSummary(student)}</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenSoap(student)}
                    className={`${UI_INLINE_ACTION} w-full justify-center sm:w-auto sm:shrink-0`}
                  >
                    บันทึกดูแล
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={Activity}
            title="ยังไม่มีรายการที่ต้องติดตามด่วน"
            description="เมื่อมีผลประเมินหรือคำขอใหม่ ระบบจะแสดงที่นี่"
          />
        )}
      </DashboardPanel>
    </div>
  );
}
