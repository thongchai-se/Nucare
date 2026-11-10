const RISK_LABEL: Record<string, string> = {
  high: "เสี่ยงสูง",
  medium: "เสี่ยงปานกลาง",
  normal: "ปกติ",
  HIGH: "เสี่ยงสูง",
  MEDIUM: "เสี่ยงปานกลาง",
  NORMAL: "ปกติ",
  LOW: "ต่ำ",
};

/** แปลสถานะดิบ/อังกฤษ → ไทยก่อนแสดง */
const STATUS_LABEL: Record<string, string> = {
  PENDING: "รอรับ",
  ACCEPTED: "รับแล้ว",
  SCHEDULED: "นัดหมายแล้ว",
  CANCEL_REQUESTED: "นศขอยกเลิก",
  CLOSED: "ปิดแล้ว",
  CANCELLED: "ยกเลิก",
  OPEN: "เปิด",
  ACKNOWLEDGED: "รับเรื่องแล้ว",
  IN_PROGRESS: "กำลังดูแล",
  RESOLVED: "ปิดแล้ว",
  COMPLETED: "พบแล้ว",
  NO_SHOW: "ไม่มาตามนัด",
  SUPERSEDED: "ถูกแทนที่",
  รอรับคำขอ: "รอรับคำขอ",
  รับคำขอแล้ว: "รับคำขอแล้ว",
  นัดหมายแล้ว: "นัดหมายแล้ว",
  นศขอยกเลิก: "นศขอยกเลิก",
  ปิดเคสแล้ว: "ปิดเคสแล้ว",
  ยกเลิก: "ยกเลิก",
  รอผู้เชี่ยวชาญรับเคส: "รอผู้เชี่ยวชาญรับเคส",
  กำลังดูแล: "กำลังดูแล",
  เสี่ยงสูง: "เสี่ยงสูง",
  เสี่ยงปานกลาง: "เสี่ยงปานกลาง",
  ปกติ: "ปกติ",
};

const DONE_LABELS = new Set([
  "ปิดแล้ว",
  "ปิดเคสแล้ว",
  "พบแล้ว",
  "ยกเลิก",
  "ไม่มาตามนัด",
  "แก้ไขแล้ว",
  "ถูกแทนที่",
]);
const OPEN_LABELS = new Set([
  "รอรับ",
  "รอรับเรื่อง",
  "รอรับคำขอ",
  "รับแล้ว",
  "รับคำขอแล้ว",
  "นัดหมายแล้ว",
  "กำลังดูแล",
  "เปิด",
  "รับเรื่องแล้ว",
  "นศขอยกเลิก",
  "รอผู้เชี่ยวชาญรับเคส",
]);

export type ActivityStatusPresentation = {
  label: string;
  tone: "done" | "open" | "risk-high" | "risk-medium" | "risk-normal" | "neutral";
};

function localizeStatus(status: string): string {
  return STATUS_LABEL[status] ?? STATUS_LABEL[status.toUpperCase()] ?? "ไม่ทราบสถานะ";
}

/** แปลงสถานะกิจกรรมไทม์ไลน์ให้เป็นป้ายอ่านง่าย — ไม่โชว์ enum อังกฤษ */
export function presentActivityStatus(
  kind: string,
  status: string | null
): ActivityStatusPresentation | null {
  if (!status) {
    return null;
  }

  if (kind === "ASSESSMENT") {
    const riskKey = status.toLowerCase();
    const riskLabel = RISK_LABEL[status] ?? RISK_LABEL[riskKey] ?? (status.startsWith("เสี่ยง") || status === "ปกติ" ? status : null);
    if (riskLabel) {
      if (riskKey === "high" || riskLabel === "เสี่ยงสูง") {
        return { label: riskLabel, tone: "risk-high" };
      }
      if (riskKey === "medium" || riskLabel === "เสี่ยงปานกลาง") {
        return { label: riskLabel, tone: "risk-medium" };
      }
      return { label: riskLabel, tone: "risk-normal" };
    }
  }

  const label = localizeStatus(status);
  if (DONE_LABELS.has(label)) {
    return { label, tone: "done" };
  }
  if (OPEN_LABELS.has(label)) {
    return { label, tone: "open" };
  }

  // ค่าไทยที่รู้จักแล้วแต่ไม่อยู่ในชุด open/done
  if (STATUS_LABEL[status] || STATUS_LABEL[status.toUpperCase()]) {
    return { label, tone: "neutral" };
  }

  return { label: "ไม่ทราบสถานะ", tone: "neutral" };
}

export const activityStatusBadgeClass: Record<ActivityStatusPresentation["tone"], string> = {
  done: "bg-slate-200 text-slate-800",
  open: "bg-amber-100 text-amber-950",
  "risk-high": "bg-rose-100 text-rose-900",
  "risk-medium": "bg-amber-100 text-amber-950",
  "risk-normal": "bg-emerald-100 text-emerald-900",
  neutral: "bg-slate-100 text-slate-700",
};
