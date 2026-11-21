"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Search, X } from "lucide-react";
import { StudentContactPanel } from "@/components/student-contact-panel";
import { ConfirmSubmitLabel } from "@/components/ui/confirm-submit-label";
import { AppDialogShell } from "@/components/ui/app-dialog-shell";
import { InlineAlert } from "@/components/ui/inline-alert";
import { FilterSummaryChip } from "@/components/ui/filter-summary-chip";
import { ListPaginationFooter } from "@/components/ui/list-pagination-footer";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useListPagination } from "@/hooks/use-list-pagination";
import { getNameInitials } from "@/lib/name-prefix";
import {
  referralStatusBadgeClass,
  STATUS_BADGE_COMPACT,
  URGENT_BADGE_CLASS,
} from "@/lib/status-badge";
import { formatStudentIdDisplay } from "@/lib/student-id";
import {
  UI_ACTION_PRIMARY_COMPACT,
  UI_ACTION_SECONDARY_COMPACT,
  UI_DIALOG_CANCEL,
  UI_DIALOG_CLOSE,
  UI_DIALOG_DANGER,
} from "@/lib/ui-classes";

/** ป้ายเจ้าของเคส — พื้นทึบ+ตัวอักษรขาว ให้คอนทราสต์ชัด ไม่กลืนพื้นหลัง */
const OWNERSHIP_BADGE_CLASS = "bg-teal-700 text-white";
import type { WelfareReferralStatus, WelfareTask } from "./types";
import {
  filterWelfareTasks,
  summarizeAcceptedOwnership,
  summarizeWelfareTasks,
  type WelfareFilter,
  type WelfareOwnershipScope,
} from "./welfare-queue";

type WelfareViewProps = {
  welfareTasks: WelfareTask[];
  currentUserId?: string | null;
  onUpdateStatus?: (
    referralId: string,
    status: WelfareReferralStatus,
    extras?: { staffNote?: string; closedReason?: string }
  ) => void | Promise<void>;
  /** รับช่วงเคสที่เพื่อนร่วมทีมกำลังประสาน */
  onClaimOwnership?: (referralId: string) => void | Promise<void>;
  onOpenChat?: (studentUserId: string) => void;
};

type PendingAction =
  | { mode: "accept"; taskId: string }
  | { mode: "close"; taskId: string }
  | { mode: "claim"; taskId: string };

const FILTER_META: Array<{ id: WelfareFilter; label: string; empty: string }> = [
  { id: "ALL", label: "ทั้งหมด", empty: "ยังไม่มีเคสส่งต่อมายังงานพัฒนานิสิต" },
  { id: "PENDING", label: "รอประสานงาน", empty: "ไม่มีเคสรอประสาน" },
  { id: "ACCEPTED", label: "กำลังประสานงาน", empty: "ไม่มีเคสที่กำลังประสาน" },
  { id: "CLOSED", label: "ปิดเคสแล้ว", empty: "ยังไม่มีเคสที่ปิด" },
];

const statusLabel = (status: WelfareReferralStatus): string => {
  if (status === "PENDING") return "รอประสานงาน";
  if (status === "ACCEPTED") return "กำลังประสานงาน";
  return "ปิดเคสแล้ว";
};

