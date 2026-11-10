export type SiteMediaSlot = "HOME_HERO" | "HOME_GALLERY" | "STUDENT_ACTIVITY";

export type SiteMediaItemDto = {
  id: string;
  slot: SiteMediaSlot;
  title: string;
  altText: string;
  imageUrl: string;
  href: string | null;
  ctaLabel: string | null;
  tag: string | null;
  summary: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

/** ดึงรายการสื่อสาธารณะตามช่อง — ล้มเหลวแล้วคืนอาร์เรย์ว่าง */
export async function fetchPublicSiteMedia(slot: SiteMediaSlot): Promise<SiteMediaItemDto[]> {
  try {
    const response = await fetch(`/api/site-media?slot=${encodeURIComponent(slot)}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) {
      return [];
    }
    const data = (await response.json()) as { items?: SiteMediaItemDto[] };
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

/** อ่านไฟล์รูปเป็น data URL สำหรับส่งอัปโหลด */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    };
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}
