"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  MessageSquareWarning,
  Users,
} from "lucide-react";
import { StudentContactPanel } from "@/components/student-contact-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterSummaryChip } from "@/components/ui/filter-summary-chip";
import { InlineAlert } from "@/components/ui/inline-alert";
import { ListPaginationFooter } from "@/components/ui/list-pagination-footer";
import {
  RosterMobileCard,
  RosterMobileList,
  RosterPersonCell,
  RosterRow,
  RosterSearchInput,
  RosterSelectFilter,
  RosterTable,
  RosterTableCard,
  RosterTd,
  RosterToolbarEnd,
} from "@/components/ui/roster-table";
import { useListPagination } from "@/hooks/use-list-pagination";
import api from "@/lib/axios";
import {
  activityStatusBadgeClass,
  presentActivityStatus,
} from "@/lib/activity-status-display";
import { getApiErrorMessage } from "@/lib/api-error";
import { getNameInitials } from "@/lib/name-prefix";
import { formatStudentIdDisplay } from "@/lib/student-dashboard";
import { UI_ACTION_SECONDARY_COMPACT } from "@/lib/ui-classes";
import type { ExecutiveYearFilter } from "@/types/executive";

type WellnessSignalItem = {
  code: string;
  labelTh: string;
  shortLabelTh: string;
  occurrenceCount: number;
  lastDetectedAt: string;
};

type ExecutiveStudentCard = {
  id: string;
  studentId: string | null;
  name: string;
  year: string;
  section?: string | null;
  email?: string | null;
  phone?: string | null;
  guardianPhone?: string | null;
  riskLevel: "high" | "medium" | "normal";
  lastAssessment: string | null;
  careRecordCount: number;
  behaviorRecordCount: number;
  latestScore: number | null;
  latestInstrument: string | null;
  wellnessSignals: WellnessSignalItem[];
  hasCrisisWellnessSignal: boolean;
};

type ConsultationByTeacher = {
  teacherId: string;
  teacherName: string;
  totalCount: number;
  openCount: number;
  closedCount: number;
  lastRequestedAt: string;
};

type DossierActivityItem = {
  id: string;
  kind: "CONSULTATION" | "REFERRAL" | "CARE" | "BEHAVIOR" | "EMERGENCY" | "ASSESSMENT";
  date: string;
  type: string;
  topic: string;
  status: string | null;
  actorName: string;
  isUrgent: boolean;
};

type AssessmentSnapshot = {
  assessedAt: string;
  score: number | null;
  instrument: string;
  riskLevel: ExecutiveStudentCard["riskLevel"];
};

type ExecutiveStudentDossier = {
  student: ExecutiveStudentCard;
  consultationByTeacher: ConsultationByTeacher[];
  consultationTotal: number;
  referrals: {
    total: number;
    open: number;
    closed: number;
    urgentOpen: number;
    recent: Array<{
      id: string;
      target: string;
      status: string;
      isUrgent: boolean;
      advisorName: string;
      createdAt: string;
    }>;
  };
  emergencies: {
    total: number;
    open: number;
    resolved: number;
    recent: Array<{
      id: string;
      status: string;
      summary: string;
      openedAt: string;
      resolvedAt: string | null;
    }>;
  };
  assessments: AssessmentSnapshot[];
  specializedCareNotes: Array<{
    id: string;
    sessionDate: string;
    summary: string;
    interventionPlan: string;
    providerName: string;
  }>;
  activity: DossierActivityItem[];
};

type RiskFilter = "all" | ExecutiveStudentCard["riskLevel"] | "crisis";

const riskLabel: Record<ExecutiveStudentCard["riskLevel"], string> = {
  high: "เสี่ยงสูง",
  medium: "เสี่ยงปานกลาง",
  normal: "ปกติ",
};

const riskBadgeClass: Record<ExecutiveStudentCard["riskLevel"], string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-800",
  normal: "bg-emerald-100 text-emerald-800",
};

const formatShortDate = (value: string | null | undefined): string => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  }).format(date);
};

type ExecutiveStudentLookupProps = {
  yearFilter?: ExecutiveYearFilter;
  onYearFilterChange?: (value: ExecutiveYearFilter) => void;
  selectedStudentId?: string | null;
  onSelectStudent?: (studentId: string | null) => void;
};

