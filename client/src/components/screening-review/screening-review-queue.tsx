"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Check, ClipboardCheck, Send, ShieldAlert, X } from "lucide-react";
import { DashboardPanel } from "@/components/ui/dashboard-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { StaffModalOverlay } from "@/components/ui/staff-modal-overlay";
import { getApiErrorMessage } from "@/lib/api-error";
import api from "@/lib/axios";
import {
  UI_ACTION_PRIMARY_COMPACT,
  UI_ACTION_SECONDARY_COMPACT,
  UI_BUTTON_GHOST,
  UI_BUTTON_PRIMARY,
  UI_CALLOUT_INFO,
} from "@/lib/ui-classes";

type ReferralTarget = "STUDENT_DEVELOPMENT" | "COUNSELING_CENTER";
type ReferralStatus = "PENDING" | "ACCEPTED" | "CLOSED";
type ReviewStatus = "PENDING" | "ACKNOWLEDGED" | "REFERRED";

export type ScreeningReviewItem = {
  responseId: string;
  studentUserId: string;
  studentCode: string | null;
  studentName: string;
  year: string;
  section: string;
  advisorName: string | null;
  riskLevel: "high" | "medium";
  surveyTitle: string;
  waveLabel: string;
  submittedAt: string;
  status: ReviewStatus;
  acknowledgedAt: string | null;
  activeReferrals: Array<{ id: string; target: ReferralTarget; status: ReferralStatus }>;
};

type ScreeningReviewQueueProps = {
  /** `/api/student-development/screening-reviews` หรือ `/api/advisor/screening-reviews` */
  basePath: string;
  /** ผู้ใช้ฝั่งงานพัฒนานิสิตส่งต่อได้เฉพาะศูนย์ให้คำปรึกษา — ตรงกับกฎฝั่งเซิร์ฟเวอร์ */
  viewer: "staff" | "advisor";
  /** แสดงชื่อที่ปรึกษาในแถว (เฉพาะมุมมองภาพรวม) */
  showAdvisorName?: boolean;
  onReferralCreated?: () => void;
};

type RiskFilter = "ALL" | "high" | "medium";

const TARGET_LABEL: Record<ReferralTarget, string> = {
  COUNSELING_CENTER: "ศูนย์ให้คำปรึกษา",
  STUDENT_DEVELOPMENT: "งานพัฒนานิสิต",
};

const REFERRAL_STATUS_LABEL: Record<ReferralStatus, string> = {
  PENDING: "รอรับ",
  ACCEPTED: "กำลังดูแล",
  CLOSED: "ปิดแล้ว",
};

const RISK_FILTERS: Array<{ value: RiskFilter; label: string }> = [
  { value: "ALL", label: "ทั้งหมด" },
  { value: "high", label: "สูง" },
  { value: "medium", label: "ปานกลาง" },
];

const formatThaiDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(date);
};

