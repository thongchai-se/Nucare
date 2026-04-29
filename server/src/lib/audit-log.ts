import { Request } from "express";
import { prisma } from "./prisma";

type WriteAuditLogInput = {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  description: string;
  ipAddress?: string | null;
};

export const getRequestIpAddress = (req: Request): string | null => {
  return req.ip || req.socket.remoteAddress || null;
};

export const writeAuditLog = async (input: WriteAuditLogInput): Promise<void> => {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId || null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId || null,
      description: input.description,
      ipAddress: input.ipAddress || null,
    },
  });
};
