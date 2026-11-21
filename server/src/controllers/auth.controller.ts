import { Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { CookieOptions, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { resolveAuthCookieSecure } from "../lib/auth-cookie";
import { getRequestIpAddress, writeAuditLog } from "../lib/audit-log";
import { formatAuditMetadata } from "../lib/audit-metadata";
import { requireEnv } from "../lib/env";
import { prisma } from "../lib/prisma";
import { getAssignedRoles } from "../lib/roles";
import { formatStudentIdForResponse } from "../lib/user-format";
import { AuthTokenPayload } from "../middleware/auth.middleware";

const ACCESS_TOKEN_COOKIE = "accessToken";
const REFRESH_TOKEN_COOKIE = "refreshToken";
const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_FAILED_MESSAGE = "Invalid credentials";
const STUDENT_ID_PATTERN = /^\d{9}-\d$/;

const loginSchema = z
  .object({
    identifier: z.string().trim().min(3, LOGIN_FAILED_MESSAGE).max(120, LOGIN_FAILED_MESSAGE),
    password: z.string().min(8, LOGIN_FAILED_MESSAGE).max(128, LOGIN_FAILED_MESSAGE),
  })
  .strict()
  .superRefine((data, context) => {
    const identifier = data.identifier.trim();
    const isStudentIdInput = !identifier.includes("@") && /^[0-9-]+$/.test(identifier);

    if (isStudentIdInput && !STUDENT_ID_PATTERN.test(identifier)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["identifier"],
        message: LOGIN_FAILED_MESSAGE,
      });
    }
  });

const getAccessSecret = (): string => {
  return requireEnv("JWT_ACCESS_SECRET");
};

const getRefreshSecret = (): string => {
  return requireEnv("JWT_REFRESH_SECRET");
};

const buildCookieOptions = (maxAge: number): CookieOptions => ({
  httpOnly: true,
  secure: resolveAuthCookieSecure(),
  sameSite: "lax",
  maxAge,
  path: "/",
});

const clearCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: resolveAuthCookieSecure(),
  sameSite: "lax",
  path: "/",
};

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

const createAccessToken = (user: { id: string; role: Role; additionalRoles?: Role[] | null }): string =>
  jwt.sign({ userId: user.id, role: user.role, roles: getAssignedRoles(user) }, getAccessSecret(), { expiresIn: "15m" });

const createRefreshToken = (user: { id: string; role: Role; additionalRoles?: Role[] | null }): string =>
  jwt.sign({ userId: user.id, role: user.role, roles: getAssignedRoles(user) }, getRefreshSecret(), {
    expiresIn: "7d",
    jwtid: randomBytes(16).toString("hex"),
  });

const setAuthCookies = (res: Response, accessToken: string, refreshToken: string): void => {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, buildCookieOptions(ACCESS_TOKEN_MAX_AGE_MS));
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, buildCookieOptions(REFRESH_TOKEN_MAX_AGE_MS));
};

const clearAuthCookies = (res: Response): void => {
  res.clearCookie(ACCESS_TOKEN_COOKIE, clearCookieOptions);
  res.clearCookie(REFRESH_TOKEN_COOKIE, clearCookieOptions);
};

const writeAuthAuditLog = async (input: {
  action: string;
  actorUserId?: string | null;
  description: string;
  entityId?: string | null;
  entityType: string;
  ipAddress?: string | null;
}): Promise<void> => {
  try {
    await writeAuditLog(input);
  } catch (error) {
    console.error("Auth audit log error:", error);
  }
};

