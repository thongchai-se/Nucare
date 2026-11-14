"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LineChart, RefreshCw } from "lucide-react";
import { ExecutiveSectionShell } from "@/components/executive/executive-section-shell";
import { MultiSeriesLineChart, type ChartSeries } from "@/components/executive/multi-series-line-chart";
import { InlineAlert } from "@/components/ui/inline-alert";
import api from "@/lib/axios";
import type { ExecutiveYearFilter } from "@/types/executive";
import type { ScreeningOverviewResponse } from "@/types/executive-screening-overview";

type OverviewMetric = "avgScore" | "completion" | "highRisk";
type OverlayMode = "metrics" | "byYear";

type ExecutiveScreeningOverviewChartsProps = {
  yearFilter: ExecutiveYearFilter;
};

const YEAR_COLORS: Record<"1" | "2" | "3" | "4", string> = {
  "1": "#2563eb",
  "2": "#0d9488",
  "3": "#d97706",
  "4": "#dc2626",
};

const METRIC_COLORS = {
  avgScore: "#2563eb",
  completion: "#0d9488",
  highRisk: "#dc2626",
} as const;

/** กราฟภาพรวมคะแนนรายรอบ — ซ้อนหลายชุดคนละสี เลือกเครื่องมือ/เมตริกได้ */
export function ExecutiveScreeningOverviewCharts({ yearFilter }: ExecutiveScreeningOverviewChartsProps) {
  const [data, setData] = useState<ScreeningOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [instrumentCode, setInstrumentCode] = useState("GHQ28");
  const [metric, setMetric] = useState<OverviewMetric>("avgScore");
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("byYear");

  const loadOverview = useCallback(
    async (nextInstrument: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get<ScreeningOverviewResponse>("/api/executive/screening-overview", {
          params: {
            studyYear: yearFilter,
            instrumentCode: nextInstrument,
          },
        });
        setData(response.data);
        setInstrumentCode(response.data.instrumentCode);
      } catch {
        setError("ไม่สามารถโหลดกราฟภาพรวมได้ กรุณาลองใหม่อีกครั้ง");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [yearFilter]
  );

  useEffect(() => {
    void loadOverview(instrumentCode);
    // โหลดใหม่เมื่อเปลี่ยนชั้นปี — คงเครื่องมือที่เลือกไว้
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadOverview]);

  const chartSeries = useMemo((): ChartSeries[] => {
    if (!data) {
      return [];
    }

    if (overlayMode === "metrics") {
      return [
        {
          id: "avgScore",
          label: "คะแนนเฉลี่ย",
          color: METRIC_COLORS.avgScore,
          values: data.series.avgScoreOverall,
        },
        {
          id: "completion",
          label: "อัตราทำแบบ (%)",
          color: METRIC_COLORS.completion,
          values: data.series.completionOverall,
        },
        {
          id: "highRisk",
          label: "จำนวนเสี่ยงสูง",
          color: METRIC_COLORS.highRisk,
          values: data.series.highRiskOverall,
        },
      ];
    }

    if (metric === "avgScore") {
      if (yearFilter !== "ALL") {
        return [
          {
            id: `year-${yearFilter}`,
            label: `คะแนนเฉลี่ย ชั้นปี ${yearFilter}`,
            color: YEAR_COLORS[yearFilter],
            values: data.series.avgScoreByYear[yearFilter],
          },
        ];
      }
      return (["1", "2", "3", "4"] as const).map((year) => ({
        id: `year-${year}`,
        label: `ชั้นปี ${year}`,
        color: YEAR_COLORS[year],
        values: data.series.avgScoreByYear[year],
      }));
    }

    if (metric === "highRisk") {
      if (yearFilter !== "ALL") {
        return [
          {
            id: `high-${yearFilter}`,
            label: `เสี่ยงสูง ชั้นปี ${yearFilter}`,
            color: YEAR_COLORS[yearFilter],
            values: data.series.highRiskByYear[yearFilter],
          },
        ];
      }
      return (["1", "2", "3", "4"] as const).map((year) => ({
        id: `high-${year}`,
        label: `เสี่ยงสูง ปี ${year}`,
        color: YEAR_COLORS[year],
        values: data.series.highRiskByYear[year],
      }));
    }

    return [
      {
        id: "completion",
        label: "อัตราทำแบบ (%)",
        color: METRIC_COLORS.completion,
        values: data.series.completionOverall,
      },
    ];
  }, [data, metric, overlayMode, yearFilter]);

  const metricLabel =
    metric === "avgScore" ? "คะแนนเฉลี่ย" : metric === "completion" ? "อัตราทำแบบ (%)" : "จำนวนเสี่ยงสูง";

  return (
    <ExecutiveSectionShell
      icon={<LineChart className="text-blue-700" size={20} />}
      title="กราฟภาพรวมรายรอบประเมิน"
      subtitle={`${data?.instrumentLabel ?? "เครื่องมือคัดกรอง"} — เส้นเชื่อมคะแนน/อัตราทำแบบ/เสี่ยงสูง ซ้อนเทียบคนละสี`}
      action={
        <button
          type="button"
          onClick={() => void loadOverview(instrumentCode)}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          โหลดใหม่
        </button>
      }
    >
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <label className="block text-sm lg:min-w-[240px]">
          <span className="mb-1.5 block font-bold text-slate-700">เครื่องมือแบบประเมิน</span>
          <select
            value={instrumentCode}
            onChange={(event) => {
              const next = event.target.value;
              setInstrumentCode(next);
              void loadOverview(next);
            }}
            disabled={loading || (data?.availableInstruments.length ?? 0) === 0}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-blue-300"
          >
            {(data?.availableInstruments ?? [{ code: "GHQ28", label: "GHQ-28" }]).map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-2" role="group" aria-label="โหมดกราฟ">
          <button
            type="button"
            onClick={() => setOverlayMode("byYear")}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              overlayMode === "byYear"
                ? "border-slate-800 bg-slate-800 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            ซ้อนตามชั้นปี
          </button>
          <button
            type="button"
            onClick={() => setOverlayMode("metrics")}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              overlayMode === "metrics"
                ? "border-slate-800 bg-slate-800 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            ซ้อนทุกเมตริก
          </button>
        </div>
      </div>

      {overlayMode === "byYear" ? (
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="เมตริกกราฟ">
          {(
            [
              { id: "avgScore" as const, label: "คะแนนเฉลี่ย" },
              { id: "completion" as const, label: "อัตราทำแบบ" },
              { id: "highRisk" as const, label: "เสี่ยงสูง" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMetric(item.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                metric === item.id
                  ? "border-blue-700 bg-blue-700 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="loader h-7 w-7 text-blue-600" />
        </div>
      ) : error ? (
        <InlineAlert className="rounded-2xl px-4 py-6">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void loadOverview(instrumentCode)}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white"
          >
            <RefreshCw size={16} /> ลองใหม่
          </button>
        </InlineAlert>
      ) : (
        <>
          <MultiSeriesLineChart
            labels={data?.series.labels ?? []}
            series={chartSeries}
            yLabel={overlayMode === "metrics" ? "เมตริกภาพรวม" : metricLabel}
            emptyMessage="ยังไม่มีรอบประเมินของเครื่องมือนี้ — เมื่อเปิดรอบและมีคำตอบ กราฟจะแสดงที่นี่"
          />
          <p className="mt-3 text-xs text-slate-500">
            รอบทั้งหมด {data?.rounds.length.toLocaleString() ?? 0} รอบ · ไม่แสดงชื่อนิสิต
            {overlayMode === "metrics"
              ? " · โหมดซ้อนทุกเมตริกใช้สเกลร่วมกันเพื่อเทียบทิศทาง"
              : ` · แสดง${metricLabel}แยกชั้นปีคนละสี`}
          </p>
        </>
      )}
    </ExecutiveSectionShell>
  );
}
