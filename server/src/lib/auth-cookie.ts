/**
 * อ่านว่า cookie auth ต้องใช้ Secure หรือไม่
 * production ค่าเริ่มต้น true — ปิดได้เฉพาะเมื่อตั้ง AUTH_COOKIE_ALLOW_INSECURE=true ชัดเจน
 */
export function resolveAuthCookieSecure(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const configured = env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  const allowInsecure =
    env.AUTH_COOKIE_ALLOW_INSECURE?.trim().toLowerCase() === "true";

  if (configured === "true") {
    return true;
  }

  if (configured === "false") {
    if (env.NODE_ENV === "production" && !allowInsecure) {
      return true;
    }
    return false;
  }

  return env.NODE_ENV === "production";
}
