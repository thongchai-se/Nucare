"use client";

import Link from "next/link";
import { CheckCircle2, Database, Lock, UploadCloud } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DashboardPanel } from "@/components/ui/dashboard-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard, type MetricCardTone } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { UI_BUTTON_PRIMARY, UI_BUTTON_SECONDARY, UI_TEXT_LINK } from "@/lib/ui-classes";
import type { Role } from "@/types/auth";
import type { AdminAuditLog, AdminStaffPreview } from "./types";

type DashboardViewProps = {
  quickStats: Array<{ title: string; value: string; tone: MetricCardTone; icon: LucideIcon }>;
  latestAuditLogs: AdminAuditLog[];
  staffPreview: AdminStaffPreview[];
  systemOnline: boolean;
  activeStudentsCount: number;
  staffCount: number;
  roleBadgeMap: Record<Role, string>;
  roleLabelMap: Record<Role, string>;
  getAuditStatus: (log: AdminAuditLog) => "Success" | "Partial" | "Failed";
  getAuditStatusLabel: (status: "Success" | "Partial" | "Failed") => string;
  getAuditActionLabel: (log: AdminAuditLog) => string;
  getAuditActorName: (log: AdminAuditLog) => string;
  getAuditTargetLabel: (log: AdminAuditLog) => string;
  formatThaiDateTime: (value: string) => string;
};

export function DashboardView(props: DashboardViewProps) {
  const {
    quickStats,
    latestAuditLogs,
    staffPreview,
    systemOnline,
    activeStudentsCount,
    staffCount,
    roleBadgeMap,
    roleLabelMap,
    getAuditStatus,
    getAuditStatusLabel,
    getAuditActionLabel,
    getAuditActorName,
    getAuditTargetLabel,
    formatThaiDateTime,
  } = props;

  return (
    <div className="space-y-6">
      <PageHeader
        title="แดชบอร์ดผู้ดูแลระบบ"
        description="ภาพรวมการทำงานของระบบจัดการ Nucare และเครื่องมือดูแลข้อมูลหลัก"
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {quickStats.map((stat) => (
          <MetricCard key={stat.title} icon={stat.icon} label={stat.title} value={stat.value} tone={stat.tone} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <DashboardPanel
          title="แจ้งเตือนความปลอดภัยล่าสุด"
          icon={Lock}
          flush
          action={
            <Link href="/admin?view=audit" className={UI_TEXT_LINK}>
              ดูทั้งหมด
            </Link>
          }
        >
          {latestAuditLogs.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {latestAuditLogs.map((log) => {
                const status = getAuditStatus(log);
                return (
                  <li key={log.id} className="flex items-start justify-between gap-3 px-5 py-4 sm:px-6">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{getAuditActionLabel(log)}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {getAuditActorName(log)} • {getAuditTargetLabel(log)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">{formatThaiDateTime(log.createdAt)}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold ${
                        status === "Success"
                          ? "bg-emerald-100 text-emerald-800"
                          : status === "Partial"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {getAuditStatusLabel(status)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={Lock} title="ยังไม่มีข้อมูลบันทึกระบบ" description="เมื่อมีการดำเนินการสำคัญ ระบบจะแสดงบันทึกที่นี่" />
          )}
        </DashboardPanel>

        <DashboardPanel
          title="บุคลากรในระบบ"
          flush
          action={
            <Link href="/admin/manage-staff" className={UI_TEXT_LINK}>
              ไปหน้าจัดการ
            </Link>
          }
        >
          <ul className="divide-y divide-slate-100">
            {staffPreview.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{item.employeeId || item.email || "-"}</p>
                </div>
                <span className={`shrink-0 rounded-md px-2.5 py-1 text-[10px] font-semibold ${roleBadgeMap[item.role]}`}>
                  {roleLabelMap[item.role]}
                </span>
              </li>
            ))}
          </ul>
        </DashboardPanel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardPanel title="อัปเดตฐานข้อมูลแบบกลุ่ม" icon={UploadCloud}>
          <p className="max-w-md text-sm leading-6 text-slate-500">
            นำเข้าข้อมูลนักศึกษาหรือบุคลากรแบบกลุ่มผ่านไฟล์ CSV พร้อมตรวจสอบก่อนบันทึกเข้าสู่ระบบ
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:max-w-sm">
            <Link href="/admin/import-students" className={`${UI_BUTTON_PRIMARY} text-center`}>
              นำเข้านักศึกษา
            </Link>
            <Link href="/admin/import-staff" className={`${UI_BUTTON_SECONDARY} text-center`}>
              นำเข้าบุคลากร
            </Link>
          </div>
        </DashboardPanel>

        <DashboardPanel title="ระบบพร้อมใช้งาน" icon={Database}>
          <div className="space-y-3">
            <div
              className={`flex items-center gap-3 rounded-xl px-3.5 py-3 ${
                systemOnline ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"
              }`}
            >
              <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
              <div>
                <p className="text-sm font-semibold">{systemOnline ? "เชื่อมต่อ API ปกติ" : "ระบบต้องการตรวจสอบ"}</p>
                <p className="text-xs opacity-80">
                  สถานะล่าสุด: {systemOnline ? "ระบบพร้อมใช้งาน" : "ระบบไม่พร้อมใช้งาน"}
                </p>
              </div>
            </div>
            <p className="text-sm leading-6 text-slate-600">
              บัญชีนักศึกษาที่เปิดใช้งานอยู่ตอนนี้ {activeStudentsCount.toLocaleString()} รายการ และบุคลากรในระบบ{" "}
              {staffCount.toLocaleString()} รายการ
            </p>
          </div>
        </DashboardPanel>
      </div>
    </div>
  );
}
