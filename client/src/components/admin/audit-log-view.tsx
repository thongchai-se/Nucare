"use client";

import { Download } from "lucide-react";
import type { Role } from "@/types/auth";
import type { AdminAuditLog } from "./types";

type AuditLogViewProps = {
  filteredAuditLogs: AdminAuditLog[];
  paginatedAuditLogs: AdminAuditLog[];
  searchQuery: string;
  auditStartItemIndex: number;
  auditEndItemIndex: number;
  auditCurrentPage: number;
  canGoPrevAudit: boolean;
  canGoNextAudit: boolean;
  roleLabelMap: Record<Role, string>;
  onSearchQueryChange: (value: string) => void;
  onExport: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  getAuditStatus: (log: AdminAuditLog) => "Success" | "Partial" | "Failed";
  getAuditStatusLabel: (status: "Success" | "Partial" | "Failed") => string;
  getAuditActionLabel: (log: AdminAuditLog) => string;
  getAuditActorName: (log: AdminAuditLog) => string;
  getAuditTargetLabel: (log: AdminAuditLog) => string;
  getAuditTargetReference: (log: AdminAuditLog) => string;
  getAuditLogRef: (log: AdminAuditLog) => string;
  getAuditIpLabel: (log: AdminAuditLog) => string;
  getResolvedAuditActionDetail: (log: AdminAuditLog) => string;
  formatThaiDate: (value: string) => string;
  formatThaiTime: (value: string) => string;
};

export function AuditLogView(props: AuditLogViewProps) {
  const {
    filteredAuditLogs,
    paginatedAuditLogs,
    searchQuery,
    auditStartItemIndex,
    auditEndItemIndex,
    auditCurrentPage,
    canGoPrevAudit,
    canGoNextAudit,
    roleLabelMap,
    onSearchQueryChange,
    onExport,
    onPrevPage,
    onNextPage,
    getAuditStatus,
    getAuditStatusLabel,
    getAuditActionLabel,
    getAuditActorName,
    getAuditTargetLabel,
    getAuditTargetReference,
    getAuditLogRef,
    getAuditIpLabel,
    getResolvedAuditActionDetail,
    formatThaiDate,
    formatThaiTime,
  } = props;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold text-slate-950">บันทึกระบบ</h2>
          <p className="mt-1 text-sm text-slate-500">
            ประวัติการใช้งานและการเข้าถึงข้อมูลทั้งหมดเพื่อตรวจสอบย้อนหลัง
          </p>
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={filteredAuditLogs.length === 0}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={16} /> ส่งออก Log (.csv)
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 p-4">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="ค้นหาตามผู้ใช้งาน, กิจกรรม, หรือ IP..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-28" />
              <col className="w-32" />
              <col className="w-[16%]" />
              <col className="w-[28%]" />
              <col className="w-[18%]" />
              <col className="w-28" />
              <col className="w-24" />
            </colgroup>
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="p-4 font-bold text-slate-600">เลขอ้างอิง</th>
                <th className="p-4 font-bold text-slate-600">วัน/เวลา</th>
                <th className="p-4 font-bold text-slate-600">ผู้ใช้งาน</th>
                <th className="p-4 font-bold text-slate-600">กิจกรรม</th>
                <th className="p-4 font-bold text-slate-600">เป้าหมาย</th>
                <th className="p-4 font-bold text-slate-600">IP Address</th>
                <th className="p-4 font-bold text-slate-600">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedAuditLogs.map((log) => {
                const status = getAuditStatus(log);
                return (
                  <tr key={log.id} className="transition-colors hover:bg-slate-50">
                    <td className="p-4 align-top">
                      <p className="font-mono text-xs font-semibold tracking-wide text-slate-700">
                        {getAuditLogRef(log)}
                      </p>
                    </td>
                    <td className="p-4 align-top text-slate-700">
                      <p className="font-medium">{formatThaiDate(log.createdAt)}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatThaiTime(log.createdAt)}</p>
                    </td>
                    <td className="p-4 align-top text-slate-800">
                      <p className="font-bold break-words">{getAuditActorName(log)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {log.actor?.role ? roleLabelMap[log.actor.role] : "ระบบ"}
                      </p>
                    </td>
                    <td className="p-4 align-top text-slate-700">
                      <p className="font-semibold text-slate-800">{getAuditActionLabel(log)}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {getResolvedAuditActionDetail(log)}
                      </p>
                    </td>
                    <td className="p-4 align-top text-slate-600">
                      <p className="font-medium text-slate-700">{getAuditTargetLabel(log)}</p>
                      {log.entityId ? (
                        <p className="mt-1 font-mono text-[11px] leading-5 tracking-wide text-slate-500">
                          {getAuditTargetReference(log)}
                        </p>
                      ) : null}
                    </td>
                    <td className="p-4 align-top">
                      <p className="text-xs leading-5 text-slate-600" title={log.ipAddress || undefined}>
                        {getAuditIpLabel(log)}
                      </p>
                    </td>
                    <td className="p-4 align-top">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          status === "Success"
                            ? "bg-emerald-100 text-emerald-700"
                            : status === "Partial"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {getAuditStatusLabel(status)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filteredAuditLogs.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-sm text-slate-500">
                    ไม่พบบันทึกที่ตรงกับคำค้นหา
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="text-sm tabular-nums text-slate-500">
            แสดง{" "}
            <span className="font-medium text-slate-800">
              {filteredAuditLogs.length === 0 ? 0 : auditStartItemIndex + 1}
            </span>
            -
            <span className="font-medium text-slate-800">{auditEndItemIndex}</span> จาก
            <span className="font-medium text-slate-800"> {filteredAuditLogs.length}</span> รายการ
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={!canGoPrevAudit}
              onClick={onPrevPage}
              className="min-w-[82px] rounded border border-slate-200 bg-white px-3 py-1 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              ก่อนหน้า
            </button>
            <button
              type="button"
              className="min-w-[42px] rounded border border-slate-200 bg-slate-900 px-3 py-1 text-center font-medium tabular-nums text-white"
            >
              {auditCurrentPage}
            </button>
            <button
              type="button"
              disabled={!canGoNextAudit}
              onClick={onNextPage}
              className="min-w-[82px] rounded border border-slate-200 bg-white px-3 py-1 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              ถัดไป
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