/** เวิร์กสเปซประสานสวัสดิการ — master–detail + ชิปสถานะ ให้ใกล้เคียงคิว MH / ติดตาม Advisor */
export function WelfareView({
  welfareTasks,
  currentUserId,
  onUpdateStatus,
  onClaimOwnership,
  onOpenChat,
}: WelfareViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<WelfareFilter>("PENDING");
  const [ownershipScope, setOwnershipScope] = useState<WelfareOwnershipScope>("mine");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [closedReason, setClosedReason] = useState("");
  const [staffNote, setStaffNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!pendingAction || pendingAction.mode !== "close") {
      return;
    }
    setClosedReason("");
    setStaffNote("");
    setFormError(null);
  }, [pendingAction]);

  useBodyScrollLock(pendingAction?.mode === "close");

  const countByFilter = useMemo(() => summarizeWelfareTasks(welfareTasks), [welfareTasks]);
  const acceptedOwnership = useMemo(
    () => summarizeAcceptedOwnership(welfareTasks, currentUserId),
    [currentUserId, welfareTasks]
  );

  const filtered = useMemo(
    () =>
      filterWelfareTasks(welfareTasks, activeFilter, searchQuery, {
        ownershipScope: activeFilter === "ACCEPTED" ? ownershipScope : "all",
        currentUserId,
      }),
    [activeFilter, currentUserId, ownershipScope, searchQuery, welfareTasks]
  );

  const pagination = useListPagination(
    filtered,
    `${activeFilter}:${ownershipScope}:${searchQuery}`,
    {
      fixedRowsPerPage: 12,
    }
  );
  const pageItems = pagination.pageItems;

  const selectedTask =
    filtered.find((task) => task.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    if (!selectedTask) {
      setSelectedId(null);
      return;
    }
    if (!filtered.some((task) => task.id === selectedId)) {
      setSelectedId(selectedTask.id);
    }
  }, [filtered, selectedId, selectedTask]);

  const closePending = () => {
    setPendingAction(null);
    setFormError(null);
  };

  const runUpdate = async (
    taskId: string,
    status: WelfareReferralStatus,
    extras?: { staffNote?: string; closedReason?: string }
  ) => {
    if (!onUpdateStatus) {
      return;
    }
    setBusyId(taskId);
    try {
      await onUpdateStatus(taskId, status, extras);
    } finally {
      setBusyId(null);
    }
  };

  const ownedByOther =
    selectedTask?.referralStatus === "ACCEPTED" &&
    Boolean(selectedTask.acceptedByUserId) &&
    Boolean(currentUserId) &&
    selectedTask.acceptedByUserId !== currentUserId;

  const emptyLabel =
    activeFilter === "ACCEPTED" && ownershipScope === "mine"
      ? "ไม่มีเคสที่คุณกำลังประสาน — สลับเป็นทั้งหมดเพื่อดูของทีม"
      : FILTER_META.find((tab) => tab.id === activeFilter)?.empty ?? "ไม่มีรายการ";
  const actionBusy = Boolean(busyId);

  const runClaim = async (taskId: string) => {
    if (!onClaimOwnership) {
      return;
    }
    setBusyId(taskId);
    try {
      await onClaimOwnership(taskId);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">ประสานงานสวัสดิการ</h2>
          <p className="mt-1 text-sm text-slate-600">
            เลือกเคสทางซ้าย แล้วรับประสานหรือปิดเคสทางขวา — ลำดับ รอประสานงาน → กำลังประสานงาน → ปิดเคสแล้ว
          </p>
        </div>
        <div className="w-full sm:w-80">
          <label className="sr-only" htmlFor="sd-welfare-search">
            ค้นหาเคสสวัสดิการ
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="sd-welfare-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="ค้นหาชื่อ, รหัส, อาจารย์..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-800 outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="tablist" aria-label="สถานะการประสานงาน">
        {FILTER_META.map((tab) => (
          <FilterSummaryChip
            key={tab.id}
            label={tab.label}
            value={countByFilter[tab.id]}
            selected={activeFilter === tab.id}
            onClick={() => {
              setActiveFilter(tab.id);
              if (tab.id === "ACCEPTED") {
                setOwnershipScope("mine");
              }
            }}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="space-y-2.5 border-b border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-slate-800">รายการส่งต่อ</p>
              <p className="mt-0.5 text-xs text-slate-600">
                {filtered.length.toLocaleString()} รายการ
              </p>
            </div>
            {activeFilter === "ACCEPTED" ? (
              <div
                className="grid w-full grid-cols-2 gap-1 rounded-full bg-slate-100 p-1"
                role="tablist"
                aria-label="ขอบเขตเคสกำลังประสาน"
              >
                <FilterSummaryChip
                  density="compact"
                  hideIcon
                  className="w-full"
                  label="ของฉัน"
                  value={acceptedOwnership.mine}
                  selected={ownershipScope === "mine"}
                  onClick={() => setOwnershipScope("mine")}
                />
                <FilterSummaryChip
                  density="compact"
                  hideIcon
                  className="w-full"
                  label="ทั้งหมดในทีม"
                  value={acceptedOwnership.all}
                  selected={ownershipScope === "all"}
                  onClick={() => setOwnershipScope("all")}
                />
              </div>
            ) : null}
          </div>
          <div className="max-h-[40rem] space-y-1 overflow-y-auto p-2">
            {pageItems.map((task) => {
              const selected = selectedTask?.id === task.id;
              const code = formatStudentIdDisplay(task.studentCode);
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setSelectedId(task.id)}
                  className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition ${
                    selected ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0057A8] text-sm font-bold text-white">
                    {getNameInitials(task.studentName, "นศ")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{task.studentName}</p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {code} · ปี {task.year}
                      {task.referralStatus === "ACCEPTED" && task.acceptedByName
                        ? ` · ${task.acceptedByName}`
                        : ""}
                    </p>
                    {task.note ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-700">{task.note}</p>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {task.isUrgent ? (
                        <span className={`${STATUS_BADGE_COMPACT} ${URGENT_BADGE_CLASS}`}>ด่วน</span>
                      ) : null}
                      <span
                        className={`${STATUS_BADGE_COMPACT} ${referralStatusBadgeClass(task.referralStatus)}`}
                      >
                        {statusLabel(task.referralStatus)}
                      </span>
                      {task.referralStatus === "ACCEPTED" &&
                      currentUserId &&
                      task.acceptedByUserId === currentUserId ? (
                        <span className={`${STATUS_BADGE_COMPACT} ${OWNERSHIP_BADGE_CLASS}`}>ของฉัน</span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-slate-600">{emptyLabel}</p>
            ) : null}
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
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          {!selectedTask ? (
            <p className="py-20 text-center text-sm text-slate-600">เลือกเคสทางซ้ายเพื่อดูรายละเอียดและดำเนินการ</p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0057A8] text-lg font-bold text-white">
                    {getNameInitials(selectedTask.studentName, "นศ")}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-900">{selectedTask.studentName}</h3>
                      {selectedTask.isUrgent ? (
                        <span className={`${STATUS_BADGE_COMPACT} ${URGENT_BADGE_CLASS}`}>ด่วน</span>
                      ) : null}
                      <span
                        className={`${STATUS_BADGE_COMPACT} ${referralStatusBadgeClass(
                          selectedTask.referralStatus
                        )}`}
                      >
                        {statusLabel(selectedTask.referralStatus)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatStudentIdDisplay(selectedTask.studentCode)} · ชั้นปี {selectedTask.year}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      ส่งต่อโดย {selectedTask.owner}
                      {selectedTask.acceptedByName ? ` · ผู้ประสาน ${selectedTask.acceptedByName}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{selectedTask.updatedAt}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {onOpenChat && selectedTask.studentUserId && selectedTask.referralStatus !== "CLOSED" ? (
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => onOpenChat(selectedTask.studentUserId!)}
                      className={UI_ACTION_SECONDARY_COMPACT}
                    >
                      คุยสั้น
                    </button>
                  ) : null}
                  {onUpdateStatus && selectedTask.referralStatus === "PENDING" ? (
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => setPendingAction({ mode: "accept", taskId: selectedTask.id })}
                      className={UI_ACTION_PRIMARY_COMPACT}
                    >
                      <ConfirmSubmitLabel busy={busyId === selectedTask.id}>รับประสาน</ConfirmSubmitLabel>
                    </button>
                  ) : null}
                  {onUpdateStatus && selectedTask.referralStatus !== "CLOSED" ? (
                    ownedByOther ? (
                      <div className="flex flex-col items-stretch gap-2 sm:items-end">
                        <p className="text-xs text-slate-500">
                          ผู้ประสานตอนนี้: {selectedTask.acceptedByName || "เพื่อนร่วมทีม"} ·
                          ปิดเคสได้เฉพาะผู้รับ
                        </p>
                        {onClaimOwnership ? (
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() => setPendingAction({ mode: "claim", taskId: selectedTask.id })}
                            className={UI_ACTION_PRIMARY_COMPACT}
                          >
                            <ConfirmSubmitLabel busy={busyId === selectedTask.id}>
                              รับช่วงเคสนี้
                            </ConfirmSubmitLabel>
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => setPendingAction({ mode: "close", taskId: selectedTask.id })}
                        className={UI_ACTION_SECONDARY_COMPACT}
                      >
                        ปิดเคส
                      </button>
                    )
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-bold tracking-wide text-slate-600">เหตุผลที่ส่งต่อ</p>
                <p className="mt-1 text-sm leading-6 text-slate-800">{selectedTask.note || "—"}</p>
              </div>

              <StudentContactPanel
                email={selectedTask.email}
                phone={selectedTask.phone}
                guardianPhone={selectedTask.guardianPhone}
              />

              {selectedTask.staffNote ? (
                <div className="rounded-xl border border-slate-200 px-4 py-3">
                  <p className="text-[10px] font-bold tracking-wide text-slate-600">บันทึกประสาน</p>
                  <p className="mt-1 text-sm text-slate-700">{selectedTask.staffNote}</p>
                </div>
              ) : null}

              {selectedTask.closedReason ? (
                <div className="rounded-xl border border-slate-200 px-4 py-3">
                  <p className="text-[10px] font-bold tracking-wide text-slate-600">เหตุผลปิดเคส</p>
                  <p className="mt-1 text-sm text-slate-700">{selectedTask.closedReason}</p>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">เอกสารที่ควรเตรียมไว้ล่วงหน้า</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {["แบบฟอร์มยืนยันการช่วยเหลือเบื้องต้น", "รายการเอกสารประกอบการขอรับทุน"].map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-800">
              <FileText className="h-4 w-4 shrink-0 text-slate-500" />
              {item}
            </div>
          ))}
        </div>
      </section>

      <PromptDialog
        open={pendingAction?.mode === "accept"}
        optional
        title="รับประสานเคส"
        description="บันทึกสั้น ๆ ตอนรับประสานได้ถ้าต้องการ แล้วกดยืนยันเพื่อรับเคสเข้าประสาน"
        placeholder="เช่น ติดต่อนิสิตภายในวันนี้..."
        confirmLabel="รับประสาน"
        cancelLabel="ยกเลิก"
        onCancel={closePending}
        onConfirm={(value) => {
          if (!pendingAction || pendingAction.mode !== "accept") {
            return;
          }
          const taskId = pendingAction.taskId;
          closePending();
          void runUpdate(taskId, "ACCEPTED", {
            staffNote: value || undefined,
          });
        }}
      />

      <PromptDialog
        open={pendingAction?.mode === "claim"}
        optional
        title="รับช่วงเคส"
        description={
          selectedTask?.acceptedByName
            ? `รับช่วงจาก ${selectedTask.acceptedByName} — คุณจะเป็นผู้ประสานและปิดเคสได้`
            : "รับช่วงจากเพื่อนร่วมทีม — คุณจะเป็นผู้ประสานและปิดเคสได้"
        }
        placeholder="บันทึกสั้น ๆ ตอนรับช่วง (ไม่บังคับ)"
        confirmLabel="ยืนยันรับช่วง"
        cancelLabel="ยกเลิก"
        onCancel={closePending}
        onConfirm={() => {
          if (!pendingAction || pendingAction.mode !== "claim") {
            return;
          }
          const taskId = pendingAction.taskId;
          closePending();
          void runClaim(taskId);
        }}
      />

      {mounted && pendingAction?.mode === "close" ? (
        <AppDialogShell
          panelClassName="max-w-md"
          zIndexClassName="z-[10001]"
          labelledBy="welfare-close-title"
          onBackdropClick={closePending}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-red-50 to-white" />
          <button type="button" onClick={closePending} className={UI_DIALOG_CLOSE} aria-label="ปิด">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>

          <div className="relative px-6 pb-2 pt-8 sm:px-8 sm:pt-9">
            <h3 id="welfare-close-title" className="pr-8 text-lg font-bold text-slate-900 sm:text-xl">
              ปิดเคส
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              ระบุเหตุผลที่ปิดเคส (จำเป็น) และบันทึกสรุปเพิ่มเติมได้ถ้าต้องการ
            </p>

            <div className="mt-5 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">เหตุผลที่ปิดเคส</label>
                <textarea
                  rows={3}
                  value={closedReason}
                  onChange={(event) => {
                    setClosedReason(event.target.value);
                    if (formError) {
                      setFormError(null);
                    }
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-[#0057A8]/40 focus:ring-4 focus:ring-[#0057A8]/10"
                  placeholder="เช่น ช่วยเหลือเรียบร้อย / ส่งต่อหน่วยงานอื่นแล้ว"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">บันทึกสรุปเพิ่มเติม (ไม่บังคับ)</label>
                <textarea
                  rows={2}
                  value={staffNote}
                  onChange={(event) => setStaffNote(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-[#0057A8]/40 focus:ring-4 focus:ring-[#0057A8]/10"
                  placeholder="รายละเอียดสั้น ๆ"
                />
              </div>
              {formError ? <InlineAlert className="py-2 text-xs">{formError}</InlineAlert> : null}
            </div>
          </div>

          <div className="relative flex flex-col-reverse gap-2.5 px-6 pb-6 pt-4 sm:flex-row sm:justify-center sm:px-8 sm:pb-7">
            <button type="button" onClick={closePending} className={`${UI_DIALOG_CANCEL} sm:min-w-[7rem]`}>
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={() => {
                const reason = closedReason.trim();
                if (!reason) {
                  setFormError("กรุณาระบุเหตุผลที่ปิดเคส");
                  return;
                }
                if (!pendingAction) {
                  return;
                }
                const taskId = pendingAction.taskId;
                closePending();
                void runUpdate(taskId, "CLOSED", {
                  closedReason: reason,
                  staffNote: staffNote.trim() || undefined,
                });
              }}
              className={UI_DIALOG_DANGER}
            >
              ปิดเคส
            </button>
          </div>
        </AppDialogShell>
      ) : null}
    </div>
  );
}
