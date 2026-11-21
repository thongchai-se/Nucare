"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  GitBranch,
  Hourglass,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import { ExecutivePageToolbar } from "@/components/executive/executive-page-toolbar";
import { ExecutiveSectionShell } from "@/components/executive/executive-section-shell";
import { ExecutiveStatCard } from "@/components/executive/executive-stat-card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { ListPaginationFooter } from "@/components/ui/list-pagination-footer";
import {
  RosterMobileCard,
  RosterMobileList,
  RosterPersonCell,
  RosterRow,
  RosterTable,
  RosterTd,
} from "@/components/ui/roster-table";
import { useListPagination } from "@/hooks/use-list-pagination";
import api from "@/lib/axios";
import {
  buildTimelineSteps,
  type TimelineDisplayKind,
  type TimelineDisplayStep,
} from "@/lib/executive-referral-timeline";
import {
  referralStatusBadgeClass,
  STATUS_BADGE_COMPACT,
  URGENT_BADGE_CLASS,
} from "@/lib/status-badge";
import { formatStudentIdDisplay } from "@/lib/student-dashboard";
import type { ExecutiveYearFilter } from "@/types/executive";
import type {
  ExecutiveReferralCaseDetail,
  ExecutiveReferralCaseListItem,
  ExecutiveReferralListResponse,
} from "@/types/executive-referrals";

type StatusFilter = "ALL" | "PENDING" | "ACCEPTED" | "CLOSED";
type TargetFilter = "ALL" | "COUNSELING_CENTER" | "STUDENT_DEVELOPMENT";

type ExecutiveReferralCasesProps = {
  yearFilter: ExecutiveYearFilter;
  onYearFilterChange: (next: ExecutiveYearFilter) => void;
  selectedCaseId: string | null;
  onSelectCase: (caseId: string | null) => void;
};

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const statusToneClass = (status: ExecutiveReferralCaseListItem["status"]): string =>
  referralStatusBadgeClass(status);

const roadmapStepMeta = (
  kind: TimelineDisplayKind
): { badge: string; rail: string; shortLabel: string } => {
  if (kind === "sent") {
    return { badge: "bg-amber-600 text-white", rail: "bg-amber-300", shortLabel: "ส่ง" };
  }
  if (kind === "accepted") {
    return { badge: "bg-sky-700 text-white", rail: "bg-sky-300", shortLabel: "รับ" };
  }
  if (kind === "care") {
    return { badge: "bg-emerald-700 text-white", rail: "bg-emerald-300", shortLabel: "ดูแล" };
  }
  return { badge: "bg-slate-700 text-white", rail: "bg-slate-300", shortLabel: "ปิด" };
};

