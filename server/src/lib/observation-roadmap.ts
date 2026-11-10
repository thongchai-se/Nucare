import { AlertStatus } from "@prisma/client";

export type ObservationRoadmapStepKind = "reported" | "acknowledged" | "closed" | "referred";

export type ObservationRoadmapStep = {
  key: string;
  label: string;
  at: string;
  actorName?: string;
  /** รายละเอียดกดดูได้ เช่น เหตุผลปิดเรื่อง / เหตุผลส่งต่อ */
  detail?: string;
  kind: ObservationRoadmapStepKind;
};

export type ObservationRoadmapAlertInput = {
  id: string;
  status: AlertStatus;
  updatedAt: Date;
  recipientName: string;
  acknowledgedAt?: Date | null;
  closedAt?: Date | null;
  resolutionNote?: string | null;
};

export type ObservationRoadmapReferralInput = {
  id: string;
  createdAt: Date;
  targetLabel: string;
  reason: string;
  advisorName: string;
  status: string;
};

/**
 * สร้างเส้นทางติดตามจากเหตุการณ์จริง
 * แจ้ง → รับเรื่อง → ปิดเรื่อง (พร้อมเหตุผล) → ส่งต่อได้ต่อแม้หลังปิด (ไม่บังคับจบที่ปิดเรื่อง)
 */
export function buildObservationRoadmap(input: {
  createdAt: Date;
  alerts: readonly ObservationRoadmapAlertInput[];
  referrals?: readonly ObservationRoadmapReferralInput[];
}): ObservationRoadmapStep[] {
  const steps: ObservationRoadmapStep[] = [
    {
      key: "reported",
      label: "แจ้งข้อสังเกต",
      at: input.createdAt.toISOString(),
      kind: "reported",
      detail: "บันทึกข้อสังเกตและแจ้งที่ปรึกษาของนิสิตแล้ว",
    },
  ];

  type TimedStep = ObservationRoadmapStep & { sortAt: number };
  const timed: TimedStep[] = [];

  for (const alert of input.alerts) {
    if (alert.status === AlertStatus.OPEN) {
      continue;
    }

    const ackAt = alert.acknowledgedAt ?? (alert.status === AlertStatus.ACKNOWLEDGED ? alert.updatedAt : null);
    const closeAt = alert.closedAt ?? (alert.status === AlertStatus.CLOSED ? alert.updatedAt : null);

    // ปิดเรื่องโดยตรงจาก OPEN ก็ยังใส่ขั้นรับเรื่องก่อน เพื่อให้เส้นทางครบ
    if (alert.status === AlertStatus.ACKNOWLEDGED || alert.status === AlertStatus.CLOSED) {
      const at = ackAt ?? closeAt ?? alert.updatedAt;
      timed.push({
        key: `ack-${alert.id}`,
        label: "รับเรื่อง",
        at: at.toISOString(),
        actorName: alert.recipientName,
        kind: "acknowledged",
        detail: `${alert.recipientName} รับเรื่องข้อสังเกตนี้แล้ว และจะติดตามต่อ`,
        sortAt: at.getTime(),
      });
    }

    if (alert.status === AlertStatus.CLOSED) {
      const at = closeAt ?? alert.updatedAt;
      const note = alert.resolutionNote?.trim();
      timed.push({
        key: `close-${alert.id}`,
        label: "ปิดเรื่อง",
        at: at.toISOString(),
        actorName: alert.recipientName,
        kind: "closed",
        detail: note
          ? `ปิดการติดตามโดย ${alert.recipientName}\nเหตุผล: ${note}`
          : `ปิดการติดตามโดย ${alert.recipientName} (ยังไม่ระบุเหตุผลเพิ่มเติม)`,
        sortAt: at.getTime() + 1,
      });
    }
  }

  // รวมส่งต่อปลายทางเดียวกันเป็นหมุดเดียว (กันเคสซ้ำจากเทส/ส่งหลายครั้ง)
  const referralByTarget = new Map<
    string,
    {
      first: ObservationRoadmapReferralInput;
      latest: ObservationRoadmapReferralInput;
      count: number;
    }
  >();
  for (const referral of input.referrals ?? []) {
    const current = referralByTarget.get(referral.targetLabel);
    if (!current) {
      referralByTarget.set(referral.targetLabel, { first: referral, latest: referral, count: 1 });
      continue;
    }
    current.count += 1;
    if (referral.createdAt.getTime() < current.first.createdAt.getTime()) {
      current.first = referral;
    }
    if (referral.createdAt.getTime() >= current.latest.createdAt.getTime()) {
      current.latest = referral;
    }
  }

  for (const [targetLabel, group] of referralByTarget) {
    const { first, latest, count } = group;
    timed.push({
      key: `referral-${first.id}`,
      label: `ส่งต่อ\n${targetLabel}`,
      at: first.createdAt.toISOString(),
      actorName: latest.advisorName,
      kind: "referred",
      detail: [
        `สถานะล่าสุด: ${latest.status}`,
        count > 1 ? `มีการส่งไปปลายทางนี้ ${count} ครั้ง (แสดงหมุดรวม)` : null,
        `เหตุผลล่าสุด: ${latest.reason}`,
      ]
        .filter(Boolean)
        .join("\n"),
      sortAt: first.createdAt.getTime(),
    });
  }

  timed.sort((left, right) => left.sortAt - right.sortAt || left.key.localeCompare(right.key));

  for (const step of timed) {
    const { sortAt: _sortAt, ...rest } = step;
    steps.push(rest);
  }

  return steps;
}
