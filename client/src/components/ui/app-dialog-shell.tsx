"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import {
  UI_DIALOG_BACKDROP,
  UI_DIALOG_PANEL,
  UI_DIALOG_PANEL_ENTER,
} from "@/lib/ui-classes";

type AppDialogShellProps = {
  children: ReactNode;
  /** ปิดเมื่อคลิกพื้นหลัง — ถ้าไม่ส่งจะไม่ปิดจาก backdrop */
  onBackdropClick?: () => void;
  /** ความกว้างแผง เช่น max-w-md / max-w-2xl */
  panelClassName?: string;
  /** คลาส z-index ของชั้นนอก — ค่าเริ่มต้น z-[220] */
  zIndexClassName?: string;
  labelledBy?: string;
  describedBy?: string;
  /** true = แผงเป็น dialog (confirm ฯลฯ) · false = ให้ลูกเป็นคนตั้ง role */
  asDialog?: boolean;
  /** ถ้าระบบ lock scroll ภายนอกแล้ว ตั้ง false */
  lockBodyScroll?: boolean;
};

/**
 * โครงป๊อปอัปร่วมของระบบ — พื้นหลัง + แผง + แอนิเมชันเข้า
 * ใช้กับ confirm / staff modal / แจ้งเตือนนิสิต ให้จังหวะจัดวางสอดคล้องกัน
 */
export function AppDialogShell({
  children,
  onBackdropClick,
  panelClassName = "max-w-md",
  zIndexClassName = "z-[220]",
  labelledBy,
  describedBy,
  asDialog = Boolean(labelledBy),
  lockBodyScroll = true,
}: AppDialogShellProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useBodyScrollLock(lockBodyScroll && mounted);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className={`fixed inset-0 flex items-center justify-center overflow-hidden p-4 sm:p-6 ${zIndexClassName}`}
    >
      {onBackdropClick ? (
        <button
          type="button"
          aria-label="ปิดพื้นหลัง"
          className={`absolute inset-0 ${UI_DIALOG_BACKDROP}`}
          onClick={onBackdropClick}
        />
      ) : (
        <div className={`absolute inset-0 ${UI_DIALOG_BACKDROP}`} aria-hidden />
      )}
      <div
        role={asDialog ? "dialog" : undefined}
        aria-modal={asDialog ? true : undefined}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={`relative flex min-h-0 max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden outline-none ${UI_DIALOG_PANEL} ${panelClassName}`}
        style={{ animation: UI_DIALOG_PANEL_ENTER }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
