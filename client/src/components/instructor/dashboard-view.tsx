"use client";

import { AlertCircle, BookOpen, Calendar, ChevronRight, Clock, FileWarning, GraduationCap } from "lucide-react";
import { DashboardPanel } from "@/components/ui/dashboard-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { UI_BUTTON_PRIMARY, UI_TEXT_LINK } from "@/lib/ui-classes";
import type { BehaviorRecord, BehaviorRecordStatus, StudentGroup } from "./types";

type DashboardViewProps = {
  studentGroups: StudentGroup[];
  studentsCount: number;
  pendingRecordsCount: number;
  latestHistory: BehaviorRecord[];
  dashboardGroupsPreview: StudentGroup[];
  statusBadgeMap: Record<BehaviorRecordStatus, string>;
  onOpenReport: () => void;
  onNavigateHistory: () => void;
  onOpenGroup: (groupId: StudentGroup["id"]) => void;
  formatThaiDateTime: (value: string) => string;
};

const statusLabelMap: Record<BehaviorRecordStatus, string> = {
  PENDING: "รอดำเนินการ",
  ACKNOWLEDGED: "รับทราบแล้ว",
  COMPLETED: "เสร็จสิ้น",
};

export function DashboardView({
  studentGroups,
  studentsCount,
  pendingRecordsCount,
  latestHistory,
  dashboardGroupsPreview,
  statusBadgeMap,
  onOpenReport,
  onNavigateHistory,
  onOpenGroup,
  formatThaiDateTime,
}: DashboardViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={() => onOpenReport()} className={UI_BUTTON_PRIMARY}>
          <AlertCircle size={18} aria-hidden /> แจ้งพฤติกรรมผิดปกติทันที
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
        <MetricCard tone="blue" icon={BookOpen} label="กลุ่มติดตามที่พร้อมใช้งาน" value={studentGroups.length} />
        <MetricCard
          tone="slate"
          icon={GraduationCap}
          label="นักศึกษาที่ได้รับมอบหมาย"
          value={studentsCount}
          subtitle={studentsCount === 0 ? "ยังไม่มีนักศึกษาในขอบเขต ติดต่อผู้ดูแลระบบเพื่อมอบหมาย" : undefined}
        />
        <MetricCard tone="amber" icon={FileWarning} label="เคสที่รอการรับเรื่อง" value={pendingRecordsCount} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardPanel
          flush
          title="ติดตามการแจ้งเตือนล่าสุด"
          icon={Clock}
          action={
            <button type="button" onClick={() => onNavigateHistory()} className={UI_TEXT_LINK}>
              ดูทั้งหมด
            </button>
          }
        >
          {latestHistory.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {latestHistory.map((record) => (
                <li key={record.id} className="px-5 py-4 transition-colors hover:bg-slate-50/80 sm:px-6">
                  <div className="mb-1 flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {record.student.name} ({record.student.studentId || "-"})
                    </p>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusBadgeMap[record.status]}`}>
                      {statusLabelMap[record.status]}
                    </span>
                  </div>
                  <p className="line-clamp-1 text-xs text-slate-500">{record.details}</p>
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
                    <Calendar size={11} aria-hidden /> {formatThaiDateTime(record.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Clock} title="ยังไม่มีประวัติการแจ้งเรื่อง" description="เมื่อมีการแจ้งพฤติกรรม รายการล่าสุดจะปรากฏที่นี่" />
          )}
        </DashboardPanel>

        <DashboardPanel title="กลุ่มติดตามปัจจุบัน" flush>
          {dashboardGroupsPreview.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {dashboardGroupsPreview.map((group) => (
                <li key={group.id}>
                  <button
                    type="button"
                    onClick={() => onOpenGroup(group.id)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50/80 sm:px-6"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">
                        {group.code}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{group.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{group.students} นักศึกษา</p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-slate-400" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={BookOpen}
              title="ยังไม่มีกลุ่มติดตาม"
              description="เมื่อได้รับมอบหมายกลุ่มเรียน รายการจะแสดงที่นี่"
            />
          )}
        </DashboardPanel>
      </div>
    </div>
  );
}
