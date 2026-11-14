"use client";

import Link from "next/link";
import { BarChart3, FileSpreadsheet, Shield } from "lucide-react";
import { InlineAlert } from "@/components/ui/inline-alert";

export type AdminReportsSummary = {
  generatedAt: string;
  activeSurvey: { id: string; title: string } | null;
  overall: {
    totalStudents: number;
    screenedCount: number;
    distressCounts: {
      NORMAL: number;
      MILD: number;
      MODERATE: number;
      SEVERE: number;
      unscreened: number;
    };
    riskCounts: {
      NORMAL: number;
      MEDIUM: number;
      HIGH: number;
      unscreened: number;
    };
  };
  operations: {
    avgConsultationResponseHours: number | null;
    caseClosureRate: number | null;
    openReferrals: number;
    openSos: number;
  };
};

type ReportsViewProps = {
  loading: boolean;
  summary: AdminReportsSummary | null;
  error: string | null;
  onRefresh: () => void;
  onOpenAudit: () => void;
};

/** หน้ารายงานแอดมิน: สถิติแบบไม่ระบุตัวตนและลิงก์ไป audit/แบบประเมิน */
export function ReportsView({ loading, summary, error, onRefresh, onOpenAudit }: ReportsViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">สถิติและรายงาน</h2>
          <p className="mt-1 text-sm text-slate-500">
            สรุปภาพรวมแบบไม่ระบุตัวตน เชื่อมกับ audit export และหน้าแบบประเมิน
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
        >
          รีเฟรชสรุป
        </button>
      </div>

      {error ? <InlineAlert className="rounded-2xl">{error}</InlineAlert> : null}

      {loading && !summary ? (
        <div className="flex min-h-40 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <span className="loader h-6 w-6 text-blue-600" />
        </div>
      ) : null}

      {summary ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="นิสิตทั้งหมด" value={summary.overall.totalStudents} />
            <MetricCard label="คัดกรองแล้ว" value={summary.overall.screenedCount} />
            <MetricCard label="referral เปิดอยู่" value={summary.operations.openReferrals} />
            <MetricCard label="SOS เปิดอยู่" value={summary.operations.openSos} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-800">ระดับความเสี่ยงล่าสุด</h3>
              </div>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex justify-between"><span>ปกติ</span><span className="font-bold text-slate-900">{summary.overall.riskCounts.NORMAL}</span></li>
                <li className="flex justify-between"><span>ปานกลาง</span><span className="font-bold text-amber-700">{summary.overall.riskCounts.MEDIUM}</span></li>
                <li className="flex justify-between"><span>สูง</span><span className="font-bold text-red-700">{summary.overall.riskCounts.HIGH}</span></li>
                <li className="flex justify-between"><span>ยังไม่คัดกรอง</span><span className="font-bold text-slate-500">{summary.overall.riskCounts.unscreened}</span></li>
              </ul>
              <p className="mt-4 text-xs text-slate-400">
                แบบประเมินที่ใช้งาน: {summary.activeSurvey?.title ?? "ยังไม่มีแบบประเมินเปิดอยู่"}
              </p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-slate-800">ประสิทธิภาพการดูแล</h3>
              </div>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex justify-between">
                  <span>อัตราปิดเคส</span>
                  <span className="font-bold text-slate-900">
                    {summary.operations.caseClosureRate == null ? "-" : `${summary.operations.caseClosureRate}%`}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>เวลาตอบคำขอปรึกษาเฉลี่ย</span>
                  <span className="font-bold text-slate-900">
                    {summary.operations.avgConsultationResponseHours == null
                      ? "-"
                      : `${summary.operations.avgConsultationResponseHours} ชม.`}
                  </span>
                </li>
              </ul>
              <p className="mt-4 text-xs text-slate-400">อัปเดตเมื่อ {new Date(summary.generatedAt).toLocaleString("th-TH")}</p>
            </section>
          </div>
        </>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-slate-700" />
          <h3 className="font-bold text-slate-800">ส่งออกและเครื่องมือที่เกี่ยวข้อง</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={onOpenAudit}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition-colors hover:bg-slate-100"
          >
            <p className="text-sm font-bold text-slate-800">บันทึกตรวจสอบ (Audit)</p>
            <p className="mt-1 text-xs text-slate-500">ดูและส่งออก CSV จากหน้า audit</p>
          </button>
          <Link
            href="/admin/surveys"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition-colors hover:bg-slate-100"
          >
            <p className="text-sm font-bold text-slate-800">แบบประเมินและผลตอบ</p>
            <p className="mt-1 text-xs text-slate-500">จัดการแบบสอบถามและส่งออกผล</p>
          </Link>
          <Link
            href="/executive?view=reports"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition-colors hover:bg-slate-100"
          >
            <p className="text-sm font-bold text-slate-800">รายงานผู้บริหาร</p>
            <p className="mt-1 text-xs text-slate-500">ดูมุมมอง executive พร้อม CSV</p>
          </Link>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
