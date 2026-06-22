"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Download, RefreshCw } from "lucide-react";
import api from "@/lib/axios";
import { downloadCsv, pushCsvSection, pushKeyValueRows } from "@/lib/csv-export";
import { ExecutiveSectionShell } from "@/components/executive/executive-section-shell";
import type {
  ExecutiveYearFilter,
  ScreeningComparisonResponse,
  ScreeningRoundInfo,
} from "@/types/executive";

type ExecutiveScreeningComparisonProps = {
  yearFilter: ExecutiveYearFilter;
};

const formatRoundLabel = (round: ScreeningRoundInfo): string => {
  const dateLabel = round.startsAt
    ? new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(round.startsAt))
    : "ไม่ระบุวันที่";

  return `${round.title} (${dateLabel})`;
};

const formatYearFilterLabel = (yearFilter: ExecutiveYearFilter): string =>
  yearFilter === "ALL" ? "ทุกชั้นปี" : `ชั้นปีที่ ${yearFilter}`;

const formatDelta = (delta: number): string => (delta > 0 ? `+${delta}` : String(delta));

const exportComparisonCsv = (
  data: ScreeningComparisonResponse,
  yearFilter: ExecutiveYearFilter
): void => {
  const round1Title = data.round1?.title ?? "รอบที่ 1";
  const round2Title = data.round2?.title ?? "รอบที่ 2";
  const rows: unknown[][] = [];

  rows.push(["Metadata"]);
  rows.push(["รายการ", "ค่า"]);
  pushKeyValueRows(rows, [
    ["วันที่ export", new Date().toISOString().slice(0, 10)],
    ["อัปเดตข้อมูล", data.generatedAt.slice(0, 10)],
    ["ชั้นปีที่กรอง", formatYearFilterLabel(yearFilter)],
    ["รอบที่ 1", data.round1 ? formatRoundLabel(data.round1) : "-"],
    ["รอบที่ 2", data.round2 ? formatRoundLabel(data.round2) : "-"],
    ["เทียบได้ (คน)", data.summary.comparedCount],
    ["ดีขึ้น", data.summary.improvedCount],
    ["คงที่", data.summary.unchangedCount],
    ["แย่ลง", data.summary.worsenedCount],
    ["เฉลี่ยรอบ 1", data.summary.avgRound1Score === null ? "-" : data.summary.avgRound1Score],
    ["เฉลี่ยรอบ 2", data.summary.avgRound2Score === null ? "-" : data.summary.avgRound2Score],
    ["เฉลี่ยการเปลี่ยนแปลง", data.summary.avgDelta === null ? "-" : data.summary.avgDelta],
  ]);

  pushCsvSection(
    rows,
    "ComparisonRows",
    [
      "รหัสนักศึกษา",
      "ชั้นปี",
      "Section",
      `คะแนน ${round1Title}`,
      `คะแนน ${round2Title}`,
      "เปลี่ยนแปลง",
      "ระดับรอบ1",
      "ระดับรอบ2",
      "การเปลี่ยนระดับ",
    ],
    data.rows.map((row) => [
      row.studentCode,
      row.studyYear === null ? "-" : String(row.studyYear),
      row.section ?? "-",
      row.round1.score,
      row.round2.score,
      formatDelta(row.deltaScore),
      row.round1.distressLabel,
      row.round2.distressLabel,
      row.distressChange ?? "-",
    ])
  );

  downloadCsv(
    `executive-screening-comparison-${yearFilter.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`,
    rows
  );
};

