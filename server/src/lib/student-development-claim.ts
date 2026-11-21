import { ReferralStatus } from "@prisma/client";

export type WelfareClaimDecision =
  | { ok: true; alreadyOwner: boolean }
  | { ok: false; message: string };

/**
 * ตรวจว่าบุคลากรกองพัฒนารับช่วงเคสที่กำลังประสานได้หรือไม่
 * — อนุญาตเมื่อสถานะ ACCEPTED และยังไม่ใช่เจ้าของคนปัจจุบัน
 */
export function decideWelfareClaim(
  status: ReferralStatus,
  acceptedByUserId: string | null | undefined,
  actorUserId: string
): WelfareClaimDecision {
  if (status !== ReferralStatus.ACCEPTED) {
    return { ok: false, message: "รับช่วงได้เฉพาะเคสที่กำลังประสานงาน" };
  }
  if (acceptedByUserId === actorUserId) {
    return { ok: true, alreadyOwner: true };
  }
  return { ok: true, alreadyOwner: false };
}
