/**
 * ตรวจ Origin / Sec-Fetch-Site ของคำขอที่เปลี่ยนสถานะ — กัน CSRF จากโดเมนอื่น
 * production: ต้องมี Origin ใน allowlist หรือ Sec-Fetch-Site เป็น same-origin/same-site
 */
export function isUnsafeMethodOriginAllowed(input: {
  method: string;
  origin: string | undefined;
  secFetchSite: string | undefined;
  allowedOrigins: ReadonlySet<string>;
  isProduction: boolean;
}): boolean {
  const method = input.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true;
  }

  const origin = input.origin?.trim();
  if (origin) {
    return input.allowedOrigins.has(origin);
  }

  if (!input.isProduction) {
    // local tools / curl ใน dev อนุญาตเมื่อไม่มี Origin
    return true;
  }

  const site = (input.secFetchSite || "").toLowerCase();
  return site === "same-origin" || site === "same-site";
}
