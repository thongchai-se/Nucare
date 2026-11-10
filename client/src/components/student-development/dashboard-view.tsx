"use client";

import { AlertCircle, ClipboardCheck, Megaphone, Send, ShieldCheck, Users } from "lucide-react";
import { DashboardAlert } from "@/components/ui/dashboard-alert";
import { DashboardPanel } from "@/components/ui/dashboard-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { UI_BUTTON_PRIMARY, UI_INLINE_ACTION, UI_TEXT_LINK } from "@/lib/ui-classes";
import type {
  CampaignHighlight,
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
  campaignHighlights: CampaignHighlight[];
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
  campaignHighlights,
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

  return (
    <div className="space-y-6">
      <DashboardAlert tone="rose" icon={ShieldCheck} title={alertTitle} description={alertDescription} />

      {alerts.length > 0 ? (
        <DashboardPanel title="การแจ้งเตือนเคสส่งต่อ" description="เคสสวัสดิการใหม่ที่ส่งมายังงานพัฒนานิสิต">
          <ul className="space-y-3">
            {alerts.slice(0, 5).map((alert) => (
              <li key={alert.id} className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">{alert.title}</p>
                <p className="mt-1 text-sm text-slate-600">{alert.message}</p>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => onNavigate("welfare")} className={`${UI_TEXT_LINK} mt-3`}>
            ไปที่งานสวัสดิการ
          </button>
        </DashboardPanel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.9fr]">
        <DashboardPanel title="ความคืบหน้าการคัดกรอง" icon={ClipboardCheck}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex-1">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-semibold tabular-nums tracking-tight text-slate-950">
                    {screeningStats.percentage}%
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    ทำแบบประเมินแล้ว {screeningStats.completed} จาก {screeningStats.totalTarget} คน
                  </p>
                </div>
                <div className="rounded-xl bg-amber-50 px-4 py-3 text-right">
                  <p className="text-xs font-medium text-amber-800">ค้างประเมิน</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-900">
                    {screeningStats.pending}
                  </p>
                </div>
              </div>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[#0057A8] transition-[width] duration-300"
                  style={{ width: `${screeningStats.percentage}%` }}
                />
              </div>
              <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                <AlertCircle className="h-4 w-4 text-amber-600" aria-hidden />
                มีนิสิต {screeningStats.pending} คนที่ยังค้างประเมิน
              </p>
            </div>

            <button
              type="button"
              onClick={() => onOpenReminder(null)}
              disabled={screeningStats.pending === 0}
              className={UI_BUTTON_PRIMARY}
            >
              <Megaphone className="h-4 w-4" aria-hidden />
              ส่งแจ้งเตือนทั้งหมด
            </button>
          </div>
        </DashboardPanel>

        <DashboardPanel title="โฟกัสวันนี้">
          <div className="space-y-3">
            {campaignHighlights.map((highlight) => (
              <div key={highlight.title} className="rounded-xl bg-slate-50 px-4 py-3.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <span className="rounded-lg bg-white p-2 text-rose-700 shadow-sm">{highlight.icon}</span>
                  {highlight.title}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{highlight.description}</p>
              </div>
            ))}
          </div>
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
          flush
          title="สรุปกลุ่มเสี่ยงจากผลคัดกรอง"
          description="ใช้วางกิจกรรมเชิงป้องกันตามระดับความเสี่ยง"
          action={
            <button type="button" onClick={() => onNavigate("wellness")} className={UI_TEXT_LINK}>
              ดูรายละเอียด
            </button>
          }
        >
          {wellnessActivities.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {wellnessActivities.map((activity) => (
                <li key={activity.id} className="px-5 py-4 sm:px-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{activity.name}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{activity.focus}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <span
                        className={`inline-flex shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                          activity.status === "กลุ่มเสี่ยงสูง"
                            ? "bg-red-100 text-red-800"
                            : activity.status === "กลุ่มเสี่ยงปานกลาง"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {activity.status}
                      </span>
                      <p className="mt-2 text-sm font-semibold tabular-nums text-slate-700">
                        {activity.registered} คน
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
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
        title="ประสานงานสวัสดิการที่กำลังดำเนินการ"
        description="เคสส่งต่อมายังงานพัฒนานิสิตที่ยังต้องติดตาม"
        action={
          <button type="button" onClick={() => onNavigate("welfare")} className={UI_TEXT_LINK}>
            เปิดมุมมองงานสวัสดิการ
          </button>
        }
      >
        {welfareTasks.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {welfareTasks.slice(0, 6).map((task) => (
              <div key={task.id} className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold leading-6 text-slate-900">{task.title}</p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                      task.status === "กำลังประสานงาน"
                        ? "bg-blue-100 text-blue-800"
                        : task.status === "ปิดงานแล้ว"
                          ? "bg-slate-100 text-slate-600"
                          : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {task.status}
                  </span>
                </div>
                <p className="mt-3 line-clamp-3 text-sm text-slate-600">{task.note}</p>
                <div className="mt-4 flex items-center justify-between border-t border-slate-200/80 pt-3 text-xs text-slate-500">
                  <span>{task.owner}</span>
                  <span>{task.updatedAt}</span>
                </div>
              </div>
            ))}
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
