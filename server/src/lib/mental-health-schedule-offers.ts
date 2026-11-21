export type MentalHealthScheduleOfferDto = {
  id: string;
  referralId: string;
  proposedAt: string;
  location: string;
  note: string | null;
  status: "PENDING" | "ACCEPTED" | "SUPERSEDED" | "CANCELLED";
  createdAt: string;
  proposedById: string;
  proposedByName: string;
  proposedByRole: "MENTAL_HEALTH" | "STUDENT";
  waitingOn: "MENTAL_HEALTH" | "STUDENT" | null;
};

type MentalHealthOfferRecord = {
  id: string;
  referralId: string;
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

/** แปลงข้อเสนอนัดสุขภาพจิตเป็น DTO พร้อมระบุบทบาทผู้เสนอและฝ่ายที่ต้องตอบ */
export function mapMentalHealthScheduleOffer(
  offer: MentalHealthOfferRecord,
  studentId: string
): MentalHealthScheduleOfferDto {
  const proposedByRole = offer.proposedById === studentId ? "STUDENT" : "MENTAL_HEALTH";
  const waitingOn =
    offer.status !== "PENDING"
      ? null
      : proposedByRole === "MENTAL_HEALTH"
        ? "STUDENT"
        : "MENTAL_HEALTH";

  return {
    id: offer.id,
    referralId: offer.referralId,
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

/** เลือกข้อเสนอนัดสุขภาพจิตสถานะ PENDING ที่สร้างล่าสุดด้วยการไล่ข้อมูลครั้งเดียว */
export function pickLatestPendingMentalHealthOffer<
  T extends { status: string; createdAt: Date | string },
>(offers: readonly T[]): T | null {
  let latest: T | null = null;
  let latestTimestamp = Number.NEGATIVE_INFINITY;

  for (const offer of offers) {
    if (offer.status !== "PENDING") {
      continue;
    }
    const timestamp =
      typeof offer.createdAt === "string"
        ? Date.parse(offer.createdAt)
        : offer.createdAt.getTime();
    if (timestamp > latestTimestamp) {
      latest = offer;
      latestTimestamp = timestamp;
    }
  }

  return latest;
}

/** แปลงวันเวลาจากภายนอกและยอมรับเฉพาะเวลาปัจจุบันหรืออนาคต */
export function parseFutureMentalHealthSchedule(
  value: string,
  now = new Date()
): Date | null {
  const proposedAt = new Date(value);
  if (Number.isNaN(proposedAt.getTime()) || proposedAt.getTime() < now.getTime()) {
    return null;
  }
  return proposedAt;
}
