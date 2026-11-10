"use client";

import { useId, useMemo, useState } from "react";
import { Send, Users, X } from "lucide-react";
import { ListPaginationFooter } from "@/components/ui/list-pagination-footer";
import { StaffModalOverlay } from "@/components/ui/staff-modal-overlay";
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
import { stripSeedMarkers } from "@/lib/history-display";
import { formatStudentIdDisplay } from "@/lib/student-id";
import {
  UI_BUTTON_PRIMARY,
  UI_PANEL_NEUTRAL,
  UI_STATUS_DANGER,
} from "@/lib/ui-classes";
import { ObservationRoadmap } from "./observation-roadmap";
import type { AdvisorReferralItem, ReferralStatus, ReferralTarget } from "./types";

type ReferralHistoryViewProps = {
  referrals: AdvisorReferralItem[];
  loadingReferrals: boolean;
  referralStatusMap: Record<ReferralStatus, { label: string; className: string }>;
  referralTargetMap: Record<ReferralTarget, string>;
  formatThaiDate: (value: string | null) => string;
  formatThaiDateTime: (value: string | null) => string;
};

type ReferralFilter = "ALL" | ReferralStatus;

const FILTER_META: Array<{ id: ReferralFilter; label: string; empty: string }> = [
  { id: "ALL", label: "ทั้งหมด", empty: "ยังไม่มีเคสส่งต่อในขณะนี้" },
  { id: "PENDING", label: "รอรับเคส", empty: "ไม่มีเคสที่รอรับ" },
  { id: "ACCEPTED", label: "กำลังดูแล", empty: "ไม่มีเคสที่กำลังดูแล" },
  { id: "CLOSED", label: "ปิดแล้ว", empty: "ยังไม่มีเคสที่ปิด" },
];

function statusHint(status: ReferralStatus): string {
  if (status === "PENDING") {
    return "รอทีมปลายทางรับเคส — คุณสามารถติดตามจากหมุดด้านล่างได้";
  }
  if (status === "ACCEPTED") {
    return "ทีมปลายทางรับเคสแล้ว และกำลังดูแลต่อ";
  }
  return "เคสถูกปิดการติดตามแล้ว";
}

