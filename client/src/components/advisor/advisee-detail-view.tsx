"use client";

import { ArrowLeft, ChevronRight, ClipboardList, Flag, Send } from "lucide-react";
import { AssessmentTimelinePanel } from "@/components/assessment/assessment-timeline-panel";
import { presentClinicalNote } from "@/lib/clinical-note-display";
import { presentHistoryText, stripSeedMarkers } from "@/lib/history-display";
import { formatStudentIdDisplay } from "@/lib/student-id";
import {
  UI_ACTION_PRIMARY_COMPACT,
  UI_ACTION_SECONDARY_COMPACT,
  UI_STATUS_ACTIVE,
  UI_STATUS_DANGER,
} from "@/lib/ui-classes";
import { hasActiveReferral } from "./referral-active";
import type {
  AdvisorHistoryItem,
  AdvisorReferralItem,
  AdvisorStudent,
  ReferralStatus,
  RiskMeta,
  StudentRiskLevel,
  WellnessSignalItem,
} from "./types";

const HISTORY_VISIBLE_LIMIT = 8;

type AdviseeQueueSummary = {
  openConsultationCount: number;
  pendingSignalCount: number;
};

type AdviseeDetailViewProps = {
  student: AdvisorStudent;
  historyItems: AdvisorHistoryItem[];
  loadingHistory: boolean;
  latestReferral: AdvisorReferralItem | undefined;
  queueSummary: AdviseeQueueSummary;
  riskMeta: Record<StudentRiskLevel, RiskMeta>;
  referralStatusMap: Record<ReferralStatus, { label: string; className: string }>;
  formatAssessmentSummary: (student: AdvisorStudent) => string;
  formatThaiDate: (value: string | null) => string;
  formatThaiDateTime: (value: string | null) => string;
  onBack: () => void;
  onOpenSoap: () => void;
  onOpenReferral: () => void;
  onOpenConsultations: () => void;
  onOpenSignals: () => void;
  onOpenReferrals: () => void;
};

function historyKindLabel(kind: AdvisorHistoryItem["kind"]): string {
  if (kind === "CARE") return "บันทึกดูแล";
  if (kind === "REFERRAL") return "ส่งต่อเคส";
  if (kind === "CONSULTATION") return "คำขอปรึกษา";
  return "แจ้งจากผู้สอน";
}

function historyKindClass(kind: AdvisorHistoryItem["kind"]): string {
  if (kind === "REFERRAL") return "bg-[#0057A8]";
  if (kind === "BEHAVIOR") return "bg-amber-600";
  if (kind === "CONSULTATION") return "bg-[#F15A22]";
  return "bg-emerald-600";
}

