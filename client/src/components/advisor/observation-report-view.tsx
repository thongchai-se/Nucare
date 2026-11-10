"use client";

import { useEffect, useId, useState } from "react";
import { BookOpen, Calendar, Flag, RefreshCw, Users, X } from "lucide-react";
import { ListPaginationFooter } from "@/components/ui/list-pagination-footer";
import { StaffModalOverlay } from "@/components/ui/staff-modal-overlay";
import {
  RosterCountBadge,
  RosterMobileCard,
  RosterMobileList,
  RosterPersonCell,
  RosterRow,
  RosterSearchInput,
  RosterTable,
  RosterTableCard,
  RosterTd,
  RosterToolbarEnd,
} from "@/components/ui/roster-table";
import { useListPagination } from "@/hooks/use-list-pagination";
import { stripSeedMarkers } from "@/lib/history-display";
import {
  UI_BUTTON_PRIMARY,
  UI_PANEL_NEUTRAL,
  UI_SEVERITY_HIGH,
  UI_SEVERITY_LOW,
  UI_SEVERITY_MEDIUM,
  UI_STATUS_SCHEDULED,
} from "@/lib/ui-classes";
import { ObservationRoadmap, type ObservationRoadmapStep } from "./observation-roadmap";

export type ObservationSeverity = "LOW" | "MEDIUM" | "HIGH";
export type ObservationStatus = "PENDING" | "ACKNOWLEDGED" | "COMPLETED";

export type ObservationStudentOption = {
  id: string;
  name: string;
  studentId: string | null;
  studyYear?: number | null;
  section?: string | null;
};

export type ObservationRecord = {
  id: string;
  category: string;
  details: string;
  severity: ObservationSeverity;
  observedAt: string;
  createdAt: string;
  status: ObservationStatus;
  advisorRecipients: string[];
  roadmap?: ObservationRoadmapStep[];
  student: ObservationStudentOption;
};

type ObservationReportViewProps = {
  records: ObservationRecord[];
  search: string;
  onSearchChange: (value: string) => void;
  onOpenCompose: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  statusBadgeMap: Record<ObservationStatus, string>;
  statusLabelMap: Record<ObservationStatus, string>;
  formatThaiDateTime: (value: string) => string;
};

const severityLabelMap: Record<ObservationSeverity, string> = {
  LOW: "ต่ำ",
  MEDIUM: "ปานกลาง",
  HIGH: "เร่งด่วน",
};

function resolveRoadmap(record: ObservationRecord): ObservationRoadmapStep[] {
  if (record.roadmap && record.roadmap.length > 0) {
    return record.roadmap;
  }
  return [
    {
      key: `reported-${record.id}`,
      label: "แจ้งข้อสังเกต",
      at: record.createdAt,
      kind: "reported" as const,
      detail: "บันทึกข้อสังเกตและแจ้งที่ปรึกษาของนิสิตแล้ว",
    },
  ];
}

function severityTone(severity: ObservationSeverity) {
  if (severity === "HIGH") {
    return UI_SEVERITY_HIGH;
  }
  if (severity === "MEDIUM") {
    return UI_SEVERITY_MEDIUM;
  }
  return UI_SEVERITY_LOW;
}

