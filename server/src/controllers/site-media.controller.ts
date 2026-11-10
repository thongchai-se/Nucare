import { SiteMediaSlot } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { canManageSiteMediaSlot, getManageableSiteMediaSlots } from "../lib/site-media-access";
import {
  deleteSiteMediaImage,
  parseImageDataUrl,
  saveSiteMediaImage,
  serializeSiteMediaItem,
} from "../lib/site-media";
import {
  createSiteMediaSchema,
  listSiteMediaQuerySchema,
  updateSiteMediaSchema,
} from "../validators/site-media";

const actorFromRequest = (req: Request) => {
  if (!req.user) {
    return undefined;
  }
  return {
    role: req.user.role,
    roles: req.user.roles,
  };
};

/** รายการสื่อสาธารณะตามช่อง — เฉพาะรายการที่เปิดใช้งาน */
export async function listPublicSiteMedia(req: Request, res: Response): Promise<void> {
  const parsed = listSiteMediaQuerySchema.safeParse({
    slot: typeof req.query.slot === "string" ? req.query.slot : undefined,
  });
  if (!parsed.success) {
    res.status(400).json({ message: "พารามิเตอร์ไม่ถูกต้อง", errors: parsed.error.flatten() });
    return;
  }

  const items = await prisma.siteMediaItem.findMany({
    where: {
      isActive: true,
      ...(parsed.data.slot ? { slot: parsed.data.slot } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  res.status(200).json({ items: items.map(serializeSiteMediaItem) });
}

/** รายการสื่อสำหรับผู้มีสิทธิ์จัดการ (กรองช่องตามบทบาท) */
export async function listManagedSiteMedia(req: Request, res: Response): Promise<void> {
  const allowedSlots = getManageableSiteMediaSlots(actorFromRequest(req));
  if (allowedSlots.length === 0) {
    res.status(403).json({ message: "ไม่มีสิทธิ์จัดการสื่อ" });
    return;
  }

  const parsed = listSiteMediaQuerySchema.safeParse({
    slot: typeof req.query.slot === "string" ? req.query.slot : undefined,
    includeInactive:
      typeof req.query.includeInactive === "string" ? req.query.includeInactive : undefined,
  });
  if (!parsed.success) {
    res.status(400).json({ message: "พารามิเตอร์ไม่ถูกต้อง", errors: parsed.error.flatten() });
    return;
  }

  if (parsed.data.slot && !allowedSlots.includes(parsed.data.slot)) {
    res.status(403).json({ message: "ไม่มีสิทธิ์ดูช่องสื่อนี้" });
    return;
  }

  const includeInactive = parsed.data.includeInactive === true;
  const items = await prisma.siteMediaItem.findMany({
    where: {
      slot: parsed.data.slot ? parsed.data.slot : { in: allowedSlots },
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ slot: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  res.status(200).json({ items: items.map(serializeSiteMediaItem) });
}

/** @deprecated ใช้ listManagedSiteMedia */
export const listAdminSiteMedia = listManagedSiteMedia;

/** เพิ่มสื่อใหม่พร้อมอัปโหลดรูป */
export async function createSiteMedia(req: Request, res: Response): Promise<void> {
  const parsed = createSiteMediaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง", errors: parsed.error.flatten() });
    return;
  }

  if (!canManageSiteMediaSlot(actorFromRequest(req), parsed.data.slot)) {
    res.status(403).json({ message: "ไม่มีสิทธิ์เพิ่มสื่อในช่องนี้" });
    return;
  }

  const image = parseImageDataUrl(parsed.data.imageDataUrl);
  if ("error" in image) {
    res.status(400).json({ message: image.error });
    return;
  }

  const imagePath = await saveSiteMediaImage(image.buffer, image.extension);
  try {
    const item = await prisma.siteMediaItem.create({
      data: {
        slot: parsed.data.slot,
        title: parsed.data.title,
        altText: parsed.data.altText || parsed.data.title,
        imagePath,
        href: parsed.data.href,
        ctaLabel: parsed.data.ctaLabel,
        tag: parsed.data.tag,
        summary: parsed.data.summary,
        sortOrder: parsed.data.sortOrder,
        isActive: parsed.data.isActive,
        createdByUserId: req.user?.userId ?? null,
      },
    });
    res.status(201).json({ item: serializeSiteMediaItem(item) });
  } catch (error) {
    await deleteSiteMediaImage(imagePath);
    throw error;
  }
}

/** แก้ไขเมตาดาตาหรือแทนที่รูป */
export async function updateSiteMedia(req: Request, res: Response): Promise<void> {
  const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
  if (!id) {
    res.status(400).json({ message: "ไม่พบรหัสรายการ" });
    return;
  }

  const parsed = updateSiteMediaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง", errors: parsed.error.flatten() });
    return;
  }

  const existing = await prisma.siteMediaItem.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ message: "ไม่พบรายการ" });
    return;
  }

  if (!canManageSiteMediaSlot(actorFromRequest(req), existing.slot)) {
    res.status(403).json({ message: "ไม่มีสิทธิ์แก้ไขสื่อในช่องนี้" });
    return;
  }

  let nextImagePath: string | undefined;
  let previousImagePath: string | undefined;
  if (parsed.data.imageDataUrl) {
    const image = parseImageDataUrl(parsed.data.imageDataUrl);
    if ("error" in image) {
      res.status(400).json({ message: image.error });
      return;
    }
    nextImagePath = await saveSiteMediaImage(image.buffer, image.extension);
    previousImagePath = existing.imagePath;
  }

  try {
    const item = await prisma.siteMediaItem.update({
      where: { id },
      data: {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.altText !== undefined ? { altText: parsed.data.altText } : {}),
        ...(nextImagePath ? { imagePath: nextImagePath } : {}),
        ...(parsed.data.href !== undefined ? { href: parsed.data.href } : {}),
        ...(parsed.data.ctaLabel !== undefined ? { ctaLabel: parsed.data.ctaLabel } : {}),
        ...(parsed.data.tag !== undefined ? { tag: parsed.data.tag } : {}),
        ...(parsed.data.summary !== undefined ? { summary: parsed.data.summary } : {}),
        ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
    });

    if (previousImagePath && previousImagePath !== item.imagePath) {
      await deleteSiteMediaImage(previousImagePath);
    }

    res.status(200).json({ item: serializeSiteMediaItem(item) });
  } catch (error) {
    if (nextImagePath) {
      await deleteSiteMediaImage(nextImagePath);
    }
    throw error;
  }
}

/** ลบสื่อและไฟล์รูป */
export async function deleteSiteMedia(req: Request, res: Response): Promise<void> {
  const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
  if (!id) {
    res.status(400).json({ message: "ไม่พบรหัสรายการ" });
    return;
  }

  const existing = await prisma.siteMediaItem.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ message: "ไม่พบรายการ" });
    return;
  }

  if (!canManageSiteMediaSlot(actorFromRequest(req), existing.slot)) {
    res.status(403).json({ message: "ไม่มีสิทธิ์ลบสื่อในช่องนี้" });
    return;
  }

  await prisma.siteMediaItem.delete({ where: { id } });
  await deleteSiteMediaImage(existing.imagePath);
  res.status(200).json({ ok: true });
}

export const SITE_MEDIA_SLOT_LABELS: Record<SiteMediaSlot, string> = {
  HOME_HERO: "แบนเนอร์หน้าแรก",
  HOME_GALLERY: "แกลเลอรีหน้าแรก",
  STUDENT_ACTIVITY: "กิจกรรมหน้านิสิต",
};
