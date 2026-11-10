import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { readEnv } from "../lib/env";
import { getRequestIpAddress } from "../lib/audit-log";
import { prisma } from "../lib/prisma";
import { AuthTokenPayload } from "../middleware/auth.middleware";

export const CONSENT_POLICY_VERSION = "2026-09-08";

const consentSchema = z.object({
  anonymousId: z.string().trim().min(8).max(80),
  status: z.enum(["accepted_all", "necessary_only", "customized"]),
  analytics: z.boolean(),
  policyVersion: z.literal(CONSENT_POLICY_VERSION),
});

const resolveOptionalUserId = (req: Request): string | null => {
  const token = req.cookies?.accessToken as string | undefined;
  const secret = readEnv("JWT_ACCESS_SECRET");
  if (!token || !secret) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, secret) as AuthTokenPayload;
    return decoded.userId || null;
  } catch {
    return null;
  }
};

export const recordConsent = async (req: Request, res: Response): Promise<void> => {
  const parsed = consentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid consent payload" });
    return;
  }

  const userId = resolveOptionalUserId(req);
  const userAgent = req.get("user-agent")?.slice(0, 300) || null;

  try {
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!user) {
        res.status(400).json({ message: "Invalid consent payload" });
        return;
      }
    }

    const record = await prisma.consentRecord.create({
      data: {
        userId,
        anonymousId: parsed.data.anonymousId,
        status: parsed.data.status,
        analytics: parsed.data.analytics,
        policyVersion: parsed.data.policyVersion,
        userAgent,
        ipAddress: getRequestIpAddress(req),
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      ok: true,
      id: record.id,
      recordedAt: record.createdAt,
    });
  } catch (error) {
    console.error("Record consent error:", error);
    res.status(500).json({ message: "Failed to record consent" });
  }
};
