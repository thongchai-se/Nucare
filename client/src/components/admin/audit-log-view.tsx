"use client";

import { Download } from "lucide-react";
import { ListPaginationFooter } from "@/components/ui/list-pagination-footer";
import {
  RosterSearchInput,
  RosterSelectFilter,
  RosterToolbarEnd,
} from "@/components/ui/roster-table";
import {
  AUDIT_DISPLAY_STATUS_FILTER_OPTIONS,
  type AuditDisplayStatus,
} from "@/lib/audit-status";
import type { Role } from "@/types/auth";
import type { AdminAuditLog } from "./types";

type AuditLogViewProps = {
  filteredAuditLogs: AdminAuditLog[];
  paginatedAuditLogs: AdminAuditLog[];
  searchQuery: string;
  auditStatusFilter: "ALL" | AuditDisplayStatus;
  auditFromDate: string;
  auditToDate: string;
  auditLoading?: boolean;
  auditStartItemIndex: number;
  auditEndItemIndex: number;
  auditCurrentPage: number;
  canGoPrevAudit: boolean;
  canGoNextAudit: boolean;
  roleLabelMap: Record<Role, string>;
  onSearchQueryChange: (value: string) => void;
  onAuditStatusFilterChange: (value: "ALL" | AuditDisplayStatus) => void;
  onAuditFromDateChange: (value: string) => void;
  onAuditToDateChange: (value: string) => void;
  onReloadAudit: () => void;
  onExport: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  getAuditStatus: (log: AdminAuditLog) => AuditDisplayStatus;
  getAuditStatusLabel: (status: AuditDisplayStatus) => string;
  getAuditStatusClassName: (status: AuditDisplayStatus) => string;
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
    auditStatusFilter,
    auditFromDate,
    auditToDate,
    auditLoading = false,
    auditStartItemIndex,
    auditEndItemIndex,
    auditCurrentPage,
    canGoPrevAudit,
    canGoNextAudit,
    roleLabelMap,
    onSearchQueryChange,
    onAuditStatusFilterChange,
    onAuditFromDateChange,
    onAuditToDateChange,
    onReloadAudit,
    onExport,
    onPrevPage,
    onNextPage,
    getAuditStatus,
    getAuditStatusLabel,
    getAuditStatusClassName,
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
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <RosterSearchInput
              value={searchQuery}
              onChange={onSearchQueryChange}
              placeholder="ค้นหาตามผู้ใช้งาน, กิจกรรม, หรือ IP..."
              aria-label="ค้นหาบันทึกระบบ"
            />
            <RosterToolbarEnd>
              <RosterSelectFilter
                value={auditStatusFilter}
                onChange={(value) => onAuditStatusFilterChange(value as "ALL" | AuditDisplayStatus)}
                aria-label="กรองสถานะบันทึก"
              >
                <option value="ALL">ทุกสถานะ</option>
                {AUDIT_DISPLAY_STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </RosterSelectFilter>
            </RosterToolbarEnd>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="text-xs font-semibold text-slate-600">
              จากวันที่
              <input
                type="date"
                value={auditFromDate}
                onChange={(event) => onAuditFromDateChange(event.target.value)}
                className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              ถึงวันที่
              <input
                type="date"
                value={auditToDate}
                onChange={(event) => onAuditToDateChange(event.target.value)}
                className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm"
              />
            </label>
            <button
              type="button"
              onClick={onReloadAudit}
              disabled={auditLoading}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              {auditLoading ? "กำลังโหลด..." : "โหลดตามช่วงวัน"}
            </button>
            <p className="self-center text-xs text-slate-500">ดึงได้สูงสุด 500 รายการล่าสุดในช่วงที่เลือก</p>
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
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${getAuditStatusClassName(status)}`}
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
        <ListPaginationFooter
          total={filteredAuditLogs.length}
          rangeStart={filteredAuditLogs.length === 0 ? 0 : auditStartItemIndex + 1}
          rangeEnd={auditEndItemIndex}
          currentPage={auditCurrentPage}
          canGoPrev={canGoPrevAudit}
          canGoNext={canGoNextAudit}
          onPrev={onPrevPage}
          onNext={onNextPage}
        />
      </div>
    </div>
  );
}