/** คิวทบทวนผลคัดกรองระดับปานกลาง/สูง — ผู้ดูแลกดรับทราบหรือสร้างส่งต่อเอง ระบบไม่ส่งต่ออัตโนมัติ */
export function ScreeningReviewQueue({
  basePath,
  viewer,
  showAdvisorName = false,
  onReferralCreated,
}: ScreeningReviewQueueProps) {
  const [items, setItems] = useState<ScreeningReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("ALL");
  const [includeReferred, setIncludeReferred] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [referTarget, setReferTarget] = useState<ScreeningReviewItem | null>(null);
  const latestRequest = useRef(0);

  const allowedTargets = useMemo<ReferralTarget[]>(
    () =>
      viewer === "advisor" ? ["COUNSELING_CENTER", "STUDENT_DEVELOPMENT"] : ["COUNSELING_CENTER"],
    [viewer]
  );

  const load = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    setLoadError("");
    try {
      const response = await api.get<{ items: ScreeningReviewItem[] }>(basePath, {
        params: { status: includeReferred ? "ALL" : "OPEN" },
      });
      if (requestId === latestRequest.current) {
        setItems(response.data.items);
      }
    } catch (error) {
      if (requestId === latestRequest.current) {
        setLoadError(getApiErrorMessage(error, "โหลดคิวทบทวนผลคัดกรองไม่สำเร็จ"));
      }
    } finally {
      if (requestId === latestRequest.current) {
        setLoading(false);
      }
    }
  }, [basePath, includeReferred]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleItems = useMemo(
    () => (riskFilter === "ALL" ? items : items.filter((item) => item.riskLevel === riskFilter)),
    [items, riskFilter]
  );

  const handleAcknowledge = async (item: ScreeningReviewItem) => {
    if (busyId) {
      return;
    }
    setBusyId(item.responseId);
    setNotice("");
    try {
      await api.post(`${basePath}/${encodeURIComponent(item.responseId)}/acknowledge`);
      setItems((current) =>
        current.map((row) =>
          row.responseId === item.responseId && row.status === "PENDING"
            ? { ...row, status: "ACKNOWLEDGED", acknowledgedAt: new Date().toISOString() }
            : row
        )
      );
      setNotice(`รับทราบผลของ ${item.studentName} แล้ว`);
    } catch (error) {
      setNotice(getApiErrorMessage(error, "รับทราบไม่สำเร็จ กรุณาลองใหม่"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardPanel
      icon={ShieldAlert}
      title="ผลคัดกรองที่ควรทบทวน"
      description="ระบบไม่ส่งต่ออัตโนมัติ — พิจารณาบริบทของนิสิตแล้วเลือกรับทราบหรือสร้างส่งต่อด้วยตนเอง"
      flush
    >
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-wrap gap-2" role="group" aria-label="กรองตามระดับความเสี่ยง">
          {RISK_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={riskFilter === option.value}
              onClick={() => setRiskFilter(option.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                riskFilter === option.value
                  ? "bg-[#0057A8] text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            checked={includeReferred}
            onChange={(event) => setIncludeReferred(event.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          รวมที่ส่งต่อแล้ว
        </label>
      </div>

      {notice ? (
        <p role="status" className="border-b border-slate-100 bg-slate-50 px-5 py-2.5 text-sm text-slate-700 sm:px-6">
          {notice}
        </p>
      ) : null}
      {loadError ? (
        <div className="px-5 py-4 sm:px-6">
          <InlineAlert>{loadError}</InlineAlert>
          <button type="button" onClick={() => void load()} className={`${UI_ACTION_SECONDARY_COMPACT} mt-3`}>
            ลองใหม่
          </button>
        </div>
      ) : loading && items.length === 0 ? (
        <div className="flex justify-center px-5 py-8 sm:px-6" role="status" aria-live="polite">
          <span className="loader h-6 w-6 text-blue-600" aria-hidden="true" />
          <span className="sr-only">กำลังโหลด</span>
        </div>
      ) : visibleItems.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="ไม่มีผลที่ต้องทบทวน"
          description="เมื่อมีผลคัดกรองระดับปานกลางหรือสูงจากรอบล่าสุด จะแสดงที่นี่"
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {visibleItems.map((item) => {
            const busy = busyId === item.responseId;
            const referrals = item.activeReferrals;
            const canRefer = allowedTargets.some(
              (target) => !referrals.some((referral) => referral.target === target)
            );
            return (
              <li
                key={item.responseId}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{item.studentName}</p>
                    <span
                      className={`inline-flex whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                        item.riskLevel === "high" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      เสี่ยง{item.riskLevel === "high" ? "สูง" : "ปานกลาง"}
                    </span>
                    {item.status === "ACKNOWLEDGED" ? (
                      <span className="inline-flex whitespace-nowrap rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                        รับทราบแล้ว
                      </span>
                    ) : null}
                    {referrals.map((referral) => (
                      <span
                        key={referral.id}
                        className="inline-flex whitespace-nowrap rounded-md bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-800"
                      >
                        ส่งต่อ{TARGET_LABEL[referral.target]} · {REFERRAL_STATUS_LABEL[referral.status]}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.studentCode || "-"} • ชั้นปี {item.year} • {item.surveyTitle} ({item.waveLabel}) •{" "}
                    {formatThaiDate(item.submittedAt)}
                    {showAdvisorName ? ` • ที่ปรึกษา: ${item.advisorName ?? "ยังไม่มอบหมาย"}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {item.status === "PENDING" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleAcknowledge(item)}
                      className={UI_ACTION_SECONDARY_COMPACT}
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden />
                      รับทราบ
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy || !canRefer}
                    onClick={() => setReferTarget(item)}
                    className={UI_ACTION_PRIMARY_COMPACT}
                  >
                    <Send className="h-3.5 w-3.5" aria-hidden />
                    สร้างส่งต่อ
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {referTarget ? (
        <ScreeningReferralModal
          basePath={basePath}
          item={referTarget}
          allowedTargets={allowedTargets}
          onClose={() => setReferTarget(null)}
          onCreated={(message) => {
            setReferTarget(null);
            setNotice(message);
            void load();
            onReferralCreated?.();
          }}
        />
      ) : null}
    </DashboardPanel>
  );
}

type ScreeningReferralModalProps = {
  basePath: string;
  item: ScreeningReviewItem;
  allowedTargets: ReferralTarget[];
  onClose: () => void;
  onCreated: (message: string) => void;
};

/** โมดัลสร้างส่งต่อจากผลคัดกรอง — ปิดปลายทางที่มีเคสเปิดอยู่แล้วตามกฎกันซ้ำ */
function ScreeningReferralModal({
  basePath,
  item,
  allowedTargets,
  onClose,
  onCreated,
}: ScreeningReferralModalProps) {
  const blockedTargets = new Set(item.activeReferrals.map((referral) => referral.target));
  const firstOpenTarget = allowedTargets.find((target) => !blockedTargets.has(target)) ?? null;
  const [target, setTarget] = useState<ReferralTarget | null>(firstOpenTarget);
  const [reason, setReason] = useState("");
  const [isUrgent, setIsUrgent] = useState(item.riskLevel === "high");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const reasonLength = reason.trim().length;
  const canSubmit = Boolean(target) && reasonLength >= 20 && !submitting;

  const handleClose = () => {
    if (!submitting) {
      onClose();
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!target || !canSubmit) {
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.post(`${basePath}/${encodeURIComponent(item.responseId)}/referrals`, {
        target,
        reason: reason.trim(),
        isUrgent,
      });
      onCreated(`ส่งต่อ ${item.studentName} ไป${TARGET_LABEL[target]}แล้ว`);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, "ส่งต่อไม่สำเร็จ กรุณาลองใหม่"));
      setSubmitting(false);
    }
  };

  return (
    <StaffModalOverlay panelClassName="max-w-xl">
      <div className="flex items-center justify-between border-b border-slate-100 bg-[#F4F7FB] p-5">
        <div>
          <h3 className="text-lg font-bold text-slate-800">สร้างส่งต่อ</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {item.studentName} • {item.studentCode || "-"}
          </p>
        </div>
        <button
          type="button"
          aria-label="ปิด"
          onClick={handleClose}
          disabled={submitting}
          className="rounded-full bg-white p-1.5 text-slate-400 shadow-sm disabled:opacity-50"
        >
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <fieldset className="space-y-2">
            <legend className="text-xs font-bold text-slate-700">ส่งต่อไปที่</legend>
            {allowedTargets.map((option) => {
              const blocked = blockedTargets.has(option);
              return (
                <label
                  key={option}
                  className={`flex items-start gap-3 rounded-xl border p-4 ${
                    blocked
                      ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
                      : "cursor-pointer border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="target"
                    value={option}
                    checked={target === option}
                    disabled={blocked}
                    onChange={() => setTarget(option)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    <span className="block text-sm font-bold">{TARGET_LABEL[option]}</span>
                    {blocked ? (
                      <span className="mt-1 block text-xs">มีเคสที่ยังเปิดอยู่ในปลายทางนี้แล้ว</span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </fieldset>

          <div className="space-y-1">
            <label htmlFor="screening-referral-reason" className="text-xs font-bold text-slate-700">
              ข้อมูลส่งต่อให้ผู้รับเคส (จำเป็น)
            </label>
            <textarea
              id="screening-referral-reason"
              rows={5}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={4000}
              placeholder="สิ่งที่สังเกตหรือพูดคุยแล้ว ความช่วยเหลือที่ต้องการ และข้อควรระวัง"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-500">
              อย่างน้อย 20 ตัวอักษร ({reasonLength}/20) — ไม่ต้องใส่คะแนนหรือคำตอบรายข้อ
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={isUrgent}
              onChange={(event) => setIsUrgent(event.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            ต้องการให้ติดต่อเร็ว
          </label>

          <p className={UI_CALLOUT_INFO}>
            ส่งต่อนี้ผูกกับผลคัดกรองรอบนี้ เพื่อให้ตรวจย้อนได้ว่าใครตัดสินใจและเมื่อใด
          </p>

          {error ? <InlineAlert>{error}</InlineAlert> : null}
        </div>

        <div className="flex flex-col-reverse justify-end gap-2 border-t border-slate-100 bg-slate-50 p-5 sm:flex-row">
          <button type="button" onClick={handleClose} disabled={submitting} className={UI_BUTTON_GHOST}>
            ยกเลิก
          </button>
          <button type="submit" disabled={!canSubmit} className={UI_BUTTON_PRIMARY}>
            {submitting ? "กำลังส่ง..." : "ยืนยันการส่งต่อ"}
          </button>
        </div>
      </form>
    </StaffModalOverlay>
  );
}
