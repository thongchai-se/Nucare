"use client";

import { useMemo, useState } from "react";
import { buildDonutArcs } from "@/lib/donut-chart";
import type { RiskInsightCard } from "./types";

const STATUS_STYLE: Record<
  RiskInsightCard["status"],
  { solid: string; soft: string; gradientFrom: string; gradientTo: string }
> = {
  กลุ่มปกติ: {
    solid: "#059669",
    soft: "bg-emerald-50 border-emerald-100",
    gradientFrom: "#34d399",
    gradientTo: "#047857",
  },
  กลุ่มเสี่ยงปานกลาง: {
    solid: "#d97706",
    soft: "bg-amber-50 border-amber-100",
    gradientFrom: "#fbbf24",
    gradientTo: "#b45309",
  },
  กลุ่มเสี่ยงสูง: {
    solid: "#dc2626",
    soft: "bg-red-50 border-red-100",
    gradientFrom: "#f87171",
    gradientTo: "#b91c1c",
  },
};

type RiskDonutChartProps = {
  items: RiskInsightCard[];
};

/** กราฟโดนัทสัดส่วนกลุ่มเสี่ยง — มีช่องว่างชิ้น กราเดียนต์ และตำนานการ์ด */
export function RiskDonutChart({ items }: RiskDonutChartProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const slices = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        label: item.status.replace(/^กลุ่ม/, ""),
        value: item.registered,
        color: STATUS_STYLE[item.status].solid,
        status: item.status,
      })),
    [items]
  );

  const { total, arcs } = useMemo(
    () =>
      buildDonutArcs(
        slices.map(({ id, label, value, color }) => ({ id, label, value, color })),
        { gapRadians: 0.06, outerRadius: 100, innerRadius: 64 }
      ),
    [slices]
  );

  if (total <= 0) {
    return null;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:items-center">
      <div className="relative mx-auto w-full max-w-[16rem]">
        <div
          className="pointer-events-none absolute inset-[12%] rounded-full bg-slate-900/[0.04] blur-2xl"
          aria-hidden
        />
        <svg
          viewBox="0 0 240 240"
          className="relative h-auto w-full drop-shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
          role="img"
          aria-label="สัดส่วนกลุ่มเสี่ยง"
        >
          <defs>
            <filter id="risk-donut-soft" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0f172a" floodOpacity="0.12" />
            </filter>
            {slices.map((slice) => {
              const style = STATUS_STYLE[slice.status];
              return (
                <linearGradient
                  key={`grad-${slice.id}`}
                  id={`risk-grad-${slice.id}`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor={style.gradientFrom} />
                  <stop offset="100%" stopColor={style.gradientTo} />
                </linearGradient>
              );
            })}
          </defs>

          <circle cx="120" cy="120" r="108" fill="#f8fafc" />
          <circle cx="120" cy="120" r="104" fill="none" stroke="#e2e8f0" strokeWidth="1" />

          <g filter="url(#risk-donut-soft)">
            {arcs.map((arc) => {
              const emphasized = activeId === null || activeId === arc.id;
              return (
                <path
                  key={arc.id}
                  d={arc.path}
                  fill={`url(#risk-grad-${arc.id})`}
                  className="cursor-pointer transition-[opacity,transform] duration-200"
                  style={{
                    opacity: emphasized ? 1 : 0.35,
                    transformOrigin: "120px 120px",
                    transform: activeId === arc.id ? "scale(1.03)" : "scale(1)",
                  }}
                  onMouseEnter={() => setActiveId(arc.id)}
                  onMouseLeave={() => setActiveId(null)}
                >
                  <title>
                    {arc.label}: {arc.value} คน ({arc.percent.toFixed(0)}%)
                  </title>
                </path>
              );
            })}
          </g>

          <circle cx="120" cy="120" r="60" fill="white" />
          <circle cx="120" cy="120" r="60" fill="none" stroke="#f1f5f9" strokeWidth="2" />
          <text
            x="120"
            y="112"
            textAnchor="middle"
            style={{ fontSize: 32, fontWeight: 700, fill: "#0f172a" }}
          >
            {total}
          </text>
          <text
            x="120"
            y="136"
            textAnchor="middle"
            style={{ fontSize: 12, fontWeight: 600, fill: "#64748b" }}
          >
            คนทั้งหมด
          </text>
        </svg>
      </div>

      <div className="space-y-4">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100 shadow-inner">
          {arcs.map((arc) => {
            const slice = slices.find((item) => item.id === arc.id);
            const style = slice ? STATUS_STYLE[slice.status] : null;
            if (!style) {
              return null;
            }
            return (
              <div
                key={`bar-${arc.id}`}
                className="h-full transition-[filter] duration-200"
                style={{
                  width: `${arc.percent}%`,
                  background: `linear-gradient(90deg, ${style.gradientFrom}, ${style.gradientTo})`,
                  filter: activeId && activeId !== arc.id ? "saturate(0.4)" : undefined,
                }}
                title={`${arc.label} ${arc.percent.toFixed(0)}%`}
              />
            );
          })}
        </div>

        <ul className="space-y-2.5">
          {arcs.map((arc) => {
            const slice = slices.find((item) => item.id === arc.id);
            if (!slice) {
              return null;
            }
            const style = STATUS_STYLE[slice.status];
            const active = activeId === arc.id;
            return (
              <li key={`legend-${arc.id}`}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveId(arc.id)}
                  onMouseLeave={() => setActiveId(null)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                    active
                      ? `${style.soft} shadow-sm`
                      : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full shadow-sm ring-2 ring-white"
                      style={{ backgroundColor: style.solid }}
                      aria-hidden
                    />
                    <span className="truncate text-sm font-semibold text-slate-800">{arc.label}</span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="block text-base font-bold text-slate-900">{arc.value}</span>
                    <span className="text-xs font-medium text-slate-500">{arc.percent.toFixed(0)}%</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
