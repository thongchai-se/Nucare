export type ResolvedMediaHref = {
  href: string;
  external: boolean;
};

/**
 * ตรวจลิงก์จากสื่อประชาสัมพันธ์ — อนุญาตเฉพาะ path ในแอป หรือ http(s)
 * คืน null ถ้าไม่ปลอดภัยหรือว่าง
 */
export function resolveMediaHref(value: string | null | undefined): ResolvedMediaHref | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("\\") || trimmed.includes("\0")) {
    return null;
  }

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return { href: trimmed, external: false };
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return { href: url.toString(), external: true };
  } catch {
    return null;
  }
}
