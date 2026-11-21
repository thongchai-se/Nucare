"use client";

import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { RiskDonutChart } from "./risk-donut-chart";
import { RiskSummaryCards } from "./risk-summary-cards";
import type { RiskInsightCard } from "./types";

type WellnessViewProps = {
  wellnessActivities: RiskInsightCard[];
};

/** แสดงสรุปกลุ่มเสี่ยงจากการคัดกรอง พร้อมกราฟสัดส่วน */
export function WellnessView({ wellnessActivities }: WellnessViewProps) {
  const totalAssessed = wellnessActivities.reduce((sum, item) => sum + item.registered, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">สรุปกลุ่มเสี่ยง</h1>
        <p className="mt-1 text-sm text-slate-500">
          จากผลคัดกรองล่าสุด · ประเมินแล้ว {totalAssessed.toLocaleString("th-TH")} คน
        </p>
      </div>

      {wellnessActivities.length > 0 ? (
        <>
          <RiskSummaryCards items={wellnessActivities} />
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.35)]">
            <div className="border-b border-slate-100 bg-white/80 px-5 py-4 sm:px-6">
              <h2 className="text-base font-semibold text-slate-900">สัดส่วนกลุ่มเสี่ยง</h2>
              <p className="mt-1 text-sm text-slate-500">ชี้เมาส์ที่ชิ้นกราฟหรือแถวตำนานเพื่อเน้นกลุ่ม</p>
            </div>
            <div className="p-5 sm:p-6">
              <RiskDonutChart items={wellnessActivities} />
            </div>
          </section>
        </>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <EmptyState
            icon={Users}
            title="ยังไม่มีข้อมูลกลุ่มเสี่ยง"
            description="เมื่อมีผลคัดกรองแล้ว กลุ่มจะแสดงที่นี่"
          />
        </div>
      )}
    </div>
  );
}
