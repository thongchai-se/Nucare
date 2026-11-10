"use client";

import { useMemo, useState } from "react";
import { prepareRoadmapSteps } from "./observation-roadmap-prepare";

export type ObservationRoadmapStepKind =
  | "reported"
  | "acknowledged"
  | "closed"
  | "referred"
  | "sent"
  | "accepted"
  | "care";

export type ObservationRoadmapStep = {
  key: string;
  label: string;
  at: string;
  actorName?: string;
  detail?: string;
  kind?: ObservationRoadmapStepKind;
};

type ObservationRoadmapProps = {
  steps: ObservationRoadmapStep[];
  formatThaiDateTime: (value: string) => string;
};

const WRAP_STEP_THRESHOLD = 5;

/** เขียว = ขั้นที่จบแล้ว · น้ำเงิน = ขั้นที่กำลังอยู่ (ยังไม่ปิด) */
function stepTone(step: ObservationRoadmapStep, index: number, total: number) {
  const isLatest = index === total - 1;
  const isFinished = !isLatest || step.kind === "closed";
  if (isFinished) {
    return {
      badge: "bg-emerald-600 text-white",
      label: "text-slate-800",
      link: "text-emerald-700",
      selected: "bg-slate-50 ring-1 ring-slate-200",
      panel: "border-slate-200",
    };
  }
  return {
    badge: "bg-[#0057A8] text-white",
    label: "text-slate-800",
    link: "text-[#0057A8]",
    selected: "bg-slate-50 ring-1 ring-slate-200",
    panel: "border-slate-200",
  };
}

/** Roadmap ตามเหตุการณ์จริง — กดขั้นเพื่อดูรายละเอียด (เหตุผลปิด/ส่งต่อ) */
export function ObservationRoadmap({ steps, formatThaiDateTime }: ObservationRoadmapProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const displaySteps = useMemo(() => prepareRoadmapSteps(steps), [steps]);
  const useWrappedLayout = displaySteps.length > WRAP_STEP_THRESHOLD;

  if (displaySteps.length === 0) {
    return null;
  }

  const selected = selectedKey ? displaySteps.find((step) => step.key === selectedKey) : null;
  const selectedIndex = selected ? displaySteps.findIndex((step) => step.key === selected.key) : -1;
  const selectedTone =
    selected && selectedIndex >= 0 ? stepTone(selected, selectedIndex, displaySteps.length) : null;

  return (
    <div className="mt-4 space-y-4">
      <ol
        className={
          useWrappedLayout
            ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
            : "flex flex-col gap-0 lg:flex-row lg:items-stretch lg:gap-0"
        }
      >
        {displaySteps.map((step, index) => {
          const isSelected = selectedKey === step.key;
          const tone = stepTone(step, index, displaySteps.length);
          const showConnector = !useWrappedLayout && index < displaySteps.length - 1;
          return (
            <li
              key={step.key}
              className={
                useWrappedLayout
                  ? "relative flex min-w-0 gap-3 rounded-xl border border-slate-100 bg-white/70 p-3 lg:flex-col lg:gap-2"
                  : "relative flex min-w-0 flex-1 gap-3 lg:flex-col lg:gap-2"
              }
            >
              <div className="flex flex-col items-center lg:flex-row lg:items-center">
                <span
                  className={`relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${tone.badge}`}
                >
                  {index + 1}
                </span>
                {showConnector ? (
                  <>
                    <span className="my-1 w-px flex-1 bg-slate-200 lg:hidden" aria-hidden="true" />
                    <span className="mx-1 hidden h-px flex-1 bg-slate-200 lg:block" aria-hidden="true" />
                  </>
                ) : null}
              </div>
              <div className={`min-w-0 ${useWrappedLayout ? "" : "pb-4 lg:pb-0 lg:pr-3"}`}>
                <button
                  type="button"
                  onClick={() => setSelectedKey(isSelected ? null : step.key)}
                  className={`w-full rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isSelected ? tone.selected : ""
                  }`}
                  aria-expanded={isSelected}
                >
                  <p className={`line-clamp-2 whitespace-pre-line text-xs font-bold leading-snug ${tone.label}`}>
                    {step.label}
                  </p>
                  {step.actorName ? (
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-600">{step.actorName}</p>
                  ) : null}
                  <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                    {formatThaiDateTime(step.at)}
                  </p>
                  <p className={`mt-1 text-[10px] font-semibold ${tone.link}`}>ดูรายละเอียด</p>
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      {selected && selectedTone ? (
        <div className={`rounded-xl border bg-white px-4 py-3 text-sm text-slate-700 ${selectedTone.panel}`}>
          <p className="whitespace-pre-line text-xs font-bold text-slate-500">รายละเอียดขั้น: {selected.label}</p>
          {selected.actorName ? (
            <p className="mt-1 text-xs text-slate-600">โดย {selected.actorName}</p>
          ) : null}
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
            {selected.detail?.trim() || "ไม่มีรายละเอียดเพิ่มเติมในขั้นนี้"}
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">
          เขียว = ขั้นที่จบแล้ว · น้ำเงิน = ขั้นที่กำลังอยู่ — กดขั้นเพื่อดูรายละเอียด
        </p>
      )}
    </div>
  );
}
