"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Database,
  HardDrive,
  Lock,
  Server,
  ShieldAlert,
  UploadCloud,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DashboardPanel } from "@/components/ui/dashboard-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard, type MetricCardTone } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { useSiteSettings } from "@/context/site-settings.context";
import { UI_BUTTON_PRIMARY, UI_BUTTON_SECONDARY, UI_TEXT_LINK } from "@/lib/ui-classes";
import type { Role } from "@/types/auth";
import type { AdminAuditLog, AdminStaffPreview } from "./types";

export type AdminSystemHealthSnapshot = {
  apiOk: boolean;
  databaseOk: boolean;
  databaseLatencyMs: number | null;
  directoryConfigured: boolean;
  directoryHost: string | null;
};

type DashboardViewProps = {
  quickStats: Array<{ title: string; value: string; tone: MetricCardTone; icon: LucideIcon }>;
  latestAuditLogs: AdminAuditLog[];
  staffPreview: AdminStaffPreview[];
  systemHealth: AdminSystemHealthSnapshot;
  activeStudentsCount: number;
  staffCount: number;
  roleBadgeMap: Record<Role, string>;
  roleLabelMap: Record<Role, string>;
  getSecurityAlertBadge: (log: AdminAuditLog) => { label: string; className: string };
  getAuditActionLabel: (log: AdminAuditLog) => string;
  getAuditActorName: (log: AdminAuditLog) => string;
  getAuditTargetLabel: (log: AdminAuditLog) => string;
  formatThaiDateTime: (value: string) => string;
};

type StatusRowProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  ok: boolean;
  warn?: boolean;
};

/** แถวสถานะสั้น — พื้นขาว+ตัวอักษรเข้ม อ่านง่าย; สถานะอยู่ที่ชิปสีชัด */
function StatusRow({ icon: Icon, label, value, ok, warn }: StatusRowProps) {
  const StatusIcon = ok ? CheckCircle2 : warn ? AlertTriangle : XCircle;
  const chip = ok
    ? "bg-emerald-700 text-white"
    : warn
      ? "bg-amber-700 text-white"
      : "bg-red-700 text-white";
  const chipLabel = ok ? "ปกติ" : warn ? "ควรตรวจ" : "ผิดปกติ";

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-600">{label}</p>
        <p className="truncate text-sm font-semibold text-slate-900">{value}</p>
      </div>
      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${chip}`}>
        <StatusIcon className="h-3.5 w-3.5" aria-hidden />
        {chipLabel}
      </span>
    </div>
  );
}

export function DashboardView(props: DashboardViewProps) {
  const {
    quickStats,
    latestAuditLogs,
    staffPreview,
    systemHealth,
    activeStudentsCount,
    staffCount,
    roleBadgeMap,
    roleLabelMap,
    getSecurityAlertBadge,
    getAuditActionLabel,
    getAuditActorName,
    getAuditTargetLabel,
    formatThaiDateTime,
  } = props;
  const { settings } = useSiteSettings();
  const maintenanceOn = settings.maintenanceEnabled;

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
                const badge = getSecurityAlertBadge(log);
                return (
                  <li key={log.id} className="flex items-start justify-between gap-3 px-5 py-4 sm:px-6">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{getAuditActionLabel(log)}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {getAuditActorName(log)} • {getAuditTargetLabel(log)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">{formatThaiDateTime(log.createdAt)}</p>
                    </div>
                    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold ${badge.className}`}>
                      {badge.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={Lock}
              title="ยังไม่มีเหตุการณ์ความปลอดภัยที่น่ากังวล"
              description="เมื่อมี login ผิดพลาด การยิงถี่ผิดปกติ หรือพยายามเข้าโซนสิทธิ์สูง ระบบจะแสดงที่นี่"
            />
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

        <DashboardPanel
          title="ระบบพร้อมใช้งาน"
          icon={Database}
          action={
            <Link href="/admin?view=settings" className={UI_TEXT_LINK}>
              รายละเอียด
            </Link>
          }
        >
          <div className="space-y-2">
            <StatusRow
              icon={Server}
              label="API"
              value={systemHealth.apiOk ? "ปกติ" : "ไม่พร้อม"}
              ok={systemHealth.apiOk}
            />
            <StatusRow
              icon={HardDrive}
              label="ฐานข้อมูล"
              value={
                systemHealth.databaseOk
                  ? systemHealth.databaseLatencyMs != null
                    ? `${systemHealth.databaseLatencyMs} ms`
                    : "ปกติ"
                  : "เชื่อมต่อไม่ได้"
              }
              ok={systemHealth.databaseOk}
            />
            <StatusRow
              icon={Building2}
              label="ไดเรกทอรี"
              value={
                systemHealth.directoryConfigured
                  ? systemHealth.directoryHost || "ตั้งค่าแล้ว"
                  : "ยังไม่ตั้งค่า"
              }
              ok={systemHealth.directoryConfigured}
              warn={!systemHealth.directoryConfigured}
            />
            <StatusRow
              icon={ShieldAlert}
              label="ปิดปรับปรุง"
              value={maintenanceOn ? "เปิดอยู่" : "ปิด"}
              ok={!maintenanceOn}
              warn={maintenanceOn}
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            นิสิตใช้งาน {activeStudentsCount.toLocaleString()} · บุคลากร {staffCount.toLocaleString()}
          </p>
        </DashboardPanel>
      </div>
    </div>
  );
}
