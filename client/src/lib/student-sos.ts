import { getApiErrorMessage } from "@/lib/student-dashboard";

/**
 * รันการแจ้ง SOS แล้วคืนผลสำเร็จ/ข้อความผิดพลาด
 * — ไม่กลืน error เพื่อไม่ให้ UI ปิด dialog แบบสำเร็จปลอม
 */
export async function runStudentSosRequest(
  submit: () => Promise<void>
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await submit();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: getApiErrorMessage(error, "ไม่สามารถส่งเคส SOS ได้ กรุณาโทร 1323"),
    };
  }
}
