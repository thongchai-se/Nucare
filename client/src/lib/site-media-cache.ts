import type { SiteMediaItemDto, SiteMediaSlot } from "@/lib/site-media-api";

const CACHE_PREFIX = "nucare:site-media:v1:";
/** อายุแคชสื่อสาธารณะ — รีเฟรชแล้วยังโชว์รูปเดิมทันที แล้วค่อยดึงใหม่ */
export const SITE_MEDIA_CACHE_MAX_AGE_MS = 30 * 60 * 1000;

type SiteMediaCacheEnvelope = {
  savedAt: number;
  items: SiteMediaItemDto[];
};

function cacheKey(slot: SiteMediaSlot): string {
  return `${CACHE_PREFIX}${slot}`;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** ตรวจว่าซองแคชยังใช้ได้และมีรายการเป็นอาร์เรย์ */
export function parseSiteMediaCacheEnvelope(
  raw: string | null,
  nowMs: number = Date.now(),
  maxAgeMs: number = SITE_MEDIA_CACHE_MAX_AGE_MS
): SiteMediaItemDto[] | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SiteMediaCacheEnvelope>;
    if (
      typeof parsed.savedAt !== "number" ||
      !Number.isFinite(parsed.savedAt) ||
      !Array.isArray(parsed.items)
    ) {
      return null;
    }
    if (nowMs - parsed.savedAt > maxAgeMs) {
      return null;
    }
    return parsed.items as SiteMediaItemDto[];
  } catch {
    return null;
  }
}

/** อ่านแคชสื่อสาธารณะตามช่อง — หมดอายุหรือพังแล้วคืน null */
export function readSiteMediaCache(slot: SiteMediaSlot): SiteMediaItemDto[] | null {
  if (!canUseStorage()) {
    return null;
  }
  try {
    return parseSiteMediaCacheEnvelope(window.localStorage.getItem(cacheKey(slot)));
  } catch {
    return null;
  }
}

/** เขียนแคชสื่อสาธารณะหลังดึงสำเร็จ (รวมอาร์เรย์ว่าง) */
export function writeSiteMediaCache(slot: SiteMediaSlot, items: SiteMediaItemDto[]): void {
  if (!canUseStorage()) {
    return;
  }
  const envelope: SiteMediaCacheEnvelope = {
    savedAt: Date.now(),
    items,
  };
  try {
    window.localStorage.setItem(cacheKey(slot), JSON.stringify(envelope));
  } catch {
    // quota / private mode — ข้ามได้ ไม่กระทบการแสดงผล
  }
}

/** ล้างแคชช่องเดียวหรือทุกช่องหลังแอดมินแก้สื่อ */
export function clearSiteMediaCache(slot?: SiteMediaSlot): void {
  if (!canUseStorage()) {
    return;
  }
  try {
    if (slot) {
      window.localStorage.removeItem(cacheKey(slot));
      return;
    }
    const keysToRemove: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}
