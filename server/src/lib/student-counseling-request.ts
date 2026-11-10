import { ReferralStatus, ReferralTarget } from "@prisma/client";
import {
  ACTIVE_REFERRAL_STATUSES,
  activeReferralConflictMessage,
} from "./active-referral";

export type StudentCounselingRequestPlan =
  | { action: "reject"; reason: "no_assigned_advisor" | "active_counseling_referral"; message: string }
  | {
      action: "create";
      advisorId: string;
      reason: string;
      isUrgent: boolean;
    };

/** วางแผนคำขอนัดผู้เชี่ยวชาญจากนิสิต — สร้าง CaseReferral ไปศูนย์ให้คำปรึกษา */
export function planStudentCounselingRequest(input: {
  assignedAdvisorId: string | null;
  hasActiveCounselingReferral: boolean;
  activeStatus?: ReferralStatus | null;
  note: string | null;
}): StudentCounselingRequestPlan {
  if (input.hasActiveCounselingReferral) {
    return {
      action: "reject",
      reason: "active_counseling_referral",
      message: activeReferralConflictMessage(
        input.activeStatus ?? ReferralStatus.PENDING,
        ReferralTarget.COUNSELING_CENTER
      ),
    };
  }
  if (!input.assignedAdvisorId) {
    return {
      action: "reject",
      reason: "no_assigned_advisor",
      message: "ยังไม่มีอาจารย์ที่ปรึกษาในระบบ กรุณาติดต่องานพัฒนานิสิตก่อนขอนัดผู้เชี่ยวชาญ",
    };
  }

  const note = input.note?.trim();
  return {
    action: "create",
    advisorId: input.assignedAdvisorId,
    reason: note
      ? `นิสิตขอนัดผู้เชี่ยวชาญสุขภาพจิต: ${note}`
      : "นิสิตขอนัดผู้เชี่ยวชาญสุขภาพจิตผ่านระบบ",
    isUrgent: false,
  };
}

export { ACTIVE_REFERRAL_STATUSES };
