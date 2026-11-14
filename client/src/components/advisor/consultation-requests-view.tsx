"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ConfirmSubmitLabel } from "@/components/ui/confirm-submit-label";
import { ListPaginationFooter } from "@/components/ui/list-pagination-footer";
import {
  RosterMobileCard,
  RosterMobileList,
  RosterPersonCell,
  RosterRow,
  RosterTable,
  RosterTableCard,
  RosterTd,
} from "@/components/ui/roster-table";
import { useListPagination } from "@/hooks/use-list-pagination";
import { formatStudentIdDisplay } from "@/lib/student-id";
import {
  UI_ACTION_PRIMARY_COMPACT,
  UI_ACTION_SCHEDULE_COMPACT,
  UI_ACTION_SECONDARY_COMPACT,
  UI_BUTTON_SECONDARY,
} from "@/lib/ui-classes";
import {
  CANCELLED_CASE_LABEL,
  CANCEL_REQUESTED_LABEL,
  CLOSED_CASE_LABEL,
  consultationClosedBadgeClassName,
  consultationClosedStatusLabel,
} from "@/lib/consultation-close";
import { stripSeedMarkers } from "@/lib/history-display";
import {
  getNegotiateLane,
  sortAcceptedNegotiations,
  sortScheduledByAppointment,
  type NegotiateLane,
} from "./consultation-negotiate";
import type {
  AdvisorConsultationRequestItem,
  ConsultationRequestStatus,
  ConsultationTab,
} from "./types";

type ConsultationRequestsViewProps = {
  consultationRequests: AdvisorConsultationRequestItem[];
  loadingConsultationRequests: boolean;
  consultationStatusMap: Record<ConsultationRequestStatus, { label: string; className: string }>;
  activeTab: ConsultationTab;
  onTabChange: (tab: ConsultationTab) => void;
  formatThaiDateTime: (value: string | null) => string;
  onRefresh: () => void;
  onAcceptRequest: (requestId: string) => void;
  onProposeSchedule: (requestId: string) => void;
  onAcceptOffer: (requestId: string, offerId: string) => void;
  onCloseRequest: (requestId: string) => void;
  onConfirmCancel: (requestId: string) => void;
  onDirectCancel: (requestId: string) => void;
};

type AcceptedFilter = "all" | NegotiateLane;

const TAB_META: Array<{ id: ConsultationTab; label: string; empty: string }> = [
  { id: "pending", label: "รอรับ", empty: "ไม่มีคำขอที่รอรับ" },
  { id: "accepted", label: "รอเจรจานัด", empty: "ไม่มีคำขอที่รอเจรจานัด" },
  { id: "scheduled", label: "นัดหมายแล้ว", empty: "ยังไม่มีนัดที่ยืนยันแล้ว" },
  { id: "closed", label: "ปิด/ยกเลิก", empty: "ยังไม่มีคำขอที่ปิดหรือยกเลิก" },
];

const ACCEPTED_FILTERS: Array<{ id: AcceptedFilter; label: string }> = [
  { id: "all", label: "ทั้งหมด" },
  { id: "waiting_advisor", label: "รอฉันตอบ" },
  { id: "no_offer", label: "ยังไม่เสนอ" },
  { id: "waiting_student", label: "รอนิสิต" },
];

/** คำขอยกเลิกของนิสิตอยู่คิวเดิม — รับแล้วไปแท็บรอเจรจา ไม่เช่นนั้นอยู่รอรับ */
function isCancelRequestedInTab(
  request: AdvisorConsultationRequestItem,
  tab: ConsultationTab
): boolean {
  if (request.status !== "CANCEL_REQUESTED") {
    return false;
  }
  if (tab === "accepted") {
    return Boolean(request.acceptedAt);
  }
  if (tab === "pending") {
    return !request.acceptedAt;
  }
  return false;
}

