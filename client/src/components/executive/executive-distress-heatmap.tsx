"use client";

import { AlertTriangle, BarChart3 } from "lucide-react";
import { ExecutiveSectionShell } from "@/components/executive/executive-section-shell";
import { ghq28DistressMeta, ghq28DistressOrder } from "@/lib/ghq28-distress";
import type { ExecutiveYearFilter, StudyYearBucket } from "@/types/executive";

type ExecutiveDistressHeatmapProps = {
  rows: StudyYearBucket[];
  yearFilter: ExecutiveYearFilter;
  highestWatchIndex: number;
};

export function ExecutiveDistressHeatmap({
  rows,
  yearFilter,
  highestWatchIndex,
}: ExecutiveDistressHeatmapProps) {
  return (
    <ExecutiveSectionShell
      icon={<BarChart3 className="text-blue-600" size={20} />}
      title="ภาพรวมสุขภาวะ (GHQ-28)"
      subtitle="สถิติระดับความเครียด/สุขภาพจิต 4 ระดับ แยกตามชั้นปี"
    >
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-10 text-center">
          <BarChart3 className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-bold text-slate-600">ยังไม่มีข้อมูลในช่วงที่เลือก</p>
          <p className="mt-1 text-xs text-slate-500">ลองเปลี่ยนตัวกรองชั้นปีหรือรอให้มีการประเมินเพิ่มเติม</p>
        </div>
      ) : (
        <div className="space-y-6">
          {rows.map((row, index) => {
            const total =
              row.distressCounts.NORMAL +
              row.distressCounts.MILD +
              row.distressCounts.MODERATE +
              row.distressCounts.SEVERE +
              row.distressCounts.unscreened;
            const denominator = total > 0 ? total : 1;

            return (
              <div
                key={`${row.studyYear ?? "unknown"}-${row.label}`}
                className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 sm:p-5"
              >
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-800">{row.label}</p>
                    <p className="text-xs font-medium text-slate-500">{row.totalStudents.toLocaleString()} คน</p>
                  </div>
                  {index === highestWatchIndex && yearFilter === "ALL" ? (
                    <span className="inline-flex w-fit items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-600">
                      <AlertTriangle size={12} /> เฝ้าระวังสูงสุด
                    </span>
                  ) : null}
                </div>

                <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-200 sm:h-4">
                  {ghq28DistressOrder.map((level) => (
                    <div
                      key={level}
                      style={{ width: `${(row.distressCounts[level] / denominator) * 100}%` }}
                      className={`h-full ${ghq28DistressMeta[level].barClassName}`}
                    />
                  ))}
                  <div
                    style={{ width: `${(row.distressCounts.unscreened / denominator) * 100}%` }}
                    className="h-full bg-slate-300"
                  />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:gap-3">
                  {ghq28DistressOrder.map((level) => (
                    <span
                      key={level}
                      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${ghq28DistressMeta[level].textClassName}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${ghq28DistressMeta[level].barClassName}`} />
                      {Math.round((row.distressCounts[level] / denominator) * 100)}% {ghq28DistressMeta[level].label}
                    </span>
                  ))}
                  {row.distressCounts.unscreened > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                      <span className="h-2 w-2 rounded-full bg-slate-300" />
                      {Math.round((row.distressCounts.unscreened / denominator) * 100)}% ยังไม่ประเมิน
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ExecutiveSectionShell>
  );
}
