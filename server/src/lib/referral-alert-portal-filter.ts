import { AlertType, ReferralTarget } from "@prisma/client";
import { prisma } from "./prisma";

export type ReferralAlertPortalFields = {
  type: AlertType;
  sourceType: string | null;
  sourceId: string | null;
};

/**
 * ตัดสินว่าแจ้งเตือนควรโชว์ในพอร์ทัลปลายทางนี้หรือไม่ —
 * REFERRAL_RECEIVED ต้องชี้ CaseReferral ที่ target ตรงพอร์ทัล (กันบัญชีหลายบทบาท)
 */
export function keepAlertForReferralPortal(
  alert: ReferralAlertPortalFields,
  targetByReferralId: ReadonlyMap<string, ReferralTarget>,
  allowedTarget: ReferralTarget
): boolean {
  if (alert.type !== AlertType.REFERRAL_RECEIVED) {
    return true;
  }
  if (alert.sourceType !== "CaseReferral" || !alert.sourceId) {
    return false;
  }
  return targetByReferralId.get(alert.sourceId) === allowedTarget;
}

/** โหลด target ของ CaseReferral ตาม sourceId แล้วกรองรายการแจ้งเตือนให้เหลือเฉพาะปลายทางที่พอร์ทัลรับ */
export async function filterReferralAlertsForPortalTarget<T extends ReferralAlertPortalFields>(
  alerts: T[],
  allowedTarget: ReferralTarget
): Promise<T[]> {
  const referralIds: string[] = [];
  const seen = new Set<string>();
  for (const alert of alerts) {
    if (
      alert.type === AlertType.REFERRAL_RECEIVED &&
      alert.sourceType === "CaseReferral" &&
      alert.sourceId &&
      !seen.has(alert.sourceId)
    ) {
      seen.add(alert.sourceId);
      referralIds.push(alert.sourceId);
    }
  }

  if (referralIds.length === 0) {
    return alerts.filter((alert) => alert.type !== AlertType.REFERRAL_RECEIVED);
  }

  const rows = await prisma.caseReferral.findMany({
    where: { id: { in: referralIds } },
    select: { id: true, target: true },
  });
  const targetByReferralId = new Map(rows.map((row) => [row.id, row.target]));

  return alerts.filter((alert) =>
    keepAlertForReferralPortal(alert, targetByReferralId, allowedTarget)
  );
}
