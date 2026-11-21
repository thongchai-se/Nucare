import { Role } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { readEnv } from "../lib/env";
import { prisma } from "../lib/prisma";
import { getAssignedRoles } from "../lib/roles";
import { getMaintenanceSnapshot, shouldBlockForMaintenance } from "../lib/site-settings";

type SoftToken = {
  userId?: string;
  role?: Role;
  roles?: Role[];
};

/** อ่านบทบาทจาก access cookie แบบเบา — ล้มเหลวถือว่าไม่ใช่แอดมิน */
async function resolveIsAdmin(req: Request): Promise<boolean> {
  if (req.user?.roles?.includes(Role.ADMIN) || req.user?.role === Role.ADMIN) {
    return true;
  }

  const token = req.cookies?.accessToken as string | undefined;
  const secret = readEnv("JWT_ACCESS_SECRET");
  if (!token || !secret) {
    return false;
  }

  let decoded: SoftToken;
  try {
    decoded = jwt.verify(token, secret) as SoftToken;
  } catch {
    return false;
  }

  if (!decoded.userId) {
    return false;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, additionalRoles: true, isActive: true },
    });
    if (!user?.isActive) {
      return false;
    }
    return getAssignedRoles(user).includes(Role.ADMIN);
  } catch {
    return false;
  }
}

/**
 * บล็อก API เมื่อเปิดโหมดปิดปรับปรุง — ยกเว้น auth/health/public settings และแอดมิน
 */
export const maintenanceMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const settings = await getMaintenanceSnapshot();
    if (!settings.maintenanceEnabled) {
      next();
      return;
    }

    const isAdmin = await resolveIsAdmin(req);
    const path = req.originalUrl?.split("?")[0] || req.path;
    if (
      !shouldBlockForMaintenance({
        maintenanceEnabled: true,
        isAdmin,
        method: req.method,
        path,
      })
    ) {
      next();
      return;
    }

    const message =
      settings.maintenanceMessage.trim() ||
      "ระบบกำลังปิดปรับปรุงชั่วคราว กรุณาลองใหม่ภายหลัง";

    res.status(503).json({
      message,
      maintenance: true,
    });
  } catch (error) {
    console.error("Maintenance middleware error:", error);
    next();
  }
};