const sanitizeUser = (user: {
  id: string;
  name: string;
  studentId: string | null;
  employeeId: string | null;
  email: string | null;
  studyYear: number | null;
  section: string | null;
  phone?: string | null;
  guardianPhone?: string | null;
  role: Role;
  additionalRoles?: Role[] | null;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: user.id,
  name: user.name,
  studentId: formatStudentIdForResponse(user.studentId),
  employeeId: user.employeeId,
  email: user.email,
  studyYear: user.studyYear ?? null,
  section: user.section ?? null,
  phone: user.phone ?? null,
  guardianPhone: user.guardianPhone ?? null,
  role: user.role,
  roles: getAssignedRoles({
    role: user.role,
    additionalRoles: user.additionalRoles || [],
  }),
  image: user.image,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const findActiveUserForSession = async (userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      studentId: true,
      employeeId: true,
      email: true,
      studyYear: true,
      section: true,
      phone: true,
      guardianPhone: true,
      role: true,
      additionalRoles: true,
      image: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

const findUserByIdentifier = async (identifier: string) => {
  const normalized = identifier.trim();
  const normalizedEmail = normalized.toLowerCase();
  const digitsOnly = normalized.replace(/\D/g, "");
  const studentIdWithDash =
    digitsOnly.length === 10
      ? `${digitsOnly.slice(0, 9)}-${digitsOnly.slice(9)}`
      : undefined;

  return prisma.user.findFirst({
    where: {
      OR: [
        { studentId: normalized },
        digitsOnly ? { studentId: digitsOnly } : undefined,
        studentIdWithDash ? { studentId: studentIdWithDash } : undefined,
        { employeeId: normalized },
        { email: normalizedEmail },
      ].filter(Boolean) as Prisma.UserWhereInput[],
    },
  });
};

const resolveLoginIdentifierKind = (identifier: string): "email" | "studentId" | "employeeId" => {
  if (identifier.includes("@")) {
    return "email";
  }
  if (STUDENT_ID_PATTERN.test(identifier) || /^[0-9-]+$/.test(identifier)) {
    return "studentId";
  }
  return "employeeId";
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  const ipAddress = getRequestIpAddress(req);

  if (!parsed.success) {
    res.status(401).json({ message: LOGIN_FAILED_MESSAGE });
    return;
  }

  try {
    const { identifier, password } = parsed.data;
    const identifierKind = resolveLoginIdentifierKind(identifier);
    const user = await findUserByIdentifier(identifier);

    if (!user || !user.isActive) {
      await writeAuthAuditLog({
        action: "auth.login.failed",
        description: formatAuditMetadata({
          outcome: "failed",
          reason: user ? "inactive" : "not_found",
          identifierKind,
        }),
        entityType: "AuthSession",
        ipAddress,
      });
      res.status(401).json({ message: LOGIN_FAILED_MESSAGE });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await writeAuthAuditLog({
        action: "auth.login.failed",
        actorUserId: user.id,
        description: formatAuditMetadata({
          outcome: "failed",
          reason: "bad_password",
          identifierKind,
        }),
        entityType: "AuthSession",
        entityId: user.id,
        ipAddress,
      });
      res.status(401).json({ message: LOGIN_FAILED_MESSAGE });
      return;
    }

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    await prisma.refreshToken.deleteMany({
      where: {
        userId: user.id,
        expiresAt: { lt: new Date() },
      },
    });

    await prisma.refreshToken.create({
      data: {
        token: hashToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS),
      },
    });

    setAuthCookies(res, accessToken, refreshToken);

    await writeAuthAuditLog({
      action: "auth.login.success",
      actorUserId: user.id,
      description: formatAuditMetadata({
        outcome: "success",
        identifierKind,
        role: user.role,
      }),
      entityType: "AuthSession",
      entityId: user.id,
      ipAddress,
    });

    res.status(200).json({
      message: "Login successful",
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Failed to login" });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
  const ipAddress = getRequestIpAddress(req);

  try {
    const storedToken = refreshToken
      ? await prisma.refreshToken.findUnique({
          where: { token: hashToken(refreshToken) },
          select: { userId: true },
        })
      : null;

    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: hashToken(refreshToken) },
      });
    }

    clearAuthCookies(res);
    await writeAuthAuditLog({
      action: "auth.logout",
      actorUserId: storedToken?.userId,
      description: formatAuditMetadata({ outcome: "logout" }),
      entityType: "AuthSession",
      entityId: storedToken?.userId,
      ipAddress,
    });
    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Failed to logout" });
  }
};

export const me = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const user = await findActiveUserForSession(req.user.userId);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error("Me error:", error);
    res.status(500).json({ message: "Failed to fetch current user" });
  }
};

