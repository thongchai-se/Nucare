"use client";

import { useEffect, useRef } from "react";
import { NuCareToastCard, type DashboardToastTone } from "@/components/dashboard-toast";
import { useOptionalDashboardToast } from "@/context/dashboard-toast.context";
import {
  EXPANDABLE_TOAST_DURATION_MS,
  resolveExpandableToastContent,
} from "@/lib/expandable-toast";

export type RoleToastTone = DashboardToastTone;

type RoleToastProps = {
  description?: string;
  duration?: number;
  onClose?: () => void;
  open: boolean;
  title: string;
  tone?: RoleToastTone;
  /** ใช้เฉพาะตอน fallback นอก DashboardToastProvider */
  zIndexClassName?: string;
};

/**
 * Toast มุมขวาล่าง — ใน DashboardToastProvider จะส่งเข้าสแต็กกลางทันที
 * นอก provider ใช้การ์ด Expandable แบบ local (เช่น หน้า login)
 */
export function RoleToast({
  description,
  duration = EXPANDABLE_TOAST_DURATION_MS,
  onClose,
  open,
  title,
  tone = "success",
  zIndexClassName = "z-[80]",
}: RoleToastProps) {
  const dashboardToast = useOptionalDashboardToast();
  const lastPushedKeyRef = useRef<string>("");
  const wasOpenRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!dashboardToast) {
      return;
    }

    if (!open || !title.trim()) {
      wasOpenRef.current = false;
      lastPushedKeyRef.current = "";
      return;
    }

    const key = `${title}|${description || ""}|${tone}`;
    const risingEdge = !wasOpenRef.current;
    wasOpenRef.current = true;

    if (!risingEdge && lastPushedKeyRef.current === key) {
      return;
    }
    lastPushedKeyRef.current = key;

    const resolved = resolveExpandableToastContent({ title, description, tone });
    dashboardToast.pushToast({
      title: resolved.title,
      description: resolved.description,
      tone: resolved.tone,
      durationMs: duration,
    });

    // สแต็กกลางถือครองการแสดงผล — รีเซ็ต state ของหน้าทันทีเพื่อ rising edge รอบถัดไป
    queueMicrotask(() => {
      onCloseRef.current?.();
    });
  }, [dashboardToast, description, duration, open, title, tone]);

  if (dashboardToast) {
    return null;
  }

  if (!open) {
    return null;
  }

  const resolved = resolveExpandableToastContent({ title, description, tone });

  return (
    <div
      aria-live={tone === "error" || tone === "warning" ? "assertive" : "polite"}
      className={`pointer-events-none fixed bottom-4 right-4 w-[min(92vw,22rem)] sm:bottom-6 sm:right-6 ${zIndexClassName}`}
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
      style={{
        animation: `toast-enter 480ms cubic-bezier(0.16, 1, 0.3, 1) both`,
      }}
    >
      <div className="pointer-events-auto">
        <NuCareToastCard
          title={resolved.title}
          description={resolved.description}
          tone={resolved.tone}
          durationMs={duration}
          onDismiss={onClose}
          timed
        />
      </div>
    </div>
  );
}
