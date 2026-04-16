import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
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

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ ok: true, message: "NuCare API is running" });
});

app.use("/api/auth", authRoutes);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

app.listen(port, () => {
  console.log(`NuCare server listening on http://localhost:${port}`);
});
