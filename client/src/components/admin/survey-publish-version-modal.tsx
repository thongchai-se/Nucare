"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";
import { StaffModalOverlay } from "@/components/ui/staff-modal-overlay";
import {
  buildScoringRulesFromInputs,
  convertCutoffInput,
  DEFAULT_SYSTEM_RISK_RATIOS,
  SCORING_NOTE_MAX_LENGTH,
  type CutoffInputMode,
} from "@/lib/survey-scoring-rules-input";
import type { SurveyScoringRules, SurveyVersionSummary } from "@/types/survey";

type SurveyPublishVersionModalProps = {
  open: boolean;
  /** true เมื่อเครื่องมือเป็น CUSTOM (GHQ-28 ใช้คะแนนคงที่ จึงไม่แสดงช่องเกณฑ์) */
  isCustomInstrument: boolean;
  publishing: boolean;
  latestVersion: SurveyVersionSummary | null;
  onCancel: () => void;
  /** คืนข้อความ error เมื่อเผยแพร่ไม่สำเร็จ หรือ null เมื่อสำเร็จ */
  onConfirm: (scoringRules: SurveyScoringRules | undefined) => Promise<string | null>;
};

const inputClass =
  "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:opacity-60";

const modeOptions: Array<{ value: CutoffInputMode; label: string }> = [
  { value: "ratio", label: "สัดส่วน 0–1" },
  { value: "percent", label: "เปอร์เซ็นต์" },
];

/**
 * Modal ยืนยันเผยแพร่เวอร์ชันใหม่ของแบบสอบถาม; CUSTOM กรอกเกณฑ์ medium/high (ไม่บังคับ) ได้
 * ยกเลิกด้วยปุ่ม X / ยกเลิก / Escape (ปิดไม่ได้ระหว่างกำลังส่ง)
 */
