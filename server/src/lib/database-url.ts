/**
 * ปรับ DATABASE_URL สำหรับ Neon/PostgreSQL ให้เข้ากับ Prisma บน Express (รันยาว)
 * และบน serverless โดยไม่ทับรหัสผ่านใน log
 */

export type DatabaseUrlRuntime = "long-running" | "serverless";

const NEON_HOST_SUFFIX = ".neon.tech";

export type NormalizeDatabaseUrlOptions = {
  /** long-running = Express/local; serverless = Vercel ฯลฯ */
  runtime?: DatabaseUrlRuntime;
};

/** ตรวจว่า host เป็น Neon (รวมแบบ pooler) */
export function isNeonDatabaseHost(hostname: string): boolean {
  return hostname.toLowerCase().endsWith(NEON_HOST_SUFFIX);
}

/** แปลง host แบบ pooler เป็น direct (ตัด -pooler ก่อนโดเมนย่อย) */
export function toNeonDirectHost(hostname: string): string {
  return hostname.replace(/-pooler\./i, ".");
}

/** แปลง host direct เป็น pooler ของ Neon */
export function toNeonPoolerHost(hostname: string): string {
  if (/-pooler\./i.test(hostname)) {
    return hostname;
  }
  const dot = hostname.indexOf(".");
  if (dot <= 0) {
    return hostname;
  }
  return `${hostname.slice(0, dot)}-pooler${hostname.slice(dot)}`;
}

function setSearchParam(url: URL, key: string, value: string | null): void {
  if (value === null) {
    url.searchParams.delete(key);
    return;
  }
  url.searchParams.set(key, value);
}

/**
 * ปรับ query/host ของ Neon ให้ Prisma ใช้นิ่ง: Express ใช้ direct; serverless ใช้ pooler+pgbouncer
 */
export function normalizeDatabaseUrl(
  rawUrl: string,
  options: NormalizeDatabaseUrlOptions = {}
): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return trimmed;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return trimmed;
  }

  if (!isNeonDatabaseHost(url.hostname)) {
    return trimmed;
  }

  const runtime =
    options.runtime ??
    (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME ? "serverless" : "long-running");

  // channel_binding=require มักทำให้ไดรเวอร์ตัดการเชื่อมต่อกับ Neon ได้ง่าย
  setSearchParam(url, "channel_binding", null);
  setSearchParam(url, "sslmode", "require");

  if (runtime === "serverless") {
    url.hostname = toNeonPoolerHost(url.hostname);
    setSearchParam(url, "pgbouncer", "true");
    setSearchParam(url, "connect_timeout", url.searchParams.get("connect_timeout") || "15");
    if (!url.searchParams.has("connection_limit")) {
      setSearchParam(url, "connection_limit", "1");
    }
  } else {
    // Express มี connection pool ของ Prisma เอง — อย่าใช้ Neon pooler
    url.hostname = toNeonDirectHost(url.hostname);
    setSearchParam(url, "pgbouncer", null);
    setSearchParam(url, "connection_limit", null);
    setSearchParam(url, "connect_timeout", url.searchParams.get("connect_timeout") || "15");
  }

  return url.toString();
}

/** สร้าง DIRECT_URL สำหรับ migrate เมื่อมีแค่ pooler URL */
export function toNeonDirectDatabaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return trimmed;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return trimmed;
  }

  if (!isNeonDatabaseHost(url.hostname)) {
    return trimmed;
  }

  url.hostname = toNeonDirectHost(url.hostname);
  setSearchParam(url, "channel_binding", null);
  setSearchParam(url, "pgbouncer", null);
  setSearchParam(url, "connection_limit", null);
  setSearchParam(url, "sslmode", "require");
  return url.toString();
}
