"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarDays,
  ClipboardList,
  FileText,
  Search,
  Users,
  XCircle,
} from "lucide-react";
import { ConfirmSubmitLabel } from "@/components/ui/confirm-submit-label";
import { ListPaginationFooter } from "@/components/ui/list-pagination-footer";
import { useListPagination } from "@/hooks/use-list-pagination";
import api from "@/lib/axios";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  activityStatusBadgeClass,
  presentActivityStatus,
} from "@/lib/activity-status-display";
import { presentClinicalNote } from "@/lib/clinical-note-display";
import { stripSeedMarkers } from "@/lib/history-display";
import { getNameInitials } from "@/lib/name-prefix";
import { UI_ACTION_PRIMARY_COMPACT, UI_ACTION_SECONDARY_COMPACT } from "@/lib/ui-classes";
import type { MentalHealthCase, RiskClasses } from "./types";

type HistoryPanel = "care" | "appointments" | "overview";

type StudentHistoryResponse = {
  student: {
    id: string;
    name: string;
    studentId: string | null;
    year: string;
    riskLevel: MentalHealthCase["riskLevel"];
    latestScore: number | null;
    latestInstrument: string | null;
    careRecordCount: number;
    behaviorRecordCount: number;
  };
  careSessions: Array<{
    id: string;
    sessionDate: string;
    summary: string;
    interventionPlan: string;
    confidentialNotes: string | null;
    providerName: string;
  }>;
  appointments: Array<{
    id: string;
    date: string;
    time: string;
    location: string;
    note: string;
    status: string;
    providerName: string;
    scheduledAt: string;
  }>;
  consultationByTeacher: Array<{
    teacherId: string;
    teacherName: string;
    totalCount: number;
    openCount: number;
    closedCount: number;
    lastRequestedAt: string;
  }>;
  consultationTotal: number;
  referrals: { total: number; open: number; closed: number; urgentOpen: number };
  emergencies: { total: number; open: number; resolved: number };
  assessments: Array<{
    assessedAt: string;
    score: number | null;
    instrument: string;
    riskLevel: MentalHealthCase["riskLevel"];
  }>;
  assessmentTimeline: Array<{
    id: string;
    waveLabel: string;
    surveyTitle: string;
    instrumentCode: "GHQ28" | "CUSTOM";
    status: "COMPLETED" | "NOT_COMPLETED" | "OVERDUE";
    totalScore: number | null;
    maxScore: number | null;
    riskLevel: "NORMAL" | "MEDIUM" | "HIGH" | null;
    submittedAt: string | null;
    scheduledAt: string;
  }>;
  activity: Array<{
    id: string;
    kind: string;
    date: string;
    type: string;
    topic: string;
    status: string | null;
    actorName: string;
    isUrgent: boolean;
    detail?: string | null;
  }>;
};

export type CasesWorkspaceMode = "queue" | "cases";

type CasesViewProps = {
  mode: CasesWorkspaceMode;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  filteredActiveCases: MentalHealthCase[];
  getRiskClasses: (riskLevel: MentalHealthCase["riskLevel"]) => RiskClasses;
  getCaseStatusLabel: (item: MentalHealthCase) => string;
  getNextAppointmentLabel: (studentId: string) => string;
  formatThaiDate: (value: string) => string;
  formatThaiDateTime?: (value: string) => string;
  formatQueueWait: (createdAt: string) => string;
  openCareModal: (item: MentalHealthCase) => void;
  openAppointmentModal: (item?: MentalHealthCase) => void;
  onAcceptCase: (referralId: string) => void | Promise<void>;
  onCloseCase: (referralId: string) => void | Promise<void>;
  busyReferralId?: string | null;
  initialReferralId?: string | null;
};

const workspaceCopy: Record<
  CasesWorkspaceMode,
  { title: string; subtitle: string; listTitle: string; emptyList: string; emptyDetail: string }
> = {
  queue: {
    title: "คิวรอรับ",
    subtitle: "ดูเหตุผลและประวัติแล้วกดรับ — งานต่อทำที่เมนูเคสที่ดูแล",
    listTitle: "คิวรอรับ",
    emptyList: "ยังไม่มีคิวรอรับในตอนนี้",
    emptyDetail: "เลือกคิวทางซ้ายเพื่อดูประวัติและรับเคส",
  },
  cases: {
    title: "เคสที่ดูแล",
    subtitle: "นัดคุย บันทึกผล หรือปิดเคสเมื่อเสร็จ",
    listTitle: "เคสที่ดูแล",
    emptyList: "ยังไม่มีเคสที่ดูแล",
    emptyDetail: "เมื่อรับเคสจากคิวแล้ว จะแสดงที่นี่",
  },
};

