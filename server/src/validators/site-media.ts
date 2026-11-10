import { SiteMediaSlot } from "@prisma/client";
import { z } from "zod";

const optionalTrimmed = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((value) => {
    if (value == null) return null;
    const next = value.trim();
    return next.length > 0 ? next : null;
  });

export const siteMediaSlotSchema = z.nativeEnum(SiteMediaSlot);

export const createSiteMediaSchema = z
  .object({
    slot: siteMediaSlotSchema,
    title: z.string().trim().min(1).max(120),
    altText: z.string().trim().max(200).optional().default(""),
    imageDataUrl: z.string().min(32).max(3_500_000),
    href: optionalTrimmed,
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
  .strict();

export const updateSiteMediaSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    altText: z.string().trim().max(200).optional(),
    imageDataUrl: z.string().min(32).max(3_500_000).optional(),
    href: optionalTrimmed,
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