/** หน้ารายละเอียดนิสิต — ฮับสรุปคิวของคนนี้ + ประวัติติดตาม */
export function AdviseeDetailView({
  student,
  historyItems,
  loadingHistory,
  latestReferral,
  queueSummary,
  riskMeta,
  referralStatusMap,
  formatAssessmentSummary,
  formatThaiDate,
  formatThaiDateTime,
  onBack,
  onOpenSoap,
  onOpenReferral,
  onOpenConsultations,
  onOpenSignals,
  onOpenReferrals,
}: AdviseeDetailViewProps) {
  const studentRiskMeta = riskMeta[student.riskLevel];
  const referralDisabled = hasActiveReferral(latestReferral?.status);
  const wellnessSignals: WellnessSignalItem[] = student.wellnessSignals ?? [];
  const visibleHistory = historyItems.slice(0, HISTORY_VISIBLE_LIMIT);
  const hiddenCount = Math.max(0, historyItems.length - visibleHistory.length);
  const activeReferral = latestReferral && latestReferral.status !== "CLOSED" ? latestReferral : null;
  const hasQueue =
    queueSummary.openConsultationCount > 0 ||
    queueSummary.pendingSignalCount > 0 ||
    Boolean(activeReferral);

  return (
    <div className="w-full space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl px-1 text-sm font-bold text-slate-600 transition-colors hover:text-[#0057A8]"
      >
        <ArrowLeft className="h-4 w-4" />
        กลับรายชื่อ
      </button>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#278ACA]/15 text-base font-bold text-[#0057A8] sm:h-14 sm:w-14 sm:text-lg">
              {student.image}
            </div>
            <div className="min-w-0">
              <h2 className="break-words text-lg font-bold text-slate-800 sm:text-xl">{student.name}</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                รหัส {formatStudentIdDisplay(student.studentId)} • ชั้นปีที่ {student.year || "-"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${studentRiskMeta.badgeClassName}`}>
                  {studentRiskMeta.label}
                </span>
                {activeReferral ? (
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${referralStatusMap[activeReferral.status].className}`}
                  >
                    {referralStatusMap[activeReferral.status].label}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:w-80 lg:shrink-0">
            <button type="button" onClick={onOpenSoap} className={`${UI_ACTION_SECONDARY_COMPACT} min-h-11 sm:text-sm`}>
              บันทึกดูแล
            </button>
            <button
              type="button"
              onClick={onOpenReferral}
              disabled={referralDisabled}
              title={
                referralDisabled
                  ? latestReferral?.status === "ACCEPTED"
                    ? "มีเคสที่กำลังดูแลอยู่แล้ว"
                    : "มีเคสส่งต่อที่รอรับอยู่แล้ว"
                  : "ส่งต่อเคส"
              }
              className={`${UI_ACTION_PRIMARY_COMPACT} min-h-11 sm:text-sm`}
            >
              <Send className="h-3.5 w-3.5 shrink-0" />
              ส่งต่อเคส
            </button>
          </div>
        </div>

        <div className="border-b border-slate-100 p-4 sm:p-6">
          <h3 className="text-sm font-bold text-slate-800">คิวของนิสิตคนนี้</h3>
          <p className="mt-1 text-xs text-slate-500">สรุปงานค้างที่เกี่ยวข้อง — กดเพื่อไปจัดการต่อ</p>
          {hasQueue ? (
            <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {queueSummary.openConsultationCount > 0 ? (
                <li>
                  <button
                    type="button"
                    onClick={onOpenConsultations}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <ClipboardList className="h-4 w-4 shrink-0 text-[#0057A8]" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-800">
                        คำขอปรึกษาเปิดอยู่ {queueSummary.openConsultationCount} รายการ
                      </span>
                      <span className="text-xs text-slate-500">ไปที่คำขอปรึกษา</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>
                </li>
              ) : null}
              {queueSummary.pendingSignalCount > 0 ? (
                <li>
                  <button
                    type="button"
                    onClick={onOpenSignals}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <Flag className="h-4 w-4 shrink-0 text-amber-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-800">
                        สัญญาณเข้าค้าง {queueSummary.pendingSignalCount} รายการ
                      </span>
                      <span className="text-xs text-slate-500">ไปที่สัญญาณเข้า</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>
                </li>
              ) : null}
              {activeReferral ? (
                <li>
                  <button
                    type="button"
                    onClick={onOpenReferrals}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <Send className="h-4 w-4 shrink-0 text-[#C24712]" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-800">
                        ส่งต่อ: {referralStatusMap[activeReferral.status].label}
                      </span>
                      <span className="text-xs text-slate-500">ไปที่ติดตามการส่งต่อ</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              ไม่มีคำขอ สัญญาณ หรือเคสส่งต่อที่ค้างอยู่
            </p>
          )}
        </div>

        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-3 sm:p-6">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">ผลประเมินล่าสุด</p>
            <p className="mt-2 text-sm font-bold text-slate-800">{formatAssessmentSummary(student)}</p>
            <p className="mt-1 text-xs text-slate-500">{formatThaiDate(student.lastAssessment)}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">บันทึกการดูแล</p>
            <p className="mt-2 text-sm font-bold text-slate-800">{student.careRecordCount} รายการ</p>
            <p className="mt-1 text-xs text-slate-500">ติดตามต่อเนื่องโดยอาจารย์ที่ปรึกษา</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">สัญญาณจากผู้สอน</p>
            <p className="mt-2 text-sm font-bold text-slate-800">{student.behaviorRecordCount} รายการ</p>
            <p className="mt-1 text-xs text-slate-500">ใช้ประกอบการติดตามและประเมินความเสี่ยง</p>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          <AssessmentTimelinePanel
            endpoint={`/api/advisor/students/${student.id}/assessment-history`}
            formatThaiDate={formatThaiDate}
          />

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-800">สัญญาณจากแชท AI</h3>
              {student.hasCrisisWellnessSignal ? (
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${UI_STATUS_DANGER}`}>
                  มีสัญญาณวิกฤต
                </span>
              ) : null}
            </div>
            {wellnessSignals.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {wellnessSignals.map((signal) => (
                  <span
                    key={signal.code}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      signal.code === "SELF_HARM_CRISIS" ? UI_STATUS_DANGER : UI_STATUS_ACTIVE
                    }`}
                    title={`พบ ${signal.occurrenceCount} ครั้ง · ล่าสุด ${formatThaiDateTime(signal.lastDetectedAt)}`}
                  >
                    {signal.shortLabelTh}×{signal.occurrenceCount}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">ยังไม่พบสัญญาณจากแชท</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <ClipboardList className="h-4 w-4 text-[#0057A8]" />
                ประวัติการติดตามล่าสุด
              </h3>
              {loadingHistory ? (
                <span className="loader h-3.5 w-3.5 text-blue-600" aria-label="กำลังโหลด" />
              ) : null}
            </div>

            {visibleHistory.length > 0 ? (
              <div className="max-h-[min(28rem,60vh)] space-y-2 overflow-y-auto overscroll-contain p-3 sm:p-4">
                {visibleHistory.map((item) => {
                  const topicRaw = stripSeedMarkers(item.topic) || item.topic;
                  const topic =
                    item.kind === "CARE" ? presentClinicalNote(topicRaw) : topicRaw;
                  const actionRaw = presentHistoryText(item.action, (value) =>
                    formatThaiDateTime(value)
                  );
                  const action =
                    item.kind === "CARE" && actionRaw
                      ? presentClinicalNote(actionRaw)
                      : actionRaw;
                  const outcomeRaw = presentHistoryText(item.outcome, (value) =>
                    formatThaiDateTime(value)
                  );
                  const outcome =
                    item.kind === "CARE" && outcomeRaw
                      ? presentClinicalNote(outcomeRaw)
                      : outcomeRaw;
                  return (
                    <div key={item.id} className="rounded-xl border border-slate-100 px-3.5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold text-white ${historyKindClass(item.kind)}`}
                        >
                          {historyKindLabel(item.kind)}
                        </span>
                        {item.isUrgent ? (
                          <span className="rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                            เร่งด่วน
                          </span>
                        ) : null}
                        <span className="ml-auto text-[11px] text-slate-400">{formatThaiDateTime(item.date)}</span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-sm font-semibold text-slate-800">{topic}</p>
                      {action ? (
                        <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-sm text-slate-600">{action}</p>
                      ) : null}
                      {outcome ? (
                        <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs font-medium text-slate-500">
                          {outcome}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-slate-400">โดย {item.actorName}</p>
                    </div>
                  );
                })}
                {hiddenCount > 0 ? (
                  <p className="pt-1 text-center text-xs text-slate-500">
                    แสดงล่าสุด {HISTORY_VISIBLE_LIMIT} รายการ · มีอีก {hiddenCount} รายการที่ยังไม่แสดง
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-slate-500">
                ยังไม่มีประวัติการติดตามสำหรับนักศึกษาคนนี้
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

