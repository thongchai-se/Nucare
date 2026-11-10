/** ช่วงกันชนขั้นต่ำระหว่างนัดของอาจารย์คนเดียวกัน (1 ชั่วโมง) */
export const CONSULTATION_SLOT_BUFFER_MS = 60 * 60 * 1000;

export type ScheduleBusySlot = {
  requestId: string;
  atMs: number;
  label: string;
  source: "SCHEDULED" | "PENDING_OFFER";
};

export type ScheduleConflictResult = {
  conflict: boolean;
  conflictingSlot: ScheduleBusySlot | null;
  message: string | null;
};

function intervalsOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA < endB && startB < endA;
}

/**
 * ตรวจว่าเวลาที่เสนอทับช่วงนัดอื่นของอาจารย์หรือไม่
 * แต่ละนัดกินช่วง [at, at + buffer) — ปิดเคสแล้วจะไม่อยู่ใน busySlots
 */
export function findConsultationScheduleConflict(
  proposedAt: Date | number,
  busySlots: readonly ScheduleBusySlot[],
  bufferMs = CONSULTATION_SLOT_BUFFER_MS
): ScheduleConflictResult {
  const proposedMs = typeof proposedAt === "number" ? proposedAt : proposedAt.getTime();
  if (!Number.isFinite(proposedMs)) {
    return {
      conflict: true,
      conflictingSlot: null,
      message: "รูปแบบวันเวลานัดหมายไม่ถูกต้อง",
    };
  }

  const proposedEnd = proposedMs + bufferMs;
  for (const slot of busySlots) {
    if (!Number.isFinite(slot.atMs)) {
      continue;
    }
    const slotEnd = slot.atMs + bufferMs;
    if (intervalsOverlap(proposedMs, proposedEnd, slot.atMs, slotEnd)) {
      return {
        conflict: true,
        conflictingSlot: slot,
        message: `เวลานี้ทับกับนัดอื่น (${slot.label}) — ต้องห่างอย่างน้อย 1 ชั่วโมง หรือปิดเคสนัดก่อนหน้าก่อน`,
      };
    }
  }

  return { conflict: false, conflictingSlot: null, message: null };
}

/** รวม busy slots จากนัดที่ยืนยันแล้วและข้อเสนอที่รอตอบ — ข้าม request ปัจจุบัน */
export function buildAdvisorBusySlots(input: {
  excludeRequestId: string;
  scheduled: Array<{
    id: string;
    scheduledAt: Date | string | null;
    studentName?: string | null;
    topic?: string | null;
  }>;
  pendingOffers: Array<{
    requestId: string;
    proposedAt: Date | string;
    studentName?: string | null;
    topic?: string | null;
  }>;
}): ScheduleBusySlot[] {
  const slots: ScheduleBusySlot[] = [];

  for (const item of input.scheduled) {
    if (item.id === input.excludeRequestId || !item.scheduledAt) {
      continue;
    }
    const atMs =
      typeof item.scheduledAt === "string"
        ? Date.parse(item.scheduledAt)
        : item.scheduledAt.getTime();
    if (!Number.isFinite(atMs)) {
      continue;
    }
    const who = item.studentName?.trim() || "นิสิต";
    const topic = item.topic?.trim() || "นัดปรึกษา";
    slots.push({
      requestId: item.id,
      atMs,
      label: `${who} · ${topic}`,
      source: "SCHEDULED",
    });
  }

  for (const offer of input.pendingOffers) {
    if (offer.requestId === input.excludeRequestId) {
      continue;
    }
    const atMs =
      typeof offer.proposedAt === "string"
        ? Date.parse(offer.proposedAt)
        : offer.proposedAt.getTime();
    if (!Number.isFinite(atMs)) {
      continue;
    }
    const who = offer.studentName?.trim() || "นิสิต";
    const topic = offer.topic?.trim() || "ข้อเสนอนัด";
    slots.push({
      requestId: offer.requestId,
      atMs,
      label: `${who} · ${topic} (รอตอบ)`,
      source: "PENDING_OFFER",
    });
  }

  slots.sort((left, right) => left.atMs - right.atMs);
  return slots;
}
