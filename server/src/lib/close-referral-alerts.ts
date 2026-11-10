import { AlertStatus, AlertType } from "@prisma/client";
import { prisma } from "./prisma";

/** ปิดแจ้งเตือน REFERRAL_RECEIVED ของทั้งทีมเมื่อเคสถูกรับหรือปิดแล้ว */
export async function closeReferralReceivedAlerts(referralId: string): Promise<number> {
  const result = await prisma.alert.updateMany({
    where: {
      sourceType: "CaseReferral",
      sourceId: referralId,
      type: AlertType.REFERRAL_RECEIVED,
      status: { in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] },
    },
    data: {
      status: AlertStatus.CLOSED,
      closedAt: new Date(),
    },
  });
  return result.count;
}

/** กรองเงื่อนไขปิด alert สำหรับเทสหน่วย (ไม่แตะ DB) */
export function buildCloseReferralAlertWhere(referralId: string) {
  return {
    sourceType: "CaseReferral" as const,
    sourceId: referralId,
    type: AlertType.REFERRAL_RECEIVED,
    status: { in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] },
  };
}
