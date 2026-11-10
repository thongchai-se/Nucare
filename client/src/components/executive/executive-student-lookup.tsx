"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ClipboardList,
  MessageSquareWarning,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";
import { ListPaginationFooter } from "@/components/ui/list-pagination-footer";
import { useListPagination } from "@/hooks/use-list-pagination";
import api from "@/lib/axios";
import {
  activityStatusBadgeClass,
  presentActivityStatus,
} from "@/lib/activity-status-display";
import { formatStudentIdDisplay } from "@/lib/student-dashboard";
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
  activity: DossierActivityItem[];
};

type RiskFilter = "all" | ExecutiveStudentCard["riskLevel"] | "crisis";

const riskLabel: Record<ExecutiveStudentCard["riskLevel"], string> = {
  high: "เสี่ยงสูง",
  medium: "เสี่ยงปานกลาง",
  normal: "ปกติ",
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
};

/** รายชื่อนิสิตทั้งคณะสำหรับผู้บริหาร — ค้นหา/กรอง + dossier แนวโน้มปรึกษา/ส่งต่อ/SOS */
export function ExecutiveStudentLookup({ yearFilter = "ALL" }: ExecutiveStudentLookupProps) {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [students, setStudents] = useState<ExecutiveStudentCard[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dossier, setDossier] = useState<ExecutiveStudentDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const keyword = search.trim();
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading((prev) => (students.length === 0 ? true : prev));
        setError(null);
        try {
          const response = await api.get<{ students: ExecutiveStudentCard[] }>("/api/executive/students", {
            params: keyword.length >= 2 ? { search: keyword } : undefined,
          });
          if (!cancelled) {
            setStudents(response.data.students || []);
          }
        } catch {
          if (!cancelled) {
            setError("โหลดรายชื่อไม่สำเร็จ");
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
    // students.length ใช้แค่ตัดสิน spinner ครั้งแรก ไม่ใส่ใน deps เพื่อกัน loop
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
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setDossier(null);
          setError("โหลดรายละเอียดไม่สำเร็จ");
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

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      if (yearFilter !== "ALL" && student.year !== yearFilter) {
        return false;
      }
      if (riskFilter === "crisis") {
        return student.hasCrisisWellnessSignal;
      }
      if (riskFilter !== "all" && student.riskLevel !== riskFilter) {
        return false;
      }
      return true;
    });
  }, [riskFilter, students, yearFilter]);

  useEffect(() => {
    setSelectedId(null);
  }, [yearFilter]);

  useEffect(() => {
    if (selectedId && !filteredStudents.some((student) => student.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filteredStudents, selectedId]);

  const pagination = useListPagination(
    filteredStudents,
    `${yearFilter}:${riskFilter}:${search.trim()}`,
    { fixedRowsPerPage: 12 }
  );

  const riskFilters: Array<{ id: RiskFilter; label: string }> = [
    { id: "all", label: "ทั้งหมด" },
    { id: "high", label: "เสี่ยงสูง" },
    { id: "medium", label: "ปานกลาง" },
    { id: "normal", label: "ปกติ" },
    { id: "crisis", label: "วิกฤตแชท" },
  ];

  const detail = dossier?.student ?? null;

  return (
    <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              ผลการค้นหา
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              คะแนน ความเสี่ยง สัญญาณแชท และแนวโน้มการขอปรึกษา/ส่งต่อ (ไม่มีข้อความแชท)
              {yearFilter !== "ALL" ? ` · ชั้นปีที่ ${yearFilter}` : ""}
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหาชื่อหรือรหัส (ว่าง = ทั้งหมด)"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="กรองความเสี่ยง">
          {riskFilters.map((filter) => {
            const selected = riskFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setRiskFilter(filter.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selected
                    ? "border-slate-800 bg-slate-800 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-xl border border-slate-100">
          <div className="max-h-[36rem] space-y-2 overflow-y-auto p-2">
            {loading ? (
              <p className="px-2 py-6 text-center text-sm text-slate-500">กำลังโหลดรายชื่อ...</p>
            ) : pagination.pageItems.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-slate-500">ไม่พบนิสิตตามเงื่อนไข</p>
            ) : (
              pagination.pageItems.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => setSelectedId(student.id)}
                  className={`flex w-full items-start justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition ${
                    selectedId === student.id ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{student.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatStudentIdDisplay(student.studentId)}
                      {student.year && student.year !== "-" ? ` · ปี ${student.year}` : ""}
                    </p>
                    <p className="mt-1 text-[10px] tabular-nums text-slate-400">
                      ดูแล {student.careRecordCount} · พฤติกรรม {student.behaviorRecordCount}
                      {student.lastAssessment ? ` · ประเมิน ${formatShortDate(student.lastAssessment)}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] font-bold text-slate-600">{riskLabel[student.riskLevel]}</p>
                    {student.hasCrisisWellnessSignal ? (
                      <p className="text-[10px] font-bold text-red-600">วิกฤตแชท</p>
                    ) : null}
                  </div>
                </button>
              ))
            )}
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
          ) : pagination.total > 0 ? (
            <p className="border-t border-slate-100 px-4 py-2 text-xs tabular-nums text-slate-500">
              ทั้งหมด {pagination.total.toLocaleString()} รายการ
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 sm:p-5">
          {!selectedId ? (
            <p className="py-16 text-center text-sm text-slate-500">เลือกนิสิตทางซ้ายเพื่อดู dossier</p>
          ) : detailLoading && !dossier ? (
            <p className="py-16 text-center text-sm text-slate-500">กำลังโหลดรายละเอียด...</p>
          ) : !detail || !dossier ? (
            <p className="py-16 text-center text-sm text-slate-500">ไม่พบรายละเอียด</p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-slate-900">{detail.name}</p>
                  <p className="text-sm text-slate-500">
                    {formatStudentIdDisplay(detail.studentId)} · ชั้นปี {detail.year || "-"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-right">
                  <p className="text-[11px] font-semibold text-slate-500">ความเสี่ยงล่าสุด</p>
                  <p className="text-sm font-bold text-slate-800">{riskLabel[detail.riskLevel]}</p>
                </div>
              </div>

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

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                    <Users size={16} className="text-blue-600" />
                    ปรึกษาอาจารย์ (จำนวนครั้ง)
                  </h4>
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
                              ล่าสุด {formatShortDate(row.lastRequestedAt)} · เปิด {row.openCount} · ปิด {row.closedCount}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-bold tabular-nums text-slate-900">{row.totalCount} ครั้ง</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                    <ClipboardList size={16} className="text-indigo-600" />
                    แนวโน้มคะแนนประเมิน
                  </h4>
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
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h4 className="mb-3 text-sm font-bold text-slate-800">ส่งต่อล่าสุด</h4>
                  {dossier.referrals.recent.length === 0 ? (
                    <p className="text-sm text-slate-500">ยังไม่มีรายการส่งต่อ</p>
                  ) : (
                    <ul className="space-y-2">
                      {dossier.referrals.recent.map((row) => (
                        <li key={row.id} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                          <p className="text-sm font-semibold text-slate-800">
                            {row.target}
                            {row.isUrgent ? <span className="ml-2 text-[11px] font-bold text-red-600">เร่งด่วน</span> : null}
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
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                    <MessageSquareWarning size={16} className="text-amber-600" />
                    SOS / ฉุกเฉิน
                  </h4>
                  {dossier.emergencies.recent.length === 0 ? (
                    <p className="text-sm text-slate-500">ยังไม่มีเคสฉุกเฉิน</p>
                  ) : (
                    <ul className="space-y-2">
                      {dossier.emergencies.recent.map((row) => (
                        <li key={row.id} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                          <p className="text-sm font-semibold text-slate-800">{row.summary}</p>
                          <p className="text-[11px] text-slate-500">
                            {presentActivityStatus("EMERGENCY", row.status)?.label ?? row.status} ·
                            เปิด {formatShortDate(row.openedAt)}
                            {row.resolvedAt ? ` · ปิด ${formatShortDate(row.resolvedAt)}` : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="mb-2 text-sm font-bold text-slate-800">สัญญาณจากแชท</h4>
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
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Activity size={16} className="text-slate-600" />
                  ไทม์ไลน์กิจกรรม
                </h4>
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
              </div>

              <p className="text-[11px] text-slate-400">
                บันทึกดูแล {detail.careRecordCount} · ข้อสังเกตพฤติกรรม {detail.behaviorRecordCount}
                {detail.lastAssessment ? ` · ประเมินล่าสุด ${formatShortDate(detail.lastAssessment)}` : ""}
                {detailLoading ? " · กำลังอัปเดต..." : ""}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
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
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{value}</p>
      <p className="truncate text-[10px] text-slate-400">{hint}</p>
    </div>
  );
}
