import { ReferralTarget, RiskLevel } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { getRequestIpAddress } from "../lib/audit-log";
import {
  acknowledgeScreeningReview,
  createReferralFromScreening,
  getScreeningReviewDetail,
  listScreeningReviews,
  resolveScreeningReviewScope,
  type ScreeningReviewViewer,
} from "../lib/screening-review";

const responseParamSchema = z
  .object({
    responseId: z.string().trim().min(1).max(64),
  })
  .strict();

const listQuerySchema = z.object({
  /** คั่นด้วยจุลภาค เช่น HIGH,MEDIUM */
  riskLevels: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((item) => item.trim().toUpperCase())
            .filter(Boolean)
        : undefined
    )
    .pipe(z.array(z.enum([RiskLevel.HIGH, RiskLevel.MEDIUM])).max(2).optional()),
  status: z.enum(["OPEN", "PENDING", "ACKNOWLEDGED", "REFERRED", "ALL"]).optional(),
});

const createReferralBodySchema = z
  .object({
    target: z.nativeEnum(ReferralTarget),
    reason: z.string().trim().min(20).max(4000),
    isUrgent: z.boolean().optional(),
  })
  .strict();

/** ดึงผู้เรียกจาก req และตรวจว่ามีขอบเขตคิว — ไม่มีสิทธิ์ตอบ 403 */
function resolveActor(req: Request, res: Response, viewer: ScreeningReviewViewer) {
  const actorUserId = req.user?.userId;
  if (!actorUserId) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  const roles = req.user?.roles ?? (req.user?.role ? [req.user.role] : []);
  if (resolveScreeningReviewScope(roles, viewer) === "none") {
    res.status(403).json({ message: "Forbidden" });
    return null;
  }
  return { actorUserId, roles };
}

/** รายการคิวทบทวนผลคัดกรอง (MEDIUM/HIGH) ตามขอบเขตบทบาทของผู้เรียก */
export const makeListScreeningReviews =
  (viewer: ScreeningReviewViewer) =>
  async (req: Request, res: Response): Promise<void> => {
    const actor = resolveActor(req, res, viewer);
    if (!actor) {
      return;
    }
    const query = listQuerySchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ message: "Invalid query" });
      return;
    }

    try {
      const result = await listScreeningReviews({
        ...actor,
        viewer,
        riskLevels: query.data.riskLevels,
        status: query.data.status,
      });
      res.status(200).json({ items: result.items, truncated: result.truncated });
    } catch (error) {
      console.error("List screening reviews error:", error);
      res.status(500).json({ message: "Failed to list screening reviews" });
    }
  };

/** รายละเอียดผลคัดกรองพร้อมคำตอบ (ละเอียดอ่อน) เฉพาะผู้ตรวจที่มีสิทธิ์ต่อนิสิตคนนั้น */
export const makeGetScreeningReviewDetail =
  (viewer: ScreeningReviewViewer) =>
  async (req: Request, res: Response): Promise<void> => {
    const actor = resolveActor(req, res, viewer);
    if (!actor) {
      return;
    }
    const params = responseParamSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ message: "Invalid response id" });
      return;
    }

    try {
      const result = await getScreeningReviewDetail({
        ...actor,
        viewer,
        responseId: params.data.responseId,
        ipAddress: getRequestIpAddress(req),
      });
      if (!result.ok) {
        res.status(result.code === "NOT_ELIGIBLE" ? 400 : 404).json({ message: "ไม่พบผลคัดกรอง" });
        return;
      }
      res.status(200).json({ detail: result.detail });
    } catch (error) {
      console.error("Get screening review detail error:", error);
      res.status(500).json({ message: "Failed to fetch screening review" });
    }
  };

/** รับทราบผลคัดกรองในคิว (ไม่สร้างส่งต่อ) */
export const makeAcknowledgeScreeningReview =
  (viewer: ScreeningReviewViewer) =>
  async (req: Request, res: Response): Promise<void> => {
    const actor = resolveActor(req, res, viewer);
    if (!actor) {
      return;
    }
    const params = responseParamSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ message: "Invalid response id" });
      return;
    }

    try {
      const result = await acknowledgeScreeningReview({
        ...actor,
        viewer,
        responseId: params.data.responseId,
        ipAddress: getRequestIpAddress(req),
      });
      if (!result.ok) {
        res.status(result.code === "NOT_ELIGIBLE" ? 400 : 404).json({ message: "ไม่พบผลคัดกรอง" });
        return;
      }
      res.status(200).json({ message: "รับทราบแล้ว", alreadyAcknowledged: result.alreadyAcknowledged });
    } catch (error) {
      console.error("Acknowledge screening review error:", error);
      res.status(500).json({ message: "Failed to acknowledge screening review" });
    }
  };

/** สร้างส่งต่อจากผลคัดกรอง (ผู้ตรวจที่เป็นมนุษย์กดเอง) พร้อม sourceType/sourceId */
export const makeCreateReferralFromScreening =
  (viewer: ScreeningReviewViewer) =>
  async (req: Request, res: Response): Promise<void> => {
    const actor = resolveActor(req, res, viewer);
    if (!actor) {
      return;
    }
    const params = responseParamSchema.safeParse(req.params);
    const body = createReferralBodySchema.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ message: "Invalid payload" });
      return;
    }

    try {
      const result = await createReferralFromScreening({
        ...actor,
        viewer,
        responseId: params.data.responseId,
        target: body.data.target,
        reason: body.data.reason,
        isUrgent: body.data.isUrgent,
        ipAddress: getRequestIpAddress(req),
      });

      if (!result.ok) {
        const status =
          result.code === "ACTIVE_REFERRAL"
            ? 409
            : result.code === "FORBIDDEN_TARGET"
              ? 403
              : result.code === "NOT_ELIGIBLE"
                ? 400
                : 404;
        res.status(status).json({ message: result.message });
        return;
      }

      res.status(201).json({ message: "ส่งต่อเคสสำเร็จ", referral: result.referral });
    } catch (error) {
      console.error("Create referral from screening error:", error);
      res.status(500).json({ message: "Failed to create referral" });
    }
  };
