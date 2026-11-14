import "./lib/env";
import cors from "cors";
import cookieParser from "cookie-parser";
import express, { NextFunction, Request, Response } from "express";
import path from "node:path";
import { readEnv, requireEnv } from "./lib/env";
import { assertEmailReadyForEnvironment } from "./lib/email";
import { seedDefaultUsersIfMissing } from "./lib/default-users.seed";
import { prisma } from "./lib/prisma";
import { resolveUnhandledHttpError } from "./lib/http-error-message";
import { SITE_MEDIA_UPLOAD_DIR } from "./lib/site-media";
import { purgeExpiredAuditLogs } from "./lib/audit-log";
import { purgeStaleStudentChatMemories } from "./lib/student-chat/memory";
import { materializeDueWaves } from "./lib/survey-auto-schedule";
import { assertChatReadyForEnvironment } from "./lib/student-chat/provider";
import { purgeExpiredTrafficLogs, trafficLogMiddleware } from "./lib/traffic-log";
import adminRoutes from "./routes/admin.routes";
import alertsRoutes from "./routes/alerts.routes";
import authRoutes from "./routes/auth.routes";
import consentRoutes from "./routes/consent.routes";
import advisorRoutes from "./routes/advisor.routes";
import executiveRoutes from "./routes/executive.routes";
import instructorRoutes from "./routes/instructor.routes";
import mentalHealthRoutes from "./routes/mental-health.routes";
import siteMediaRoutes from "./routes/site-media.routes";
import studentRoutes from "./routes/student.routes";
import studentDevelopmentRoutes from "./routes/student-development.routes";
import { apiRateLimit, apiWriteRateLimit } from "./middleware/rate-limit.middleware";

const app = express();
const port = Number(readEnv("PORT")) || 5000;

const parseNonNegativeInt = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
};

const defaultTrustProxyHops = process.env.VERCEL ? 1 : 0;
const trustProxyHops = Math.max(
  0,
  parseNonNegativeInt(readEnv("TRUST_PROXY_HOPS"), defaultTrustProxyHops)
);
/**
 * รองรับอัปโหลดรูปสื่อแบบ data URL (ไฟล์จริงสูงสุด ~2MB)
 * base64 บวมประมาณ 4/3 จึงควรตั้งอย่างน้อย 4mb — ค่าใน .env ที่ต่ำกว่าจะทำให้อัปโหลดหลุดก่อนถึงตัวตรวจขนาดรูป
 */
