"use client";

import { Activity } from "lucide-react";
import type { RiskInsightCard } from "./types";

type WellnessViewProps = {
  wellnessActivities: RiskInsightCard[];
};

/** แสดงสรุปกลุ่มเสี่ยงจากการคัดกรอง เพื่อวางกิจกรรมเชิงป้องกัน */
export function WellnessView({ wellnessActivities }: WellnessViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-950">สรุปกลุ่มเสี่ยง</h1>
        <p className="mt-1 text-sm text-slate-500">
          ตัวเลขจากผลคัดกรองล่าสุด — ใช้เป็นแนวทางวางโปรแกรมเชิงป้องกัน ไม่ใช่ระบบลงทะเบียนกิจกรรม
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">กลุ่มจากผลการคัดกรอง</h2>
          </div>
          <div className="space-y-4 p-4">
            {wellnessActivities.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                ยังไม่มีข้อมูลกลุ่มเสี่ยงจากผลคัดกรอง
              </p>
            ) : (
              wellnessActivities.map((activity) => (
                <div key={activity.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{activity.name}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <Activity className="h-3.5 w-3.5" />
                        {activity.date}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{activity.focus}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left sm:text-right">
                      <span
                        className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          activity.status === "กลุ่มเสี่ยงสูง"
                            ? "bg-red-100 text-red-700"
                            : activity.status === "กลุ่มเสี่ยงปานกลาง"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {activity.status}
                      </span>
                      <p className="mt-2 text-xl font-bold text-slate-900">
                        {activity.registered}/{activity.max}
                      </p>
                      <p className="text-xs text-slate-500">จำนวนนิสิตในกลุ่ม / คัดกรองแล้ว</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">สรุปจำนวนในกลุ่ม</p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-800">รวมทุกกลุ่มที่แสดง</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {wellnessActivities.reduce((sum, item) => sum + item.registered, 0)}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
