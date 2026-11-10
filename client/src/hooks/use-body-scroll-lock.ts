"use client";

import { useEffect } from "react";
import { acquireBodyScrollLock } from "@/lib/body-scroll-lock";

/** ล็อกสกอลล์พื้นหลังขณะโมดัลเปิด — ปลดอัตโนมัติตอนปิดหรือ unmount */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) {
      return;
    }
    return acquireBodyScrollLock();
  }, [locked]);
}
