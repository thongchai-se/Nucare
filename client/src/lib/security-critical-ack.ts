import {
  SECURITY_CRITICAL_ACK_STORAGE_KEY,
  SECURITY_CRITICAL_WINDOW_MS,
  isCriticalSecurityRedFlag,
} from "./security-red-flag";

type CriticalCandidate = {
  action: string;
  createdAt: string;
};

/** ตัดสินว่าควรโชว์ popup วิกฤตหรือไม่จากรายการ audit + ค่า ack ใน storage */
export function shouldShowCriticalSecurityPopup(input: {
  logs: CriticalCandidate[];
  ackTimestampMs: number | null;
  nowMs?: number;
}): { show: boolean; latestCreatedAtMs: number | null } {
  const now = input.nowMs ?? Date.now();
  const cutoff = now - SECURITY_CRITICAL_WINDOW_MS;
  const latest = input.logs.find(
    (log) =>
      isCriticalSecurityRedFlag(log.action) &&
      new Date(log.createdAt).getTime() >= cutoff
  );

  if (!latest) {
    return { show: false, latestCreatedAtMs: null };
  }

  const eventAt = new Date(latest.createdAt).getTime();
  if (input.ackTimestampMs != null && input.ackTimestampMs >= eventAt) {
    return { show: false, latestCreatedAtMs: eventAt };
  }

  return { show: true, latestCreatedAtMs: eventAt };
}

export { SECURITY_CRITICAL_ACK_STORAGE_KEY };
