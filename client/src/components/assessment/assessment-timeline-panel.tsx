"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";

export type AssessmentTimelineEntry = {
  id: string;
  waveId: string;
  waveLabel: string;
  surveyId: string;
  surveyTitle: string;
  instrumentCode: string;
  instrument: string;
  status: "COMPLETED" | "NOT_COMPLETED" | "OVERDUE";
  totalScore: number | null;
  maxScore: number | null;
  riskLevel: "NORMAL" | "MEDIUM" | "HIGH" | null;
  submittedAt: string | null;
  scheduledAt: string;
  closesAt: string | null;
};

type AssessmentTimelinePanelProps = {
  /** เช่น /api/advisor/students/:id/assessment-history */
  endpoint: string;
  formatThaiDate: (value: string | null) => string;
  limit?: number;
};

/** แสดงไทม์ไลน์ผลประเมินรายรอบ รวมสถานะยังไม่ตอบ/หมดเขต แยกจากคะแนนปกติ */
export function AssessmentTimelinePanel({
  endpoint,
  formatThaiDate,
  limit = 8,
}: AssessmentTimelinePanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [entries, setEntries] = useState<AssessmentTimelineEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await api.get<{ timeline: AssessmentTimelineEntry[] }>(endpoint);
        if (!cancelled) {
          setEntries(response.data.timeline ?? []);
        }
      } catch {
        if (!cancelled) {
          setError("ไม่สามารถโหลดประวัติแบบประเมินได้");
          setEntries([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  const visible = [...entries].reverse().slice(0, limit);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="mb-1 text-sm font-bold text-slate-900">ไทม์ไลน์แบบประเมิน</h4>
      <p className="mb-3 text-xs text-slate-600">ผลคะแนนและรอบที่ยังไม่ตอบ แยกตามกำหนดของแต่ละรอบ</p>
      {loading ? (
        <div className="flex justify-center py-4" role="status" aria-live="polite">
          <span className="loader h-6 w-6 text-blue-600" aria-hidden="true" />
          <span className="sr-only">กำลังโหลด</span>
        </div>
      ) : error ? (
        <p className="text-sm text-rose-700">{error}</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-slate-600">ยังไม่มีรอบประเมิน</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((row) => (
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
                    {row.totalScore === null
                      ? "—"
                      : `${row.totalScore}${row.maxScore ? `/${row.maxScore}` : ""}`}
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
  );
}
