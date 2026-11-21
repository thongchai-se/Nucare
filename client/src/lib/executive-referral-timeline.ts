import type { ExecutiveReferralRoadmapStep } from "@/types/executive-referrals";

export type TimelineDisplayKind = ExecutiveReferralRoadmapStep["kind"];

export type TimelineDisplayStep = {
  key: string;
  label: string;
  at: string;
  actorName?: string;
  detail?: string;
  kind: TimelineDisplayKind;
};

/** สร้างไทม์ไลน์เส้นทางเคสสำหรับผู้บริหาร — ไม่รวมประวัติปฏิเสธคิว */
export function buildTimelineSteps(
  roadmap: ExecutiveReferralRoadmapStep[],
  targetLabel: string
): TimelineDisplayStep[] {
  return roadmap.map((step) => {
    if (step.kind === "sent") {
      return {
        key: step.key,
        label: step.label,
        at: step.at,
        actorName: step.actorName,
        kind: step.kind,
        detail: `ส่งถึง ${targetLabel}`,
      };
    }
    if (step.kind === "accepted") {
      return {
        key: step.key,
        label: step.label,
        at: step.at,
        actorName: step.actorName,
        kind: step.kind,
        detail: step.actorName ? `${step.actorName} รับช่วงดูแล` : "ทีมปลายทางรับเคสแล้ว",
      };
    }
    if (step.kind === "closed") {
      return {
        key: step.key,
        label: step.label,
        at: step.at,
        actorName: step.actorName,
        kind: step.kind,
        detail: "จบการติดตามเคสนี้แล้ว",
      };
    }
    return {
      key: step.key,
      label: step.label,
      at: step.at,
      actorName: step.actorName,
      kind: step.kind,
      detail: step.detail,
    };
  });
}
