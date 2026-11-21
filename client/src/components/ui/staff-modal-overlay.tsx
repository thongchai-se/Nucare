"use client";

import type { ReactNode } from "react";
import { AppDialogShell } from "@/components/ui/app-dialog-shell";

type StaffModalOverlayProps = {
  children: ReactNode;
  /** ความกว้างแผง modal เช่น max-w-xl / max-w-2xl */
  panelClassName?: string;
  onBackdropClick?: () => void;
};

/**
 * Overlay modal ผ่าน portal — ใช้โครงป๊อปอัปร่วมของระบบ
 * ลูกคอมโพเนนต์เป็นคนตั้ง role=dialog / หัวข้อเอง
 */
export function StaffModalOverlay({
  children,
  panelClassName = "max-w-2xl",
  onBackdropClick,
}: StaffModalOverlayProps) {
  return (
    <AppDialogShell
      panelClassName={panelClassName}
      onBackdropClick={onBackdropClick}
      asDialog={false}
    >
      {children}
    </AppDialogShell>
  );
}