export function SurveyPublishVersionModal({
  open,
  isCustomInstrument,
  publishing,
  latestVersion,
  onCancel,
  onConfirm,
}: SurveyPublishVersionModalProps) {
  const [mode, setMode] = useState<CutoffInputMode>("ratio");
  const [medium, setMedium] = useState("");
  const [high, setHigh] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  // เปิดใหม่ทุกครั้งเริ่มจากฟอร์มว่าง ไม่ค้างค่าจากครั้งก่อนที่ยกเลิก
  useEffect(() => {
    if (open) {
      setMode("ratio");
      setMedium("");
      setHigh("");
      setNote("");
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !publishing) {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, open, publishing]);

  if (!open) {
    return null;
  }

  const switchMode = (next: CutoffInputMode) => {
    if (next === mode) {
      return;
    }
    setMedium((current) => convertCutoffInput(current, mode, next));
    setHigh((current) => convertCutoffInput(current, mode, next));
    setMode(next);
    setError("");
  };

  const handleConfirm = async () => {
    let scoringRules: SurveyScoringRules | undefined;
    if (isCustomInstrument) {
      const built = buildScoringRulesFromInputs({ medium, high, note, mode });
      if (!built.ok) {
        setError(built.error);
        return;
      }
      scoringRules = built.scoringRules;
    }

    setError("");
    const failure = await onConfirm(scoringRules);
    if (failure) {
      setError(failure);
    }
  };

  const latestCutoffs = latestVersion?.scoringRules?.riskCutoffs ?? null;
  const placeholders =
    mode === "percent"
      ? {
          medium: String(Math.round(DEFAULT_SYSTEM_RISK_RATIOS.medium * 100)),
          high: String(Math.round(DEFAULT_SYSTEM_RISK_RATIOS.high * 100)),
        }
      : { medium: String(DEFAULT_SYSTEM_RISK_RATIOS.medium), high: String(DEFAULT_SYSTEM_RISK_RATIOS.high) };

  return (
    <StaffModalOverlay panelClassName="max-w-xl">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="เผยแพร่เวอร์ชันใหม่"
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900">เผยแพร่เวอร์ชันใหม่</h3>
            <p className="mt-1 text-sm text-slate-500">
              บันทึกคำถามที่บันทึกไว้ล่าสุดเป็นเวอร์ชันที่ตรึงไว้ — การแก้ไขที่ยังไม่ได้บันทึกจะไม่ถูกรวม
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={publishing}
            className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="ปิด"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {isCustomInstrument ? (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-800">เกณฑ์ระดับคัดกรอง (ไม่บังคับ)</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    เว้นว่าง = ใช้กฎของเวอร์ชันก่อนหน้า (ถ้ามี) หรือค่าเริ่มต้นของระบบ
                  </p>
                </div>
                <div className="inline-flex gap-1 rounded-lg border border-slate-200 bg-white p-1" role="group" aria-label="หน่วยของเกณฑ์">
                  {modeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={publishing}
                      aria-pressed={mode === option.value}
                      onClick={() => switchMode(option.value)}
                      className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                        mode === option.value
                          ? "bg-blue-700 text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="publish-cutoff-medium" className="mb-1.5 block text-xs font-bold text-slate-600">
                    เกณฑ์เฝ้าระวัง (medium){mode === "percent" ? " %" : ""}
                  </label>
                  <input
                    id="publish-cutoff-medium"
                    type="text"
                    inputMode="decimal"
                    value={medium}
                    disabled={publishing}
                    onChange={(event) => setMedium(event.target.value)}
                    placeholder={placeholders.medium}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="publish-cutoff-high" className="mb-1.5 block text-xs font-bold text-slate-600">
                    เกณฑ์คัดกรองสูง (high){mode === "percent" ? " %" : ""}
                  </label>
                  <input
                    id="publish-cutoff-high"
                    type="text"
                    inputMode="decimal"
                    value={high}
                    disabled={publishing}
                    onChange={(event) => setHigh(event.target.value)}
                    placeholder={placeholders.high}
                    className={inputClass}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">
                ค่าที่จางในช่องคือค่าเริ่มต้นของระบบ (สัดส่วนจากคะแนนเต็ม {DEFAULT_SYSTEM_RISK_RATIOS.medium} /{" "}
                {DEFAULT_SYSTEM_RISK_RATIOS.high}) แสดงเป็นตัวอย่างเท่านั้น ไม่ใช่เกณฑ์ที่อนุมัติ
              </p>

              <div>
                <label htmlFor="publish-scoring-note" className="mb-1.5 block text-xs font-bold text-slate-600">
                  หมายเหตุอ้างอิงเกณฑ์ (ไม่บังคับ)
                </label>
                <input
                  id="publish-scoring-note"
                  type="text"
                  value={note}
                  disabled={publishing}
                  maxLength={SCORING_NOTE_MAX_LENGTH}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="เช่น เอกสารเกณฑ์ที่ได้รับอนุมัติ ฉบับ/วันที่"
                  className={inputClass}
                />
              </div>

              {latestCutoffs ? (
                <p className="text-xs text-slate-500">
                  เวอร์ชัน {latestVersion?.version} ใช้เกณฑ์เฝ้าระวัง {latestCutoffs.medium} · คัดกรองสูง {latestCutoffs.high}
                </p>
              ) : null}

              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                เกณฑ์ต้องมาจากเกณฑ์ที่ผ่านการอนุมัติของหน่วยงานหรือผู้เชี่ยวชาญ ผลระดับคัดกรองใช้ประกอบการดูแลเท่านั้น
                ไม่ใช่การวินิจฉัย
              </p>
            </div>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              GHQ-28 ใช้เกณฑ์คะแนนคงที่ของแบบประเมิน จึงไม่มีช่องกำหนดเกณฑ์เอง
            </p>
          )}

          {error ? (
            <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-sm font-semibold text-red-700">{error}</p>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 p-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={publishing}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={publishing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {publishing ? "กำลังเผยแพร่" : "เผยแพร่เวอร์ชัน"}
          </button>
        </div>
      </div>
    </StaffModalOverlay>
  );
}
