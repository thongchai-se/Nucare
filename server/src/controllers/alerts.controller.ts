import { AlertStatus } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { resolveAlertCloseData } from "../lib/alert-close-policy";
import { getRequestIpAddress, writeAuditLog } from "../lib/audit-log";
import { prisma } from "../lib/prisma";

const alertParamSchema = z.object({
  alertId: z.string().trim().min(1),
});

/** รายการแจ้งเตือนของผู้ใช้ที่ล็อกอิน (สูงสุด 100 รายการล่าสุด) */
export const listMyAlerts = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const alerts = await prisma.alert.findMany({
      where: {
        recipientUserId: userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    res.status(200).json({ alerts });
  } catch (error) {
    console.error("List alerts error:", error);
    res.status(500).json({ message: "Failed to list alerts" });
  }
};

const closeAlertBodySchema = z
  .object({
    resolutionNote: z.string().trim().min(1).max(2000).optional(),
    /** true = ปิดกระดิ่ง/สัญญาณอย่างเดียว ไม่ถือว่ารับเรื่องติดตาม */
    dismissOnly: z.boolean().optional(),
  })
  .strict();

/**
 * อัปเดตสถานะแจ้งเตือนของผู้รับเองเท่านั้น (กัน IDOR)
 * คืนจำนวนแถวที่อัปเดต หรือ 404 ถ้าไม่ใช่ของผู้ใช้
 */
const updateOwnAlertStatus = async (
  userId: string,
  alertId: string,
  status: AlertStatus,
  auditAction: string,
  auditDescription: string,
  ipAddress: string | null,
  extraData: {
    acknowledgedAt?: Date;
    closedAt?: Date;
    resolutionNote?: string;
  } = {}
): Promise<"ok" | "not_found"> => {
  const alert = await prisma.alert.updateMany({
    where: {
      id: alertId,
      recipientUserId: userId,
    },
    data: {
      status,
      ...(extraData.acknowledgedAt ? { acknowledgedAt: extraData.acknowledgedAt } : {}),
      ...(extraData.closedAt ? { closedAt: extraData.closedAt } : {}),
      ...(extraData.resolutionNote !== undefined ? { resolutionNote: extraData.resolutionNote } : {}),
    },
  });

  if (alert.count === 0) {
    return "not_found";
  }

  await writeAuditLog({
    actorUserId: userId,
    action: auditAction,
    entityType: "Alert",
    entityId: alertId,
    description: auditDescription,
    ipAddress,
  });

  return "ok";
};

/** รับทราบแจ้งเตือน (OPEN → ACKNOWLEDGED) สำหรับผู้รับเท่านั้น */
export const acknowledgeAlert = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsed = alertParamSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid alert id" });
    return;
  }

  try {
    const now = new Date();
    const result = await updateOwnAlertStatus(
      userId,
      parsed.data.alertId,
      AlertStatus.ACKNOWLEDGED,
      "alerts.acknowledge",
      "รับทราบการแจ้งเตือน",
      getRequestIpAddress(req),
      { acknowledgedAt: now }
    );

    if (result === "not_found") {
      res.status(404).json({ message: "Alert not found" });
      return;
    }

    res.status(200).json({ message: "รับทราบแจ้งเตือนแล้ว" });
  } catch (error) {
    console.error("Acknowledge alert error:", error);
    res.status(500).json({ message: "Failed to acknowledge alert" });
  }
};

/** ปิดแจ้งเตือนหลังติดตามเสร็จ (→ CLOSED) พร้อมเหตุผลถ้ามี */
export const closeAlert = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsed = alertParamSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid alert id" });
    return;
  }

  const parsedBody = closeAlertBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(400).json({ message: "Invalid payload", errors: parsedBody.error.flatten() });
    return;
  }

  try {
    const existing = await prisma.alert.findFirst({
      where: { id: parsed.data.alertId, recipientUserId: userId },
      select: { id: true, acknowledgedAt: true },
    });
    if (!existing) {
      res.status(404).json({ message: "Alert not found" });
      return;
    }

    const closeData = resolveAlertCloseData({
      mode: parsedBody.data.dismissOnly ? "dismiss_signal" : "follow_up",
      alreadyAcknowledged: Boolean(existing.acknowledgedAt),
      resolutionNote: parsedBody.data.resolutionNote,
      now: new Date(),
    });

    if (!closeData.allowed) {
      res.status(409).json({ message: closeData.message, code: closeData.code });
      return;
    }

    const result = await updateOwnAlertStatus(
      userId,
      parsed.data.alertId,
      AlertStatus.CLOSED,
      closeData.auditAction,
      closeData.auditDescription,
      getRequestIpAddress(req),
      {
        closedAt: closeData.closedAt,
        ...(closeData.acknowledgedAt ? { acknowledgedAt: closeData.acknowledgedAt } : {}),
        ...(closeData.resolutionNote ? { resolutionNote: closeData.resolutionNote } : {}),
      }
    );

    if (result === "not_found") {
      res.status(404).json({ message: "Alert not found" });
      return;
    }

    res.status(200).json({
      message:
        parsedBody.data.dismissOnly
          ? "ปิดการแจ้งเตือนแล้ว สัญญาณยังอยู่ในประวัตินักศึกษา"
          : "ปิดการแจ้งเตือนแล้ว",
    });
  } catch (error) {
    console.error("Close alert error:", error);
    res.status(500).json({ message: "Failed to close alert" });
  }
};