const jsonBodyLimit = readEnv("JSON_BODY_LIMIT") || "4mb";
const allowedOrigins = (readEnv("CLIENT_ORIGIN") || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOriginSet = new Set(allowedOrigins);
const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const assertRequiredConfiguration = (): void => {
  const requiredEnvNames = ["DATABASE_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const;
  const missingEnvNames = requiredEnvNames.filter((name) => !readEnv(name));

  if (missingEnvNames.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvNames.join(", ")}`);
  }

  if (process.env.NODE_ENV === "production") {
    const securitySecretNames = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const;
    const weakSecretNames = securitySecretNames.filter(
      (name) => requireEnv(name).length < 32
    );

    if (weakSecretNames.length > 0) {
      throw new Error(
        `Production JWT secrets must be at least 32 characters: ${weakSecretNames.join(", ")}`
      );
    }

    assertEmailReadyForEnvironment();
    assertChatReadyForEnvironment();
  }
};

const initializeApplication = async (maxRetries: number): Promise<void> => {
  assertRequiredConfiguration();

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      const seedSummary = await seedDefaultUsersIfMissing(prisma);
      if (seedSummary.enabled) {
        console.log(
          `[seed] Default users ready (created=${seedSummary.createdCount}, skipped=${seedSummary.skippedCount})`
        );
      }
      return;
    } catch (error) {
      lastError = error;
      console.error(
        `Server startup failed (attempt ${attempt}/${maxRetries}).`,
        error
      );

      if (attempt < maxRetries) {
        await sleep(2000);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Server startup failed");
};

let appReadyPromise: Promise<void> | null = null;

export const ensureAppReady = async (
  maxRetries = process.env.VERCEL ? 1 : 5
): Promise<void> => {
  if (!appReadyPromise) {
    appReadyPromise = initializeApplication(maxRetries);
  }

  try {
    await appReadyPromise;
  } catch (error) {
    appReadyPromise = null;
    throw error;
  }
};

app.disable("x-powered-by");
app.set("trust proxy", trustProxyHops);

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");

  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
});

app.use((req: Request, res: Response, next: NextFunction) => {
  if (!unsafeMethods.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const origin = req.get("origin");
  if (!origin || allowedOriginSet.has(origin)) {
    next();
    return;
  }

  res.status(403).json({ message: "Invalid request origin" });
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOriginSet.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: jsonBodyLimit }));
app.use(cookieParser());
app.use(trafficLogMiddleware);
app.use(async (_req: Request, _res: Response, next: NextFunction) => {
  try {
    await ensureAppReady();
    next();
  } catch (error) {
    next(error instanceof Error ? error : new Error("Application startup failed"));
  }
});

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    message: "NuCare API root",
    health: "/api/health",
  });
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ ok: true, message: "NuCare API is running" });
});

app.use("/api", apiRateLimit, apiWriteRateLimit);

app.use("/api/auth", authRoutes);
app.use("/api/consent", consentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/advisor", advisorRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/student-development", studentDevelopmentRoutes);
app.use("/api/instructor", instructorRoutes);
app.use("/api/mental-health", mentalHealthRoutes);
app.use("/api/executive", executiveRoutes);
app.use("/api/alerts", alertsRoutes);
app.use("/api/site-media", siteMediaRoutes);

/** เสิร์ฟรูปสื่อที่แอดมินอัปโหลด — อนุญาตเฉพาะชื่อไฟล์ปลอดภัย */
app.get("/api/uploads/site-media/:fileName", (req: Request, res: Response) => {
  const raw = typeof req.params.fileName === "string" ? req.params.fileName : "";
  const fileName = path.basename(raw);
  if (!fileName || fileName !== raw || !/^[a-zA-Z0-9._-]+$/.test(fileName)) {
    res.status(400).json({ message: "ชื่อไฟล์ไม่ถูกต้อง" });
    return;
  }

  res.sendFile(path.join(SITE_MEDIA_UPLOAD_DIR, fileName), (error) => {
    if (error && !res.headersSent) {
      res.status(404).json({ message: "ไม่พบไฟล์" });
    }
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  const resolved = resolveUnhandledHttpError(err);
  res.status(resolved.status).json({ message: resolved.message });
});

const LOG_MAINTENANCE_INTERVAL_MS = 24 * 60 * 60 * 1000;

const runChatMemoryMaintenance = async (): Promise<void> => {
  try {
    const deleted = await purgeStaleStudentChatMemories(prisma);
    if (deleted > 0) {
      console.log(`[chat-memory] purged ${deleted} stale memories (>90 days)`);
    }
  } catch (error) {
    console.error("[chat-memory] purge failed:", error);
  }
};

const runComplianceLogMaintenance = async (): Promise<void> => {
  try {
    const [trafficDeleted, auditDeleted] = await Promise.all([
      purgeExpiredTrafficLogs(),
      purgeExpiredAuditLogs(),
    ]);
    if (trafficDeleted > 0) {
      console.log(`[traffic-log] purged ${trafficDeleted} expired rows`);
    }
    if (auditDeleted > 0) {
      console.log(`[audit-log] purged ${auditDeleted} expired rows`);
    }
  } catch (error) {
    console.error("[compliance-log] purge failed:", error);
  }
};

/** ช่วงเวลา tick งานสร้างรอบแบบประเมินอัตโนมัติ (ค่าเริ่มต้น 10 นาที, ขั้นต่ำ 1 นาที) */
const surveyScheduleIntervalMs = Math.max(
  60 * 1000,
  parseNonNegativeInt(readEnv("SURVEY_SCHEDULE_INTERVAL_MS"), 10 * 60 * 1000)
);
let surveyScheduleRunning = false;

/** รันงานปิดรอบที่หมดเวลาและสร้าง/เปิดรอบตามความถี่ของแบบประเมิน; ข้ามถ้า tick ก่อนหน้ายังไม่จบ */
const runSurveyScheduleTick = async (): Promise<void> => {
  if (surveyScheduleRunning) {
    return;
  }
  surveyScheduleRunning = true;
  try {
    const result = await materializeDueWaves();
    if (result.closed > 0 || result.created > 0 || result.opened > 0) {
      console.log(
        `[survey-schedule] closed=${result.closed} created=${result.created} opened=${result.opened}`
      );
    }
  } catch (error) {
    console.error("[survey-schedule] tick failed:", error);
  } finally {
    surveyScheduleRunning = false;
  }
};

const startServer = async (): Promise<void> => {
  await ensureAppReady(5);
  await runChatMemoryMaintenance();
  await runComplianceLogMaintenance();
  await runSurveyScheduleTick();
  setInterval(() => {
    void runChatMemoryMaintenance();
    void runComplianceLogMaintenance();
  }, LOG_MAINTENANCE_INTERVAL_MS);
  setInterval(() => {
    void runSurveyScheduleTick();
  }, surveyScheduleIntervalMs);

  app.listen(port, () => {
    console.log(`NuCare server listening on http://localhost:${port}`);
  });
};

const isExecutedDirectly = (): boolean => {
  return typeof require !== "undefined" && typeof module !== "undefined" && require.main === module;
};

const registerShutdownHandlers = (): void => {
  const shutdown = async () => {
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

if (isExecutedDirectly()) {
  registerShutdownHandlers();
  void startServer().catch((error) => {
    console.error("Server startup failed.", error);
    process.exit(1);
  });
}

export default app;
