import { SiteMediaSlot } from "@prisma/client";
import { z } from "zod";
import { sanitizeMediaHref, sanitizeYoutubeWatchUrl } from "../lib/site-media";

const optionalHref = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((value, ctx) => {
    if (value === undefined) return undefined;
    if (value == null) return null;
    const next = value.trim();
    if (!next) return null;
    const safe = sanitizeMediaHref(next);
    if (!safe) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ลิงก์ต้องเป็น path ในแอปหรือ URL แบบ http/https เท่านั้น",
      });
      return z.NEVER;
    }
    return safe;
  });

/** ระบุค่าชัดเจน — ไม่พึ่ง Prisma enum ที่อาจค้างใน process เก่าหลัง migrate */
export const siteMediaSlotSchema = z.enum([
  "HOME_HERO",
  "HOME_GALLERY",
  "HOME_VIDEO",
  "STUDENT_ACTIVITY",
]);

export const createSiteMediaSchema = z
  .object({
    slot: siteMediaSlotSchema,
    title: z.string().trim().min(1).max(120),
    altText: z.string().trim().max(200).optional().default(""),
    imageDataUrl: z.string().min(32).max(3_500_000).optional(),
    href: z.string().trim().max(500).optional().nullable(),
    ctaLabel: z
      .string()
      .trim()
      .max(40)
      .optional()
      .nullable()
      .transform((value) => {
        if (value == null) return null;
        const next = value.trim();
        return next.length > 0 ? next : null;
      }),
    tag: z
      .string()
      .trim()
      .max(40)
      .optional()
      .nullable()
      .transform((value) => {
        if (value == null) return null;
        const next = value.trim();
        return next.length > 0 ? next : null;
      }),
    summary: z
      .string()
      .trim()
      .max(280)
      .optional()
      .nullable()
      .transform((value) => {
        if (value == null) return null;
        const next = value.trim();
        return next.length > 0 ? next : null;
      }),
    sortOrder: z.number().int().min(0).max(9999).optional().default(0),
    isActive: z.boolean().optional().default(true),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.slot === SiteMediaSlot.HOME_VIDEO) {
      const youtube = sanitizeYoutubeWatchUrl(data.href);
      if (!youtube) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["href"],
          message: "กรุณาใส่ลิงก์ YouTube ที่ถูกต้อง",
        });
      }
      return;
    }

    if (!data.imageDataUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["imageDataUrl"],
        message: "กรุณาเลือกรูปภาพ",
      });
    }

    if (data.href != null && data.href.trim()) {
      const safe = sanitizeMediaHref(data.href);
      if (!safe) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["href"],
          message: "ลิงก์ต้องเป็น path ในแอปหรือ URL แบบ http/https เท่านั้น",
        });
      }
    }
  })
  .transform((data) => {
    if (data.slot === SiteMediaSlot.HOME_VIDEO) {
      return {
        ...data,
        href: sanitizeYoutubeWatchUrl(data.href),
        imageDataUrl: undefined,
      };
    }

    return {
      ...data,
      href:
        data.href == null || !String(data.href).trim()
          ? null
          : sanitizeMediaHref(data.href),
    };
  });

export const updateSiteMediaSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    altText: z.string().trim().max(200).optional(),
    imageDataUrl: z.string().min(32).max(3_500_000).optional(),
    href: optionalHref,
    ctaLabel: z
      .string()
      .trim()
      .max(40)
      .optional()
      .nullable()
      .transform((value) => {
        if (value === undefined) return undefined;
        if (value == null) return null;
        const next = value.trim();
        return next.length > 0 ? next : null;
      }),
    tag: z
      .string()
      .trim()
      .max(40)
      .optional()
      .nullable()
      .transform((value) => {
        if (value === undefined) return undefined;
        if (value == null) return null;
        const next = value.trim();
        return next.length > 0 ? next : null;
      }),
    summary: z
      .string()
      .trim()
      .max(280)
      .optional()
      .nullable()
      .transform((value) => {
        if (value === undefined) return undefined;
        if (value == null) return null;
        const next = value.trim();
        return next.length > 0 ? next : null;
      }),
    sortOrder: z.number().int().min(0).max(9999).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: "ไม่มีข้อมูลให้อัปเดต" });

export const listSiteMediaQuerySchema = z
  .object({
    slot: siteMediaSlotSchema.optional(),
    includeInactive: z
      .union([z.literal("1"), z.literal("true"), z.literal("0"), z.literal("false")])
      .optional()
      .transform((value) => value === "1" || value === "true"),
  })
  .strict();

export const reorderSiteMediaSchema = z
  .object({
    slot: siteMediaSlotSchema,
    orderedIds: z
      .array(z.string().trim().min(1).max(128))
      .min(1)
      .max(200)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "รายการรหัสซ้ำกันไม่ได้",
      }),
  })
  .strict();
