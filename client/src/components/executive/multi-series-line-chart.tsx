"use client";

import { useMemo } from "react";

export type ChartSeries = {
  id: string;
  label: string;
  color: string;
  values: Array<number | null>;
};

type MultiSeriesLineChartProps = {
  labels: string[];
  series: ChartSeries[];
  height?: number;
  yLabel?: string;
  emptyMessage?: string;
};

const CHART_PAD = { top: 16, right: 16, bottom: 36, left: 40 };

const buildPolylinePath = (points: Array<{ x: number; y: number | null }>): string[] => {
  const segments: string[] = [];
  let commands: string[] = [];

  for (const point of points) {
    if (point.y === null) {
      if (commands.length > 0) {
        segments.push(commands.join(" "));
        commands = [];
      }
      continue;
    }
    commands.push(`${commands.length === 0 ? "M" : "L"}${point.x} ${point.y}`);
  }

  if (commands.length > 0) {
    segments.push(commands.join(" "));
  }

  return segments;
};

/** วาดกราฟเส้นหลายชุดซ้อนกันคนละสี สำหรับภาพรวมผู้บริหาร */
export function MultiSeriesLineChart({
  labels,
  series,
  height = 240,
  yLabel,
  emptyMessage = "ยังไม่มีข้อมูลพอสำหรับกราฟ",
}: MultiSeriesLineChartProps) {
  const chartModel = useMemo(() => {
    const visibleSeries = series.filter((item) => item.values.some((value) => value !== null));
    const pointCount = Math.max(labels.length, ...visibleSeries.map((item) => item.values.length), 0);
    const numericValues = visibleSeries.flatMap((item) =>
      item.values.filter((value): value is number => value !== null)
    );
    const rawMax = numericValues.length > 0 ? Math.max(...numericValues) : 1;
    const rawMin = numericValues.length > 0 ? Math.min(...numericValues, 0) : 0;
    const paddedMax = rawMax === rawMin ? rawMax + 1 : rawMax;
    const width = Math.max(320, pointCount * 72);
    const plotWidth = width - CHART_PAD.left - CHART_PAD.right;
    const plotHeight = height - CHART_PAD.top - CHART_PAD.bottom;

    const pointsBySeries = visibleSeries.map((item) => {
      const points = item.values.slice(0, pointCount).map((value, index) => {
        const x =
          pointCount <= 1
            ? CHART_PAD.left + plotWidth / 2
            : CHART_PAD.left + (index / Math.max(pointCount - 1, 1)) * plotWidth;
        if (value === null) {
          return { x, y: null as number | null, value: null as number | null };
        }
        const ratio = (value - rawMin) / (paddedMax - rawMin || 1);
        return {
          x,
          y: CHART_PAD.top + plotHeight - ratio * plotHeight,
          value,
        };
      });

      return {
        ...item,
        points,
        paths: buildPolylinePath(points),
      };
    });

    return {
      visibleSeries,
      pointCount,
      maxY: paddedMax,
      minY: rawMin,
      width,
      plotWidth,
      plotHeight,
      pointsBySeries,
    };
  }, [height, labels.length, series]);

  if (chartModel.pointCount === 0 || chartModel.visibleSeries.length === 0) {
    return (
      <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center">
        <p className="text-sm font-medium text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  const gridTicks = 4;
  const yTicks = Array.from({ length: gridTicks + 1 }, (_, index) => {
    const ratio = index / gridTicks;
    return {
      value: chartModel.maxY - (chartModel.maxY - chartModel.minY) * ratio,
      y: CHART_PAD.top + chartModel.plotHeight * ratio,
    };
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {chartModel.visibleSeries.map((item) => (
          <div key={item.id} className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} aria-hidden />
            {item.label}
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <svg
          role="img"
          aria-label={yLabel ? `กราฟเส้น ${yLabel}` : "กราฟเส้นหลายชุด"}
          width={chartModel.width}
          height={height}
          className="min-w-full"
        >
          {yTicks.map((tick) => (
            <g key={`grid-${tick.y}`}>
              <line
                x1={CHART_PAD.left}
                x2={CHART_PAD.left + chartModel.plotWidth}
                y1={tick.y}
                y2={tick.y}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
              />
              <text
                x={CHART_PAD.left - 8}
                y={tick.y + 4}
                textAnchor="end"
                className="fill-slate-400"
                fontSize="10"
              >
                {Math.round(tick.value * 10) / 10}
              </text>
            </g>
          ))}

          {labels.slice(0, chartModel.pointCount).map((label, index) => {
            const x =
              chartModel.pointCount <= 1
                ? CHART_PAD.left + chartModel.plotWidth / 2
                : CHART_PAD.left + (index / Math.max(chartModel.pointCount - 1, 1)) * chartModel.plotWidth;
            return (
              <text
                key={`label-${label}-${index}`}
                x={x}
                y={height - 12}
                textAnchor="middle"
                className="fill-slate-500"
                fontSize="10"
              >
                {label}
              </text>
            );
          })}

          {chartModel.pointsBySeries.map((item) => (
            <g key={item.id}>
              {item.paths.map((d, index) => (
                <path
                  key={`${item.id}-path-${index}`}
                  d={d}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
              {item.points.map((point, index) =>
                point.y === null ? null : (
                  <circle
                    key={`${item.id}-dot-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={3.5}
                    fill="#fff"
                    stroke={item.color}
                    strokeWidth={2}
                  >
                    <title>
                      {item.label}: {point.value}
                    </title>
                  </circle>
                )
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
