export type ReferralRoadmapStepKind = "sent" | "accepted" | "care" | "closed";

export type ReferralRoadmapStep = {
  key: string;
  label: string;
  at: string;
  actorName?: string;
  detail?: string;
  kind: ReferralRoadmapStepKind;
};

export type ReferralRoadmapInput = {
  createdAt: Date;
  status: "PENDING" | "ACCEPTED" | "CLOSED";
  advisorName: string;
  targetLabel: string;
  reason: string;
  isUrgent: boolean;
  acceptedAt?: Date | null;
  acceptedByName?: string | null;
  closedAt?: Date | null;
  careSessionCount: number;
  latestCareSessionAt?: Date | null;
  latestCareProviderName?: string | null;
};

/**
 * สร้างเส้นทางหมุดติดตามการส่งต่อ: ส่งต่อ → รับเคส → บันทึกดูแล → ปิดเคส
 */
export function buildReferralRoadmap(input: ReferralRoadmapInput): ReferralRoadmapStep[] {
  const steps: ReferralRoadmapStep[] = [
    {
      key: "sent",
      label: "ส่งต่อเคส",
      at: input.createdAt.toISOString(),
      actorName: input.advisorName,
      kind: "sent",
      detail: [
        `ส่งถึง: ${input.targetLabel}`,
        input.isUrgent ? "ความเร่งด่วน: วิกฤต (SOS)" : null,
        `เหตุผล: ${input.reason.trim() || "-"}`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  if (input.status === "ACCEPTED" || input.status === "CLOSED") {
    const acceptedAt = input.acceptedAt ?? input.createdAt;
    steps.push({
      key: "accepted",
      label: "รับเคสแล้ว",
      at: acceptedAt.toISOString(),
      actorName: input.acceptedByName ?? undefined,
      kind: "accepted",
      detail: input.acceptedByName
        ? `${input.acceptedByName} รับช่วงดูแลเคสนี้แล้ว`
        : "ทีมปลายทางรับเคสแล้ว",
    });
  }

  if (input.careSessionCount > 0 && input.latestCareSessionAt) {
    steps.push({
      key: "care",
      label: "มีการบันทึกดูแล",
      at: input.latestCareSessionAt.toISOString(),
      actorName: input.latestCareProviderName ?? undefined,
      kind: "care",
      detail: `มีบันทึกดูแล ${input.careSessionCount} ครั้ง${
        input.latestCareProviderName ? `\nล่าสุดโดย ${input.latestCareProviderName}` : ""
      }`,
    });
  }

  if (input.status === "CLOSED") {
    const closedAt = input.closedAt ?? input.latestCareSessionAt ?? input.createdAt;
    steps.push({
      key: "closed",
      label: "ปิดเคส",
      at: closedAt.toISOString(),
      kind: "closed",
      detail: "เคสถูกปิดการติดตามแล้ว",
    });
  }

  return steps;
}
