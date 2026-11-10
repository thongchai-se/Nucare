"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

type StaffModalOverlayProps = {
  children: ReactNode;
  /** ความกว้างแผง modal เช่น max-w-xl / max-w-2xl */
  panelClassName?: string;
};

/**
 * Overlay modal ผ่าน portal ไป document.body — กัน backdrop ติดอยู่ใน main ที่ overflow
 * ใช้ overflow-hidden ที่ชั้นนอก เพื่อไม่ให้สกอลล์บาร์ซ้อนดันเลย์เอาต์พื้นหลัง
 */
export function StaffModalOverlay({
  children,
  panelClassName = "max-w-2xl",
}: StaffModalOverlayProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useBodyScrollLock(mounted);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-center justify-center overflow-hidden bg-slate-900/45 p-3 sm:p-4">
      <div
        className={`flex min-h-0 max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] ${panelClassName}`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
