import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import { prisma } from "./lib/prisma";
import adminRoutes from "./routes/admin.routes";
import authRoutes from "./routes/auth.routes";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

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

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const startServer = async (): Promise<void> => {
  const maxRetries = 5;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      app.listen(port, () => {
        console.log(`NuCare server listening on http://localhost:${port}`);
      });
      return;
    } catch (error) {
      console.error(
        `Database connection failed (attempt ${attempt}/${maxRetries}).`,
        error
      );

      if (attempt < maxRetries) {
        await sleep(2000);
      }
    }
  }

  process.exit(1);
};

void startServer();

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
