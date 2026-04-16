import { Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CookieOptions, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthTokenPayload } from "../middleware/auth.middleware";

const ACCESS_TOKEN_COOKIE = "accessToken";
const REFRESH_TOKEN_COOKIE = "refreshToken";
const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  identifier: z.string().trim().min(3).max(120),
  role: z.nativeEnum(Role),
  password: z.string().min(8).max(128),
  image: z.string().url().optional(),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(120),
  password: z.string().min(8).max(128),
});

const getAccessSecret = (): string => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is not set");
  }
  return secret;
};

const getRefreshSecret = (): string => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error("JWT_REFRESH_SECRET is not set");
  }
  return secret;
};

const buildCookieOptions = (maxAge: number): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge,
  path: "/",
});

const clearCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

const createAccessToken = (user: { id: string; role: Role }): string => {
  return jwt.sign({ userId: user.id, role: user.role }, getAccessSecret(), {
    expiresIn: "15m",
  });
};

const createRefreshToken = (user: { id: string; role: Role }): string => {
  return jwt.sign({ userId: user.id, role: user.role }, getRefreshSecret(), {
    expiresIn: "7d",
  });
};

const setAuthCookies = (res: Response, accessToken: string, refreshToken: string): void => {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, buildCookieOptions(ACCESS_TOKEN_MAX_AGE_MS));
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, buildCookieOptions(REFRESH_TOKEN_MAX_AGE_MS));
};

const clearAuthCookies = (res: Response): void => {
  res.clearCookie(ACCESS_TOKEN_COOKIE, clearCookieOptions);
  res.clearCookie(REFRESH_TOKEN_COOKIE, clearCookieOptions);
};

const sanitizeUser = (user: {
  id: string;
  name: string;
  studentId: string | null;
  employeeId: string | null;
  email: string | null;
  role: Role;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: user.id,
  name: user.name,
  studentId: user.studentId,
  employeeId: user.employeeId,
  email: user.email,
  role: user.role,
  image: user.image,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const resolveIdentifierField = (
  role: Role,
  identifier: string
): Pick<Prisma.UserCreateInput, "studentId" | "employeeId" | "email"> => {
  const normalized = identifier.trim();

  if (normalized.includes("@")) {
    return { email: normalized.toLowerCase() };
  }

  if (role === Role.STUDENT) {
    return { studentId: normalized };
  }

  return { employeeId: normalized };
};

const findUserByIdentifier = async (identifier: string) => {
  const normalized = identifier.trim();
  const normalizedEmail = normalized.toLowerCase();

  return prisma.user.findFirst({
    where: {
      OR: [
        { studentId: normalized },
        { employeeId: normalized },
        { email: normalizedEmail },
      ],
    },
  });
};

export const register = async (req: Request, res: Response): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
    return;
  }

  try {
    const { name, identifier, password, role, image } = parsed.data;
    const identifierField = resolveIdentifierField(role, identifier);

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          identifierField.studentId ? { studentId: identifierField.studentId } : undefined,
          identifierField.employeeId ? { employeeId: identifierField.employeeId } : undefined,
          identifierField.email ? { email: identifierField.email } : undefined,
        ].filter(Boolean) as Prisma.UserWhereInput[],
      },
    });

    if (existingUser) {
      res.status(409).json({ message: "Identifier is already registered" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        role,
        password: hashedPassword,
        image: image || null,
        ...identifierField,
      },
    });

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS),
      },
    });

    setAuthCookies(res, accessToken, refreshToken);

    res.status(201).json({
      message: "Register successful",
      user: sanitizeUser(user),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ message: "Identifier is already registered" });
      return;
    }

    console.error("Register error:", error);
    res.status(500).json({ message: "Failed to register user" });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
    return;
  }

  try {
    const { identifier, password } = parsed.data;
    const user = await findUserByIdentifier(identifier);

    if (!user) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS),
      },
    });

    setAuthCookies(res, accessToken, refreshToken);

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

  try {
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }

    clearAuthCookies(res);

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
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

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

export const refresh = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;

  if (!refreshToken) {
    res.status(401).json({ message: "Refresh token missing" });
    return;
  }

  try {
    const decoded = jwt.verify(refreshToken, getRefreshSecret()) as AuthTokenPayload;

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken) {
      clearAuthCookies(res);
      res.status(401).json({ message: "Invalid refresh token" });
      return;
    }

    if (storedToken.expiresAt.getTime() < Date.now()) {
      await prisma.refreshToken.delete({ where: { token: refreshToken } });
      clearAuthCookies(res);
      res.status(401).json({ message: "Refresh token expired" });
      return;
    }

    if (storedToken.userId !== decoded.userId) {
      clearAuthCookies(res);
      res.status(401).json({ message: "Invalid refresh token" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

    if (!user) {
      await prisma.refreshToken.delete({ where: { token: refreshToken } });
      clearAuthCookies(res);
      res.status(404).json({ message: "User not found" });
      return;
    }

    await prisma.refreshToken.delete({ where: { token: refreshToken } });

    const newAccessToken = createAccessToken(user);
    const newRefreshToken = createRefreshToken(user);

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS),
      },
    });

    setAuthCookies(res, newAccessToken, newRefreshToken);

    res.status(200).json({
      message: "Token refreshed",
      user: sanitizeUser(user),
    });
  } catch (error) {
    clearAuthCookies(res);
    res.status(401).json({ message: "Invalid or expired refresh token" });
  }
};
