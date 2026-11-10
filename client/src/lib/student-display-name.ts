import { stripKnownNamePrefix } from "@/lib/name-prefix";

/**
 * ดึงชื่อจริง (ไม่รวมคำนำหน้า) สำหรับทักทาย เช่น "สวัสดี สมชาย"
 * ใช้กฎตัดคำนำหน้าเดียวกับ initials
 */
export const getStudentPreferredFirstName = (
  fullName: string | null | undefined,
  fallback = "นักศึกษา"
): string => {
  const personal = stripKnownNamePrefix(fullName || "");
  const nameParts = personal.split(/\s+/).filter(Boolean);

  if (nameParts.length === 0) {
    return fallback;
  }

  return nameParts[0] || fallback;
};
