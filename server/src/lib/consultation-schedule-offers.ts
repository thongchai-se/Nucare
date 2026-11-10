export type ConsultationScheduleOfferDto = {
  id: string;
  proposedAt: string;
  location: string;
  note: string | null;
  status: "PENDING" | "ACCEPTED" | "SUPERSEDED" | "CANCELLED";
  createdAt: string;
  proposedById: string;
  proposedByName: string;
  proposedByRole: "ADVISOR" | "STUDENT";
  waitingOn: "ADVISOR" | "STUDENT" | null;
};

type OfferRecord = {
  id: string;
  proposedAt: Date;
  location: string;
  note: string | null;
  status: "PENDING" | "ACCEPTED" | "SUPERSEDED" | "CANCELLED";
  createdAt: Date;
  proposedById: string;
  proposedBy: {
    id: string;
    name: string;
  };
};

/** แปลงข้อเสนอนัดเป็น DTO พร้อมระบุว่าใครต้องตอบ */
export function mapConsultationScheduleOffer(
  offer: OfferRecord,
  studentId: string,
  teacherId: string
): ConsultationScheduleOfferDto {
  const proposedByRole = offer.proposedById === teacherId ? "ADVISOR" : "STUDENT";
  const waitingOn =
    offer.status !== "PENDING"
      ? null
      : proposedByRole === "ADVISOR"
        ? "STUDENT"
        : offer.proposedById === studentId
          ? "ADVISOR"
          : "STUDENT";

  return {
    id: offer.id,
    proposedAt: offer.proposedAt.toISOString(),
    location: offer.location,
    note: offer.note,
    status: offer.status,
    createdAt: offer.createdAt.toISOString(),
    proposedById: offer.proposedById,
    proposedByName: offer.proposedBy.name,
    proposedByRole,
    waitingOn,
  };
}

/** เลือกข้อเสนอที่ยังรอตอบล่าสุด */
export function pickLatestPendingOffer<T extends { status: string; createdAt: Date | string }>(
  offers: readonly T[]
): T | null {
  const pending = offers.filter((offer) => offer.status === "PENDING");
  if (pending.length === 0) {
    return null;
  }
  return [...pending].sort((left, right) => {
    const leftAt = typeof left.createdAt === "string" ? Date.parse(left.createdAt) : left.createdAt.getTime();
    const rightAt = typeof right.createdAt === "string" ? Date.parse(right.createdAt) : right.createdAt.getTime();
    return rightAt - leftAt;
  })[0] ?? null;
}