function matchesConsultationTab(
  request: AdvisorConsultationRequestItem,
  tab: ConsultationTab
): boolean {
  if (tab === "closed") {
    return request.status === "CLOSED" || request.status === "CANCELLED";
  }
  if (isCancelRequestedInTab(request, tab)) {
    return true;
  }
  if (tab === "pending") return request.status === "PENDING";
  if (tab === "accepted") return request.status === "ACCEPTED";
  return request.status === "SCHEDULED";
}

/** ดันรายการที่นิสิตขอยกเลิกขึ้นก่อนในคิว */
function sortCancelRequestedFirst(
  rows: AdvisorConsultationRequestItem[]
): AdvisorConsultationRequestItem[] {
  return [...rows].sort((left, right) => {
    const leftCancel = left.status === "CANCEL_REQUESTED" ? 0 : 1;
    const rightCancel = right.status === "CANCEL_REQUESTED" ? 0 : 1;
    if (leftCancel !== rightCancel) return leftCancel - rightCancel;
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

const LANE_BADGE: Record<NegotiateLane, { label: string; className: string }> = {
  waiting_advisor: { label: "รอฉันตอบ", className: "bg-red-100 text-red-700" },
  waiting_student: { label: "รอนิสิต", className: "bg-amber-100 text-amber-800" },
  no_offer: { label: "ยังไม่เสนอ", className: "bg-slate-100 text-slate-700" },
};

/** หน้าคำขอปรึกษา — แยกคิวนัดและเรียงนัดที่ยืนยันตามวันเวลา */
export function ConsultationRequestsView({
  consultationRequests,
  loadingConsultationRequests,
  consultationStatusMap,
  activeTab,
  onTabChange,
  formatThaiDateTime,
  onRefresh,
  onAcceptRequest,
  onProposeSchedule,
  onAcceptOffer,
  onCloseRequest,
  onConfirmCancel,
  onDirectCancel,
}: ConsultationRequestsViewProps) {
  const [acceptedFilter, setAcceptedFilter] = useState<AcceptedFilter>("all");

  const counts = useMemo(() => {
    let pending = 0;
    let accepted = 0;
    let scheduled = 0;
    let closed = 0;
    let waitingAdvisor = 0;
    let waitingStudent = 0;
    let noOffer = 0;
    for (const item of consultationRequests) {
      if (item.status === "PENDING" || isCancelRequestedInTab(item, "pending")) pending += 1;
      else if (item.status === "ACCEPTED" || isCancelRequestedInTab(item, "accepted")) {
        accepted += 1;
        if (item.status === "ACCEPTED") {
          const lane = getNegotiateLane(item);
          if (lane === "waiting_advisor") waitingAdvisor += 1;
          else if (lane === "waiting_student") waitingStudent += 1;
          else noOffer += 1;
        }
      } else if (item.status === "SCHEDULED") scheduled += 1;
      else if (item.status === "CLOSED" || item.status === "CANCELLED") closed += 1;
    }
    return {
      pending,
      accepted,
      scheduled,
      closed,
      waitingAdvisor,
      waitingStudent,
      noOffer,
    };
  }, [consultationRequests]);

  const countByTab: Record<ConsultationTab, number> = {
    pending: counts.pending,
    accepted: counts.accepted,
    scheduled: counts.scheduled,
    closed: counts.closed,
  };

  const acceptedFilterCount: Record<AcceptedFilter, number> = {
    all: counts.accepted,
    waiting_advisor: counts.waitingAdvisor,
    waiting_student: counts.waitingStudent,
    no_offer: counts.noOffer,
  };

  const filtered = useMemo(() => {
    const rows = consultationRequests.filter((item) => matchesConsultationTab(item, activeTab));
    if (activeTab === "accepted") {
      const cancelRows = rows.filter((item) => item.status === "CANCEL_REQUESTED");
      const activeRows = rows.filter((item) => item.status !== "CANCEL_REQUESTED");
      const sortedActive = sortAcceptedNegotiations(activeRows);
      const filteredActive =
        acceptedFilter === "all"
          ? sortedActive
          : sortedActive.filter((item) => getNegotiateLane(item) === acceptedFilter);
      // รายการนศขอยกเลิกโชว์ในแท็บทั้งหมด และอยู่บนสุด
      return acceptedFilter === "all"
        ? [...sortCancelRequestedFirst(cancelRows), ...filteredActive]
        : filteredActive;
    }
    if (activeTab === "scheduled") {
      return sortScheduledByAppointment(rows);
    }
    if (activeTab === "pending") {
      return sortCancelRequestedFirst(rows);
    }
    return rows;
  }, [acceptedFilter, activeTab, consultationRequests]);

  const pagination = useListPagination(filtered, `${activeTab}:${acceptedFilter}`);
  const pageItems = pagination.pageItems;

  const acceptedFilterLabel = ACCEPTED_FILTERS.find((item) => item.id === acceptedFilter)?.label;
  const emptyLabel =
    activeTab === "accepted" && acceptedFilter !== "all"
      ? `ไม่มีรายการในกลุ่ม${acceptedFilterLabel ? ` ${acceptedFilterLabel}` : ""}`
      : (TAB_META.find((tab) => tab.id === activeTab)?.empty ?? "ไม่มีรายการ");

  const showActionsColumn = activeTab !== "closed";
  const tabGridClass = "grid grid-cols-2 gap-3 sm:grid-cols-4";

  const scheduledColumns = showActionsColumn
    ? [
        { key: "student", label: "นักศึกษา", width: "28%" },
        { key: "when", label: "วันเวลานัด", width: "28%" },
        { key: "topic", label: "หัวข้อ / สถานที่", width: "24%" },
        { key: "actions", label: "จัดการ", align: "center" as const, width: "20%" },
      ]
    : [
        { key: "student", label: "นักศึกษา", width: "32%" },
        { key: "when", label: "วันเวลานัด", width: "34%" },
        { key: "topic", label: "หัวข้อ / สถานที่", width: "34%" },
      ];

  const defaultColumns = showActionsColumn
    ? [
        { key: "student", label: "นักศึกษา", width: "26%" },
        { key: "topic", label: "หัวข้อ / ช่องทาง", width: "24%" },
        { key: "status", label: "สถานะ / นัด", width: "24%" },
        { key: "actions", label: "จัดการ", align: "center" as const, width: "26%" },
      ]
    : [
        { key: "student", label: "นักศึกษา", width: "32%" },
        { key: "topic", label: "หัวข้อ / ช่องทาง", width: "34%" },
        { key: "status", label: "สถานะ / นัด", width: "34%" },
      ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">คำขอปรึกษา</h2>
          <p className="mt-1 text-sm text-slate-500">
            นิสิตขอคุยกับคุณโดยตรง — แยกจากเมนูสัญญาณเข้า (ที่อาจารย์ท่านอื่นแจ้งมา)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {loadingConsultationRequests ? (
            <span className="loader h-3.5 w-3.5 text-blue-600" aria-label="กำลังโหลด" />
          ) : null}
          <button type="button" onClick={onRefresh} className={UI_BUTTON_SECONDARY}>
            <RefreshCw className={`h-4 w-4 ${loadingConsultationRequests ? "animate-spin" : ""}`} />
            รีเฟรช
          </button>
        </div>
      </div>

      <div className={tabGridClass} role="tablist" aria-label="สถานะคำขอปรึกษา">
        {TAB_META.map((tab) => (
          <SummaryChip
            key={tab.id}
            label={tab.label}
            value={countByTab[tab.id]}
            selected={activeTab === tab.id}
            onClick={() => {
              setAcceptedFilter("all");
              onTabChange(tab.id);
            }}
          />
        ))}
      </div>

      {activeTab === "accepted" ? (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="แยกคิวเจรจานัด">
          {ACCEPTED_FILTERS.map((filter) => {
            const selected = acceptedFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setAcceptedFilter(filter.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selected
                    ? "border-slate-800 bg-slate-800 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span>{filter.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                    selected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {acceptedFilterCount[filter.id]}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <RosterTableCard>
        <RosterTable
          columns={activeTab === "scheduled" ? scheduledColumns : defaultColumns}
          emptyMessage={emptyLabel}
        >
          {pageItems.map((request) =>
            activeTab === "scheduled" ? (
              <ScheduledTableRow
                key={request.id}
                request={request}
                formatThaiDateTime={formatThaiDateTime}
                onProposeSchedule={onProposeSchedule}
                onAcceptOffer={onAcceptOffer}
                onCloseRequest={onCloseRequest}
                onConfirmCancel={onConfirmCancel}
                onDirectCancel={onDirectCancel}
                onAcceptRequest={onAcceptRequest}
                showActions={showActionsColumn}
              />
            ) : (
              <ConsultationTableRow
                key={request.id}
                request={request}
                consultationStatusMap={consultationStatusMap}
                formatThaiDateTime={formatThaiDateTime}
                onAcceptRequest={onAcceptRequest}
                onProposeSchedule={onProposeSchedule}
                onAcceptOffer={onAcceptOffer}
                onCloseRequest={onCloseRequest}
                onConfirmCancel={onConfirmCancel}
                onDirectCancel={onDirectCancel}
                showNegotiateLane={activeTab === "accepted"}
                showActions={showActionsColumn}
              />
            )
          )}
        </RosterTable>

        <RosterMobileList emptyMessage={emptyLabel}>
          {pageItems.map((request) => (
            <ConsultationMobileCard
              key={request.id}
              request={request}
              consultationStatusMap={consultationStatusMap}
              formatThaiDateTime={formatThaiDateTime}
              onAcceptRequest={onAcceptRequest}
              onProposeSchedule={onProposeSchedule}
              onAcceptOffer={onAcceptOffer}
              onCloseRequest={onCloseRequest}
              onConfirmCancel={onConfirmCancel}
              onDirectCancel={onDirectCancel}
              showNegotiateLane={activeTab === "accepted"}
              emphasizeSchedule={activeTab === "scheduled"}
              showActions={showActionsColumn}
            />
          ))}
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
    </div>
  );
}

type RowActionsProps = {
  request: AdvisorConsultationRequestItem;
  consultationStatusMap: Record<ConsultationRequestStatus, { label: string; className: string }>;
  formatThaiDateTime: (value: string | null) => string;
  onAcceptRequest: (requestId: string) => void;
  onProposeSchedule: (requestId: string) => void;
  onAcceptOffer: (requestId: string, offerId: string) => void;
  onCloseRequest: (requestId: string) => void;
  onConfirmCancel: (requestId: string) => void;
  onDirectCancel: (requestId: string) => void;
  showNegotiateLane?: boolean;
  emphasizeSchedule?: boolean;
  showActions?: boolean;
};

function closedStatusMeta(
  request: AdvisorConsultationRequestItem,
  consultationStatusMap: Record<ConsultationRequestStatus, { label: string; className: string }>
) {
  if (request.status === "CANCELLED") {
    return {
      label: CANCELLED_CASE_LABEL,
      className: consultationClosedBadgeClassName("CANCELLED"),
    };
  }
  if (request.status === "CANCEL_REQUESTED") {
    return {
      label: CANCEL_REQUESTED_LABEL,
      className: consultationClosedBadgeClassName("CANCEL_REQUESTED"),
    };
  }
  if (request.status === "CLOSED") {
    return {
      label: consultationClosedStatusLabel("CLOSED", request.advisorNote) || CLOSED_CASE_LABEL,
      className: consultationClosedBadgeClassName("CLOSED", request.advisorNote),
    };
  }
  return consultationStatusMap[request.status];
}

function ConsultationActions({
  request,
  onAcceptRequest,
  onProposeSchedule,
  onAcceptOffer,
  onCloseRequest,
  onConfirmCancel,
  onDirectCancel,
}: Omit<RowActionsProps, "consultationStatusMap" | "formatThaiDateTime" | "showNegotiateLane" | "emphasizeSchedule">) {
  const pendingOffer = request.latestPendingOffer ?? null;
  const waitingOnAdvisor = pendingOffer?.waitingOn === "ADVISOR";

  return (
    <div className="flex flex-wrap gap-2 sm:justify-end">
      {request.status === "PENDING" ? (
        <button type="button" onClick={() => onAcceptRequest(request.id)} className={UI_ACTION_PRIMARY_COMPACT}>
          <ConfirmSubmitLabel>รับคำขอ</ConfirmSubmitLabel>
        </button>
      ) : null}

      {request.status === "ACCEPTED" || request.status === "SCHEDULED" ? (
        <>
          {waitingOnAdvisor && pendingOffer ? (
            <button
              type="button"
              onClick={() => onAcceptOffer(request.id, pendingOffer.id)}
              className={UI_ACTION_PRIMARY_COMPACT}
            >
              <ConfirmSubmitLabel>ยอมรับข้อเสนอ</ConfirmSubmitLabel>
            </button>
          ) : null}
          <button type="button" onClick={() => onProposeSchedule(request.id)} className={UI_ACTION_SCHEDULE_COMPACT}>
            {request.status === "SCHEDULED"
              ? "เลื่อนนัด"
              : pendingOffer
                ? "ขอเปลี่ยนวัน/ที่"
                : "เสนอนัด"}
          </button>
        </>
      ) : null}

      {request.status === "SCHEDULED" ? (
        <button type="button" onClick={() => onCloseRequest(request.id)} className={UI_ACTION_SECONDARY_COMPACT}>
          ปิดเคส
        </button>
      ) : null}

      {request.status === "PENDING" || request.status === "ACCEPTED" ? (
        <button type="button" onClick={() => onDirectCancel(request.id)} className={UI_ACTION_SECONDARY_COMPACT}>
          ยกเลิก
        </button>
      ) : null}

      {request.status === "CANCEL_REQUESTED" ? (
        <button type="button" onClick={() => onConfirmCancel(request.id)} className={UI_ACTION_PRIMARY_COMPACT}>
          <ConfirmSubmitLabel>ยกเลิก</ConfirmSubmitLabel>
        </button>
      ) : null}
    </div>
  );
}

function OfferHint({
  request,
  formatThaiDateTime,
}: {
  request: AdvisorConsultationRequestItem;
  formatThaiDateTime: (value: string | null) => string;
}) {
  const pendingOffer = request.latestPendingOffer ?? null;
  if (!pendingOffer) {
    return null;
  }

  const waitingOnStudent = pendingOffer.waitingOn === "STUDENT";
  const waitingOnAdvisor = pendingOffer.waitingOn === "ADVISOR";

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
      <p className="font-semibold text-slate-800">
        ข้อเสนอจาก {pendingOffer.proposedByRole === "ADVISOR" ? "คุณ" : "นิสิต"}
      </p>
      <p className="mt-1">
        {formatThaiDateTime(pendingOffer.proposedAt)} · {pendingOffer.location}
      </p>
      {pendingOffer.note ? <p className="mt-1 text-slate-500">{pendingOffer.note}</p> : null}
      <p className="mt-1 font-medium text-[#C24712]">
        {waitingOnStudent
          ? "รอนิสิตตอบรับหรือขอเปลี่ยน"
          : waitingOnAdvisor
            ? "รอคุณตอบรับหรือขอเปลี่ยน"
            : "รออีกฝ่ายตอบกลับ"}
      </p>
    </div>
  );
}

function NegotiateLaneBadge({ request }: { request: AdvisorConsultationRequestItem }) {
  if (request.status !== "ACCEPTED") return null;
  const lane = getNegotiateLane(request);
  const meta = LANE_BADGE[lane];
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${meta.className}`}>{meta.label}</span>
  );
}

function ScheduledTableRow({
  request,
  formatThaiDateTime,
  onAcceptRequest,
  onProposeSchedule,
  onAcceptOffer,
  onCloseRequest,
  onConfirmCancel,
  onDirectCancel,
  showActions = true,
}: Omit<RowActionsProps, "consultationStatusMap" | "showNegotiateLane" | "emphasizeSchedule">) {
  const code = formatStudentIdDisplay(request.studentCode);
  const isSoon =
    request.scheduledAt &&
    new Date(request.scheduledAt).getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000 &&
    new Date(request.scheduledAt).getTime() >= Date.now() - 60 * 60 * 1000;

  return (
    <RosterRow>
      <RosterTd>
        <RosterPersonCell
          name={request.studentName}
          meta={`${code} · ปี ${request.year || "-"}`}
          avatarText={code}
        />
      </RosterTd>
      <RosterTd>
        <p className={`text-[15px] font-bold tabular-nums leading-snug ${isSoon ? "text-[#C24712]" : "text-slate-900"}`}>
          {formatThaiDateTime(request.scheduledAt)}
        </p>
        {isSoon ? <p className="mt-1 text-xs font-semibold text-[#C24712]">นัดใกล้ถึง</p> : null}
      </RosterTd>
      <RosterTd>
        <p className="font-medium text-slate-800">{request.topic}</p>
        <p className="mt-1 text-xs text-slate-500">
          {request.scheduleLocation || request.preferredChannelLabel}
        </p>
      </RosterTd>
      {showActions ? (
        <RosterTd align="center">
          <ConsultationActions
            request={request}
            onAcceptRequest={onAcceptRequest}
            onProposeSchedule={onProposeSchedule}
            onAcceptOffer={onAcceptOffer}
            onCloseRequest={onCloseRequest}
            onConfirmCancel={onConfirmCancel}
            onDirectCancel={onDirectCancel}
          />
        </RosterTd>
      ) : null}
    </RosterRow>
  );
}

function ConsultationTableRow({
  request,
  consultationStatusMap,
  formatThaiDateTime,
  onAcceptRequest,
  onProposeSchedule,
  onAcceptOffer,
  onCloseRequest,
  onConfirmCancel,
  onDirectCancel,
  showNegotiateLane = false,
  showActions = true,
}: RowActionsProps) {
  const statusMeta = closedStatusMeta(request, consultationStatusMap);
  const code = formatStudentIdDisplay(request.studentCode);

  return (
    <RosterRow>
      <RosterTd>
        <RosterPersonCell
          name={request.studentName}
          meta={`${code} · ปี ${request.year || "-"}`}
          avatarText={code}
        />
      </RosterTd>
      <RosterTd>
        <p className="font-medium text-slate-800">{request.topic}</p>
        <p className="mt-1 text-xs text-slate-500">{request.preferredChannelLabel}</p>
        {request.note ? (
          <p className="mt-1 line-clamp-2 text-xs text-slate-600">
            {stripSeedMarkers(request.note) || request.note}
          </p>
        ) : null}
      </RosterTd>
      <RosterTd>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${statusMeta.className}`}>
            {statusMeta.label}
          </span>
          {showNegotiateLane && request.status !== "CANCEL_REQUESTED" ? (
            <NegotiateLaneBadge request={request} />
          ) : null}
        </div>
        {request.scheduledAt ? (
          <p className="mt-2 text-xs font-semibold text-slate-700">
            {formatThaiDateTime(request.scheduledAt)}
            {request.scheduleLocation ? ` · ${request.scheduleLocation}` : ""}
          </p>
        ) : null}
        {(request.status === "CLOSED" ||
          request.status === "CANCELLED" ||
          request.status === "CANCEL_REQUESTED") &&
        request.advisorNote ? (
          <p className="mt-2 line-clamp-2 text-xs text-slate-500">{request.advisorNote}</p>
        ) : null}
        {request.status !== "CANCEL_REQUESTED" ? (
          <OfferHint request={request} formatThaiDateTime={formatThaiDateTime} />
        ) : null}
      </RosterTd>
      {showActions ? (
        <RosterTd align="center">
          <ConsultationActions
            request={request}
            onAcceptRequest={onAcceptRequest}
            onProposeSchedule={onProposeSchedule}
            onAcceptOffer={onAcceptOffer}
            onCloseRequest={onCloseRequest}
            onConfirmCancel={onConfirmCancel}
            onDirectCancel={onDirectCancel}
          />
        </RosterTd>
      ) : null}
    </RosterRow>
  );
}

function ConsultationMobileCard({
  request,
  consultationStatusMap,
  formatThaiDateTime,
  onAcceptRequest,
  onProposeSchedule,
  onAcceptOffer,
  onCloseRequest,
  onConfirmCancel,
  onDirectCancel,
  showNegotiateLane = false,
  emphasizeSchedule = false,
  showActions = true,
}: RowActionsProps) {
  const statusMeta = closedStatusMeta(request, consultationStatusMap);
  const code = formatStudentIdDisplay(request.studentCode);

  return (
    <RosterMobileCard>
      <div className="flex items-start justify-between gap-3">
        <RosterPersonCell
          name={request.studentName}
          meta={`${code} · ปี ${request.year || "-"} · ${request.topic}`}
          avatarText={code}
        />
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusMeta.className}`}>
            {statusMeta.label}
          </span>
          {showNegotiateLane && request.status !== "CANCEL_REQUESTED" ? (
            <NegotiateLaneBadge request={request} />
          ) : null}
        </div>
      </div>
      {emphasizeSchedule && request.scheduledAt ? (
        <p className="mt-3 text-sm font-bold text-slate-900">นัด: {formatThaiDateTime(request.scheduledAt)}</p>
      ) : (
        <p className="mt-3 text-sm text-slate-500">รูปแบบ: {request.preferredChannelLabel}</p>
      )}
      {request.scheduleLocation ? (
        <p className="mt-1 text-sm text-slate-600">{request.scheduleLocation}</p>
      ) : null}
      {!emphasizeSchedule && request.scheduledAt ? (
        <p className="mt-1 text-sm font-semibold text-slate-700">
          นัด: {formatThaiDateTime(request.scheduledAt)}
        </p>
      ) : null}
      {request.status !== "CANCEL_REQUESTED" ? (
        <OfferHint request={request} formatThaiDateTime={formatThaiDateTime} />
      ) : null}
      {request.note ? (
        <p className="mt-2 line-clamp-2 text-sm text-slate-600">
          {stripSeedMarkers(request.note) || request.note}
        </p>
      ) : null}
      {(request.status === "CLOSED" ||
        request.status === "CANCELLED" ||
        request.status === "CANCEL_REQUESTED") &&
      request.advisorNote ? (
        <p className="mt-2 line-clamp-2 text-sm text-slate-500">{request.advisorNote}</p>
      ) : null}
      {showActions ? (
        <div className="mt-4">
          <ConsultationActions
            request={request}
            onAcceptRequest={onAcceptRequest}
            onProposeSchedule={onProposeSchedule}
            onAcceptOffer={onAcceptOffer}
            onCloseRequest={onCloseRequest}
            onConfirmCancel={onConfirmCancel}
            onDirectCancel={onDirectCancel}
          />
        </div>
      ) : null}
    </RosterMobileCard>
  );
}

function SummaryChip({
  label,
  value,
  selected = false,
  onClick,
}: {
  label: string;
  value: number;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-left shadow-sm transition-colors ${
        selected
          ? "border-slate-300 bg-slate-50 ring-1 ring-slate-200"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-slate-950">{value}</p>
    </button>
  );
}
