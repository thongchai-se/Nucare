/**
 * นโยบายปิดแจ้งเตือน — แยก "ปิดสัญญาณ/ปิดกระดิ่ง" ออกจาก "ปิดเรื่องหลังรับติดตาม"
 */

import { formatAuditMetadata } from "./audit-metadata";

export type AlertCloseMode = "follow_up" | "dismiss_signal";

export type AlertClosePolicyInput = {
  mode: AlertCloseMode;
  alreadyAcknowledged: boolean;
  resolutionNote?: string;
  now: Date;
};

export type AlertClosePolicyAllowed = {
  allowed: true;
  closedAt: Date;
  acknowledgedAt?: Date;
  resolutionNote?: string;
  auditAction: "alerts.close" | "alerts.dismiss";
  auditDescription: string;
};

export type AlertClosePolicyDenied = {
  allowed: false;
  code: "MUST_ACKNOWLEDGE";
  message: string;
};

export type AlertClosePolicyResult = AlertClosePolicyAllowed | AlertClosePolicyDenied;

/** คำนวณฟิลด์อัปเดตตอนปิดแจ้งเตือน — follow_up ต้องรับเรื่องก่อน; dismiss ไม่ตั้งรับเรื่อง */
export function resolveAlertCloseData(input: AlertClosePolicyInput): AlertClosePolicyResult {
  const note = input.resolutionNote?.trim() || undefined;

  if (input.mode === "dismiss_signal") {
    return {
      allowed: true,
      closedAt: input.now,
      ...(note ? { resolutionNote: note } : {}),
      auditAction: "alerts.dismiss",
      auditDescription: formatAuditMetadata({
        mode: "dismiss_signal",
        hasNote: Boolean(note),
      }),
    };
  }

  if (!input.alreadyAcknowledged) {
    return {
      allowed: false,
      code: "MUST_ACKNOWLEDGE",
      message: "ต้องกดรับเรื่องก่อนจึงจะบันทึกและปิดเคสได้",
    };
  }

  return {
    allowed: true,
    closedAt: input.now,
    ...(note ? { resolutionNote: note } : {}),
    auditAction: "alerts.close",
    auditDescription: formatAuditMetadata({
      mode: "follow_up",
      hasNote: Boolean(note),
    }),
  };
}
