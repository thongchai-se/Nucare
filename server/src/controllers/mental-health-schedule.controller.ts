import {
  AlertPriority,
  AlertType,
  ConsultationOfferStatus,
  MentalHealthAppointmentStatus,
  ReferralStatus,
  ReferralTarget,
  Role,
} from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { getRequestIpAddress, writeAuditLog } from "../lib/audit-log";
import { formatAuditMetadata } from "../lib/audit-metadata";
import { serializeMentalHealthAppointment } from "../lib/mental-health-appointments";
import {
  mapMentalHealthScheduleOffer,
  parseFutureMentalHealthSchedule,
} from "../lib/mental-health-schedule-offers";
import { notifyUser } from "../lib/notify-user";
import { prisma } from "../lib/prisma";
import { hasAssignedRole } from "../lib/roles";

const referralParamSchema = z
  .object({
    referralId: z.string().trim().min(1),
  })
  .strict();

const offerParamSchema = z
  .object({
    referralId: z.string().trim().min(1),
    offerId: z.string().trim().min(1),
  })
  .strict();

const createOfferSchema = z
  .object({
    proposedAt: z.string().trim().min(1),
    location: z.string().trim().min(1).max(200),
    note: z.string().trim().max(1200).optional(),
  })
  .strict();

const mentalHealthOfferSelect = {
  id: true,
  referralId: true,
  proposedAt: true,
  location: true,
  note: true,
  status: true,
  createdAt: true,
  proposedById: true,
  proposedBy: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

type ScheduleActor = "MENTAL_HEALTH" | "STUDENT";

class ScheduleOfferConflictError extends Error {}
class ScheduleReferralConflictError extends Error {}

const loadReferralForActor = (
  referralId: string,
  actorId: string,
  actor: ScheduleActor
) =>
  prisma.caseReferral.findFirst({
    where: {
      id: referralId,
      target: ReferralTarget.COUNSELING_CENTER,
      status: ReferralStatus.ACCEPTED,
      ...(actor === "MENTAL_HEALTH"
        ? { acceptedByUserId: actorId }
        : { studentId: actorId }),
    },
    select: {
      id: true,
      studentId: true,
      acceptedByUserId: true,
      student: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      acceptedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

const formatSchedule = (date: Date): string =>
  date.toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });

const createOfferForActor = async (
  req: Request,
  res: Response,
  actor: ScheduleActor
): Promise<void> => {
  const actorId = req.user?.userId;
  if (!actorId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsedParams = referralParamSchema.safeParse(req.params);
  const parsedBody = createOfferSchema.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  const proposedAt = parseFutureMentalHealthSchedule(parsedBody.data.proposedAt);
  if (!proposedAt) {
    res.status(400).json({ message: "วันเวลานัดหมายต้องเป็นเวลาปัจจุบันหรืออนาคต" });
    return;
  }

  try {
    const referral = await loadReferralForActor(
      parsedParams.data.referralId,
      actorId,
      actor
    );
    if (!referral) {
      res.status(404).json({ message: "ไม่พบเคสที่รับแล้วหรือไม่มีสิทธิ์จัดการเคสนี้" });
      return;
    }
    if (!referral.acceptedBy) {
      res.status(409).json({ message: "เคสนี้ยังไม่มีผู้เชี่ยวชาญเจ้าของเคส" });
      return;
    }
    const expert = referral.acceptedBy;

    const offer = await prisma.$transaction(async (tx) => {
      const stillAccepted = await tx.caseReferral.updateMany({
        where: {
          id: referral.id,
          target: ReferralTarget.COUNSELING_CENTER,
          status: ReferralStatus.ACCEPTED,
          acceptedByUserId: expert.id,
          ...(actor === "STUDENT" ? { studentId: actorId } : {}),
        },
        data: {
          updatedAt: new Date(),
        },
      });
      if (stillAccepted.count === 0) {
        throw new ScheduleReferralConflictError();
      }

      await tx.mentalHealthScheduleOffer.updateMany({
        where: {
          referralId: referral.id,
          status: ConsultationOfferStatus.PENDING,
        },
        data: {
          status: ConsultationOfferStatus.SUPERSEDED,
        },
      });

      return tx.mentalHealthScheduleOffer.create({
        data: {
          referralId: referral.id,
          proposedById: actorId,
          proposedAt,
          location: parsedBody.data.location,
          note: parsedBody.data.note?.trim() || null,
          status: ConsultationOfferStatus.PENDING,
        },
        select: mentalHealthOfferSelect,
      });
    });

    const counterpart =
      actor === "MENTAL_HEALTH" ? referral.student : expert;
    await notifyUser({
      recipientUserId: counterpart.id,
      recipientEmail: counterpart.email,
      channels: { inApp: true, email: Boolean(counterpart.email) },
      alert: {
        actorUserId: actorId,
        studentId: referral.studentId,
        type: AlertType.ADVISOR_FOLLOW_UP,
        priority: AlertPriority.MEDIUM,
        title:
          actor === "MENTAL_HEALTH"
            ? "มีข้อเสนอนัดหมายจากทีมสุขภาพจิต"
            : "นิสิตส่งข้อเสนอเวลานัดหมายใหม่",
        message: `${formatSchedule(proposedAt)} · ${parsedBody.data.location}`,
        sourceType: "MentalHealthScheduleOffer",
        sourceId: offer.id,
      },
      email: {
        subject:
          actor === "MENTAL_HEALTH"
            ? "NuCare: มีข้อเสนอนัดหมายจากทีมสุขภาพจิต"
            : "NuCare: นิสิตส่งข้อเสนอเวลานัดหมายใหม่",
        text: `วันเวลา: ${formatSchedule(proposedAt)}\nสถานที่: ${parsedBody.data.location}\n\nเข้าสู่ระบบเพื่อตอบรับหรือเสนอเวลาใหม่`,
      },
    });

    await writeAuditLog({
      actorUserId: actorId,
      action: "mental-health.schedule-offer.create",
      entityType: "MentalHealthScheduleOffer",
      entityId: offer.id,
      description: formatAuditMetadata({
        op: "propose",
        actorRole: actor === "MENTAL_HEALTH" ? "mental_health" : "student",
        referralId: referral.id,
      }),
      ipAddress: getRequestIpAddress(req),
    });

    res.status(201).json({
      message: "ส่งข้อเสนอนัดหมายแล้ว รออีกฝ่ายตอบกลับ",
      offer: mapMentalHealthScheduleOffer(offer, referral.studentId),
    });
  } catch (error) {
    if (error instanceof ScheduleReferralConflictError) {
      res.status(409).json({ message: "สถานะหรือเจ้าของเคสเปลี่ยนไปแล้ว กรุณารีเฟรชข้อมูล" });
      return;
    }
    console.error("Create mental health schedule offer error:", error);
    res.status(500).json({ message: "สร้างข้อเสนอนัดหมายไม่สำเร็จ" });
  }
};

const acceptOfferForActor = async (
  req: Request,
  res: Response,
  actor: ScheduleActor
): Promise<void> => {
  const actorId = req.user?.userId;
  if (!actorId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsedParams = offerParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  try {
    const referral = await loadReferralForActor(
      parsedParams.data.referralId,
      actorId,
      actor
    );
    if (!referral) {
      res.status(404).json({ message: "ไม่พบเคสที่รับแล้วหรือไม่มีสิทธิ์จัดการเคสนี้" });
      return;
    }
    if (!referral.acceptedBy) {
      res.status(409).json({ message: "เคสนี้ยังไม่มีผู้เชี่ยวชาญเจ้าของเคส" });
      return;
    }
    const expert = referral.acceptedBy;

    const offer = await prisma.mentalHealthScheduleOffer.findFirst({
      where: {
        id: parsedParams.data.offerId,
        referralId: referral.id,
        status: ConsultationOfferStatus.PENDING,
      },
      select: mentalHealthOfferSelect,
    });
    if (!offer) {
      res.status(404).json({ message: "ไม่พบข้อเสนอนัดหมายที่รอตอบ" });
      return;
    }
    if (offer.proposedById === actorId) {
      res.status(400).json({ message: "ไม่สามารถยอมรับข้อเสนอของตนเองได้" });
      return;
    }
    if (!parseFutureMentalHealthSchedule(offer.proposedAt.toISOString())) {
      res.status(400).json({ message: "ข้อเสนอนี้เลยเวลานัดหมายแล้ว กรุณาเสนอเวลาใหม่" });
      return;
    }

    const appointment = await prisma.$transaction(async (tx) => {
      const stillAccepted = await tx.caseReferral.updateMany({
        where: {
          id: referral.id,
          target: ReferralTarget.COUNSELING_CENTER,
          status: ReferralStatus.ACCEPTED,
          acceptedByUserId: expert.id,
          ...(actor === "STUDENT" ? { studentId: actorId } : {}),
        },
        data: {
          updatedAt: new Date(),
        },
      });
      if (stillAccepted.count === 0) {
        throw new ScheduleReferralConflictError();
      }

      const accepted = await tx.mentalHealthScheduleOffer.updateMany({
        where: {
          id: offer.id,
          referralId: referral.id,
          status: ConsultationOfferStatus.PENDING,
        },
        data: {
          status: ConsultationOfferStatus.ACCEPTED,
        },
      });
      if (accepted.count === 0) {
        throw new ScheduleOfferConflictError();
      }

      await tx.mentalHealthScheduleOffer.updateMany({
        where: {
          referralId: referral.id,
          status: ConsultationOfferStatus.PENDING,
          id: { not: offer.id },
        },
        data: {
          status: ConsultationOfferStatus.SUPERSEDED,
        },
      });

      return tx.mentalHealthAppointment.create({
        data: {
          studentId: referral.studentId,
          mentalHealthUserId: expert.id,
          referralId: referral.id,
          scheduledAt: offer.proposedAt,
          location: offer.location,
          note: offer.note,
          status: MentalHealthAppointmentStatus.SCHEDULED,
        },
        include: {
          student: {
            select: {
              name: true,
            },
          },
          mentalHealthUser: {
            select: {
              name: true,
            },
          },
        },
      });
    });

    const counterpart =
      actor === "MENTAL_HEALTH" ? referral.student : expert;
    await notifyUser({
      recipientUserId: counterpart.id,
      recipientEmail: counterpart.email,
      channels: { inApp: true, email: Boolean(counterpart.email) },
      alert: {
        actorUserId: actorId,
        studentId: referral.studentId,
        type: AlertType.ADVISOR_FOLLOW_UP,
        priority: AlertPriority.MEDIUM,
        title: "ยืนยันนัดหมายกับทีมสุขภาพจิตแล้ว",
        message: `${formatSchedule(offer.proposedAt)} · ${offer.location}`,
        sourceType: "MentalHealthAppointment",
        sourceId: appointment.id,
      },
      email: {
        subject: "NuCare: ยืนยันนัดหมายกับทีมสุขภาพจิตแล้ว",
        text: `ยืนยันนัดหมายเรียบร้อยแล้ว\nวันเวลา: ${formatSchedule(offer.proposedAt)}\nสถานที่: ${offer.location}`,
      },
    });

    await writeAuditLog({
      actorUserId: actorId,
      action: "mental-health.schedule-offer.accept",
      entityType: "MentalHealthScheduleOffer",
      entityId: offer.id,
      description: formatAuditMetadata({
        op: "accept",
        actorRole: actor === "MENTAL_HEALTH" ? "mental_health" : "student",
        appointmentId: appointment.id,
      }),
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({
      message: "ยืนยันนัดหมายเรียบร้อยแล้ว",
      offer: mapMentalHealthScheduleOffer(
        { ...offer, status: ConsultationOfferStatus.ACCEPTED },
        referral.studentId
      ),
      appointment: serializeMentalHealthAppointment(appointment),
    });
  } catch (error) {
    if (error instanceof ScheduleOfferConflictError) {
      res.status(409).json({ message: "ข้อเสนอนี้ได้รับการตอบแล้ว กรุณารีเฟรชข้อมูล" });
      return;
    }
    if (error instanceof ScheduleReferralConflictError) {
      res.status(409).json({ message: "สถานะหรือเจ้าของเคสเปลี่ยนไปแล้ว กรุณารีเฟรชข้อมูล" });
      return;
    }
    console.error("Accept mental health schedule offer error:", error);
    res.status(500).json({ message: "ยืนยันข้อเสนอนัดหมายไม่สำเร็จ" });
  }
};

/** ผู้เชี่ยวชาญเสนอวันเวลาและสถานที่ให้เจ้าของเคสที่รับแล้ว */
export const createMentalHealthScheduleOffer = async (
  req: Request,
  res: Response
): Promise<void> => {
  if (!hasAssignedRole(req.user, Role.MENTAL_HEALTH)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  await createOfferForActor(req, res, "MENTAL_HEALTH");
};

/** ผู้เชี่ยวชาญยอมรับข้อเสนอแก้ไขจากนิสิตแล้วสร้างนัดหมายจริง */
export const acceptStudentMentalHealthScheduleOffer = async (
  req: Request,
  res: Response
): Promise<void> => {
  if (!hasAssignedRole(req.user, Role.MENTAL_HEALTH)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  await acceptOfferForActor(req, res, "MENTAL_HEALTH");
};

/** นิสิตเสนอวันเวลาใหม่ให้ผู้เชี่ยวชาญเจ้าของเคส */
export const createStudentMentalHealthScheduleOffer = async (
  req: Request,
  res: Response
): Promise<void> => {
  if (!hasAssignedRole(req.user, Role.STUDENT)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  await createOfferForActor(req, res, "STUDENT");
};

/** นิสิตยอมรับข้อเสนอจากผู้เชี่ยวชาญแล้วสร้างนัดหมายจริง */
export const acceptMentalHealthScheduleOffer = async (
  req: Request,
  res: Response
): Promise<void> => {
  if (!hasAssignedRole(req.user, Role.STUDENT)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  await acceptOfferForActor(req, res, "STUDENT");
};

