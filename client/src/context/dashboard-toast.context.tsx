"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DashboardToastStack,
  type DashboardToastItem,
  type DashboardToastTone,
  type ToastPlacement,
} from "@/components/dashboard-toast";
import {
  EXPANDABLE_TOAST_DURATION_MS,
  resolveExpandableToastContent,
} from "@/lib/expandable-toast";

const MAX_VISIBLE_TOASTS = 3;

type PushToastInput = {
  title: string;
  description?: string;
  tone?: DashboardToastTone;
  durationMs?: number;
  id?: string;
};

type DashboardToastContextValue = {
  pushToast: (input: PushToastInput) => string;
  dismissToast: (id: string) => void;
};

const DashboardToastContext = createContext<DashboardToastContextValue | null>(null);

const createToastId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;

type ProviderProps = {
  children: ReactNode;
  /** ตำแหน่งสแต็ก — ค่าเริ่มต้นมุมขวาล่าง */
  placement?: ToastPlacement;
};

/**
 * Toast กลางของ dashboard — ใช้เฉพาะ feedback หลังกดปุ่ม/บันทึก/ส่งฟอร์ม
 * ไม่ดึง alerts มาโชว์ popup (ดูที่กระดิ่ง / สัญญาณเข้า / คิวของแต่ละ role)
 */
export function DashboardToastProvider({
  children,
  placement = "bottom-right",
}: ProviderProps) {
  const [items, setItems] = useState<DashboardToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback((input: PushToastInput) => {
    const id = input.id || createToastId();
    const durationMs = input.durationMs ?? EXPANDABLE_TOAST_DURATION_MS;
    const resolved = resolveExpandableToastContent({
      title: input.title,
      description: input.description,
      tone: input.tone || "info",
    });
    const next: DashboardToastItem = {
      id,
      title: resolved.title,
      description: resolved.description || undefined,
      tone: resolved.tone,
      durationMs,
      createdAt: Date.now(),
    };

    setItems((current) => {
      const withoutDup = current.filter((item) => item.id !== id);
      return [...withoutDup, next].slice(-MAX_VISIBLE_TOASTS);
    });

    return id;
  }, []);

  const value = useMemo(
    () => ({
      pushToast,
      dismissToast,
    }),
    [dismissToast, pushToast]
  );

  return (
    <DashboardToastContext.Provider value={value}>
      {children}
      <DashboardToastStack items={items} onDismiss={dismissToast} placement={placement} />
    </DashboardToastContext.Provider>
  );
}

/** ดึง API แสดง toast ในหน้าที่อยู่ใน DashboardToastProvider */
export function useDashboardToast(): DashboardToastContextValue {
  const context = useContext(DashboardToastContext);
  if (!context) {
    throw new Error("useDashboardToast ต้องอยู่ภายใต้ DashboardToastProvider");
  }
  return context;
}

/** ใช้ได้ทั้งในและนอก provider — นอก provider จะ no-op */
export function useOptionalDashboardToast(): DashboardToastContextValue | null {
  return useContext(DashboardToastContext);
}
