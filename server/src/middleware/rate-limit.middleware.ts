import rateLimit from "express-rate-limit";
import { Request } from "express";

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

type LimiterOptions = {
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  skipSuccessfulRequests?: boolean;
};

const createLimiter = (
  windowMs: number,
  max: number,
  message: string,
  options?: LimiterOptions
) =>
  rateLimit({
    windowMs,
    max,
    keyGenerator: options?.keyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    skip: options?.skip,
    skipSuccessfulRequests: Boolean(options?.skipSuccessfulRequests),
    message: { message },
  });

const createAuthLimiter = (
  max: number,
  message: string,
  options?: LimiterOptions
) => createLimiter(AUTH_WINDOW_MS, max, message, options);

const authenticatedUserKey = (req: Request): string => req.user?.userId || "authenticated-user";

const isHealthCheckRequest = (req: Request): boolean => req.path === "/health" || req.path === "/api/health";

const isSafeReadRequest = (req: Request): boolean =>
  req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS";

export const apiRateLimit = createLimiter(
  parsePositiveInt(process.env.API_RATE_LIMIT_WINDOW_MS, 60 * 1000),
  parsePositiveInt(process.env.API_RATE_LIMIT_MAX, 300),
  "มีคำขอเข้าใช้งานระบบมากเกินไป กรุณาลองใหม่อีกครั้ง",
  { skip: isHealthCheckRequest }
);

export const apiWriteRateLimit = createLimiter(
  parsePositiveInt(process.env.API_WRITE_RATE_LIMIT_WINDOW_MS, 60 * 1000),
  parsePositiveInt(process.env.API_WRITE_RATE_LIMIT_MAX, 60),
  "มีคำขอเปลี่ยนแปลงข้อมูลมากเกินไป กรุณาลองใหม่อีกครั้ง",
  {
    skip: (req) => isHealthCheckRequest(req) || isSafeReadRequest(req),
  }
);

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

export const assessmentSubmitRateLimit = createLimiter(
  parsePositiveInt(process.env.ASSESSMENT_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000),
  parsePositiveInt(process.env.ASSESSMENT_RATE_LIMIT_MAX, 30),
  "คุณส่งแบบประเมินบ่อยเกินไป กรุณาลองใหม่ภายหลัง",
  { keyGenerator: authenticatedUserKey }
);

export const surveySubmitRateLimit = createLimiter(
  parsePositiveInt(process.env.SURVEY_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000),
  parsePositiveInt(process.env.SURVEY_RATE_LIMIT_MAX, 60),
  "ส่งแบบสอบถามบ่อยเกินไป กรุณาลองใหม่ภายหลัง",
  { keyGenerator: authenticatedUserKey }
);

export const sosRateLimit = createLimiter(
  parsePositiveInt(process.env.SOS_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000),
  parsePositiveInt(process.env.SOS_RATE_LIMIT_MAX, 3),
  "คุณส่งสัญญาณฉุกเฉินบ่อยเกินไป กรุณาติดต่อเจ้าหน้าที่โดยตรงหากเป็นเหตุเร่งด่วน",
  { keyGenerator: authenticatedUserKey }
);

export const consentRateLimit = createLimiter(
  parsePositiveInt(process.env.CONSENT_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000),
  parsePositiveInt(process.env.CONSENT_RATE_LIMIT_MAX, 20),
  "บันทึกความยินยอมบ่อยเกินไป กรุณาลองใหม่ภายหลัง"
);

export const consultationRequestRateLimit = createLimiter(
  parsePositiveInt(process.env.CONSULTATION_REQUEST_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000),
  parsePositiveInt(process.env.CONSULTATION_REQUEST_RATE_LIMIT_MAX, 10),
  "คุณส่งคำขอรับคำปรึกษาบ่อยเกินไป กรุณาลองใหม่ภายหลัง",
  { keyGenerator: authenticatedUserKey }
);

export const studentChatRateLimit = createLimiter(
  parsePositiveInt(process.env.STUDENT_CHAT_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000),
  parsePositiveInt(process.env.STUDENT_CHAT_RATE_LIMIT_MAX, 40),
  "คุณส่งข้อความแชทบ่อยเกินไป กรุณาพักสักครู่แล้วลองใหม่",
  { keyGenerator: authenticatedUserKey }
);