/** รายชื่อนิสิตทั้งคณะแบบตาราง — กดเข้าดูรายละเอียดแบบหน้าที่ปรึกษา */
export function ExecutiveStudentLookup({
  yearFilter = "ALL",
  onYearFilterChange,
  selectedStudentId = null,
  onSelectStudent,
}: ExecutiveStudentLookupProps) {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [students, setStudents] = useState<ExecutiveStudentCard[]>([]);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [dossier, setDossier] = useState<ExecutiveStudentDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedId = onSelectStudent ? selectedStudentId : internalSelectedId;

  const setSelectedId = (studentId: string | null) => {
    if (onSelectStudent) {
      onSelectStudent(studentId);
      return;
    }
    setInternalSelectedId(studentId);
  };

  useEffect(() => {
    const keyword = search.trim();
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading((prev) => (students.length === 0 ? true : prev));
        try {
          const response = await api.get<{ students: ExecutiveStudentCard[] }>("/api/executive/students", {
            params: keyword.length >= 2 ? { search: keyword } : undefined,
          });
          if (!cancelled) {
            setStudents(response.data.students || []);
            setError("");
          }
        } catch (err) {
          if (!cancelled) {
            setError(getApiErrorMessage(err, "โหลดรายชื่อไม่สำเร็จ"));
            setStudents([]);
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      })();
    }, keyword.length >= 2 ? 300 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    if (!selectedId) {
      setDossier(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      setDetailLoading(true);
      try {
        const response = await api.get<ExecutiveStudentDossier>(`/api/executive/students/${selectedId}`);
        if (!cancelled) {
          setDossier(response.data);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setDossier(null);
          setError(getApiErrorMessage(err, "โหลดรายละเอียดไม่สำเร็จ"));
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const yearScopedStudents = useMemo(
    () =>
      yearFilter === "ALL"
        ? students
        : students.filter((student) => student.year === yearFilter),
    [students, yearFilter]
  );

  const riskCounts = useMemo(() => {
    const counts: Record<RiskFilter, number> = {
      all: yearScopedStudents.length,
      high: 0,
      medium: 0,
      normal: 0,
      crisis: 0,
    };
    for (const student of yearScopedStudents) {
      if (student.riskLevel === "high") counts.high += 1;
      if (student.riskLevel === "medium") counts.medium += 1;
      if (student.riskLevel === "normal") counts.normal += 1;
      if (student.hasCrisisWellnessSignal) counts.crisis += 1;
    }
    return counts;
  }, [yearScopedStudents]);

  const filteredStudents = useMemo(() => {
    return yearScopedStudents.filter((student) => {
      if (riskFilter === "crisis") {
        return student.hasCrisisWellnessSignal;
      }
      if (riskFilter !== "all" && student.riskLevel !== riskFilter) {
        return false;
      }
      return true;
    });
  }, [riskFilter, yearScopedStudents]);

  useEffect(() => {
    if (selectedId && filteredStudents.length > 0 && !filteredStudents.some((row) => row.id === selectedId)) {
      setSelectedId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredStudents, selectedId]);

  const pagination = useListPagination(
    filteredStudents,
    `${yearFilter}:${riskFilter}:${search.trim()}`,
    { fixedRowsPerPage: 10 }
  );

  const riskFilters: Array<{ id: RiskFilter; label: string }> = [
    { id: "all", label: "ทั้งหมด" },
    { id: "high", label: "เสี่ยงสูง" },
    { id: "medium", label: "ปานกลาง" },
    { id: "normal", label: "ปกติ" },
    { id: "crisis", label: "วิกฤตแชท" },
  ];

  if (selectedId) {
    return (
      <ExecutiveStudentDetail
        dossier={dossier}
        loading={detailLoading}
        error={error}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="กรองความเสี่ยง">
        {riskFilters.map((filter) => (
          <FilterSummaryChip
            key={filter.id}
            density="compact"
            label={filter.label}
            value={riskCounts[filter.id]}
            selected={riskFilter === filter.id}
            onClick={() => setRiskFilter(filter.id)}
          />
        ))}
      </div>

      <RosterTableCard
        toolbar={
          <>
            <RosterSearchInput
              value={search}
              onChange={setSearch}
              placeholder="ค้นหาชื่อหรือรหัสนิสิต..."
              aria-label="ค้นหานิสิต"
            />
            <RosterToolbarEnd>
              <RosterSelectFilter
                value={yearFilter}
                onChange={(value) => onYearFilterChange?.(value as ExecutiveYearFilter)}
                aria-label="กรองชั้นปี"
              >
                <option value="ALL">ทุกชั้นปี</option>
                <option value="1">ชั้นปี 1</option>
                <option value="2">ชั้นปี 2</option>
                <option value="3">ชั้นปี 3</option>
                <option value="4">ชั้นปี 4</option>
              </RosterSelectFilter>
            </RosterToolbarEnd>
          </>
        }
      >
        {loading && filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-2 py-16" role="status">
            <span className="loader h-6 w-6 text-blue-600" aria-hidden="true" />
            <p className="text-sm text-slate-500">กำลังโหลดรายชื่อ...</p>
          </div>
        ) : (
          <>
            <RosterTable
              columns={[
                { key: "student", label: "นิสิต", width: "28%" },
                { key: "year", label: "ชั้นปี", width: "8%" },
                { key: "risk", label: "ความเสี่ยง", width: "16%" },
                { key: "summary", label: "สรุป", width: "28%" },
                { key: "actions", label: "จัดการ", align: "center", width: "20%" },
              ]}
              emptyMessage={
                search.trim() || riskFilter !== "all" || yearFilter !== "ALL" ? (
                  "ไม่พบนิสิตตามเงื่อนไข"
                ) : (
                  <EmptyState
                    icon={Users}
                    title="ยังไม่มีรายชื่อนิสิต"
                    description="เมื่อมีข้อมูลนิสิตในระบบ รายชื่อจะแสดงที่นี่"
                  />
                )
              }
            >
              {pagination.pageItems.map((student) => (
                <RosterRow key={student.id} onClick={() => setSelectedId(student.id)}>
                  <RosterTd>
                    <RosterPersonCell
                      name={student.name}
                      meta={formatStudentIdDisplay(student.studentId)}
                      avatarText={getNameInitials(student.name, "นศ")}
                      onClick={() => setSelectedId(student.id)}
                    />
                  </RosterTd>
                  <RosterTd className="font-medium text-slate-600">{student.year || "-"}</RosterTd>
                  <RosterTd>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${riskBadgeClass[student.riskLevel]}`}
                      >
                        {riskLabel[student.riskLevel]}
                      </span>
                      {student.hasCrisisWellnessSignal ? (
                        <span className="inline-flex rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white">
                          วิกฤตแชท
                        </span>
                      ) : null}
                    </div>
                  </RosterTd>
                  <RosterTd>
                    <p className="truncate text-slate-500">
                      {student.latestScore === null
                        ? "ยังไม่มีคะแนน"
                        : `${student.latestInstrument || "ประเมิน"} ${student.latestScore}`}
                      {student.lastAssessment ? ` · ${formatShortDate(student.lastAssessment)}` : ""}
                    </p>
                  </RosterTd>
                  <RosterTd align="center">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedId(student.id);
                      }}
                      className={UI_ACTION_SECONDARY_COMPACT}
                    >
                      ดูรายละเอียด
                    </button>
                  </RosterTd>
                </RosterRow>
              ))}
            </RosterTable>

            <RosterMobileList
              emptyMessage={
                search.trim() || riskFilter !== "all" || yearFilter !== "ALL"
                  ? "ไม่พบนิสิตตามเงื่อนไข"
                  : "ยังไม่มีรายชื่อนิสิต"
              }
            >
              {pagination.pageItems.map((student) => (
                <RosterMobileCard key={student.id}>
                  <button type="button" onClick={() => setSelectedId(student.id)} className="w-full text-left">
                    <RosterPersonCell
                      name={student.name}
                      meta={`${formatStudentIdDisplay(student.studentId)} • ปี ${student.year || "-"}`}
                      avatarText={getNameInitials(student.name, "นศ")}
                    />
                  </button>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${riskBadgeClass[student.riskLevel]}`}
                    >
                      {riskLabel[student.riskLevel]}
                    </span>
                    {student.hasCrisisWellnessSignal ? (
                      <span className="inline-flex rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white">
                        วิกฤตแชท
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm text-slate-500">
                    {student.latestScore === null
                      ? "ยังไม่มีคะแนน"
                      : `${student.latestInstrument || "ประเมิน"} ${student.latestScore}`}
                  </p>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setSelectedId(student.id)}
                      className={UI_ACTION_SECONDARY_COMPACT}
                    >
                      ดูรายละเอียด
                    </button>
                  </div>
                </RosterMobileCard>
              ))}
            </RosterMobileList>
          </>
        )}

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
    </div>
  );
}

function ExecutiveStudentDetail({
  dossier,
  loading,
  error,
  onBack,
}: {
  dossier: ExecutiveStudentDossier | null;
  loading: boolean;
  error: string;
  onBack: () => void;
}) {
  const detail = dossier?.student ?? null;

  return (
    <div className="w-full space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl px-1 text-sm font-bold text-slate-600 transition-colors hover:text-[#0057A8]"
      >
        <ArrowLeft className="h-4 w-4" />
        กลับรายชื่อ
      </button>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      {loading && !dossier ? (
        <div className="flex min-h-[20rem] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <span className="loader h-7 w-7 text-blue-600" aria-hidden="true" />
          <p className="text-sm text-slate-500">กำลังโหลดรายละเอียด...</p>
        </div>
      ) : !detail || !dossier ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500 shadow-sm">
          ไม่พบรายละเอียดนิสิต
        </div>
      ) : (
        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#278ACA]/15 text-base font-bold text-[#0057A8] sm:h-14 sm:w-14 sm:text-lg">
                {getNameInitials(detail.name, "นศ")}
              </div>
              <div className="min-w-0">
                <h2 className="break-words text-lg font-bold text-slate-800 sm:text-xl">{detail.name}</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  รหัส {formatStudentIdDisplay(detail.studentId)} • ชั้นปีที่ {detail.year || "-"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${riskBadgeClass[detail.riskLevel]}`}
                  >
                    {riskLabel[detail.riskLevel]}
                  </span>
                  {detail.hasCrisisWellnessSignal ? (
                    <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">
                      วิกฤตแชท
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-100 p-4 sm:p-6">
            <StudentContactPanel
              email={detail.email}
              phone={detail.phone}
              guardianPhone={detail.guardianPhone}
            />
          </div>

          <div className="border-b border-slate-100 p-4 sm:p-6">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatChip
                icon={<ClipboardList size={14} />}
                label="คะแนนล่าสุด"
                value={detail.latestScore === null ? "—" : String(detail.latestScore)}
                hint={detail.latestInstrument || "—"}
              />
              <StatChip
                icon={<Users size={14} />}
                label="ขอปรึกษา"
                value={String(dossier.consultationTotal)}
                hint={`${dossier.consultationByTeacher.length} อาจารย์`}
              />
              <StatChip
                icon={<Activity size={14} />}
                label="ส่งต่อ"
                value={String(dossier.referrals.total)}
                hint={`เปิด ${dossier.referrals.open}${dossier.referrals.urgentOpen > 0 ? ` · เร่งด่วน ${dossier.referrals.urgentOpen}` : ""}`}
              />
              <StatChip
                icon={<AlertTriangle size={14} />}
                label="SOS"
                value={String(dossier.emergencies.total)}
                hint={`เปิด ${dossier.emergencies.open}`}
              />
            </div>
          </div>

          <div className="space-y-4 p-4 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="ปรึกษาอาจารย์ (จำนวนครั้ง)" icon={<Users size={16} className="text-blue-600" />}>
                {dossier.consultationByTeacher.length === 0 ? (
                  <p className="text-sm text-slate-500">ยังไม่มีคำขอปรึกษา</p>
                ) : (
                  <ul className="space-y-2">
                    {dossier.consultationByTeacher.map((row) => (
                      <li
                        key={row.teacherId}
                        className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">{row.teacherName}</p>
                          <p className="text-[11px] text-slate-500">
                            ล่าสุด {formatShortDate(row.lastRequestedAt)} · เปิด {row.openCount} · ปิด{" "}
                            {row.closedCount}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-bold tabular-nums text-slate-900">
                          {row.totalCount} ครั้ง
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel
                title="แนวโน้มคะแนนประเมิน"
                icon={<ClipboardList size={16} className="text-indigo-600" />}
              >
                {dossier.assessments.length === 0 ? (
                  <p className="text-sm text-slate-500">ยังไม่มีผลประเมิน</p>
                ) : (
                  <ul className="space-y-2">
                    {dossier.assessments.map((row) => (
                      <li
                        key={`${row.assessedAt}-${row.instrument}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{row.instrument}</p>
                          <p className="text-[11px] text-slate-500">{formatShortDate(row.assessedAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold tabular-nums text-slate-900">
                            {row.score === null ? "—" : row.score}
                          </p>
                          <p className="text-[11px] font-semibold text-slate-500">{riskLabel[row.riskLevel]}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="ส่งต่อล่าสุด">
                {dossier.referrals.recent.length === 0 ? (
                  <p className="text-sm text-slate-500">ยังไม่มีรายการส่งต่อ</p>
                ) : (
                  <ul className="space-y-2">
                    {dossier.referrals.recent.map((row) => (
                      <li key={row.id} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                        <p className="text-sm font-semibold text-slate-800">
                          {row.target}
                          {row.isUrgent ? (
                            <span className="ml-2 text-[11px] font-bold text-red-600">เร่งด่วน</span>
                          ) : null}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {row.advisorName} ·{" "}
                          {presentActivityStatus("REFERRAL", row.status)?.label ?? row.status} ·{" "}
                          {formatShortDate(row.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel
                title="SOS / ฉุกเฉิน"
                icon={<MessageSquareWarning size={16} className="text-amber-600" />}
              >
                {dossier.emergencies.recent.length === 0 ? (
                  <p className="text-sm text-slate-500">ยังไม่มีเคสฉุกเฉิน</p>
                ) : (
                  <ul className="space-y-2">
                    {dossier.emergencies.recent.map((row) => (
                      <li key={row.id} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                        <p className="text-sm font-semibold text-slate-800">{row.summary}</p>
                        <p className="text-[11px] text-slate-500">
                          {presentActivityStatus("EMERGENCY", row.status)?.label ?? row.status} · เปิด{" "}
                          {formatShortDate(row.openedAt)}
                          {row.resolvedAt ? ` · ปิด ${formatShortDate(row.resolvedAt)}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            <Panel title="สัญญาณจากแชท">
              {detail.wellnessSignals.length === 0 ? (
                <p className="text-sm text-slate-500">ยังไม่มีสัญญาณ</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {detail.wellnessSignals.map((signal) => (
                    <span
                      key={signal.code}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                        signal.code === "SELF_HARM_CRISIS"
                          ? "border-red-200 bg-red-50 text-red-800"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {signal.shortLabelTh} ×{signal.occurrenceCount}
                    </span>
                  ))}
                </div>
              )}
            </Panel>

            <Panel
              title="บันทึกดูแลเฉพาะทาง"
              icon={<ClipboardList size={16} className="text-emerald-700" />}
            >
              {(dossier.specializedCareNotes ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">ยังไม่มีบันทึกจากศูนย์ให้คำปรึกษา</p>
              ) : (
                <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {dossier.specializedCareNotes.map((note) => (
                    <li key={note.id} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                      <p className="text-[11px] text-slate-500">
                        {formatShortDate(note.sessionDate)} · {note.providerName}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-800">{note.summary}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">แผน: {note.interventionPlan}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="ไทม์ไลน์กิจกรรม" icon={<Activity size={16} className="text-slate-600" />}>
              {dossier.activity.length === 0 ? (
                <p className="text-sm text-slate-500">ยังไม่มีกิจกรรม</p>
              ) : (
                <ol className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {dossier.activity.map((item) => {
                    const status = presentActivityStatus(item.kind, item.status);
                    return (
                      <li
                        key={item.id}
                        className={`rounded-lg border px-3 py-2 ${
                          item.isUrgent ? "border-amber-200 bg-amber-50/70" : "border-slate-100 bg-slate-50/80"
                        }`}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800">{item.type}</p>
                          <p className="text-[11px] tabular-nums text-slate-500">{formatShortDate(item.date)}</p>
                        </div>
                        <p className="mt-0.5 text-sm text-slate-700">{item.topic}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span>{item.actorName}</span>
                          {status ? (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${activityStatusBadgeClass[status.tone]}`}
                            >
                              {status.label}
                            </span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Panel>

            <p className="text-[11px] text-slate-400">
              บันทึกดูแล {detail.careRecordCount} · ข้อสังเกตพฤติกรรม {detail.behaviorRecordCount}
              {detail.lastAssessment ? ` · ประเมินล่าสุด ${formatShortDate(detail.lastAssessment)}` : ""}
              {loading ? " · กำลังอัปเดต..." : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
        {icon}
        {title}
      </h4>
      {children}
    </div>
  );
}

function StatChip({
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
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{value}</p>
      <p className="truncate text-[10px] text-slate-400">{hint}</p>
    </div>
  );
}
