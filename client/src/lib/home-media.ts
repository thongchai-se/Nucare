export type HomeHeroSlide = {
  id: string;
  /** ใส่พาธรูปใน `public/home-gallery/` เช่น `/home-gallery/hero-01.jpg` — ว่างไว้แสดงช่องว่าง */
  src: string;
  title: string;
  alt: string;
};

export type HomeGalleryItem = {
  id: string;
  /** ใส่พาธรูปใน `public/home-gallery/` เช่น `/home-gallery/01.jpg` — ว่างไว้แสดงช่องว่างสำหรับใส่รูป */
  src: string;
  title: string;
  alt: string;
};

export type HomeYoutubeConfig = {
  /** ลิงก์ YouTube เต็ม เช่น https://www.youtube.com/watch?v=XXXX หรือ https://youtu.be/XXXX */
  url: string;
  title: string;
  description: string;
};

/**
 * ค่าเริ่มต้น/สำรองของสื่อหน้าแรก
 * - แอดมินจัดการรูปจริงได้ที่ `/admin/site-media` (ช่อง HOME_HERO / HOME_GALLERY)
 * - ถ้ายังไม่มีรายการในฐานข้อมูล จะใช้ค่าด้านล่าง (ช่องว่าง) เป็น placeholder
 * - คลิป YouTube ยังตั้งใน `homeYoutube` ที่นี่
 */
export const homeHeroSlides: HomeHeroSlide[] = [
  {
    id: "hero-1",
    src: "",
    title: "ภาพประชาสัมพันธ์คณะ",
    alt: "ภาพประชาสัมพันธ์คณะพยาบาลศาสตร์",
  },
  {
    id: "hero-2",
    src: "",
    title: "กิจกรรมดูแลสุขภาพใจนักศึกษา",
    alt: "ภาพกิจกรรมดูแลสุขภาพใจนักศึกษา",
  },
  {
    id: "hero-3",
    src: "",
    title: "แนะนำระบบ Nucare",
    alt: "ภาพแนะนำระบบ Nucare",
  },
];

export const homeGalleryItems: HomeGalleryItem[] = [
  {
    id: "gallery-1",
    src: "",
    title: "กิจกรรมดูแลสุขภาพใจ",
    alt: "ภาพกิจกรรมดูแลสุขภาพใจ",
  },
  {
    id: "gallery-2",
    src: "",
    title: "ปฐมนิเทศและแนะนำระบบ",
    alt: "ภาพปฐมนิเทศและแนะนำระบบ Nucare",
  },
  {
    id: "gallery-3",
    src: "",
    title: "อบรมอาจารย์ที่ปรึกษา",
    alt: "ภาพอบรมอาจารย์ที่ปรึกษา",
  },
  {
    id: "gallery-4",
    src: "",
    title: "กิจกรรมส่งเสริมสุขภาวะ",
    alt: "ภาพกิจกรรมส่งเสริมสุขภาวะนักศึกษา",
  },
  {
    id: "gallery-5",
    src: "",
    title: "งานบริการวิชาการ",
    alt: "ภาพงานบริการวิชาการของคณะ",
  },
  {
    id: "gallery-6",
    src: "",
    title: "กิจกรรมนักศึกษา",
    alt: "ภาพกิจกรรมนักศึกษาคณะพยาบาลศาสตร์",
  },
];

export const homeYoutube: HomeYoutubeConfig = {
  /** ว่าง = แสดงช่องว่าง; ใส่ลิงก์จริงเมื่อมีคลิปแนะนำระบบ */
  url: "",
  title: "แนะนำระบบ Nucare",
  description: "คลิปแนะนำระบบจากคณะ (ใส่ลิงก์ใน home-media.ts)",
};

export const getYoutubeEmbedId = (url: string): string | null => {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }

    const fromQuery = parsed.searchParams.get("v");
    if (fromQuery) {
      return fromQuery;
    }

    const embedMatch = parsed.pathname.match(/\/embed\/([^/]+)/);
    if (embedMatch?.[1]) {
      return embedMatch[1];
    }

    const shortsMatch = parsed.pathname.match(/\/shorts\/([^/]+)/);
    if (shortsMatch?.[1]) {
      return shortsMatch[1];
    }
  } catch {
    return null;
  }

  return null;
};
