import type { SurveyScoringRules } from "@/types/survey";

export type CutoffInputMode = "ratio" | "percent";

export const SCORING_NOTE_MAX_LENGTH = 500;

/** ค่าเริ่มต้นของระบบ (สัดส่วน 0–1) ใช้เป็น placeholder เท่านั้น ไม่ใช่เกณฑ์ที่อนุมัติทางคลินิก */
export const DEFAULT_SYSTEM_RISK_RATIOS = { medium: 0.34, high: 0.67 } as const;

type CutoffParse = { ok: true; value: number | null } | { ok: false };

const roundRatio = (value: number): number => Math.round(value * 10000) / 10000;

/**
 * แปลงข้อความเกณฑ์จากช่องกรอกเป็นสัดส่วน 0–1 (โหมด percent หาร 100); ว่างคืน null, ค่านอกช่วง (0, 1] หรือไม่ใช่ตัวเลขคืน ok:false
 */
export function parseCutoffInput(raw: string, mode: CutoffInputMode): CutoffParse {
  const text = raw.trim();
  if (text === "") {
    return { ok: true, value: null };
  }

  if (!/^\d*\.?\d+$/.test(text)) {
    return { ok: false };
  }

  const numeric = Number(text);
  const ratio = mode === "percent" ? numeric / 100 : numeric;
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 1) {
    return { ok: false };
  }

  return { ok: true, value: roundRatio(ratio) };
}

/**
 * แปลงข้อความเกณฑ์ที่กรอกไว้จากโหมดหนึ่งไปอีกโหมดตอนสลับ ratio/percent; ว่างหรือไม่ถูกต้องคืนสตริงว่างเพื่อไม่ให้ตีความผิดหน่วย
 */
export function convertCutoffInput(raw: string, from: CutoffInputMode, to: CutoffInputMode): string {
  const parsed = parseCutoffInput(raw, from);
  if (!parsed.ok || parsed.value === null) {
    return "";
  }
  if (from === to) {
    return raw.trim();
  }
  return String(to === "percent" ? Math.round(parsed.value * 10000) / 100 : parsed.value);
}

export type ScoringRulesBuildResult =
  | { ok: true; scoringRules: SurveyScoringRules | undefined }
  | { ok: false; error: string };

/**
 * สร้าง scoringRules สำหรับ publish-version จากช่องกรอกของ CUSTOM; ว่างทั้งหมดคืน undefined (ไม่ส่ง = สืบทอดกฎเดิม)
 * ต้องกรอกเกณฑ์ medium/high คู่กัน และ medium ต้องน้อยกว่า high
 */
export function buildScoringRulesFromInputs(input: {
  medium: string;
  high: string;
  note: string;
  mode: CutoffInputMode;
}): ScoringRulesBuildResult {
  const note = input.note.trim();
  if (note.length > SCORING_NOTE_MAX_LENGTH) {
    return { ok: false, error: `หมายเหตุยาวเกิน ${SCORING_NOTE_MAX_LENGTH} ตัวอักษร` };
  }

  const medium = parseCutoffInput(input.medium, input.mode);
  const high = parseCutoffInput(input.high, input.mode);
  if (!medium.ok || !high.ok) {
    return {
      ok: false,
      error:
        input.mode === "percent"
          ? "เกณฑ์ต้องเป็นตัวเลขมากกว่า 0 และไม่เกิน 100 เปอร์เซ็นต์"
          : "เกณฑ์ต้องเป็นตัวเลขมากกว่า 0 และไม่เกิน 1",
    };
  }

  if (medium.value === null && high.value === null) {
    return { ok: true, scoringRules: note ? { note } : undefined };
  }

  if (medium.value === null || high.value === null) {
    return { ok: false, error: "กรอกเกณฑ์เฝ้าระวังและคัดกรองสูงให้ครบทั้งสองช่อง หรือเว้นว่างทั้งคู่" };
  }

  if (medium.value >= high.value) {
    return { ok: false, error: "เกณฑ์เฝ้าระวังต้องน้อยกว่าเกณฑ์คัดกรองสูง" };
  }

  return {
    ok: true,
    scoringRules: {
      riskCutoffs: { medium: medium.value, high: high.value },
      ...(note ? { note } : {}),
    },
  };
}

/** หาเวอร์ชันที่เลขสูงสุดจากรายการสรุป (ไม่ขึ้นกับลำดับในอาร์เรย์); รายการว่างคืน null — O(n) */
export function pickLatestVersion<T extends { version: number }>(versions: readonly T[]): T | null {
  let latest: T | null = null;
  for (const item of versions) {
    if (latest === null || item.version > latest.version) {
      latest = item;
    }
  }
  return latest;
}
