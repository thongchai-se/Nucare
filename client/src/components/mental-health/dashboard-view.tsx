"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  CalendarDays,
  CheckCircle2,
  FileText,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { DashboardAlert } from "@/components/ui/dashboard-alert";
import { DashboardPanel } from "@/components/ui/dashboard-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { stripSeedMarkers } from "@/lib/history-display";
import { UI_ACTION_PRIMARY_COMPACT, UI_ACTION_SECONDARY_COMPACT, UI_TEXT_LINK } from "@/lib/ui-classes";
import type {
  MentalHealthAlert,
  MentalHealthAppointment,
  MentalHealthCase,
  MentalHealthEmergencyCase,
  MentalHealthReferral,
  RiskClasses,
} from "./types";

type DashboardViewProps = {
  pendingReferrals: MentalHealthReferral[];
  activeCases: MentalHealthCase[];
  todayAppointments: MentalHealthAppointment[];
  emergencyCases: MentalHealthEmergencyCase[];
  alerts: MentalHealthAlert[];
  busyEmergencyCaseId?: string | null;
  navigateTo: (view: "queue" | "cases" | "appointments", referralId?: string) => void;
  handleAcknowledgeAlert: (alertId: string) => void | Promise<void>;
  onUpdateEmergencyCase: (caseId: string, status: MentalHealthEmergencyCase["status"]) => void | Promise<void>;
  openAppointmentModal: (item?: MentalHealthCase) => void;
  openCareModal: (item: MentalHealthCase) => void;
  loadDashboard: () => void | Promise<void>;
  getCaseStatusLabel: (item: MentalHealthCase) => string;
  getNextAppointmentLabel: (studentId: string) => string;
  formatThaiDateTime: (value: string) => string;
  formatLatestAssessment: (assessment: MentalHealthCase["latestAssessment"]) => string;
  getRiskClasses: (riskLevel: MentalHealthCase["riskLevel"] | MentalHealthReferral["student"]["riskLevel"]) => RiskClasses;
};

