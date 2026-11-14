import { Request } from "express";
import { prisma } from "./prisma";
import {
  resolveLogRetentionCutoff,
  resolveLogRetentionDays,
} from "./log-retention";

type WriteAuditLogInput = {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  description: string;
  ipAddress?: string | null;
};

/** อ่าน IP ของผู้เรียกจาก request (รองรับ trust proxy) */
export const getRequestIpAddress = (req: Request): string | null => {
  return req.ip || req.socket.remoteAddress || null;
};

/** บันทึก audit event ระดับธุรกิจ (ไม่เก็บ password / เนื้อหาข้อความ) */
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

/** ลบ AuditLog ที่เก่าเกินระยะเก็บรักษา (ขั้นต่ำ 90 วัน) */
export const purgeExpiredAuditLogs = async (
  retentionDays = resolveLogRetentionDays("AUDIT_LOG_RETENTION_DAYS")
): Promise<number> => {
  const cutoff = resolveLogRetentionCutoff(retentionDays);
  const result = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return result.count;
};
