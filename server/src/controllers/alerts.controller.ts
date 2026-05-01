import { AlertStatus } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { getRequestIpAddress, writeAuditLog } from "../lib/audit-log";
import { prisma } from "../lib/prisma";

const alertParamSchema = z.object({
  alertId: z.string().trim().min(1),
});

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
    const alert = await prisma.alert.updateMany({
      where: {
        id: parsed.data.alertId,
        recipientUserId: userId,
      },
      data: {
        status: AlertStatus.ACKNOWLEDGED,
      },
    });

    if (alert.count === 0) {
      res.status(404).json({ message: "Alert not found" });
      return;
    }

    await writeAuditLog({
      actorUserId: userId,
      action: "alerts.acknowledge",
      entityType: "Alert",
      entityId: parsed.data.alertId,
      description: "รับทราบการแจ้งเตือน",
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({ message: "รับทราบแจ้งเตือนแล้ว", count: alert.count });
  } catch (error) {
    console.error("Acknowledge alert error:", error);
    res.status(500).json({ message: "Failed to acknowledge alert" });
  }
};
