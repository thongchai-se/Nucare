import { SiteMediaSlot } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const SITE_MEDIA_UPLOAD_DIR = path.join(process.cwd(), "uploads", "site-media");
export const SITE_MEDIA_PUBLIC_PREFIX = "/api/uploads/site-media";

/** รายการคลิปที่เก็บแค่ลิงก์ ไม่มีไฟล์รูปในดิสก์ */
export const SITE_MEDIA_LINK_ONLY_PATH = "__link__";

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
    value === SiteMediaSlot.HOME_VIDEO ||
    value === SiteMediaSlot.STUDENT_ACTIVITY
  );
}

/** คำนวณลำดับถัดไปจากค่าสูงสุดในช่อง — รายการแรกได้ 0 */
export function resolveNextSortOrder(maxSortOrder: number | null | undefined): number {
  if (maxSortOrder == null || !Number.isFinite(maxSortOrder)) {
    return 0;
  }
  return Math.min(9999, Math.floor(maxSortOrder) + 1);
}

/** สร้างคู่ id→sortOrder ตามลำดับที่ลากจัด (เบา ไม่ต้องคำนวณหนัก) */
export function buildReorderSortAssignments(
  orderedIds: string[]
): Array<{ id: string; sortOrder: number }> {
  return orderedIds.map((id, index) => ({ id, sortOrder: index }));
}

/** รายการที่ไม่มีไฟล์รูป (คลิปจากลิงก์) */
export function isLinkOnlySiteMediaPath(imagePath: string | null | undefined): boolean {
  return !imagePath || imagePath === SITE_MEDIA_LINK_ONLY_PATH;
}

/**
 * ดึงรหัสวิดีโอ YouTube จากลิงก์ที่รองรับ
 * (watch / youtu.be / embed / shorts)
 */
export function parseYoutubeVideoId(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "youtube.com" && host !== "m.youtube.com" && host !== "youtu.be" && host !== "youtube-nocookie.com") {
      return null;
    }

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id && /^[\w-]{6,}$/i.test(id) ? id : null;
    }

    const fromQuery = parsed.searchParams.get("v");
    if (fromQuery && /^[\w-]{6,}$/i.test(fromQuery)) {
      return fromQuery;
    }

    const embedMatch = parsed.pathname.match(/\/(?:embed|shorts)\/([^/?#]+)/i);
    if (embedMatch?.[1] && /^[\w-]{6,}$/i.test(embedMatch[1])) {
      return embedMatch[1];
    }
  } catch {
    return null;
  }

  return null;
}

/** ตรวจและคืนลิงก์ YouTube มาตรฐาน — ไม่ใช่ YouTube คืน null */
export function sanitizeYoutubeWatchUrl(value: string | null | undefined): string | null {
  const id = parseYoutubeVideoId(value);
  if (!id) {
    return null;
  }
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
}

/** URL ปกคลิปจาก YouTube (ใช้แสดงตัวอย่าง) */
export function youtubePosterUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}

/**
 * ตรวจและคืนลิงก์สื่อที่ปลอดภัย — อนุญาตเฉพาะ path ในแอป หรือ http(s)
 * คืน null ถ้าว่างหรือโปรโตคอลไม่ปลอดภัย
 */
export function sanitizeMediaHref(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("\\") || trimmed.includes("\0")) {
    return null;
  }

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
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
  if (isLinkOnlySiteMediaPath(imagePath)) {
    return;
  }
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
  const isVideo = item.slot === SiteMediaSlot.HOME_VIDEO || isLinkOnlySiteMediaPath(item.imagePath);
  const href = isVideo
    ? sanitizeYoutubeWatchUrl(item.href) ?? sanitizeMediaHref(item.href)
    : sanitizeMediaHref(item.href);
  const youtubeId = isVideo ? parseYoutubeVideoId(href) : null;

  return {
    id: item.id,
    slot: item.slot,
    title: item.title,
    altText: item.altText,
    imageUrl: isLinkOnlySiteMediaPath(item.imagePath)
      ? youtubeId
        ? youtubePosterUrl(youtubeId)
        : ""
      : toSiteMediaPublicUrl(item.imagePath),
    href,
    ctaLabel: item.ctaLabel,
    tag: item.tag,
    summary: item.summary,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}