export function ExecutiveScreeningComparison({ yearFilter }: ExecutiveScreeningComparisonProps) {
  const [data, setData] = useState<ScreeningComparisonResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromSurveyId, setFromSurveyId] = useState("");
  const [toSurveyId, setToSurveyId] = useState("");

  const loadComparison = useCallback(
    async (fromId: string, toId: string) => {
      setLoading(true);
      setError(null);

      try {
        const params: Record<string, string> = {
          studyYear: yearFilter,
        };

        if (fromId) {
          params.fromSurveyId = fromId;
        }

        if (toId) {
          params.toSurveyId = toId;
        }

        const response = await api.get<ScreeningComparisonResponse>("/api/executive/screening-comparison", {
          params,
        });

        setData(response.data);
        setFromSurveyId(response.data.round1?.id ?? fromId);
        setToSurveyId(response.data.round2?.id ?? toId);
      } catch {
        setError("ไม่สามารถโหลดข้อมูลเปรียบเทียบได้ กรุณาลองใหม่อีกครั้ง");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [yearFilter]
  );

  useEffect(() => {
    void loadComparison("", "");
  }, [loadComparison]);

  const roundOptions = useMemo(() => data?.availableRounds ?? [], [data?.availableRounds]);

  const canCompare = Boolean(data?.round1 && data?.round2 && data.rows.length > 0);

  return (
    <ExecutiveSectionShell
      title="เปรียบเทียบรายบุคคล (รอบต่อรอบ)"
      subtitle="เทียบคะแนน GHQ-28 รอบแรกกับรอบถัดไป — แสดงเฉพาะรหัสนักศึกษา ไม่มีชื่อ-นามสกุล"
    >
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-slate-700">รอบที่ 1 (ก่อนหน้า)</span>
            <select
              value={fromSurveyId}
              onChange={(event) => setFromSurveyId(event.target.value)}
              disabled={loading || roundOptions.length === 0}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-blue-300"
            >
              <option value="">เลือกรอบประเมิน</option>
              {roundOptions.map((round) => (
                <option key={round.id} value={round.id}>
                  {formatRoundLabel(round)} — {round.responseCount.toLocaleString()} คน
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-slate-700">รอบที่ 2 (ล่าสุด)</span>
            <select
              value={toSurveyId}
              onChange={(event) => setToSurveyId(event.target.value)}
              disabled={loading || roundOptions.length === 0}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-blue-300"
            >
              <option value="">เลือกรอบประเมิน</option>
              {roundOptions.map((round) => (
                <option key={round.id} value={round.id}>
                  {formatRoundLabel(round)} — {round.responseCount.toLocaleString()} คน
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void loadComparison(fromSurveyId, toSurveyId)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            โหลดใหม่
          </button>
          <button
            type="button"
            onClick={() => data && exportComparisonCsv(data, yearFilter)}
            disabled={!canCompare}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            <Download size={16} />
            ส่งออก CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="loader h-7 w-7 text-blue-600" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-6 text-center text-sm font-medium text-red-700">
          {error}
        </div>
      ) : !data?.round1 || !data.round2 ? (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-8 text-center">
          <p className="text-sm font-bold text-slate-600">ต้องมีอย่างน้อย 2 รอบที่นักศึกษาทำครบทั้งคู่</p>
          <p className="mt-2 text-sm text-slate-500">
            เมื่อเปิดแบบสอบถาม GHQ-28 รอบใหม่และมีนักศึกษาทำครบทั้งสองรอบ ข้อมูลจะแสดงที่นี่
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">เทียบได้</p>
              <p className="mt-2 text-2xl font-black text-slate-800">{data.summary.comparedCount.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-xs font-bold text-emerald-700">ดีขึ้น</p>
              <p className="mt-2 text-2xl font-black text-emerald-800">{data.summary.improvedCount.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-xs font-bold text-amber-700">คงที่</p>
              <p className="mt-2 text-2xl font-black text-amber-800">{data.summary.unchangedCount.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
              <p className="text-xs font-bold text-rose-700">แย่ลง</p>
              <p className="mt-2 text-2xl font-black text-rose-800">{data.summary.worsenedCount.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">เฉลี่ยรอบ 1</p>
              <p className="mt-2 text-2xl font-black text-slate-800">
                {data.summary.avgRound1Score === null ? "—" : data.summary.avgRound1Score}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">เฉลี่ยรอบ 2</p>
              <p className="mt-2 text-2xl font-black text-slate-800">
                {data.summary.avgRound2Score === null ? "—" : data.summary.avgRound2Score}
              </p>
            </div>
          </div>

          {data.rows.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-8 text-center">
              <p className="text-sm font-bold text-slate-600">ไม่พบนักศึกษาที่ทำครบทั้งสองรอบในช่วงที่เลือก</p>
              <p className="mt-2 text-sm text-slate-500">ลองเปลี่ยนรอบประเมินหรือตัวกรองชั้นปี</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">รหัสนักศึกษา</th>
                    <th className="px-4 py-3">ชั้นปี</th>
                    <th className="px-4 py-3">Section</th>
                    <th className="px-4 py-3">รอบ 1</th>
                    <th className="px-4 py-3">รอบ 2</th>
                    <th className="px-4 py-3">เปลี่ยนแปลง</th>
                    <th className="px-4 py-3">ระดับความทุกข์</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.rows.map((row) => {
                    const deltaClassName =
                      row.deltaScore < 0
                        ? "text-emerald-700"
                        : row.deltaScore > 0
                          ? "text-rose-700"
                          : "text-slate-600";
                    const DeltaIcon =
                      row.deltaScore < 0 ? ArrowDownRight : row.deltaScore > 0 ? ArrowUpRight : ArrowRight;

                    return (
                      <tr key={row.studentCode} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-mono text-xs font-bold text-slate-800 sm:text-sm">
                          {row.studentCode}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {row.studyYear === null ? "—" : `ปี ${row.studyYear}`}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{row.section ?? "—"}</td>
                        <td className="px-4 py-3 font-bold text-slate-800">{row.round1.score}</td>
                        <td className="px-4 py-3 font-bold text-slate-800">{row.round2.score}</td>
                        <td className={`px-4 py-3 font-bold ${deltaClassName}`}>
                          <span className="inline-flex items-center gap-1">
                            <DeltaIcon size={14} />
                            {formatDelta(row.deltaScore)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {row.distressChange ?? row.round2.distressLabel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </ExecutiveSectionShell>
  );
}