export const session = async (req: Request, res: Response): Promise<void> => {
  const accessToken = req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined;
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;

  try {
    if (accessToken) {
      try {
        const decoded = jwt.verify(accessToken, getAccessSecret()) as AuthTokenPayload;
        if (decoded.userId) {
          const user = await findActiveUserForSession(decoded.userId);
          if (user?.isActive) {
            res.status(200).json({ user: sanitizeUser(user) });
            return;
          }
        }
      } catch {
        // Fall through to the refresh-token path below.
      }
    }

    if (!refreshToken) {
      clearAuthCookies(res);
      res.status(200).json({ user: null });
      return;
    }

    let decodedRefreshToken: AuthTokenPayload;
    try {
      decodedRefreshToken = jwt.verify(refreshToken, getRefreshSecret()) as AuthTokenPayload;
    } catch {
      clearAuthCookies(res);
      res.status(200).json({ user: null });
      return;
    }

    const hashedRefreshToken = hashToken(refreshToken);
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: hashedRefreshToken },
    });

    if (
      !storedToken ||
      storedToken.expiresAt.getTime() < Date.now() ||
      storedToken.userId !== decodedRefreshToken.userId
    ) {
      if (storedToken) {
        await prisma.refreshToken.deleteMany({ where: { token: hashedRefreshToken } });
      }
      clearAuthCookies(res);
      res.status(200).json({ user: null });
      return;
    }

    const user = await findActiveUserForSession(decodedRefreshToken.userId);
    if (!user?.isActive) {
      await prisma.refreshToken.deleteMany({ where: { token: hashedRefreshToken } });
      clearAuthCookies(res);
      res.status(200).json({ user: null });
      return;
    }

    // Renew access only. Do not rotate refresh here — concurrent dashboard API
    // calls may also hit /api/auth/refresh and racing token rotation logs users out.
    const newAccessToken = createAccessToken(user);
    res.cookie(ACCESS_TOKEN_COOKIE, newAccessToken, buildCookieOptions(ACCESS_TOKEN_MAX_AGE_MS));
    res.status(200).json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error("Session error:", error);
    res.status(500).json({ message: "Failed to check session" });
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;

  if (!refreshToken) {
    res.status(401).json({ message: "Refresh token missing" });
    return;
  }

  try {
    const decoded = jwt.verify(refreshToken, getRefreshSecret()) as AuthTokenPayload;
    const hashedRefreshToken = hashToken(refreshToken);

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: hashedRefreshToken },
    });

    if (!storedToken) {
      // JWT ยังใช้ได้แต่ hash หาย = น่าจะถูกหมุนไปแล้ว (reuse) — เพิกถอนทุก refresh ของผู้ใช้
      await prisma.refreshToken.deleteMany({ where: { userId: decoded.userId } });
      await writeAuthAuditLog({
        action: "auth.refresh.reuse-detected",
        actorUserId: decoded.userId,
        description: formatAuditMetadata({ outcome: "revoked_all" }),
        entityType: "User",
        entityId: decoded.userId,
        ipAddress: getRequestIpAddress(req),
      });
      clearAuthCookies(res);
      res.status(401).json({ message: "Invalid refresh token" });
      return;
    }

    if (storedToken.expiresAt.getTime() < Date.now()) {
      await prisma.refreshToken.delete({ where: { token: hashedRefreshToken } });
      clearAuthCookies(res);
      res.status(401).json({ message: "Refresh token expired" });
      return;
    }

    if (storedToken.userId !== decoded.userId) {
      await prisma.refreshToken.deleteMany({ where: { userId: decoded.userId } });
      clearAuthCookies(res);
      res.status(401).json({ message: "Invalid refresh token" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      await prisma.refreshToken.delete({ where: { token: hashedRefreshToken } });
      clearAuthCookies(res);
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (!user.isActive) {
      await prisma.refreshToken.delete({ where: { token: hashedRefreshToken } });
      clearAuthCookies(res);
      res.status(401).json({ message: "Invalid refresh token" });
      return;
    }

    await prisma.refreshToken.delete({ where: { token: hashedRefreshToken } });

    const newAccessToken = createAccessToken(user);
    const newRefreshToken = createRefreshToken(user);

    await prisma.refreshToken.create({
      data: {
        token: hashToken(newRefreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS),
      },
    });

    setAuthCookies(res, newAccessToken, newRefreshToken);

    res.status(200).json({
      message: "Token refreshed",
      user: sanitizeUser(user),
    });
  } catch (_error) {
    clearAuthCookies(res);
    res.status(401).json({ message: "Invalid or expired refresh token" });
  }
};
