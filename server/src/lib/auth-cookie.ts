/** อ่านว่า cookie auth ต้องใช้ Secure หรือไม่ — production ค่าเริ่มต้น true แต่ faculty HTTP staging ตั้ง false ได้ */
export function resolveAuthCookieSecure(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const configured = env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  if (configured === "true") {
    return true;
  }
  if (configured === "false") {
    return false;
  }

  return env.NODE_ENV === "production";
}