/** ติดตามเคสส่งต่อ — การ์ดสถานะกรองรายการ ไม่มีหัวแถบจำนวนบนตาราง */
export function ReferralHistoryView({
  referrals,
  loadingReferrals,
  referralStatusMap,
  referralTargetMap,
  formatThaiDate,
  formatThaiDateTime,
}: ReferralHistoryViewProps) {
  const detailTitleId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ReferralFilter>("PENDING");

  const selected = useMemo(
    () => (selectedId ? referrals.find((item) => item.id === selectedId) ?? null : null),
    [referrals, selectedId]
  );

  const summary = useMemo(() => {
    let pending = 0;
    let accepted = 0;
    let closed = 0;
    for (const item of referrals) {
      if (item.status === "PENDING") pending += 1;
      else if (item.status === "ACCEPTED") accepted += 1;
      else closed += 1;
    }
    return { pending, accepted, closed, total: referrals.length };
  }, [referrals]);

  const countByFilter: Record<ReferralFilter, number> = {
    ALL: summary.total,
    PENDING: summary.pending,
    ACCEPTED: summary.accepted,
    CLOSED: summary.closed,
  };

  const filtered = useMemo(() => {
    if (activeFilter === "ALL") return referrals;
    return referrals.filter((item) => item.status === activeFilter);
  }, [activeFilter, referrals]);

  const pagination = useListPagination(filtered, activeFilter);
  const pageItems = pagination.pageItems;

  const emptyLabel = FILTER_META.find((tab) => tab.id === activeFilter)?.empty ?? "ไม่มีรายการ";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">ติดตามการส่งต่อ</h2>
          <p className="mt-1 text-sm text-slate-500">
            กดการ์ดสถานะเพื่อกรองรายการ — กดแถวเพื่อดูรายละเอียดและหมุดเส้นทาง
          </p>
        </div>
        {loadingReferrals ? <span className="text-xs text-slate-400">กำลังโหลด...</span> : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="tablist" aria-label="สถานะการส่งต่อ">
        {FILTER_META.map((tab) => (
          <SummaryChip
            key={tab.id}
            label={tab.label}
            value={countByFilter[tab.id]}
            selected={activeFilter === tab.id}
            onClick={() => setActiveFilter(tab.id)}
          />
        ))}
      </div>

      <RosterTableCard>
        <RosterTable
          columns={[
            { key: "student", label: "นักศึกษา", width: "32%" },
            { key: "target", label: "ส่งถึง", width: "24%" },
            { key: "date", label: "วันที่ส่ง", width: "20%" },
            { key: "status", label: "สถานะ", width: "24%" },
          ]}
          emptyMessage={emptyLabel}
        >
          {pageItems.map((referral) => {
            const status = referralStatusMap[referral.status];
            const code = formatStudentIdDisplay(referral.studentCode);
            return (
              <RosterRow key={referral.id} onClick={() => setSelectedId(referral.id)}>
                <RosterTd>
                  <RosterPersonCell
                    name={referral.studentName}
                    meta={`${code} · ปี ${referral.year || "-"}`}
                    avatarText={code}
                  />
                </RosterTd>
                <RosterTd>
                  <p className="truncate text-slate-600">{referralTargetMap[referral.target]}</p>
                </RosterTd>
                <RosterTd className="whitespace-nowrap text-slate-500">
                  {formatThaiDateTime(referral.createdAt)}
                </RosterTd>
                <RosterTd>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${status.className}`}>
                      {status.label}
                    </span>
                    {referral.isUrgent ? (
                      <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${UI_STATUS_DANGER}`}>
                        SOS
                      </span>
                    ) : null}
                  </div>
                </RosterTd>
              </RosterRow>
            );
          })}
        </RosterTable>

        <RosterMobileList emptyMessage={emptyLabel}>
          {pageItems.map((referral) => {
            const status = referralStatusMap[referral.status];
            const code = formatStudentIdDisplay(referral.studentCode);
            return (
              <button
                key={referral.id}
                type="button"
                onClick={() => setSelectedId(referral.id)}
                className="w-full text-left"
              >
                <RosterMobileCard>
                  <div className="flex items-start justify-between gap-3">
                    <RosterPersonCell
                      name={referral.studentName}
                      meta={`${code} · ${referralTargetMap[referral.target]}`}
                      avatarText={code}
                    />
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">{formatThaiDateTime(referral.createdAt)}</p>
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

      {selected ? (
        <StaffModalOverlay panelClassName="max-w-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-white p-5">
            <div className="min-w-0">
              <h3 id={detailTitleId} className="text-lg font-bold text-slate-800">
                รายละเอียดการส่งต่อ
              </h3>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {selected.studentName} ({formatStudentIdDisplay(selected.studentCode) || "-"})
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="ปิดรายละเอียด"
            >
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5" role="dialog" aria-labelledby={detailTitleId}>
            <div className={UI_PANEL_NEUTRAL}>
              <p className="text-xs font-semibold text-slate-600">สถานะที่ติดตามได้</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${referralStatusMap[selected.status].className}`}
                >
                  {referralStatusMap[selected.status].label}
                </span>
                {selected.isUrgent ? (
                  <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${UI_STATUS_DANGER}`}>
                    ความเร่งด่วน: วิกฤต (SOS)
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-slate-700">{statusHint(selected.status)}</p>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-600">เหตุผลในการส่งต่อ</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                {stripSeedMarkers(selected.reason) || selected.reason?.trim() || "-"}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className={UI_PANEL_NEUTRAL}>
                <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                  <Send size={12} /> ส่งถึง
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {referralTargetMap[selected.target]}
                </p>
              </div>
              <div className={UI_PANEL_NEUTRAL}>
                <p className="text-[11px] font-semibold text-slate-500">วันที่ส่ง</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {formatThaiDateTime(selected.createdAt)}
                </p>
              </div>
              <div className={UI_PANEL_NEUTRAL}>
                <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                  <Users size={12} /> ผู้รับผิดชอบ
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {selected.currentOwnerName || "ยังไม่มีผู้รับเคส"}
                </p>
              </div>
              <div className={UI_PANEL_NEUTRAL}>
                <p className="text-[11px] font-semibold text-slate-500">บันทึกล่าสุด</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {selected.latestCareSessionAt
                    ? formatThaiDate(selected.latestCareSessionAt)
                    : selected.careSessionCount > 0
                      ? `${selected.careSessionCount} ครั้ง`
                      : "ยังไม่มีบันทึกดูแล"}
                </p>
              </div>
            </div>

            <div className={UI_PANEL_NEUTRAL}>
              <p className="text-[11px] font-semibold text-slate-500">เส้นทางติดตาม</p>
              <p className="mt-1 text-xs text-slate-500">
                ส่งต่อ → รับเคส → บันทึกดูแล → ปิดเคส — กดแต่ละขั้นเพื่อดูรายละเอียด
              </p>
              <ObservationRoadmap
                steps={selected.roadmap ?? []}
                formatThaiDateTime={(value) => formatThaiDateTime(value)}
              />
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-100 bg-slate-50 p-5">
            <button type="button" onClick={() => setSelectedId(null)} className={UI_BUTTON_PRIMARY}>
              ปิด
            </button>
          </div>
        </StaffModalOverlay>
      ) : null}
    </div>
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
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">{value}</p>
    </button>
  );
}
