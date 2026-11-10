import type { ObservationRoadmapStep, ObservationRoadmapStepKind } from "./observation-roadmap";

export type RoadmapPrepareStep = {
  key: string;
  label: string;
  at: string;
  actorName?: string;
  detail?: string;
  kind?: ObservationRoadmapStepKind;
};

/** แยกป้ายส่งต่อยาวให้ขึ้นบรรทัดใหม่ และดึงปลายทางไว้รวมหมุดซ้ำ */
export function normalizeRoadmapStepLabel(label: string): {
  label: string;
  referralTarget: string | null;
} {
  const trimmed = label.trim();
  const match = trimmed.match(/^ส่งต่อ(?:\s*[·•\-–]\s*|\n+)(.+)$/s);
  if (match?.[1]) {
    const target = match[1].replace(/\s+/g, " ").trim();
    return { label: `ส่งต่อ\n${target}`, referralTarget: target };
  }
  return { label: trimmed, referralTarget: null };
}

function isReferralStep(step: RoadmapPrepareStep): boolean {
  if (step.kind === "referred") {
    return true;
  }
  return /^ส่งต่อ(?:\s*[·•\-–]|\n|$)/.test(step.label.trim());
}

/**
 * รวมหมุดส่งต่อปลายทางเดียวกัน และตัดป้ายยาวเป็นสองบรรทัด
 * (กันข้อมูลเก่าจาก API ที่ยังแตกหมุดซ้ำ)
 */
export function prepareRoadmapSteps(steps: readonly RoadmapPrepareStep[]): ObservationRoadmapStep[] {
  const prepared: ObservationRoadmapStep[] = [];
  const referralIndexByTarget = new Map<string, number>();
  const referralCountByTarget = new Map<string, number>();

  for (const step of steps) {
    const { label, referralTarget } = normalizeRoadmapStepLabel(step.label);

    if (isReferralStep(step) && referralTarget) {
      const existingIndex = referralIndexByTarget.get(referralTarget);
      if (existingIndex !== undefined) {
        const existing = prepared[existingIndex]!;
        const nextCount = (referralCountByTarget.get(referralTarget) || 1) + 1;
        referralCountByTarget.set(referralTarget, nextCount);
        const keepLatest = Date.parse(step.at) >= Date.parse(existing.at);
        prepared[existingIndex] = {
          ...existing,
          at: keepLatest ? step.at : existing.at,
          actorName: keepLatest ? step.actorName || existing.actorName : existing.actorName,
          detail: [
            (keepLatest ? step.detail : existing.detail)?.trim() || null,
            `มีการส่งไปปลายทางนี้ ${nextCount} ครั้ง (แสดงหมุดรวม)`,
          ]
            .filter(Boolean)
            .join("\n"),
        };
        continue;
      }

      referralIndexByTarget.set(referralTarget, prepared.length);
      referralCountByTarget.set(referralTarget, 1);
      prepared.push({
        ...step,
        kind: step.kind ?? "referred",
        label,
      });
      continue;
    }

    prepared.push({ ...step, label });
  }

  return prepared;
}
