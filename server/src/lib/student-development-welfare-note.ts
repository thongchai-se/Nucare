import { ReferralStatus } from "@prisma/client";

/** ปิดเคสสวัสดิการควรมีเหตุผลสั้น ๆ เพื่อติดตามผล */
export function shouldRequireClosedReason(
  nextStatus: ReferralStatus,
  closedReason: string | undefined
): boolean {
  if (nextStatus !== ReferralStatus.CLOSED) {
    return false;
  }
  return !closedReason || closedReason.trim().length === 0;
}
