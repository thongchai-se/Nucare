import {
  AlertPriority,
  AlertType,
  ConsultationOfferStatus,
  ConsultationRequestStatus,
  Role,
} from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { writeAuditLog, getRequestIpAddress } from "../lib/audit-log";
import { formatAuditMetadata } from "../lib/audit-metadata";
import {
  mapConsultationScheduleOffer,
  pickLatestPendingOffer,
} from "../lib/consultation-schedule-offers";
import {
  buildAdvisorBusySlots,
  findConsultationScheduleConflict,
} from "../lib/consultation-schedule-conflict";
import { notifyUser } from "../lib/notify-user";
import { prisma } from "../lib/prisma";
import { isAdvisorRole } from "../lib/access-control";
import { hasAssignedRole } from "../lib/roles";

/** โหลดช่วงเวลาที่อาจารย์ติดนัดแล้ว/มีข้อเสนอค้าง เพื่อกันชน 1 ชม. */
async function loadTeacherBusySlots(teacherId: string, excludeRequestId: string) {
  const [scheduled, pendingOffers] = await Promise.all([
    prisma.consultationRequest.findMany({
      where: {
        teacherId,
        status: ConsultationRequestStatus.SCHEDULED,
        scheduledAt: { not: null },
        NOT: { id: excludeRequestId },
      },
      select: {
        id: true,
        scheduledAt: true,
        topic: true,
        student: { select: { name: true } },
      },
    }),
    prisma.consultationScheduleOffer.findMany({
      where: {
        status: ConsultationOfferStatus.PENDING,
        request: {
          teacherId,
          NOT: { id: excludeRequestId },
        },
      },
      select: {
        requestId: true,
        proposedAt: true,
        request: {
          select: {
            topic: true,
            student: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  return buildAdvisorBusySlots({
    excludeRequestId,
    scheduled: scheduled.map((item) => ({
      id: item.id,
      scheduledAt: item.scheduledAt,
      studentName: item.student.name,
      topic: item.topic,
    })),
    pendingOffers: pendingOffers.map((offer) => ({
      requestId: offer.requestId,
      proposedAt: offer.proposedAt,
      studentName: offer.request.student.name,
      topic: offer.request.topic,
    })),
  });
}

const requestParamSchema = z.object({
  requestId: z.string().trim().min(1),
});

const offerParamSchema = z.object({
  requestId: z.string().trim().min(1),
  offerId: z.string().trim().min(1),
});

const createOfferSchema = z.object({
  proposedAt: z.string().trim().min(1),
  location: z.string().trim().min(1).max(200),
  note: z.string().trim().max(1200).optional(),
});

const offerSelect = {
  id: true,
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

const parseProposedAt = (value: string): Date | null => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const loadRequestForActor = async (requestId: string, actorId: string, asAdvisor: boolean) =>
  prisma.consultationRequest.findFirst({
    where: asAdvisor
      ? { id: requestId, teacherId: actorId }
      : { id: requestId, studentId: actorId },
    select: {
      id: true,
      status: true,
      studentId: true,
      teacherId: true,
      topic: true,
      student: { select: { id: true, name: true, email: true } },
      teacher: { select: { id: true, name: true, email: true } },
    },
  });

/** เสนอเวลานัด/สถานที่ — ใช้ได้ทั้งอาจารย์และนิสิต (ขอเปลี่ยน) */
export const createConsultationScheduleOffer = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const asAdvisor = isAdvisorRole(req.user?.roles ?? (req.user?.role ? [req.user.role] : []));
  const asStudent = hasAssignedRole(req.user, Role.STUDENT);
  if (!asAdvisor && !asStudent) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsedParams = requestParamSchema.safeParse(req.params);
  const parsedBody = createOfferSchema.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  const proposedAt = parseProposedAt(parsedBody.data.proposedAt);
  if (!proposedAt) {
    res.status(400).json({ message: "รูปแบบวันเวลานัดหมายไม่ถูกต้อง" });
    return;
  }

  try {
    const existing = await loadRequestForActor(parsedParams.data.requestId, userId, asAdvisor);
    if (!existing) {
      res.status(404).json({ message: "ไม่พบคำขอปรึกษา" });
      return;
    }

    if (existing.status !== ConsultationRequestStatus.ACCEPTED && existing.status !== ConsultationRequestStatus.SCHEDULED) {
      res.status(400).json({ message: "เสนอเวลานัดได้เมื่อคำขอถูกรับแล้วหรือกำลังนัดหมาย" });
      return;
    }

    if (asStudent && existing.status === ConsultationRequestStatus.SCHEDULED) {
      // นิสิตขอเปลี่ยนหลังนัดแล้ว — กลับไปสถานะ ACCEPTED ระหว่างเจรจา
    }

    const busySlots = await loadTeacherBusySlots(existing.teacherId, existing.id);
    const conflict = findConsultationScheduleConflict(proposedAt, busySlots);
    if (conflict.conflict) {
      res.status(409).json({ message: conflict.message ?? "เวลานัดทับกับนัดอื่น" });
      return;
    }

    const offer = await prisma.$transaction(async (tx) => {
      await tx.consultationScheduleOffer.updateMany({
        where: {
          requestId: existing.id,
          status: ConsultationOfferStatus.PENDING,
        },
        data: {
          status: ConsultationOfferStatus.SUPERSEDED,
        },
      });

      const created = await tx.consultationScheduleOffer.create({
        data: {
          requestId: existing.id,
          proposedById: userId,
          proposedAt,
          location: parsedBody.data.location.trim(),
          note: parsedBody.data.note?.trim() || null,
          status: ConsultationOfferStatus.PENDING,
        },
        select: offerSelect,
      });

      if (existing.status === ConsultationRequestStatus.SCHEDULED) {
        await tx.consultationRequest.update({
          where: { id: existing.id },
          data: {
            status: ConsultationRequestStatus.ACCEPTED,
            scheduledAt: null,
            scheduleLocation: null,
          },
        });
      }

      return created;
    });

    const counterpart = asAdvisor ? existing.student : existing.teacher;
    await notifyUser({
      recipientUserId: counterpart.id,
      recipientEmail: counterpart.email,
      channels: { inApp: true, email: Boolean(counterpart.email) },
      alert: {
        actorUserId: userId,
        studentId: existing.studentId,
        type: AlertType.ADVISOR_FOLLOW_UP,
        priority: AlertPriority.MEDIUM,
        title: asAdvisor ? "มีข้อเสนอนัดปรึกษา" : "นิสิตขอเปลี่ยนวัน/สถานที่นัด",
        message: `${existing.topic} · ${proposedAt.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })} · ${parsedBody.data.location}`,
        sourceType: "ConsultationRequest",
        sourceId: existing.id,
      },
      email: {
        subject: asAdvisor ? "NuCare: มีข้อเสนอนัดปรึกษา" : "NuCare: นิสิตขอเปลี่ยนนัดปรึกษา",
        text: `มีข้อเสนอเวลา/สถานที่สำหรับคำขอ "${existing.topic}"\nวันเวลา: ${proposedAt.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}\nสถานที่/ช่องทาง: ${parsedBody.data.location}\n\nเข้าสู่ระบบเพื่อตอบรับหรือขอเปลี่ยน`,
      },
    });

    await writeAuditLog({
      actorUserId: userId,
      action: "consultation.schedule-offer.create",
      entityType: "ConsultationScheduleOffer",
      entityId: offer.id,
      description: formatAuditMetadata({
        op: "propose",
        actorRole: asAdvisor ? "advisor" : "student",
      }),
      ipAddress: getRequestIpAddress(req),
    });

    res.status(201).json({
      message: "ส่งข้อเสนอนัดหมายแล้ว รออีกฝ่ายตอบกลับ",
      offer: mapConsultationScheduleOffer(offer, existing.studentId, existing.teacherId),
    });
  } catch (error) {
    console.error("Create consultation schedule offer error:", error);
    res.status(500).json({ message: "Failed to create schedule offer" });
  }
};

/** ยอมรับข้อเสนอนัด — ยืนยันนัดหมายทั้งสองฝ่าย */
export const acceptConsultationScheduleOffer = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const asAdvisor = isAdvisorRole(req.user?.roles ?? (req.user?.role ? [req.user.role] : []));
  const asStudent = hasAssignedRole(req.user, Role.STUDENT);
  if (!asAdvisor && !asStudent) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsedParams = offerParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  try {
    const existing = await loadRequestForActor(parsedParams.data.requestId, userId, asAdvisor);
    if (!existing) {
      res.status(404).json({ message: "ไม่พบคำขอปรึกษา" });
      return;
    }

    const offer = await prisma.consultationScheduleOffer.findFirst({
      where: {
        id: parsedParams.data.offerId,
        requestId: existing.id,
        status: ConsultationOfferStatus.PENDING,
      },
      select: offerSelect,
    });

    if (!offer) {
      res.status(404).json({ message: "ไม่พบข้อเสนอนัดที่รอตอบ" });
      return;
    }

    if (offer.proposedById === userId) {
      res.status(400).json({ message: "ไม่สามารถยอมรับข้อเสนอของตนเองได้ รออีกฝ่ายตอบกลับ" });
      return;
    }

    const busySlots = await loadTeacherBusySlots(existing.teacherId, existing.id);
    const conflict = findConsultationScheduleConflict(offer.proposedAt, busySlots);
    if (conflict.conflict) {
      res.status(409).json({ message: conflict.message ?? "เวลานัดทับกับนัดอื่น" });
      return;
    }

    const updatedRequest = await prisma.$transaction(async (tx) => {
      await tx.consultationScheduleOffer.update({
        where: { id: offer.id },
        data: { status: ConsultationOfferStatus.ACCEPTED },
      });
      await tx.consultationScheduleOffer.updateMany({
        where: {
          requestId: existing.id,
          status: ConsultationOfferStatus.PENDING,
          id: { not: offer.id },
        },
        data: { status: ConsultationOfferStatus.SUPERSEDED },
      });

      return tx.consultationRequest.update({
        where: { id: existing.id },
        data: {
          status: ConsultationRequestStatus.SCHEDULED,
          scheduledAt: offer.proposedAt,
          scheduleLocation: offer.location,
          acceptedAt: existing.status === ConsultationRequestStatus.PENDING ? new Date() : undefined,
        },
        select: {
          id: true,
          status: true,
          scheduledAt: true,
          scheduleLocation: true,
        },
      });
    });

    const counterpart = asAdvisor ? existing.student : existing.teacher;
    await notifyUser({
      recipientUserId: counterpart.id,
      recipientEmail: counterpart.email,
      channels: { inApp: true, email: Boolean(counterpart.email) },
      alert: {
        actorUserId: userId,
        studentId: existing.studentId,
        type: AlertType.ADVISOR_FOLLOW_UP,
        priority: AlertPriority.MEDIUM,
        title: "ยืนยันนัดปรึกษาแล้ว",
        message: `${existing.topic} · ${offer.proposedAt.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })} · ${offer.location}`,
        sourceType: "ConsultationRequest",
        sourceId: existing.id,
      },
      email: {
        subject: "NuCare: ยืนยันนัดปรึกษาแล้ว",
        text: `นัดปรึกษาสำหรับ "${existing.topic}" ได้รับการยืนยันแล้ว\nวันเวลา: ${offer.proposedAt.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}\nสถานที่/ช่องทาง: ${offer.location}`,
      },
    });

    await writeAuditLog({
      actorUserId: userId,
      action: "consultation.schedule-offer.accept",
      entityType: "ConsultationScheduleOffer",
      entityId: offer.id,
      description: formatAuditMetadata({ op: "confirm" }),
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({
      message: "ยืนยันนัดหมายเรียบร้อยแล้ว",
      request: updatedRequest,
      offer: mapConsultationScheduleOffer(
        { ...offer, status: ConsultationOfferStatus.ACCEPTED },
        existing.studentId,
        existing.teacherId
      ),
    });
  } catch (error) {
    console.error("Accept consultation schedule offer error:", error);
    res.status(500).json({ message: "Failed to accept schedule offer" });
  }
};

export { pickLatestPendingOffer, mapConsultationScheduleOffer, offerSelect };
