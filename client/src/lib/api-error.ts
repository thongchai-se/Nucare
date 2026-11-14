const FRIENDLY_SYSTEM_ERROR = "ระบบมีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้ง";
const FRIENDLY_PAYLOAD_TOO_LARGE =
  "ไฟล์หรือข้อมูลที่ส่งมีขนาดใหญ่เกินไป กรุณาเลือกรูปไม่เกิน 2 MB แล้วลองใหม่";

/** คีย์เป็นตัวพิมพ์เล็กทั้งหมด */
const ENGLISH_API_MESSAGE_TH: Record<string, string> = {
  unauthorized: "ไม่มีสิทธิ์เข้าถึง กรุณาเข้าสู่ระบบใหม่",
  forbidden: "ไม่มีสิทธิ์ดำเนินการนี้",
  "not found": "ไม่พบข้อมูลที่ต้องการ",
  "invalid payload": "ข้อมูลที่ส่งไม่ถูกต้อง",
  "invalid query": "คำค้นไม่ถูกต้อง",
  "invalid credentials": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  "internal server error": FRIENDLY_SYSTEM_ERROR,
  "something went wrong": FRIENDLY_SYSTEM_ERROR,
  "network error": "เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่",
  "request entity too large": FRIENDLY_PAYLOAD_TOO_LARGE,
  "payload too large": FRIENDLY_PAYLOAD_TOO_LARGE,
  "entity too large": FRIENDLY_PAYLOAD_TOO_LARGE,
  "failed to fetch student dashboard": "โหลดหน้าหลักนิสิตไม่สำเร็จ",
  "failed to list consultation requests": "โหลดคำขอปรึกษาไม่สำเร็จ",
  "failed to create consultation request": "ส่งคำขอปรึกษาไม่สำเร็จ",
  "failed to cancel consultation request": "ยกเลิกคำขอไม่สำเร็จ",
  "failed to list alerts": "โหลดการแจ้งเตือนไม่สำเร็จ",
  "failed to fetch student development dashboard": "โหลดแดชบอร์ดพัฒนานักศึกษาไม่สำเร็จ",
};

/** ถ้าข้อความ API เป็นอังกฤษเทคนิค ให้แปลเป็นไทยก่อนโชว์ผู้ใช้ */
function localizeApiMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return trimmed;
  }
  const mapped = ENGLISH_API_MESSAGE_TH[trimmed.toLowerCase()];
  if (mapped) {
    return mapped;
  }
  if (/entity too large|payload too large/i.test(trimmed)) {
    return FRIENDLY_PAYLOAD_TOO_LARGE;
  }
  if (
    /^Failed to\b/i.test(trimmed) ||
    /^Invalid\b/i.test(trimmed) ||
    /^Internal\b/i.test(trimmed) ||
    /^Error\b/i.test(trimmed) ||
    /^Prisma\b/i.test(trimmed) ||
    /^ECONN/i.test(trimmed) ||
    /^ETIMEDOUT/i.test(trimmed)
  ) {
    return FRIENDLY_SYSTEM_ERROR;
  }
  // ข้อความอังกฤษล้วนจากเซิร์ฟเวอร์ — ไม่โชว์ศัพท์เทคนิคให้ผู้ใช้
  if (!/[\u0E00-\u0E7F]/.test(trimmed) && /[A-Za-z]{3,}/.test(trimmed)) {
    return FRIENDLY_SYSTEM_ERROR;
  }
  return trimmed;
}

type AxiosLikeError = {
  response?: {
    status?: number;
    data?: { message?: string };
  };
  message?: string;
};

/** ดึงข้อความ error จาก API response ให้เป็นภาษาคนอ่าน — ไม่โชว์ Axios raw message */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const axiosError = error as AxiosLikeError;
    const status = axiosError.response?.status;
    const message =
      typeof axiosError.response?.data?.message === "string"
        ? axiosError.response.data.message.trim()
        : "";

    if (message) {
      return localizeApiMessage(message);
    }
    if (status === 413) {
      return FRIENDLY_PAYLOAD_TOO_LARGE;
    }
  }

  if (error instanceof Error) {
    const raw = error.message.trim();
    if (/^Request failed with status code 413$/i.test(raw)) {
      return FRIENDLY_PAYLOAD_TOO_LARGE;
    }
    if (/^Request failed with status code \d+$/i.test(raw)) {
      return fallback;
    }
    if (raw) {
      return localizeApiMessage(raw);
    }
  }

  return fallback;
}
