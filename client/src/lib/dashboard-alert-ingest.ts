/**
 * ช่วยเรียง/คัด alerts ตามความเร่งด่วน
 * หมายเหตุ: ไม่ผูกกับ toast popup แล้ว — toast ใช้เฉพาะ feedback หลังกดปุ่ม
 * alerts ดูที่กระดิ่ง / สัญญาณเข้า / คิวของแต่ละ role
 */
export type IngestAlertDto = {
  id: string;
  title: string;
  message: string;
  status: "OPEN" | "ACKNOWLEDGED" | "CLOSED";
  type: string;
  createdAt: string;
};

const alertUrgencyRank = (type: string): number =>
  type === "SOS_OPENED" || type === "HIGH_RISK_SCREENING" ? 0 : 1;

/** เรียงวิกฤตก่อนแล้วตัดเหลือสูงสุด maxVisible (เก็บตัวสำคัญ ไม่ใช่อันท้ายคิว) */
export function prioritizeAndCapAlerts(
  alerts: IngestAlertDto[],
  maxVisible = 3
): IngestAlertDto[] {
  return alerts
    .slice()
    .sort((left, right) => alertUrgencyRank(left.type) - alertUrgencyRank(right.type))
    .slice(0, Math.max(0, maxVisible));
}

/** เลือกรายการแจ้งเตือนที่ควรโชว์ toast ตอน hydrate ครั้งแรก (เคารพ seen + วิกฤตก่อน) */
export function selectOpenAlertsForFirstHydrate(
  alerts: IngestAlertDto[],
  maxVisible = 3,
  seenIds: ReadonlySet<string> = new Set()
): IngestAlertDto[] {
  return selectAlertsForToast(alerts, seenIds, maxVisible);
}

/** หา alerts ใหม่ที่ยังไม่เคยเห็น — ใช้ตอน poll รอบถัดไป (ยังไม่ตัดจำนวน) */
export function selectFreshOpenAlerts(
  alerts: IngestAlertDto[],
  seenIds: ReadonlySet<string>
): IngestAlertDto[] {
  return alerts.filter((alert) => alert.status === "OPEN" && !seenIds.has(alert.id));
}

/** เลือก alerts ที่จะโชว์ toast: ยังไม่เคยเห็น + วิกฤตก่อน + จำกัดจำนวน */
export function selectAlertsForToast(
  alerts: IngestAlertDto[],
  seenIds: ReadonlySet<string>,
  maxVisible = 3
): IngestAlertDto[] {
  return prioritizeAndCapAlerts(selectFreshOpenAlerts(alerts, seenIds), maxVisible);
}
