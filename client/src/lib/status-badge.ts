import {
  UI_STATUS_ACTIVE,
  UI_STATUS_DANGER,
  UI_STATUS_DONE,
  UI_STATUS_PENDING,
} from "@/lib/ui-classes";

/**
 * รูปทรงแบดจ์สถานะ/เร่งด่วนในรายการเคส — ใช้ร่วมทุกบทบาท
 * คู่สีต้องเป็นทึบ + text-white เท่านั้น (UI_STATUS_*) ห้าม pastel
 */
export const STATUS_BADGE_COMPACT =
  "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white";

/** คลาสสีสถานะ referral มาตรฐาน */
export function referralStatusBadgeClass(
  status: "PENDING" | "ACCEPTED" | "CLOSED"
): string {
  if (status === "PENDING") return UI_STATUS_PENDING;
  if (status === "ACCEPTED") return UI_STATUS_ACTIVE;
  return UI_STATUS_DONE;
}

export const URGENT_BADGE_CLASS = UI_STATUS_DANGER;
