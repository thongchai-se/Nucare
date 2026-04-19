import { Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { CookieOptions, Request, Response } from "express";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthTokenPayload } from "../middleware/auth.middleware";

const ACCESS_TOKEN_COOKIE = "accessToken";
const REFRESH_TOKEN_COOKIE = "refreshToken";
const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_FAILED_MESSAGE = "ชื่อบัญชีหรือรหัสผ่านไม่ถูกต้อง";
const PASSWORD_RESET_REQUEST_FAILED_MESSAGE = "ไม่พบบัญชีอีเมลนี้ในระบบ";
const INVALID_RESET_TOKEN_MESSAGE = "ลิงก์เปลี่ยนรหัสผ่านไม่ถูกต้องหรือหมดอายุ";

const loginSchema = z
  .object({
    identifier: z
      .string()
      .trim()
      .min(3, LOGIN_FAILED_MESSAGE)
      .max(120, LOGIN_FAILED_MESSAGE),
    password: z
      .string()
      .min(8, LOGIN_FAILED_MESSAGE)
      .max(128, LOGIN_FAILED_MESSAGE),
  })
  .superRefine((data, context) => {
    const identifier = data.identifier.trim();
    const isStudentIdInput = !identifier.includes("@") && /^[0-9-]+$/.test(identifier);

    if (!isStudentIdInput) {
      return;
    }

    const digitsOnly = identifier.replace(/\D/g, "");
    if (digitsOnly.length !== 10) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["identifier"],
        message: LOGIN_FAILED_MESSAGE,
      });
    }
  });

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("กรุณากรอกอีเมลให้ถูกต้อง"),
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, INVALID_RESET_TOKEN_MESSAGE),
  password: z.string().min(8, "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร").max(128),
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

const getClientOrigin = (): string => {
  return process.env.CLIENT_ORIGIN || "http://localhost:3000";
};

const getPasswordResetExpiryMinutes = (): number => {
  const configured = Number(process.env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES || "30");
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }
  return 30;
};

const getSmtpTransport = () => {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || "465");
  const secure = `${process.env.SMTP_SECURE || "true"}`.toLowerCase() !== "false";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error("SMTP_USER or SMTP_PASS is not set");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
};

const sendPasswordResetEmail = async (email: string, resetLink: string): Promise<void> => {
  const transporter = getSmtpTransport();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from,
    to: email,
    subject: "NUCARE - เปลี่ยนรหัสผ่าน",
    text: `คุณได้ทำรายการลืมรหัสผ่าน\n\nกรุณาเปลี่ยนรหัสผ่านผ่านลิงก์นี้: ${resetLink}\n\nหากคุณไม่ได้ร้องขอ กรุณาเพิกเฉยอีเมลฉบับนี้`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <h2 style="margin-bottom: 8px;">NUCARE - เปลี่ยนรหัสผ่าน</h2>
        <p>คุณได้ทำรายการลืมรหัสผ่าน</p>
        <p>
          กดปุ่มด้านล่างเพื่อเปลี่ยนรหัสผ่าน:
        </p>
        <p style="margin: 24px 0;">
          <a
            href="${resetLink}"
            style="display: inline-block; border-radius: 10px; background: #2563eb; padding: 11px 18px; color: #ffffff; text-decoration: none; font-weight: 700;"
          >
            เปลี่ยนรหัสผ่าน
          </a>
        </p>
        <p>หากคุณไม่ได้ร้องขอ กรุณาเพิกเฉยอีเมลฉบับนี้</p>
      </div>
    `,
  });
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

export const login = async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(401).json({ message: LOGIN_FAILED_MESSAGE });
    return;
  }

  try {
    const { identifier, password } = parsed.data;
    const user = await findUserByIdentifier(identifier);

    if (!user || !user.isActive) {
      res.status(401).json({ message: LOGIN_FAILED_MESSAGE });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
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

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const parsed = forgotPasswordSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: "กรุณากรอกอีเมลให้ถูกต้อง" });
    return;
  }

  try {
    const email = parsed.data.email.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (!user?.email) {
      res.status(404).json({ message: PASSWORD_RESET_REQUEST_FAILED_MESSAGE });
      return;
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + getPasswordResetExpiryMinutes() * 60 * 1000);

    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
    });

    await prisma.passwordResetToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt,
      },
    });

    const resetLink = `${getClientOrigin()}/reset-password?token=${rawToken}`;
    await sendPasswordResetEmail(user.email, resetLink);

    res.status(200).json({ message: "ส่งลิงก์เปลี่ยนรหัสผ่านไปยังอีเมลเรียบร้อยแล้ว" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "ไม่สามารถส่งอีเมลเปลี่ยนรหัสผ่านได้" });
  }
};

export const validateResetPasswordToken = async (req: Request, res: Response): Promise<void> => {
  const token = typeof req.query?.token === "string" ? req.query.token.trim() : "";

  if (!token) {
    res.status(400).json({ message: INVALID_RESET_TOKEN_MESSAGE });
    return;
  }

  try {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
      },
      select: {
        id: true,
        expiresAt: true,
      },
    });

    if (!resetToken || resetToken.expiresAt.getTime() < Date.now()) {
      res.status(400).json({ message: INVALID_RESET_TOKEN_MESSAGE });
      return;
    }

    res.status(200).json({ message: "Reset token is valid" });
  } catch (error) {
    console.error("Validate reset token error:", error);
    res.status(500).json({ message: "ไม่สามารถตรวจสอบลิงก์เปลี่ยนรหัสผ่านได้" });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const parsed = resetPasswordSchema.safeParse(req.body);

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || "ข้อมูลไม่ถูกต้อง";
    res.status(400).json({ message: firstError });
    return;
  }

  try {
    const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
      },
    });

    if (!resetToken || resetToken.expiresAt.getTime() < Date.now()) {
      res.status(400).json({ message: INVALID_RESET_TOKEN_MESSAGE });
      return;
    }

    const hashedPassword = await bcrypt.hash(parsed.data.password, 12);

    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    });

    await prisma.refreshToken.deleteMany({
      where: { userId: resetToken.userId },
    });

    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });

    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: resetToken.userId,
        id: { not: resetToken.id },
      },
    });

    res.status(200).json({ message: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "ไม่สามารถเปลี่ยนรหัสผ่านได้" });
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

    if (!user.isActive) {
      await prisma.refreshToken.delete({ where: { token: refreshToken } });
      clearAuthCookies(res);
      res.status(401).json({ message: "Invalid refresh token" });
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
