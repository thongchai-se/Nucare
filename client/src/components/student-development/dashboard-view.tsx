"use client";

import {
  ArrowRightLeft,
  Bell,
  ClipboardCheck,
  Megaphone,
  Send,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { DashboardAlert } from "@/components/ui/dashboard-alert";
import { DashboardPanel } from "@/components/ui/dashboard-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { sanitizeDisplayNote } from "@/lib/display-note";
import { getNameInitials } from "@/lib/name-prefix";
import { formatStudentIdDisplay } from "@/lib/student-id";
import { referralStatusBadgeClass, STATUS_BADGE_COMPACT, URGENT_BADGE_CLASS } from "@/lib/status-badge";
import {
  UI_ACTION_PRIMARY_COMPACT,
  UI_BUTTON_PRIMARY,
  UI_INLINE_ACTION,
  UI_TEXT_LINK,
} from "@/lib/ui-classes";
import { RiskSummaryCards } from "./risk-summary-cards";
import type {
  PendingStudent,
  RiskInsightCard,
  ScreeningMeta,
  ScreeningStats,
  StudentDevelopmentAlert,
  WelfareTask,
} from "./types";

type DashboardViewProps = {
  screeningStats: ScreeningStats;
  screeningMeta?: ScreeningMeta;
  pendingStudents: PendingStudent[];
  wellnessActivities: RiskInsightCard[];
  welfareTasks: WelfareTask[];
  alerts?: StudentDevelopmentAlert[];
  onOpenReminder: (student: PendingStudent | null) => void;
  onNavigate: (view: "tracking" | "wellness" | "welfare") => void;
};

export function DashboardView({
  screeningStats,
  screeningMeta,
  pendingStudents,
  wellnessActivities,
  welfareTasks,
  alerts = [],
  onOpenReminder,
  onNavigate,
}: DashboardViewProps) {
  const waveLabel = screeningMeta?.openWaveLabel;
  const alertTitle = screeningMeta?.hasOpenSurveyWave
    ? waveLabel
      ? `รอบคัดกรองเปิดอยู่: ${waveLabel}`
      : "รอบคัดกรองเปิดอยู่"
    : "ยังไม่มีคลื่นแบบประเมินที่เปิดอยู่";
  const alertDescription = screeningMeta?.hasOpenSurveyWave
    ? "ตรวจสอบนิสิตที่ค้างประเมินและส่งแจ้งเตือนให้ครบก่อนปิดรอบ"
    : "เมื่อแอดมินเปิดคลื่นแบบประเมิน รายชื่อค้างประเมินจะอัปเดตตาม assignment";

  const highRiskCount =
    wellnessActivities.find((item) => item.status === "กลุ่มเสี่ยงสูง")?.registered ??
    screeningStats.highRiskCount;
  let waitingWelfareCount = 0;
  let openWelfareCount = 0;
  for (const task of welfareTasks) {
    if (task.referralStatus === "CLOSED") {
      continue;
    }
    openWelfareCount += 1;
    if (task.status === "รอประสานงาน") {
      waitingWelfareCount += 1;
    }
  }

  const queueItems = [
    {
      id: "pending",
      label: "ค้างประเมิน",
      count: screeningStats.pending,
      hint: screeningStats.pending > 0 ? "ไปติดตามและส่งแจ้งเตือน" : "ไม่มีรายการค้าง",
      icon: ClipboardCheck,
      tone: screeningStats.pending > 0 ? "amber" : "slate",
      onClick: () => onNavigate("tracking"),
    },
    {
      id: "high-risk",
      label: "กลุ่มเสี่ยงสูง",
      count: highRiskCount,
      hint: highRiskCount > 0 ? "ดูสรุปเพื่อวางการติดตาม" : "ยังไม่มีในผลล่าสุด",
      icon: ShieldAlert,
      tone: highRiskCount > 0 ? "rose" : "slate",
      onClick: () => onNavigate("wellness"),
    },
    {
      id: "welfare",
      label: "เคสรอประสานงาน",
      count: waitingWelfareCount,
      hint:
        waitingWelfareCount > 0
          ? `เปิดอยู่ทั้งหมด ${openWelfareCount} เคส`
          : openWelfareCount > 0
            ? `กำลังประสาน ${openWelfareCount} เคส`
            : "ไม่มีเคสรอประสาน",
      icon: ArrowRightLeft,
      tone: waitingWelfareCount > 0 ? "blue" : "slate",
      onClick: () => onNavigate("welfare"),
    },
  ] as const;

  const toneClass = {
    amber: "bg-amber-50 text-amber-800",
    rose: "bg-rose-50 text-rose-800",
    blue: "bg-blue-50 text-blue-800",
    slate: "bg-slate-50 text-slate-600",
  } as const;

  return (
    <div className="space-y-6">
      <DashboardAlert tone="rose" icon={ShieldCheck} title={alertTitle} description={alertDescription} />

      {alerts.length > 0 ? (
        <DashboardPanel
          title="เคสสวัสดิการใหม่"
          description="มีรายการส่งมายังงานพัฒนานิสิต"
          icon={Bell}
          action={
            <button
              type="button"
              onClick={() => onNavigate("welfare")}
              className={UI_ACTION_PRIMARY_COMPACT}
            >
              ไปงานสวัสดิการ
            </button>
          }
          flush
        >
          <ul className="divide-y divide-slate-100">
            {alerts.slice(0, 5).map((alert) => {
              const note = sanitizeDisplayNote(alert.message);
              return (
                <li key={alert.id} className="flex items-start gap-3 px-5 py-3.5 sm:px-6">
                  <span
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0057A8]"
                    aria-hidden
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{alert.title || "เคสสวัสดิการใหม่"}</p>
                    {note ? (
                      <p className="mt-0.5 line-clamp-2 text-sm leading-5 text-slate-600">{note}</p>
                    ) : (
                      <p className="mt-0.5 text-sm text-slate-500">มีรายละเอียดในงานสวัสดิการ</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </DashboardPanel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.9fr]">
        <DashboardPanel title="ความคืบหน้าการคัดกรอง" icon={ClipboardCheck}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-3xl font-semibold tabular-nums tracking-tight text-slate-950">
                  {screeningStats.percentage}%
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  ทำแบบประเมินแล้ว {screeningStats.completed} จาก {screeningStats.totalTarget} คน
                  {screeningStats.pending > 0 ? (
                    <span className="text-amber-800"> · ค้าง {screeningStats.pending} คน</span>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenReminder(null)}
                disabled={screeningStats.pending === 0}
                className={`${UI_BUTTON_PRIMARY} shrink-0 self-start`}
              >
                <Megaphone className="h-4 w-4" aria-hidden />
                ส่งแจ้งเตือนทั้งหมด
              </button>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#0057A8] transition-[width] duration-300"
                style={{ width: `${screeningStats.percentage}%` }}
              />
            </div>
            {screeningStats.pending === 0 && screeningStats.totalTarget > 0 ? (
              <p className="text-sm text-emerald-700">ครบทุกรายการในรอบนี้แล้ว</p>
            ) : null}
          </div>
        </DashboardPanel>

        <DashboardPanel title="คิวงานที่ต้องทำ" description="ตัวเลขจริงจากระบบ กดเพื่อไปทำงานต่อ">
          <ul className="space-y-2">
            {queueItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0057A8]/40"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClass[item.tone]}`}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                        <span className="text-lg font-semibold tabular-nums tracking-tight text-slate-950">
                          {item.count}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">{item.hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </DashboardPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <DashboardPanel
          flush
          title="นิสิตที่ต้องติดตาม"
          description="กลุ่มที่ค้างประเมินหรือมี assignment คลื่นเปิดค้างอยู่"
          action={
            <button type="button" onClick={() => onNavigate("tracking")} className={UI_TEXT_LINK}>
              ดูทั้งหมด
            </button>
          }
        >
          {pendingStudents.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {pendingStudents.slice(0, 3).map((student) => (
                <li
                  key={student.id}
                  className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-sm font-semibold text-amber-800">
                      {(student.studentCode || student.id).slice(-2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{student.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {student.studentCode || student.id} • ชั้นปี {student.year} • {student.lastActive}
                      </p>
                      <span className="mt-2 inline-flex shrink-0 whitespace-nowrap rounded-md bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                        {student.status}
                      </span>
                    </div>
                  </div>
                  <button type="button" onClick={() => onOpenReminder(student)} className={UI_INLINE_ACTION}>
                    <Send className="h-3.5 w-3.5" aria-hidden />
                    ส่งข้อความ
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={ClipboardCheck}
              title="ไม่มีนิสิตค้างติดตาม"
              description="เมื่อมีผู้ค้างประเมิน รายชื่อจะแสดงที่นี่"
            />
          )}
        </DashboardPanel>

        <DashboardPanel
          title="สรุปกลุ่มเสี่ยง"
          description="จากผลคัดกรองล่าสุด"
          action={
            <button type="button" onClick={() => onNavigate("wellness")} className={UI_TEXT_LINK}>
              ดูรายละเอียด
            </button>
          }
        >
          {wellnessActivities.length > 0 ? (
            <RiskSummaryCards items={wellnessActivities} />
          ) : (
            <EmptyState
              icon={Users}
              title="ยังไม่มีสรุปกลุ่มเสี่ยง"
              description="เมื่อมีผลคัดกรองแล้ว กลุ่มจะแสดงที่นี่"
            />
          )}
        </DashboardPanel>
      </div>

      <DashboardPanel
        title="เคสสวัสดิการ"
        description="ที่ต้องติดตาม"
        action={
          <button type="button" onClick={() => onNavigate("welfare")} className={UI_TEXT_LINK}>
            เปิดงานสวัสดิการ
          </button>
        }
      >
        {welfareTasks.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {welfareTasks.slice(0, 6).map((task) => {
              const note = sanitizeDisplayNote(task.note);
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onNavigate("welfare")}
                  className="rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-[#0057A8]/25 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0057A8]/30"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0057A8] text-sm font-bold text-white">
                      {getNameInitials(task.studentName, "นศ")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {task.studentName}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {formatStudentIdDisplay(task.studentCode)} · ปี {task.year}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {task.isUrgent ? (
                            <span className={`${STATUS_BADGE_COMPACT} ${URGENT_BADGE_CLASS}`}>ด่วน</span>
                          ) : null}
                          <span
                            className={`${STATUS_BADGE_COMPACT} ${referralStatusBadgeClass(task.referralStatus)}`}
                          >
                            {task.status}
                          </span>
                        </div>
                      </div>
                      {note ? (
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{note}</p>
                      ) : null}
                      <p className="mt-3 truncate text-[11px] text-slate-500">
                        {task.acceptedByName
                          ? `ผู้ประสาน ${task.acceptedByName}`
                          : `ส่งโดย ${task.owner}`}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={ClipboardCheck}
            title="ยังไม่มีเคสสวัสดิการ"
            description="เมื่ออาจารย์ส่งต่อมายังงานพัฒนานิสิต จะแสดงที่นี่"
          />
        )}
      </DashboardPanel>
    </div>
  );
}