/** หน้าแจ้งและติดตามข้อสังเกต — ผู้แจ้งกดดูเส้นทางรับเรื่อง / ปิดเรื่อง / ส่งต่อได้ */
export function ObservationReportView({
  records,
  search,
  onSearchChange,
  onOpenCompose,
  onRefresh,
  refreshing = false,
  statusBadgeMap,
  statusLabelMap,
  formatThaiDateTime,
}: ObservationReportViewProps) {
  const detailTitleId = useId();
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  const normalized = search.trim().toLowerCase();
  const filtered = normalized
    ? records.filter((record) => {
        const haystack = [
          record.student.name,
          record.student.studentId || "",
          record.category,
          record.details,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalized);
      })
    : records;

  const pagination = useListPagination(filtered, search);
  const pageItems = pagination.pageItems;

  const selectedRecord =
    selectedRecordId == null ? null : (records.find((record) => record.id === selectedRecordId) ?? null);

  useEffect(() => {
    if (!selectedRecordId) {
      return;
    }
    if (!records.some((record) => record.id === selectedRecordId)) {
      setSelectedRecordId(null);
    }
  }, [records, selectedRecordId]);

  useEffect(() => {
    if (!selectedRecord) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedRecordId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedRecord]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">ข้อสังเกตที่แจ้ง</h2>
          <p className="mt-1 text-sm text-slate-500">
            สำหรับแจ้งนิสิตของอาจารย์ท่านอื่นเท่านั้น — สัญญาณจะเข้าเมนูสัญญาณเข้าของที่ปรึกษาคนนั้น ไม่ใช่นิสิตในสังกัดตัวเอง
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              รีเฟรชสถานะ
            </button>
          ) : null}
          <button type="button" onClick={onOpenCompose} className={`${UI_BUTTON_PRIMARY} min-h-11`}>
            <Flag className="h-4 w-4" />
            แจ้งข้อสังเกตใหม่
          </button>
        </div>
      </div>

      <RosterTableCard
        toolbar={
          <>
            <RosterSearchInput
              value={search}
              onChange={onSearchChange}
              placeholder="ค้นหาประวัติที่เคยแจ้ง..."
              aria-label="ค้นหาข้อสังเกต"
            />
            <RosterToolbarEnd>
              <RosterCountBadge count={filtered.length} />
            </RosterToolbarEnd>
          </>
        }
      >
        <RosterTable
          columns={[
            { key: "student", label: "นักศึกษา", width: "26%" },
            { key: "details", label: "รายละเอียด", width: "34%" },
            { key: "status", label: "สถานะ", width: "22%" },
            { key: "date", label: "วันที่", width: "18%" },
          ]}
          emptyMessage={search.trim() ? "ไม่พบประวัติที่ตรงกับคำค้น" : "ยังไม่มีประวัติการแจ้งข้อสังเกต"}
        >
          {pageItems.map((record) => {
            const steps = resolveRoadmap(record);
            const hasReferral = steps.some((step) => step.kind === "referred");
            const code = record.student.studentId || "-";
            return (
              <RosterRow key={record.id} onClick={() => setSelectedRecordId(record.id)}>
                <RosterTd>
                  <RosterPersonCell name={record.student.name} meta={code} avatarText={code} />
                </RosterTd>
                <RosterTd>
                  <p className="line-clamp-2 text-slate-700">
                    {stripSeedMarkers(record.details) || record.details}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <BookOpen size={12} /> {record.category}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${severityTone(record.severity)}`}
                    >
                      {severityLabelMap[record.severity]}
                    </span>
                  </p>
                </RosterTd>
                <RosterTd>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${statusBadgeMap[record.status]}`}>
                      {statusLabelMap[record.status]}
                    </span>
                    {hasReferral ? (
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${UI_STATUS_SCHEDULED}`}>
                        มีการส่งต่อ
                      </span>
                    ) : null}
                  </div>
                </RosterTd>
                <RosterTd className="whitespace-nowrap text-slate-500">
                  {formatThaiDateTime(record.createdAt)}
                </RosterTd>
              </RosterRow>
            );
          })}
        </RosterTable>

        <RosterMobileList emptyMessage={search.trim() ? "ไม่พบประวัติที่ตรงกับคำค้น" : "ยังไม่มีประวัติการแจ้งข้อสังเกต"}>
          {pageItems.map((record) => {
            const steps = resolveRoadmap(record);
            const hasReferral = steps.some((step) => step.kind === "referred");
            const code = record.student.studentId || "-";
            return (
              <button
                key={record.id}
                type="button"
                onClick={() => setSelectedRecordId(record.id)}
                className="w-full text-left"
              >
                <RosterMobileCard>
                  <div className="flex items-start justify-between gap-3">
                    <RosterPersonCell name={record.student.name} meta={code} avatarText={code} />
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusBadgeMap[record.status]}`}>
                      {statusLabelMap[record.status]}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-slate-700">
                    {stripSeedMarkers(record.details) || record.details}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <BookOpen size={12} /> {record.category}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={12} /> {formatThaiDateTime(record.createdAt)}
                    </span>
                    {hasReferral ? <span>มีการส่งต่อ</span> : null}
                  </div>
                </RosterMobileCard>
              </button>
            );
          })}
        </RosterMobileList>

        {pagination.total > pagination.rowsPerPage ? (
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
                รายละเอียดข้อสังเกต
              </h3>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {selectedRecord.student.name} ({selectedRecord.student.studentId || "-"})
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedRecordId(null)}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="ปิดรายละเอียด"
            >
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5" role="dialog" aria-labelledby={detailTitleId}>
            <div className={UI_PANEL_NEUTRAL}>
              <p className="text-xs font-semibold text-slate-600">สถานะที่ผู้แจ้งเห็นได้</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusBadgeMap[selectedRecord.status]}`}>
                  {statusLabelMap[selectedRecord.status]}
                </span>
                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${severityTone(selectedRecord.severity)}`}>
                  ความเร่งด่วน: {severityLabelMap[selectedRecord.severity]}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-600">รายละเอียดที่แจ้ง</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                {stripSeedMarkers(selectedRecord.details) || selectedRecord.details}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className={UI_PANEL_NEUTRAL}>
                <p className="text-[11px] font-semibold text-slate-500">ประเภท</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{selectedRecord.category}</p>
              </div>
              <div className={UI_PANEL_NEUTRAL}>
                <p className="text-[11px] font-semibold text-slate-500">วันที่สังเกต</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {formatThaiDateTime(selectedRecord.observedAt)}
                </p>
              </div>
              <div className={UI_PANEL_NEUTRAL}>
                <p className="text-[11px] font-semibold text-slate-500">วันเวลาที่แจ้ง</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {formatThaiDateTime(selectedRecord.createdAt)}
                </p>
              </div>
              <div className={UI_PANEL_NEUTRAL}>
                <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                  <Users size={12} /> ที่ปรึกษาที่รับแจ้ง
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {selectedRecord.advisorRecipients.join(", ") || "ยังไม่มีที่ปรึกษาที่รับแจ้ง"}
                </p>
              </div>
            </div>

            <div className={UI_PANEL_NEUTRAL}>
              <p className="text-[11px] font-semibold text-slate-500">เส้นทางติดตาม</p>
              <p className="mt-1 text-xs text-slate-500">
                แจ้ง → รับเรื่อง → ปิดเรื่อง (พร้อมรายละเอียด) หรือส่งต่อ — กดแต่ละขั้นเพื่อดูรายละเอียด
              </p>
              <ObservationRoadmap
                steps={resolveRoadmap(selectedRecord)}
                formatThaiDateTime={formatThaiDateTime}
              />
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-100 bg-slate-50 p-5">
            <button type="button" onClick={() => setSelectedRecordId(null)} className={UI_BUTTON_PRIMARY}>
              ปิด
            </button>
          </div>
        </StaffModalOverlay>
      ) : null}
    </div>
  );
}