const fieldLabelClass = "text-[10px] font-bold tracking-wide text-slate-600";

const appointmentStatusLabel: Record<string, string> = {
  SCHEDULED: "นัดหมายแล้ว",
  COMPLETED: "พบแล้ว",
  CANCELLED: "ยกเลิก",
  NO_SHOW: "ไม่มาตามนัด",
};

/** เวิร์กสเปซคิวหรือเคสแบบ master–detail — รายชื่อซ้าย ประวัติ/นัด/บันทึกขวา */
export function CasesView({
  mode,
  searchQuery,
  setSearchQuery,
  filteredActiveCases,
  getRiskClasses,
  getCaseStatusLabel,
  getNextAppointmentLabel,
  formatThaiDate,
  formatThaiDateTime,
  formatQueueWait,
  openCareModal,
  openAppointmentModal,
  onAcceptCase,
  onCloseCase,
  busyReferralId = null,
  initialReferralId = null,
}: CasesViewProps) {
  const copy = workspaceCopy[mode];
  const isQueue = mode === "queue";
  const actionBusy = Boolean(busyReferralId);
  const pagination = useListPagination(filteredActiveCases, searchQuery, {
    fixedRowsPerPage: 12,
  });
  const pageItems = pagination.pageItems;

  const [selectedReferralId, setSelectedReferralId] = useState<string | null>(initialReferralId);
  const [history, setHistory] = useState<StudentHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyReloadKey, setHistoryReloadKey] = useState(0);
  const [panel, setPanel] = useState<HistoryPanel>(isQueue ? "overview" : "care");
  const [revealedConfidentialIds, setRevealedConfidentialIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setPanel(isQueue ? "overview" : "care");
  }, [isQueue]);

  useEffect(() => {
    setRevealedConfidentialIds({});
  }, [selectedReferralId]);

  useEffect(() => {
    if (initialReferralId && filteredActiveCases.some((item) => item.referralId === initialReferralId)) {
      setSelectedReferralId(initialReferralId);
    }
  }, [filteredActiveCases, initialReferralId]);

  const selectedCase =
    filteredActiveCases.find((item) => item.referralId === selectedReferralId) ??
    filteredActiveCases[0] ??
    null;

  useEffect(() => {
    if (!selectedCase) {
      setSelectedReferralId(null);
      setHistory(null);
      return;
    }
    if (!filteredActiveCases.some((item) => item.referralId === selectedReferralId)) {
      setSelectedReferralId(selectedCase.referralId);
    }
  }, [filteredActiveCases, selectedCase, selectedReferralId]);

  useEffect(() => {
    if (!selectedCase) {
      setHistory(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const response = await api.get<StudentHistoryResponse>(
          `/api/mental-health/referrals/${selectedCase.referralId}/history`
        );
        if (!cancelled) {
          setHistory(response.data);
        }
      } catch (error) {
        if (!cancelled) {
          setHistory(null);
          setHistoryError(getApiErrorMessage(error, "โหลดประวัติไม่สำเร็จ กรุณาลองใหม่"));
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [historyReloadKey, selectedCase?.referralId, selectedCase?.careSessionCount, selectedCase?.status]);

  const formatWhen = formatThaiDateTime ?? ((value: string) => formatThaiDate(value));

  const panels: Array<{ id: HistoryPanel; label: string }> = isQueue
    ? [
        { id: "overview", label: "ภาพรวม" },
        { id: "care", label: "บันทึกหลังพบ" },
        { id: "appointments", label: "นัดหมาย" },
      ]
    : [
        { id: "care", label: "บันทึกหลังพบ" },
        { id: "appointments", label: "นัดหมาย" },
        { id: "overview", label: "ภาพรวม" },
      ];

  const selectedRisk = selectedCase ? getRiskClasses(selectedCase.riskLevel) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{copy.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{copy.subtitle}</p>
        </div>
        <div className="w-full sm:w-80">
          <label className="sr-only" htmlFor={`mh-${mode}-search`}>
            ค้นหารายชื่อ
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id={`mh-${mode}-search`}
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="ค้นหาชื่อ, รหัส, ปีการศึกษา..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-800 outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-bold text-slate-800">{copy.listTitle}</p>
            <p className="mt-0.5 text-xs text-slate-600">{filteredActiveCases.length.toLocaleString()} รายการ</p>
          </div>
          <div className="max-h-[40rem] space-y-1 overflow-y-auto p-2">
            {pageItems.map((item) => {
              const risk = getRiskClasses(item.riskLevel);
              const selected = selectedCase?.referralId === item.referralId;
              return (
                <button
                  key={item.referralId}
                  type="button"
                  onClick={() => setSelectedReferralId(item.referralId)}
                  className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition ${
                    selected ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0057A8] text-sm font-bold text-white">
                    {getNameInitials(item.name, "นศ")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{item.name}</p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {item.maskedStudentId} · {item.year}
                      {isQueue ? ` · ${formatQueueWait(item.createdAt)}` : null}
                    </p>
                    {isQueue && item.reason ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-700">
                        {stripSeedMarkers(item.reason) || item.reason}
                      </p>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${risk.badge}`}>
                        {risk.label}
                      </span>
                      <span
                        className={`text-[10px] font-semibold ${
                          isQueue ? "text-amber-800" : "text-blue-800"
                        }`}
                      >
                        {getCaseStatusLabel(item)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
            {filteredActiveCases.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-slate-600">{copy.emptyList}</p>
            ) : null}
          </div>
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
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          {!selectedCase ? (
            <p className="py-20 text-center text-sm text-slate-600">{copy.emptyDetail}</p>
          ) : (
            <div className="space-y-5">
              <div className="sticky top-0 z-10 -mx-1 space-y-3 bg-white px-1 pb-3">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0057A8] text-lg font-bold text-white">
                      {getNameInitials(selectedCase.name, "นศ")}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900">{selectedCase.name}</h3>
                        {selectedRisk ? (
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${selectedRisk.badge}`}>
                            {selectedRisk.label}
                          </span>
                        ) : null}
                        {selectedCase.isUrgent ? (
                          <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            เร่งด่วน
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {selectedCase.maskedStudentId} · ชั้นปี {selectedCase.year}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        ส่งต่อโดย {selectedCase.advisorName}
                        {isQueue
                          ? ` · ${formatQueueWait(selectedCase.createdAt)}`
                          : ` · นัดถัดไป ${getNextAppointmentLabel(selectedCase.studentId)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isQueue ? (
                      <>
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => void onAcceptCase(selectedCase.referralId)}
                          className={`${UI_ACTION_PRIMARY_COMPACT} px-3 py-2`}
                        >
                          <ConfirmSubmitLabel busy={busyReferralId === selectedCase.referralId}>
                            {busyReferralId === selectedCase.referralId ? "กำลังรับเคส..." : "ยืนยันรับเคส"}
                          </ConfirmSubmitLabel>
                        </button>
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => void onCloseCase(selectedCase.referralId)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          ปฏิเสธคิว
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => openCareModal(selectedCase)}
                          className={`${UI_ACTION_SECONDARY_COMPACT} px-3 py-2`}
                        >
                          <FileText className="h-4 w-4" />
                          บันทึกผล
                        </button>
                        <button
                          type="button"
                          onClick={() => openAppointmentModal(selectedCase)}
                          className={`${UI_ACTION_PRIMARY_COMPACT} px-3 py-2`}
                        >
                          <CalendarDays className="h-4 w-4" />
                          นัดหมาย
                        </button>
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => void onCloseCase(selectedCase.referralId)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          ปิดเคส
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className={fieldLabelClass}>เหตุผลส่งต่อ</p>
                <p className="mt-1 text-sm text-slate-800">
                  {stripSeedMarkers(selectedCase.reason) || selectedCase.reason}
                </p>
              </div>

              {!isQueue ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <SummaryChip
                    icon={<ClipboardList size={14} />}
                    label="คะแนนล่าสุด"
                    value={
                      history?.student.latestScore === null || history?.student.latestScore === undefined
                        ? "—"
                        : String(history.student.latestScore)
                    }
                    hint={history?.student.latestInstrument || "—"}
                  />
                  <SummaryChip
                    icon={<FileText size={14} />}
                    label="บันทึกผล"
                    value={String(history?.careSessions.length ?? selectedCase.careSessionCount)}
                    hint="ครั้ง"
                  />
                  <SummaryChip
                    icon={<CalendarDays size={14} />}
                    label="นัดหมาย"
                    value={String(history?.appointments.length ?? 0)}
                    hint="ทั้งหมด"
                  />
                  <SummaryChip
                    icon={<Users size={14} />}
                    label="ปรึกษาอาจารย์"
                    value={String(history?.consultationTotal ?? 0)}
                    hint="ครั้ง"
                  />
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2" role="tablist" aria-label="ชั้นประวัติ">
                {panels.map((item) => {
                  const active = panel === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setPanel(item.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        active
                          ? "border-slate-800 bg-slate-800 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {historyLoading && !history ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16" role="status" aria-live="polite">
                  <span className="loader h-7 w-7 text-blue-600" aria-hidden="true" />
                  <p className="text-sm font-medium text-slate-500">กำลังโหลดประวัติ...</p>
                </div>
              ) : historyError ? (
                <div className="space-y-3 py-8 text-center">
                  <p className="text-sm font-medium text-red-700">{historyError}</p>
                  <button
                    type="button"
                    onClick={() => setHistoryReloadKey((value) => value + 1)}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    ลองโหลดอีกครั้ง
                  </button>
                </div>
              ) : !history ? (
                <p className="py-8 text-center text-sm text-slate-600">ยังไม่มีประวัติ</p>
              ) : (
                <div className="min-h-[16rem]">
                  {panel === "care" ? (
                    history.careSessions.length === 0 ? (
                      isQueue ? (
                        <EmptyBlock
                          title="ยังไม่มีบันทึกผลการปรึกษา"
                          description="รับเคสก่อน จึงจะบันทึกผลการพบได้"
                        />
                      ) : (
                      <EmptyBlock
                        title="ยังไม่มีบันทึกผลการปรึกษา"
                        description="กด “บันทึกผล” เมื่อพบนิสิตแล้ว"
                        actionLabel="บันทึกผล"
                        onAction={() => openCareModal(selectedCase)}
                      />
                      )
                    ) : (
                      <ul className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                        {history.careSessions.map((session) => (
                          <li key={session.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className="text-sm font-bold text-slate-900">{session.providerName}</p>
                              <p className="text-xs tabular-nums text-slate-600">{formatWhen(session.sessionDate)}</p>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                              {presentClinicalNote(session.summary)}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                              {presentClinicalNote(session.interventionPlan)}
                            </p>
                            {session.confidentialNotes ? (
                              revealedConfidentialIds[session.id] ? (
                                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                                  <span className="font-bold">บันทึกลับ: </span>
                                  {presentClinicalNote(session.confidentialNotes)}
                                </p>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRevealedConfidentialIds((current) => ({
                                      ...current,
                                      [session.id]: true,
                                    }))
                                  }
                                  className="mt-2 text-xs font-semibold text-amber-900 underline-offset-2 hover:underline"
                                >
                                  แสดงบันทึกลับ
                                </button>
                              )
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )
                  ) : null}

                  {panel === "appointments" ? (
                    history.appointments.length === 0 ? (
                      isQueue ? (
                        <EmptyBlock
                          title="ยังไม่มีนัดหมาย"
                          description="รับเคสก่อน จึงจะสร้างนัดหมายได้"
                        />
                      ) : (
                      <EmptyBlock
                        title="ยังไม่มีนัดหมาย"
                        description="สร้างนัดเพื่อคุยกับนิสิต"
                        actionLabel="นัดหมาย"
                        onAction={() => openAppointmentModal(selectedCase)}
                      />
                      )
                    ) : (
                      <ul className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                        {history.appointments.map((item) => (
                          <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-bold text-slate-900">
                                  {formatThaiDate(item.date)} · {item.time || "—"}
                                </p>
                                <p className="mt-1 text-xs text-slate-600">{item.location}</p>
                                <p className="mt-1 text-xs text-slate-600">โดย {item.providerName}</p>
                              </div>
                              <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-800">
                                {appointmentStatusLabel[item.status] || "ไม่ทราบสถานะ"}
                              </span>
                            </div>
                            {item.note ? <p className="mt-2 text-sm text-slate-700">{item.note}</p> : null}
                          </li>
                        ))}
                      </ul>
                    )
                  ) : null}

                  {panel === "overview" ? (
                    <div className="space-y-4">
                      {isQueue ? (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <SummaryChip
                            icon={<ClipboardList size={14} />}
                            label="คะแนนล่าสุด"
                            value={
                              history.student.latestScore === null || history.student.latestScore === undefined
                                ? "—"
                                : String(history.student.latestScore)
                            }
                            hint={history.student.latestInstrument || "—"}
                          />
                          <SummaryChip
                            icon={<FileText size={14} />}
                            label="บันทึกผล"
                            value={String(history.careSessions.length)}
                            hint="ครั้ง"
                          />
                          <SummaryChip
                            icon={<CalendarDays size={14} />}
                            label="นัดหมาย"
                            value={String(history.appointments.length)}
                            hint="ทั้งหมด"
                          />
                          <SummaryChip
                            icon={<Users size={14} />}
                            label="ปรึกษาอาจารย์"
                            value={String(history.consultationTotal)}
                            hint="ครั้ง"
                          />
                        </div>
                      ) : null}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs font-semibold text-slate-600">ส่งต่อ</p>
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            ทั้งหมด {history.referrals.total} · เปิด {history.referrals.open}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs font-semibold text-slate-600">ปรึกษาอาจารย์</p>
                          <p className="mt-1 text-sm font-bold text-slate-900">{history.consultationTotal} ครั้ง</p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <h4 className="mb-1 text-sm font-bold text-slate-900">ไทม์ไลน์แบบประเมิน</h4>
                        <p className="mb-3 text-xs text-slate-600">ผลคะแนนและรอบที่ยังไม่ตอบ แยกตามกำหนดของแต่ละรอบ</p>
                        {history.assessmentTimeline.length === 0 ? (
                          <p className="text-sm text-slate-600">ยังไม่มีรอบประเมิน</p>
                        ) : (
                          <ul className="space-y-2">
                            {[...history.assessmentTimeline].reverse().slice(0, 8).map((row) => (
                              <li
                                key={row.id}
                                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-900">{row.surveyTitle}</p>
                                  <p className="text-[11px] text-slate-600">
                                    {row.waveLabel} · {formatThaiDate(row.submittedAt ?? row.scheduledAt)}
                                  </p>
                                </div>
                                {row.status === "COMPLETED" ? (
                                  <div className="shrink-0 text-right">
                                    <p className="text-sm font-bold tabular-nums text-slate-900">
                                      {row.totalScore === null ? "—" : `${row.totalScore}${row.maxScore ? `/${row.maxScore}` : ""}`}
                                    </p>
                                    <p className="text-[11px] font-semibold text-slate-700">
                                      {row.riskLevel === "HIGH"
                                        ? "เสี่ยงสูง"
                                        : row.riskLevel === "MEDIUM"
                                          ? "เสี่ยงปานกลาง"
                                          : "ปกติ"}
                                    </p>
                                  </div>
                                ) : (
                                  <span
                                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                      row.status === "OVERDUE"
                                        ? "bg-rose-100 text-rose-800"
                                        : "bg-amber-100 text-amber-800"
                                    }`}
                                  >
                                    {row.status === "OVERDUE" ? "หมดเขต" : "ยังไม่ตอบ"}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <h4 className="mb-2 text-sm font-bold text-slate-900">กิจกรรมล่าสุด</h4>
                        <p className="mb-3 text-xs text-slate-600">
                          ประเภท · สถานะ (จบหรือยังเปิด) · ผู้เกี่ยวข้อง
                        </p>
                        {history.activity.length === 0 ? (
                          <p className="text-sm text-slate-600">ยังไม่มีกิจกรรม</p>
                        ) : (
                          <ol className="max-h-72 space-y-2 overflow-y-auto">
                            {history.activity.slice(0, 8).map((item) => {
                              const status = presentActivityStatus(item.kind, item.status);
                              return (
                                <li key={item.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[11px] font-semibold text-slate-600">{item.type}</p>
                                      <p className="mt-0.5 text-sm font-semibold text-slate-900">
                                        {item.topic || "—"}
                                      </p>
                                      <p className="mt-1 text-[11px] text-slate-600">
                                        {item.actorName ? `โดย ${item.actorName}` : null}
                                        {item.actorName ? " · " : null}
                                        <span className="tabular-nums">{formatWhen(item.date)}</span>
                                      </p>
                                    </div>
                                    <div className="flex shrink-0 flex-col items-end gap-1">
                                      {status ? (
                                        <span
                                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${activityStatusBadgeClass[status.tone]}`}
                                        >
                                          {status.label}
                                        </span>
                                      ) : (
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                          บันทึกแล้ว
                                        </span>
                                      )}
                                      {item.isUrgent ? (
                                        <span className="text-[10px] font-semibold text-rose-700">เร่งด่วน</span>
                                      ) : null}
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ol>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryChip({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{value}</p>
      <p className="truncate text-[10px] text-slate-600">{hint}</p>
    </div>
  );
}

function EmptyBlock({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
      <p className="text-sm font-bold text-slate-800">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-[#0057A8] px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
