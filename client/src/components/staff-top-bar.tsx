"use client";

import { Menu } from "lucide-react";
import { STAFF_TOP_HEADER } from "@/lib/ui-classes";

type StaffTopBarProps = {
  onOpenMenu: () => void;
};

/**
 * แถบบนพอร์ทัล staff — คงความสูงเส้นขอบกับ sidebar; มือถือมีแค่ปุ่มเมนู
 * (ไม่แสดงชื่อพอร์ทัล / สถานะ / โปรไฟล์ตามที่ล็อกไว้)
 */
export function StaffTopBar({ onOpenMenu }: StaffTopBarProps) {
  return (
    <header className={STAFF_TOP_HEADER}>
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="เปิดหรือปิดเมนู"
        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>
    </header>
  );
}
