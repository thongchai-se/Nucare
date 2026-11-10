const ENGLISH_API_MESSAGE_TH: Record<string, string> = {
  Unauthorized: "ไม่มีสิทธิ์เข้าถึง กรุณาเข้าสู่ระบบใหม่",
  Forbidden: "ไม่มีสิทธิ์ดำเนินการนี้",
  "Not found": "ไม่พบข้อมูลที่ต้องการ",
  "Invalid payload": "ข้อมูลที่ส่งไม่ถูกต้อง",
  "Invalid query": "คำค้นไม่ถูกต้อง",
  "Invalid credentials": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  "Failed to fetch student dashboard": "โหลดหน้าหลักนิสิตไม่สำเร็จ",
  "Failed to list consultation requests": "โหลดคำขอปรึกษาไม่สำเร็จ",
  "Failed to create consultation request": "ส่งคำขอปรึกษาไม่สำเร็จ",
  "Failed to cancel consultation request": "ยกเลิกคำขอไม่สำเร็จ",
  "Failed to list alerts": "โหลดการแจ้งเตือนไม่สำเร็จ",
  "Failed to fetch student development dashboard": "โหลดแดชบอร์ดพัฒนานักศึกษาไม่สำเร็จ",
};

/** ถ้าข้อความ API เป็นอังกฤษเทคนิค ให้แปลเป็นไทยก่อนโชว์ผู้ใช้ */
function localizeApiMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (ENGLISH_API_MESSAGE_TH[trimmed]) {
    return ENGLISH_API_MESSAGE_TH[trimmed];
  }
  if (/^Failed to\b/i.test(trimmed) || /^Invalid\b/i.test(trimmed)) {
    return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
  }
  return trimmed;
}

/** ดึงข้อความ error จาก API response ให้เป็นภาษาคนอ่าน — ไม่โชว์ Axios raw message */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
  ) {
    const message = (error as { response: { data: { message: string } } }).response.data.message.trim();
    if (message) {
      return localizeApiMessage(message);
    }
  }

  if (error instanceof Error) {
    const raw = error.message.trim();
    if (/^Request failed with status code \d+$/i.test(raw)) {
      return fallback;
    }
    if (raw && !/^Network Error$/i.test(raw)) {
      if (!/status code|ECONNREFUSED|ETIMEDOUT|axios/i.test(raw)) {
        return localizeApiMessage(raw);
      }
    }
  }

  return fallback;
}
