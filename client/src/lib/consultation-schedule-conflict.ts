/** ช่วงกันชนขั้นต่ำระหว่างนัดของอาจารย์คนเดียวกัน (1 ชั่วโมง) — สอดคล้องฝั่ง server */
export const CONSULTATION_SLOT_BUFFER_MS = 60 * 60 * 1000;

export type ClientScheduleBusySlot = {
  requestId: string;
  atMs: number;
  label: string;
  scheduledAtLabel: string;
  source: "SCHEDULED" | "PENDING_OFFER";
};

export type ClientScheduleConflictResult = {
  conflict: boolean;
  message: string | null;
  conflictingSlot: ClientScheduleBusySlot | null;
};

function intervalsOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}

/** ตรวจทับช่วงนัดบน client ก่อนยิง API */
export function findClientConsultationScheduleConflict(
  proposedAt: Date | number,
  busySlots: readonly ClientScheduleBusySlot[],
  bufferMs = CONSULTATION_SLOT_BUFFER_MS
): ClientScheduleConflictResult {
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
    if (intervalsOverlap(proposedMs, proposedEnd, slot.atMs, slot.atMs + bufferMs)) {
      return {
        conflict: true,
        conflictingSlot: slot,
        message: `เวลานี้ทับกับนัดอื่น (${slot.label}) — ต้องห่างอย่างน้อย 1 ชั่วโมง หรือปิดเคสนัดก่อนหน้าก่อน`,
      };
    }
  }

  return { conflict: false, conflictingSlot: null, message: null };
}

/** สร้าง busy slots จากรายการคำขอของที่ปรึกษาสำหรับ popup เสนอนัด */
export function buildClientAdvisorBusySlots(input: {
  excludeRequestId: string;
  requests: Array<{
    id: string;
    status: string;
    scheduledAt: string | null;
    studentName: string;
    topic: string;
    latestPendingOffer?: {
      proposedAt: string;
      status: string;
      waitingOn?: string | null;
    } | null;
  }>;
  formatLabel: (iso: string) => string;
}): ClientScheduleBusySlot[] {
  const slots: ClientScheduleBusySlot[] = [];

  for (const request of input.requests) {
    if (request.id === input.excludeRequestId) {
      continue;
    }

    if (request.status === "SCHEDULED" && request.scheduledAt) {
      const atMs = Date.parse(request.scheduledAt);
      if (Number.isFinite(atMs)) {
        slots.push({
          requestId: request.id,
          atMs,
          label: `${request.studentName} · ${request.topic}`,
          scheduledAtLabel: input.formatLabel(request.scheduledAt),
          source: "SCHEDULED",
        });
      }
    }

    const pending = request.latestPendingOffer;
    if (pending && pending.status === "PENDING" && pending.proposedAt) {
      const atMs = Date.parse(pending.proposedAt);
      if (Number.isFinite(atMs)) {
        slots.push({
          requestId: request.id,
          atMs,
          label: `${request.studentName} · ${request.topic} (รอตอบ)`,
          scheduledAtLabel: input.formatLabel(pending.proposedAt),
          source: "PENDING_OFFER",
        });
      }
    }
  }

  slots.sort((left, right) => left.atMs - right.atMs);
  return slots;
}