export function DashboardView({
  pendingReferrals,
  activeCases,
  todayAppointments,
  emergencyCases,
  alerts,
  busyEmergencyCaseId = null,
  navigateTo,
  handleAcknowledgeAlert,
  onUpdateEmergencyCase,
  openAppointmentModal,
  openCareModal,
  loadDashboard,
  getCaseStatusLabel,
  getNextAppointmentLabel,
  formatThaiDateTime,
  formatLatestAssessment,
  getRiskClasses,
}: DashboardViewProps) {
  const openSosCount = emergencyCases.filter((item) => item.status !== "RESOLVED").length;

  return (
    <div className="space-y-6">
      <div className="inline-flex w-max items-center gap-2 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        เปิดการคุ้มครองข้อมูลส่วนบุคคล (PDPA)
      </div>

      {openSosCount > 0 ? (
        <DashboardAlert
          tone="rose"
          icon={AlertTriangle}
          title={`มีคำขอช่วยเหลือด่วน ${openSosCount} รายการ`}
          description="รับดำเนินการหรือปิดเคสเมื่อช่วยเหลือแล้ว — หากฉุกเฉินนอกระบบให้แนะนำโทร 1323"
        />
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
        <MetricCard
          tone="blue"
          icon={ArrowRightLeft}
          subtitle="ส่งต่อจากที่ปรึกษา"
          label="คิวรอรับ"
          value={pendingReferrals.length}
          onClick={() => navigateTo("queue")}
        />
        <MetricCard
          tone="rose"
          icon={AlertTriangle}
          subtitle="SOS ที่ยังไม่ปิด"
          label="ช่วยเหลือด่วน"
          value={openSosCount}
          emphasized={openSosCount > 0}
        />
        <MetricCard
          tone="slate"
          icon={CalendarDays}
          subtitle="นัดวันนี้ที่ยังไม่จบ"
          label="นัดหมายวันนี้"
          value={todayAppointments.length}
          onClick={() => navigateTo("appointments")}
        />
        <MetricCard
          tone="emerald"
          icon={CheckCircle2}
          subtitle="รับแล้วและยังไม่ปิด"
          label="เคสที่ดูแล"
          value={activeCases.length}
          onClick={() => navigateTo("cases")}
        />
      </div>

      {emergencyCases.length > 0 ? (
        <DashboardPanel title="คำขอช่วยเหลือด่วน (SOS)" icon={AlertTriangle}>
          <div className="space-y-3">
            {emergencyCases.map((item) => (
              <div key={item.id} className="rounded-xl border border-rose-100 bg-rose-50/60 px-4 py-3.5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{item.student.name}</p>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                          item.status === "IN_PROGRESS"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {item.status === "IN_PROGRESS" ? "กำลังดำเนินการ" : "รอรับ"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      {item.student.studentId || "ไม่ระบุรหัส"} · ชั้นปี {item.student.year} ·{" "}
                      {formatThaiDateTime(item.openedAt)}
                    </p>
                    <p className="mt-2 text-sm text-slate-700">{item.summary}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    {item.status === "OPEN" ? (
                      <button
                        type="button"
                        disabled={busyEmergencyCaseId === item.id}
                        onClick={() => void onUpdateEmergencyCase(item.id, "IN_PROGRESS")}
                        className={UI_ACTION_PRIMARY_COMPACT}
                      >
                        รับดำเนินการ
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busyEmergencyCaseId === item.id}
                      onClick={() => void onUpdateEmergencyCase(item.id, "RESOLVED")}
                      className={UI_ACTION_SECONDARY_COMPACT}
                    >
                      ปิดเคส
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DashboardPanel>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardPanel
          title="คิวรอรับ"
          icon={ArrowRightLeft}
          action={
            <button type="button" onClick={() => navigateTo("queue")} className={UI_TEXT_LINK}>
              เปิดคิวรอรับ
            </button>
          }
        >
          {pendingReferrals.length > 0 ? (
            <div className="space-y-3">
              {pendingReferrals.slice(0, 3).map((item) => {
                const risk = getRiskClasses(item.student.riskLevel);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateTo("queue", item.id)}
                    className="flex w-full items-start justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3.5 text-left transition-colors hover:bg-slate-100"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{item.student.name}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        {item.student.studentId || "ไม่ระบุรหัส"} · ปี {item.student.year} · ส่งต่อโดย{" "}
                        {item.advisorName}
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                        {stripSeedMarkers(item.reason) || item.reason}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-md px-2.5 py-1 text-[10px] font-semibold ${risk.badge}`}>
                      {risk.label}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={ArrowRightLeft}
              title="ยังไม่มีคิวรอรับ"
              description="เมื่อมีเคสส่งต่อเข้าคิว ระบบจะแสดงที่นี่"
              className="py-6"
            />
          )}
        </DashboardPanel>

        <DashboardPanel
          title="นัดหมายวันนี้"
          icon={CalendarDays}
          action={
            <button type="button" onClick={() => openAppointmentModal()} className={UI_TEXT_LINK}>
              เพิ่มนัดหมาย
            </button>
          }
        >
          {todayAppointments.length > 0 ? (
            <div className="space-y-3">
              {todayAppointments.slice(0, 3).map((item) => (
                <div key={item.id} className="flex gap-4 rounded-xl bg-slate-50 px-4 py-3.5">
                  <div className="text-center">
                    <p className="text-sm font-semibold tabular-nums text-[#0057A8]">{item.time || "--:--"}</p>
                    <p className="text-[10px] text-slate-500">น.</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{item.studentName}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                      <MapPin className="h-3.5 w-3.5" aria-hidden />
                      {item.location || "ยังไม่ระบุสถานที่"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="วันนี้ยังไม่มีนัดหมาย"
              description="สร้างนัดหมายใหม่เพื่อติดตามเคสที่กำลังดูแล"
              className="py-6"
            />
          )}
        </DashboardPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <DashboardPanel
          title="เคสที่ดูแล"
          icon={Users}
          action={
            <button type="button" onClick={() => navigateTo("cases")} className={UI_TEXT_LINK}>
              เปิดทั้งหมด
            </button>
          }
        >
          {activeCases.length > 0 ? (
            <div className="space-y-4">
              {activeCases.slice(0, 4).map((item) => {
                const risk = getRiskClasses(item.riskLevel);
                return (
                  <div key={item.referralId} className="rounded-xl border border-slate-100 p-4">
                    <button
                      type="button"
                      onClick={() => navigateTo("cases", item.referralId)}
                      className="flex w-full flex-col gap-3 text-left sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          รหัส: {item.maskedStudentId} • {item.year} • โดย {item.advisorName}
                        </p>
                        <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                        {stripSeedMarkers(item.reason) || item.reason}
                      </p>
                      </div>
                      <span className={`w-max rounded-md px-2.5 py-1 text-[10px] font-semibold ${risk.badge}`}>
                        {risk.label}
                      </span>
                    </button>

                    <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-3">
                      <div>
                        <p className="text-xs font-medium text-slate-500">สถานะ</p>
                        <p className="mt-1 text-xs font-semibold text-[#0057A8]">{getCaseStatusLabel(item)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500">ประเมินล่าสุด</p>
                        <p className="mt-1 text-xs text-slate-700">{formatLatestAssessment(item.latestAssessment)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500">นัดหมายถัดไป</p>
                        <p className="mt-1 text-xs text-slate-700">{getNextAppointmentLabel(item.studentId)}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => openCareModal(item)}
                        className={`${UI_ACTION_SECONDARY_COMPACT} flex-1 py-2.5 text-sm`}
                      >
                        <FileText className="h-4 w-4" aria-hidden />
                        บันทึกผล
                      </button>
                      <button
                        type="button"
                        onClick={() => openAppointmentModal(item)}
                        className={`${UI_ACTION_PRIMARY_COMPACT} flex-1 py-2.5 text-sm`}
                      >
                        <CalendarDays className="h-4 w-4" aria-hidden />
                        นัดหมาย
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="ยังไม่มีเคสที่ดูแล"
              description="เมื่อรับเคสจากคิว รายการจะปรากฏที่นี่"
              className="py-6"
            />
          )}
        </DashboardPanel>

        <DashboardPanel
          title="สัญญาณและการแจ้งเตือน"
          icon={Activity}
          action={
            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="รีเฟรชการแจ้งเตือน"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          }
        >
          {alerts.length > 0 ? (
            <div className="space-y-3">
              {alerts.slice(0, 4).map((item) => (
                <div key={item.id} className="rounded-xl bg-slate-50 px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                      <p className="mt-2 text-xs text-slate-500">{formatThaiDateTime(item.createdAt)}</p>
                      <button
                        type="button"
                        onClick={() => void handleAcknowledgeAlert(item.id)}
                        className="mt-2 text-xs font-semibold text-blue-700 hover:text-blue-800"
                      >
                        รับทราบ
                      </button>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold ${
                        item.priority === "CRITICAL" || item.priority === "HIGH"
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {item.priority === "CRITICAL"
                        ? "วิกฤต"
                        : item.priority === "HIGH"
                          ? "สูง"
                          : item.priority === "MEDIUM"
                            ? "ปานกลาง"
                            : "ทั่วไป"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Activity}
              title="ยังไม่มีการแจ้งเตือนใหม่"
              description="ระบบจะแสดงสัญญาณสำคัญที่นี่เมื่อมีเหตุการณ์"
              className="py-6"
            />
          )}
        </DashboardPanel>
      </div>
    </div>
  );
}