/** ไทม์ไลน์เส้นทางเคสสำหรับผู้บริหาร */
function ReferralCaseTimeline({ steps }: { steps: TimelineDisplayStep[] }) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <ol className="relative">
      {steps.map((step, index) => {
        const meta = roadmapStepMeta(step.kind);
        const isLast = index === steps.length - 1;
        return (
          <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
            <div className="relative flex w-9 shrink-0 flex-col items-center">
              <span
                className={`relative z-[1] flex h-8 min-w-[2rem] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none ${meta.badge}`}
              >
                {meta.shortLabel}
              </span>
              {!isLast ? <span className={`mt-1 w-0.5 flex-1 min-h-[1rem] ${meta.rail}`} aria-hidden /> : null}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{step.label}</p>
                <p className="shrink-0 text-[11px] tabular-nums text-slate-500">{formatDateTime(step.at)}</p>
              </div>
              {step.actorName ? (
                <p className="mt-1 text-xs font-medium text-slate-700">{step.actorName}</p>
              ) : null}
              {step.detail ? <p className="mt-1 text-xs leading-5 text-slate-600">{step.detail}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** รายการเคสส่งต่อ + แผงเจาะลึกเส้นทาง/บันทึกสำหรับผู้บริหาร */
export function ExecutiveReferralCases({
  yearFilter,
  onYearFilterChange,
  selectedCaseId,
  onSelectCase,
}: ExecutiveReferralCasesProps) {
  const [items, setItems] = useState<ExecutiveReferralCaseListItem[]>([]);
  const [stats, setStats] = useState<ExecutiveReferralListResponse["stats"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [targetFilter, setTargetFilter] = useState<TargetFilter>("ALL");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [detail, setDetail] = useState<ExecutiveReferralCaseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (yearFilter !== "ALL") {
        params.set("studyYear", yearFilter);
      }
      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      if (targetFilter !== "ALL") {
        params.set("target", targetFilter);
      }
      if (urgentOnly) {
        params.set("urgentOnly", "true");
      }
      if (appliedSearch.trim().length >= 2) {
        params.set("search", appliedSearch.trim());
      }

      const query = params.toString();
      const response = await api.get<ExecutiveReferralListResponse>(
        `/api/executive/referrals${query ? `?${query}` : ""}`
      );
      setItems(response.data.items);
      setStats(response.data.stats);
    } catch {
      setError("โหลดเคสส่งต่อไม่สำเร็จ กรุณาลองใหม่");
      setItems([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, statusFilter, targetFilter, urgentOnly, yearFilter]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (!selectedCaseId) {
      setDetail(null);
      setDetailError(null);
      return;
    }

    let cancelled = false;
    const loadDetail = async () => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const response = await api.get<ExecutiveReferralCaseDetail>(
          `/api/executive/referrals/${selectedCaseId}`
        );
        if (!cancelled) {
          setDetail(response.data);
        }
      } catch {
        if (!cancelled) {
          setDetail(null);
          setDetailError("โหลดรายละเอียดเคสไม่สำเร็จ");
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    };

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedCaseId]);

  const pagination = useListPagination(
    items,
    `${yearFilter}:${statusFilter}:${targetFilter}:${urgentOnly}:${appliedSearch}:${items.length}`,
    { fixedRowsPerPage: 10 }
  );

  const selectedPreview = useMemo(
    () => items.find((item) => item.id === selectedCaseId) ?? detail,
    [detail, items, selectedCaseId]
  );

  const applySearch = () => {
    setAppliedSearch(searchInput.trim());
  };

  return (
    <div className="space-y-6">
      <ExecutivePageToolbar
        title="เคสส่งต่อ"
        subtitle="ดูภาพรวมการส่งต่อ แล้วกดเจาะลึกว่าใครส่งไปไหน ใครรับ/ปิด และบันทึกว่าอย่างไร"
        bucketLabel={yearFilter === "ALL" ? "ทุกชั้นปี" : `ชั้นปีที่ ${yearFilter}`}
        yearFilter={yearFilter}
        onYearFilterChange={onYearFilterChange}
      />

      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <ExecutiveStatCard
            label="ทั้งหมด"
            value={stats.total.toLocaleString()}
            description="เคสในช่วงที่กรอง"
            icon={<Users size={18} />}
          />
          <ExecutiveStatCard
            label="รอรับเคส"
            value={stats.pending.toLocaleString()}
            description="ยังไม่มีผู้รับเคส"
            icon={<Hourglass size={18} />}
            iconClassName="bg-amber-50 text-amber-800"
          />
          <ExecutiveStatCard
            label="กำลังดูแล"
            value={stats.accepted.toLocaleString()}
            description="รับเคสแล้ว"
            icon={<GitBranch size={18} />}
            iconClassName="bg-sky-50 text-sky-800"
          />
          <ExecutiveStatCard
            label="ปิดเคสแล้ว"
            value={stats.closed.toLocaleString()}
            description="จบการติดตาม"
            icon={<CheckCircle2 size={18} />}
            iconClassName="bg-slate-100 text-slate-700"
          />
          <ExecutiveStatCard
            label="เร่งด่วนค้าง"
            value={stats.urgentOpen.toLocaleString()}
            description="ยังไม่ปิด"
            icon={<ShieldAlert size={18} />}
            iconClassName="bg-red-50 text-red-800"
            valueClassName={stats.urgentOpen > 0 ? "text-red-700" : undefined}
          />
        </div>
      ) : null}

      {stats && stats.byTarget.length > 0 ? (
        <ExecutiveSectionShell title="กระจายตามปลายทาง" subtitle="จำนวนเคสในช่วงที่กรอง">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {stats.byTarget.map((row) => {
              const pct = stats.total > 0 ? Math.round((row.count / stats.total) * 100) : 0;
              return (
                <div key={row.target} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-800">{row.label}</p>
                    <p className="text-lg font-bold text-slate-900">{row.count.toLocaleString()}</p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-slate-700" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{pct}% ของรายการที่กรอง</p>
                </div>
              );
            })}
          </div>
        </ExecutiveSectionShell>
      ) : null}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="min-w-0 flex-1 text-sm">
            <span className="mb-1.5 block font-semibold text-slate-700">ค้นหา</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    applySearch();
                  }
                }}
                placeholder="ชื่อนิสิต รหัส ผู้ส่ง หรือเหตุผล (≥2 ตัวอักษร)"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none focus:border-slate-400"
              />
            </div>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={applySearch}
              className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
            >
              ค้นหา
            </button>
            <button
              type="button"
              onClick={() => void fetchList()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={16} /> รีเฟรช
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="ตัวกรองสถานะ">
          {(
            [
              { id: "ALL" as const, label: "ทุกสถานะ" },
              { id: "PENDING" as const, label: "รอรับเคส" },
              { id: "ACCEPTED" as const, label: "กำลังดูแล" },
              { id: "CLOSED" as const, label: "ปิดเคสแล้ว" },
            ] as const
          ).map((option) => {
            const selected = statusFilter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setStatusFilter(option.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selected
                    ? "border-slate-800 bg-slate-800 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="ตัวกรองปลายทาง">
          {(
            [
              { id: "ALL" as const, label: "ทุกปลายทาง" },
              { id: "COUNSELING_CENTER" as const, label: "ศูนย์ให้คำปรึกษา" },
              { id: "STUDENT_DEVELOPMENT" as const, label: "งานพัฒนานิสิต" },
            ] as const
          ).map((option) => {
            const selected = targetFilter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setTargetFilter(option.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selected
                    ? "border-slate-800 bg-slate-800 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setUrgentOnly((current) => !current)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              urgentOnly
                ? "border-red-700 bg-red-700 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <ShieldAlert size={14} /> เร่งด่วนเท่านั้น
          </button>
        </div>
      </div>

      {error ? (
        <InlineAlert>
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void fetchList()}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white"
          >
            <RefreshCw size={14} /> ลองใหม่
          </button>
        </InlineAlert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex min-h-[280px] items-center justify-center">
              <span className="loader h-7 w-7 text-blue-600" />
            </div>
          ) : (
            <>
              <RosterTable
                columns={[
                  { key: "student", label: "ชื่อ-นามสกุล", width: "28%" },
                  { key: "status", label: "สถานะ", width: "16%", align: "center" },
                  { key: "path", label: "เส้นทาง", width: "36%" },
                  { key: "when", label: "วัน/เวลา", width: "20%" },
                ]}
                emptyMessage={
                  <span className="inline-flex flex-col items-center gap-2">
                    <GitBranch className="h-8 w-8 text-slate-300" />
                    <span>ยังไม่มีเคสส่งต่อในช่วงที่เลือก</span>
                  </span>
                }
                minWidthClass="min-w-[640px]"
              >
                {pagination.pageItems.map((item) => {
                  const selected = item.id === selectedCaseId;
                  const ownerLabel =
                    item.status === "CLOSED"
                      ? item.currentOwnerName ?? "ปิดเคสแล้ว"
                      : item.currentOwnerName ?? "รอผู้รับ";
                  return (
                    <RosterRow
                      key={item.id}
                      selected={selected}
                      onClick={() => onSelectCase(item.id)}
                    >
                      <RosterTd>
                        <RosterPersonCell
                          name={item.studentName}
                          meta={`${formatStudentIdDisplay(item.studentCode)} · ชั้นปี ${item.studyYear}`}
                        />
                      </RosterTd>
                      <RosterTd align="center">
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          {item.isUrgent ? (
                            <span className={`${STATUS_BADGE_COMPACT} ${URGENT_BADGE_CLASS}`}>ด่วน</span>
                          ) : null}
                          <span className={`${STATUS_BADGE_COMPACT} ${statusToneClass(item.status)}`}>
                            {item.statusLabel}
                          </span>
                        </div>
                      </RosterTd>
                      <RosterTd>
                        <p className="truncate text-slate-700">
                          {item.advisorName}
                          <span className="mx-1 text-slate-400">→</span>
                          {item.targetLabel}
                          <span className="mx-1 text-slate-400">→</span>
                          {ownerLabel}
                        </p>
                      </RosterTd>
                      <RosterTd className="text-slate-500">{formatDateTime(item.createdAt)}</RosterTd>
                    </RosterRow>
                  );
                })}
              </RosterTable>

              <RosterMobileList
                emptyMessage={
                  <span className="inline-flex flex-col items-center gap-2">
                    <GitBranch className="h-8 w-8 text-slate-300" />
                    <span>ยังไม่มีเคสส่งต่อในช่วงที่เลือก</span>
                  </span>
                }
              >
                {pagination.pageItems.map((item) => {
                  const selected = item.id === selectedCaseId;
                  const ownerLabel =
                    item.status === "CLOSED"
                      ? item.currentOwnerName ?? "ปิดเคสแล้ว"
                      : item.currentOwnerName ?? "รอผู้รับ";
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectCase(item.id)}
                      className={`w-full text-left ${selected ? "bg-blue-50/70" : ""}`}
                    >
                      <RosterMobileCard>
                        <RosterPersonCell
                          name={item.studentName}
                          meta={`${formatStudentIdDisplay(item.studentCode)} · ชั้นปี ${item.studyYear}`}
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {item.isUrgent ? (
                            <span className={`${STATUS_BADGE_COMPACT} ${URGENT_BADGE_CLASS}`}>ด่วน</span>
                          ) : null}
                          <span className={`${STATUS_BADGE_COMPACT} ${statusToneClass(item.status)}`}>
                            {item.statusLabel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          {item.advisorName} → {item.targetLabel} → {ownerLabel}
                        </p>
                        <p className="text-xs text-slate-400">{formatDateTime(item.createdAt)}</p>
                      </RosterMobileCard>
                    </button>
                  );
                })}
              </RosterMobileList>
            </>
          )}

          {!loading ? (
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
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          {!selectedCaseId ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center px-4 text-center">
              <ClipboardList className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm font-bold text-slate-600">เลือกเคสจากรายการเพื่อเจาะลึก</p>
              <p className="mt-1 text-sm text-slate-500">จะเห็นเส้นทางส่งต่อ ผู้รับเคส และบันทึกที่เกี่ยวข้อง</p>
            </div>
          ) : detailLoading && !detail ? (
            <div className="flex min-h-[280px] items-center justify-center">
              <span className="loader h-7 w-7 text-blue-600" />
            </div>
          ) : detailError && !detail ? (
            <InlineAlert>
              <p>{detailError}</p>
            </InlineAlert>
          ) : detail || selectedPreview ? (
            (() => {
              const caseItem = detail ?? selectedPreview;
              if (!caseItem) {
                return null;
              }
              const timelineSteps = buildTimelineSteps(caseItem.roadmap, caseItem.targetLabel);
              const hasNotes = Boolean(caseItem.reason || caseItem.staffNote || caseItem.closedReason);

              return (
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900">{caseItem.studentName}</h3>
                        {caseItem.isUrgent ? (
                          <span className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-800">
                            เร่งด่วน
                          </span>
                        ) : null}
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${statusToneClass(caseItem.status)}`}
                        >
                          {caseItem.statusLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatStudentIdDisplay(caseItem.studentCode)} · ชั้นปี {caseItem.studyYear}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectCase(null)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      aria-label="ปิดรายละเอียด"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <MapPin size={16} className="text-slate-500" />
                      เส้นทางเคส
                    </h4>
                    <ReferralCaseTimeline steps={timelineSteps} />
                  </div>

                  {hasNotes ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <h4 className="text-sm font-semibold text-slate-800">บันทึก</h4>
                      <dl className="mt-2 space-y-2 text-sm">
                        {caseItem.reason ? (
                          <div>
                            <dt className="text-xs font-semibold text-slate-500">เหตุผลส่งต่อ</dt>
                            <dd className="mt-0.5 break-words leading-6 text-slate-700">{caseItem.reason}</dd>
                          </div>
                        ) : null}
                        {caseItem.staffNote ? (
                          <div>
                            <dt className="text-xs font-semibold text-slate-500">บันทึกผู้รับเคส</dt>
                            <dd className="mt-0.5 break-words leading-6 text-slate-700">{caseItem.staffNote}</dd>
                          </div>
                        ) : null}
                        {caseItem.closedReason ? (
                          <div>
                            <dt className="text-xs font-semibold text-slate-500">เหตุผลปิด</dt>
                            <dd className="mt-0.5 break-words leading-6 text-slate-700">{caseItem.closedReason}</dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                  ) : null}

                  {detail?.careNotes && detail.careNotes.length > 0 ? (
                    <div>
                      <h4 className="mb-3 text-sm font-semibold text-slate-800">บันทึกการดูแล</h4>
                      <ul className="space-y-3">
                        {detail.careNotes.map((note) => (
                          <li key={note.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">
                              {formatDateTime(note.sessionDate)} · {note.providerName}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-700">{note.summary}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">แผน: {note.interventionPlan}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              );
            })()
          ) : null}
        </aside>
      </div>
    </div>
  );
}
