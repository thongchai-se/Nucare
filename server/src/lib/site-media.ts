import { SiteMediaSlot } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const SITE_MEDIA_UPLOAD_DIR = path.join(process.cwd(), "uploads", "site-media");
export const SITE_MEDIA_PUBLIC_PREFIX = "/api/uploads/site-media";

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** ขนาดไฟล์สูงสุดหลัง decode (2 MiB) */
export const SITE_MEDIA_MAX_BYTES = 2 * 1024 * 1024;

export type ParsedDataImage = {
  mime: string;
  extension: string;
  buffer: Buffer;
};

/** ตรวจ slot ที่รองรับ */
export function isSiteMediaSlot(value: string): value is SiteMediaSlot {
  return (
    value === SiteMediaSlot.HOME_HERO ||
    value === SiteMediaSlot.HOME_GALLERY ||
    value === SiteMediaSlot.STUDENT_ACTIVITY
  );
}

/** แปลง data URL รูปเป็น buffer — ปฏิเสธชนิด/ขนาดที่ไม่ปลอดภัย */
export function parseImageDataUrl(dataUrl: string): ParsedDataImage | { error: string } {
  const trimmed = dataUrl.trim();
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(trimmed);
  if (!match) {
    return { error: "รองรับเฉพาะรูป JPEG / PNG / WebP แบบ data URL" };
  }

  const mime = match[1].toLowerCase();
  const extension = ALLOWED_MIME_TO_EXT[mime];
  if (!extension) {
    return { error: "ชนิดไฟล์ไม่รองรับ" };
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
  } catch {
    return { error: "ถอดรหัสรูปไม่สำเร็จ" };
  }

  if (buffer.length === 0) {
    return { error: "ไฟล์ว่าง" };
  }
  if (buffer.length > SITE_MEDIA_MAX_BYTES) {
    return { error: "ไฟล์ใหญ่เกิน 2 MB" };
  }

  return { mime, extension, buffer };
}

/** สร้างชื่อไฟล์สุ่มภายใต้โฟลเดอร์อัปโหลด */
export function buildSiteMediaFileName(extension: string): string {
  const stamp = Date.now().toString(36);
  const rand = randomBytes(8).toString("hex");
  const hash = createHash("sha256").update(`${stamp}-${rand}`).digest("hex").slice(0, 10);
  return `${stamp}-${hash}.${extension}`;
}

/** บันทึกรูปลงดิสก์ แล้วคืนชื่อไฟล์ */
export async function saveSiteMediaImage(buffer: Buffer, extension: string): Promise<string> {
  await mkdir(SITE_MEDIA_UPLOAD_DIR, { recursive: true });
  const fileName = buildSiteMediaFileName(extension);
  const absolute = path.join(SITE_MEDIA_UPLOAD_DIR, fileName);
  await writeFile(absolute, buffer);
  return fileName;
}

/** ลบไฟล์รูปถ้าอยู่ในโฟลเดอร์ที่อนุญาต */
export async function deleteSiteMediaImage(imagePath: string): Promise<void> {
  const base = path.basename(imagePath);
  if (!base || base !== imagePath || base.includes("..")) {
    return;
  }
  const absolute = path.join(SITE_MEDIA_UPLOAD_DIR, base);
  try {
    await unlink(absolute);
  } catch {
    // ไฟล์อาจถูกลบไปแล้ว
  }
}

/** URL สาธารณะสำหรับแสดงรูป (ผ่าน proxy /api) */
export function toSiteMediaPublicUrl(imagePath: string): string {
  const base = path.basename(imagePath);
  return `${SITE_MEDIA_PUBLIC_PREFIX}/${encodeURIComponent(base)}`;
}

export function serializeSiteMediaItem(item: {
  id: string;
  slot: SiteMediaSlot;
  title: string;
  altText: string;
  imagePath: string;
  href: string | null;
  ctaLabel: string | null;
  tag: string | null;
  summary: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: item.id,
    slot: item.slot,
    title: item.title,
    altText: item.altText,
    imageUrl: toSiteMediaPublicUrl(item.imagePath),
    href: item.href,
    ctaLabel: item.ctaLabel,
    tag: item.tag,
    summary: item.summary,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}
