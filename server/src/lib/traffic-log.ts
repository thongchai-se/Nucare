import type { Request, Response } from "express";
import { prisma } from "./prisma";
import { getRequestIpAddress } from "./audit-log";
import {
  resolveLogRetentionCutoff,
  resolveLogRetentionDays,
} from "./log-retention";

const USER_AGENT_MAX_LENGTH = 300;
const PATH_MAX_LENGTH = 500;

const SKIP_TRAFFIC_LOG_PATHS = new Set(["/api/health", "/"]);

type WriteTrafficLogInput = {
  method: string;
  path: string;
  statusCode: number;
  durationMs?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  actorUserId?: string | null;
  protocol?: string | null;
};

/** ตัด query string และจำกัดความยาว path สำหรับ traffic log */
export const sanitizeTrafficPath = (rawPath: string): string => {
  const withoutQuery = rawPath.split("?")[0] || "/";
  const normalized = withoutQuery.replace(/\/{2,}/g, "/");
  if (normalized.length <= PATH_MAX_LENGTH) {
    return normalized || "/";
  }
  return `${normalized.slice(0, PATH_MAX_LENGTH - 1)}…`;
};

/** ตัด User-Agent ให้สั้นพอสำหรับเก็บเป็น traffic metadata */
export const sanitizeUserAgent = (raw: string | undefined): string | null => {
  const value = raw?.trim();
  if (!value) {
    return null;
  }
  if (value.length <= USER_AGENT_MAX_LENGTH) {
    return value;
  }
  return `${value.slice(0, USER_AGENT_MAX_LENGTH - 1)}…`;
};

type TrafficLogDelegate = {
  create: (args: {
    data: {
      method: string;
      path: string;
      statusCode: number;
      durationMs: number | null;
      ipAddress: string | null;
      userAgent: string | null;
      actorUserId: string | null;
      protocol: string | null;
    };
  }) => Promise<unknown>;
  deleteMany: (args: { where: { createdAt: { lt: Date } } }) => Promise<{ count: number }>;
};

const getTrafficLogDelegate = (): TrafficLogDelegate | null => {
  const delegate = (prisma as unknown as { trafficLog?: TrafficLogDelegate }).trafficLog;
  return delegate || null;
};

/** เขียน traffic log หนึ่งแถว — ไม่ throw ออกนอกเพื่อไม่กระทบ response */
export const writeTrafficLog = async (input: WriteTrafficLogInput): Promise<void> => {
  try {
    const trafficLog = getTrafficLogDelegate();
    if (!trafficLog) {
      console.error("[traffic-log] Prisma client missing TrafficLog — run prisma generate");
      return;
    }

    await trafficLog.create({
      data: {
        method: input.method.toUpperCase().slice(0, 16),
        path: sanitizeTrafficPath(input.path),
        statusCode: input.statusCode,
        durationMs: input.durationMs ?? null,
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
        actorUserId: input.actorUserId || null,
        protocol: input.protocol || null,
      },
    });
  } catch (error) {
    console.error("[traffic-log] write failed:", error);
  }
};

/** ลบ TrafficLog ที่เก่าเกินระยะเก็บรักษา (ขั้นต่ำ 90 วัน) */
export const purgeExpiredTrafficLogs = async (
  retentionDays = resolveLogRetentionDays("TRAFFIC_LOG_RETENTION_DAYS")
): Promise<number> => {
  const trafficLog = getTrafficLogDelegate();
  if (!trafficLog) {
    console.error("[traffic-log] Prisma client missing TrafficLog — run prisma generate");
    return 0;
  }

  const cutoff = resolveLogRetentionCutoff(retentionDays);
  const result = await trafficLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return result.count;
};

/** middleware บันทึกการจราจร HTTP หลัง response จบ (ไม่เก็บ body) */
export const trafficLogMiddleware = (req: Request, res: Response, next: () => void): void => {
  const startedAt = Date.now();

  res.on("finish", () => {
    const path = sanitizeTrafficPath(req.originalUrl || req.url || req.path || "/");
    if (SKIP_TRAFFIC_LOG_PATHS.has(path)) {
      return;
    }

    void writeTrafficLog({
      method: req.method,
      path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      ipAddress: getRequestIpAddress(req),
      userAgent: sanitizeUserAgent(req.get("user-agent") || undefined),
      actorUserId: req.user?.userId || null,
      protocol: req.protocol || null,
    });
  });

  next();
};
