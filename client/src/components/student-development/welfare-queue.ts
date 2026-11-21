import type { WelfareReferralStatus, WelfareTask } from "./types";

export type WelfareFilter = "ALL" | WelfareReferralStatus;

/** ขอบเขตเคสกำลังประสาน — ของฉัน (ค่าเริ่มต้น) หรือทั้งหมดในทีม */
export type WelfareOwnershipScope = "mine" | "all";

/** นับเคสตามสถานะ referral สำหรับชิปกรอง */
export function summarizeWelfareTasks(tasks: WelfareTask[]): Record<WelfareFilter, number> {
  let pending = 0;
  let accepted = 0;
  let closed = 0;
  for (const task of tasks) {
    if (task.referralStatus === "PENDING") pending += 1;
    else if (task.referralStatus === "ACCEPTED") accepted += 1;
    else closed += 1;
  }
  return { ALL: tasks.length, PENDING: pending, ACCEPTED: accepted, CLOSED: closed };
}

/** นับเคสกำลังประสานที่ฉันรับ vs ทั้งหมด */
export function summarizeAcceptedOwnership(
  tasks: WelfareTask[],
  currentUserId: string | null | undefined
): { mine: number; all: number } {
  let mine = 0;
  let all = 0;
  for (const task of tasks) {
    if (task.referralStatus !== "ACCEPTED") {
      continue;
    }
    all += 1;
    if (currentUserId && task.acceptedByUserId === currentUserId) {
      mine += 1;
    }
  }
  return { mine, all };
}

/** กรองรายการตามสถานะ คำค้น และขอบเขตเจ้าของ (เฉพาะ ACCEPTED) — O(n) */
export function filterWelfareTasks(
  tasks: WelfareTask[],
  activeFilter: WelfareFilter,
  searchQuery: string,
  options?: {
    ownershipScope?: WelfareOwnershipScope;
    currentUserId?: string | null;
  }
): WelfareTask[] {
  const keyword = searchQuery.trim().toLowerCase();
  const ownershipScope = options?.ownershipScope ?? "all";
  const currentUserId = options?.currentUserId ?? null;

  return tasks.filter((task) => {
    if (activeFilter !== "ALL" && task.referralStatus !== activeFilter) {
      return false;
    }
    if (
      activeFilter === "ACCEPTED" &&
      ownershipScope === "mine" &&
      (!currentUserId || task.acceptedByUserId !== currentUserId)
    ) {
      return false;
    }
    if (!keyword) {
      return true;
    }
    const haystack = [
      task.studentName,
      task.studentCode,
      task.title,
      task.owner,
      task.acceptedByName,
      task.note,
      task.year,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(keyword);
  });
}
