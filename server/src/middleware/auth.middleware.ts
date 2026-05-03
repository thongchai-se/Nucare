import { Role } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { requireEnv } from "../lib/env";
import { prisma } from "../lib/prisma";
import { getAssignedRoles } from "../lib/roles";

export interface AuthTokenPayload extends JwtPayload {
  userId: string;
  role: Role;
  roles?: Role[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

const getAccessSecret = (): string => {
  return requireEnv("JWT_ACCESS_SECRET");
};

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = req.cookies?.accessToken as string | undefined;

  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  let decoded: AuthTokenPayload;
  try {
    decoded = jwt.verify(token, getAccessSecret()) as AuthTokenPayload;
  } catch (_error) {
    res.status(401).json({ message: "Invalid or expired access token" });
    return;
  }

  if (!decoded.userId) {
    res.status(401).json({ message: "Invalid or expired access token" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true,
        additionalRoles: true,
        isActive: true,
      },
    });

    if (!user?.isActive) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const assignedRoles = getAssignedRoles(user);

    req.user = {
      ...decoded,
      userId: user.id,
      role: user.role,
      roles: assignedRoles,
    };
    next();
  } catch (error) {
    console.error("Authenticate token error:", error);
    res.status(500).json({ message: "Failed to authenticate request" });
  }
};

export const authorizeRoles =
  (...allowedRoles: Role[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const assignedRoles = req.user.roles?.length ? req.user.roles : [req.user.role];

    if (!assignedRoles.some((role) => allowedRoles.includes(role))) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    next();
  };
