import rateLimit from "express-rate-limit";

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const AUTH_WINDOW_MS = parsePositiveInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);

const createAuthLimiter = (
  max: number,
  message: string,
  options?: { skipSuccessfulRequests?: boolean }
) =>
  rateLimit({
    windowMs: AUTH_WINDOW_MS,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: Boolean(options?.skipSuccessfulRequests),
    message: { message },
  });

export const loginRateLimit = createAuthLimiter(
  10,
  "ลองเข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่อีกครั้งภายหลัง",
  {
    skipSuccessfulRequests: true,
  }
);

export const forgotPasswordRateLimit = createAuthLimiter(
  5,
  "คุณขอลิงก์เปลี่ยนรหัสผ่านบ่อยเกินไป กรุณาลองใหม่อีกครั้งภายหลัง"
);

export const resetPasswordRateLimit = createAuthLimiter(
  10,
  "คุณเปลี่ยนรหัสผ่านบ่อยเกินไป กรุณาลองใหม่อีกครั้งภายหลัง"
);

export const refreshRateLimit = createAuthLimiter(
  60,
  "คำขอต่ออายุเซสชันมากเกินไป กรุณาลองใหม่อีกครั้ง"
);

export const changePasswordRateLimit = createAuthLimiter(
  10,
  "คุณพยายามเปลี่ยนรหัสผ่านบ่อยเกินไป กรุณาลองใหม่อีกครั้งภายหลัง"
);
