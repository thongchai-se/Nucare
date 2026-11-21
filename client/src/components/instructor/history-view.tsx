"use client";

import { useId, useMemo, useState } from "react";
import { AlertCircle, BookOpen, Calendar, ChevronRight, Users, X } from "lucide-react";
import { ObservationRoadmap } from "@/components/advisor/observation-roadmap";
import { ListPaginationFooter } from "@/components/ui/list-pagination-footer";
import { StaffModalOverlay } from "@/components/ui/staff-modal-overlay";
import {
  RosterSearchInput,
  RosterSelectFilter,
  RosterTableCard,
  RosterToolbarEnd,
} from "@/components/ui/roster-table";
import { useListPagination } from "@/hooks/use-list-pagination";
import type { BehaviorRecord, BehaviorRecordStatus } from "./types";

type HistoryViewProps = {
  historySearch: string;
  filteredHistory: BehaviorRecord[];
  statusBadgeMap: Record<BehaviorRecordStatus, string>;
  statusLabelMap: Record<BehaviorRecordStatus, string>;
  onHistorySearchChange: (value: string) => void;
  formatThaiDateTime: (value: string) => string;
};

/** ประวัติที่ผู้สอนแจ้งไว้ — กดดูเส้นทางรับเรื่อง / ปิดเรื่อง / ส่งต่อได้เหมือนฝั่งที่ปรึกษา */
export function HistoryView({
  historySearch,
  filteredHistory,
  statusBadgeMap,
  statusLabelMap,
  onHistorySearchChange,
  formatThaiDateTime,
}: HistoryViewProps) {
  const detailTitleId = useId();
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | BehaviorRecordStatus>("ALL");

  const statusFiltered = useMemo(
    () =>
      statusFilter === "ALL"
        ? filteredHistory
        : filteredHistory.filter((record) => record.status === statusFilter),
    [filteredHistory, statusFilter]
  );

  const pagination = useListPagination(statusFiltered, `${historySearch}:${statusFilter}`, {
    fixedRowsPerPage: 8,
  });
  const selectedRecord =
    selectedRecordId == null
      ? null
      : (filteredHistory.find((record) => record.id === selectedRecordId) ?? null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">ประวัติการแจ้งข้อสังเกต</h2>
          <p className="mt-1 text-sm text-slate-500">
            ติดตามได้ว่าที่ปรึกษารับเรื่อง ปิดพร้อมรายละเอียด หรือส่งต่อแล้ว — กดรายการเพื่อดูเส้นทาง
          </p>
        </div>
      </div>

      <RosterTableCard
        toolbar={
          <>
            <RosterSearchInput
              value={historySearch}
              onChange={onHistorySearchChange}
              placeholder="ค้นหาประวัติ..."
              aria-label="ค้นหาประวัติข้อสังเกต"
            />
            <RosterToolbarEnd>
              <RosterSelectFilter
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as "ALL" | BehaviorRecordStatus)}
                aria-label="กรองสถานะ"
              >
                <option value="ALL">ทุกสถานะ</option>
                {(Object.keys(statusLabelMap) as BehaviorRecordStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {statusLabelMap[status]}
                  </option>
                ))}
              </RosterSelectFilter>
            </RosterToolbarEnd>
          </>
        }
      >
        <div className="divide-y divide-slate-100">
          {pagination.pageItems.length > 0 ? (
            pagination.pageItems.map((record) => {
              const steps = record.roadmap ?? [];
              const hasReferral = steps.some((step) => step.kind === "referred");
              return (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => setSelectedRecordId(record.id)}
                  className="flex w-full items-start gap-4 p-5 text-left transition-colors hover:bg-slate-50"
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white ${
                      record.severity === "HIGH"
                        ? "bg-red-600"
                        : record.severity === "MEDIUM"
                          ? "bg-[#0057A8]"
                          : "bg-emerald-600"
                    }`}
                  >
                    <AlertCircle size={24} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-slate-800">
                        {record.student.name} ({record.student.studentId || "-"})
                      </h4>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeMap[record.status]}`}>
                        {statusLabelMap[record.status]}
                      </span>
                      {hasReferral ? (
                        <span className="rounded-full bg-[#F15A22] px-2.5 py-1 text-[11px] font-semibold text-white">
                          มีการส่งต่อ
                        </span>
                      ) : null}
                    </div>
                    <p className="mb-1 text-sm font-medium text-slate-600">{record.details}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-slate-500">
                      <span className="flex items-center gap-1">
                        <BookOpen size={12} /> {record.category}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> {formatThaiDateTime(record.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={12} /> {record.advisorRecipients.join(", ") || "รอผูกอาจารย์ที่ปรึกษา"}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-300" aria-hidden="true" />
                </button>
              );
            })
          ) : (
            <div className="p-10 text-center text-sm text-slate-500">ยังไม่มีประวัติการแจ้งเรื่อง</div>
          )}
        </div>
        {pagination.total > 0 ? (
          <ListPaginationFooter
            total={pagination.total}
            rangeStart={pagination.rangeStart}
            rangeEnd={pagination.rangeEnd}
            currentPage={pagination.currentPage}
            canGoPrev={pagination.canGoPrev}
            canGoNext={pagination.canGoNext}
            onPrev={() => pagination.setCurrentPage((prev) => Math.max(1, prev - 1))}
            onNext={() => pagination.setCurrentPage((prev) => prev + 1)}
          />
        ) : null}
      </RosterTableCard>

      {selectedRecord ? (
        <StaffModalOverlay panelClassName="max-w-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-white p-5">
            <div className="min-w-0">
              <h3 id={detailTitleId} className="text-lg font-bold text-slate-800">
                เส้นทางติดตามข้อสังเกต
              </h3>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {selectedRecord.student.name} ({selectedRecord.student.studentId || "-"})
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedRecordId(null)}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              aria-label="ปิด"
            >
              <X size={18} />
            </button>
          </div>
          <div className="space-y-4 overflow-y-auto p-5" role="dialog" aria-labelledby={detailTitleId}>
            <p className="whitespace-pre-wrap text-sm text-slate-800">{selectedRecord.details}</p>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
              <p className="text-[11px] font-bold text-slate-500">เส้นทางติดตาม</p>
              <p className="mt-1 text-xs text-slate-500">
                แจ้ง → รับเรื่อง → ปิดเรื่อง (พร้อมรายละเอียด) หรือส่งต่อ
              </p>
              <ObservationRoadmap
                steps={
                  selectedRecord.roadmap && selectedRecord.roadmap.length > 0
                    ? selectedRecord.roadmap
                    : [
                        {
                          key: `reported-${selectedRecord.id}`,
                          label: "แจ้งข้อสังเกต",
                          at: selectedRecord.createdAt,
                          kind: "reported",
                          detail: "บันทึกข้อสังเกตและแจ้งที่ปรึกษาของนิสิตแล้ว",
                        },
                      ]
                }
                formatThaiDateTime={formatThaiDateTime}
              />
            </div>
          </div>
        </StaffModalOverlay>
      ) : null}
    </div>
  );
}
