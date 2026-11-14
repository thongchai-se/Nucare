"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import {
  buildToastTimerLeftLabel,
  computeToastElapsedProgress,
  EXPANDABLE_TOAST_DURATION_MS,
  formatToastCountdownSeconds,
  resolveExpandableToastContent,
  type ExpandableToastTone,
} from "@/lib/expandable-toast";

export type DashboardToastTone = ExpandableToastTone;

export type DashboardToastItem = {
  id: string;
  title: string;
  description?: string;
  tone: DashboardToastTone;
  durationMs: number;
  createdAt: number;
};

export type ToastPlacement = "bottom-right" | "top-right" | "bottom-center";

type DashboardToastStackProps = {
  items: DashboardToastItem[];
  onDismiss: (id: string) => void;
  placement?: ToastPlacement;
};

const toneMeta: Record<
  DashboardToastTone,
  {
    Icon: typeof Check;
    iconBg: string;
    progress: string;
  }
> = {
  /** สำเร็จ — เขียว */
  success: {
    Icon: Check,
    iconBg: "bg-emerald-500",
    progress: "bg-emerald-500",
  },
  /** ข้อมูลทั่วไป — ฟ้า */
  info: {
    Icon: Bell,
    iconBg: "bg-sky-500",
    progress: "bg-sky-500",
  },
  /** ผิดพลาด / ล้มเหลว — แดง */
  error: {
    Icon: AlertCircle,
    iconBg: "bg-rose-500",
    progress: "bg-rose-500",
  },
  /** เตือน / ยกเลิก — ส้ม */
  warning: {
    Icon: AlertTriangle,
    iconBg: "bg-amber-500",
    progress: "bg-amber-500",
  },
};

const placementClass: Record<ToastPlacement, string> = {
  "bottom-right": "bottom-4 right-4 sm:bottom-6 sm:right-6 items-end",
  "top-right": "top-4 right-4 sm:top-6 sm:right-6 items-end",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2 sm:bottom-6 items-center",
};

type ToastCardProps = {
  title: string;
  description?: string;
  tone: DashboardToastTone;
  durationMs?: number;
  onDismiss?: () => void;
  timed?: boolean;
  /** ถ้าไม่ระบุ จะปิดแผงรายละเอียดเป็นค่าเริ่มต้น */
  defaultExpanded?: boolean;
};

/**
 * Expandable Notification Toast — หัวข้อสั้น ๆ เป็นค่าเริ่มต้น · มีรายละเอียดค่อยกดขยาย
 */
export function NuCareToastCard({
  title,
  description,
  tone,
  durationMs = EXPANDABLE_TOAST_DURATION_MS,
  onDismiss,
  timed = true,
  defaultExpanded,
}: ToastCardProps) {
  const resolved = resolveExpandableToastContent({ title, description, tone });
  const meta = toneMeta[resolved.tone];
  const Icon = meta.Icon;
  const startExpanded = defaultExpanded ?? resolved.expandByDefault;
  const [expanded, setExpanded] = useState(startExpanded);
  const [paused, setPaused] = useState(false);
  const [remainingMs, setRemainingMs] = useState(durationMs);
  const remainingRef = useRef(durationMs);
  const pausedRef = useRef(false);
  const dismissedRef = useRef(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    remainingRef.current = durationMs;
    setRemainingMs(durationMs);
    setPaused(false);
    pausedRef.current = false;
    dismissedRef.current = false;
    setExpanded(defaultExpanded ?? resolved.expandByDefault);
  }, [durationMs, title, description, tone, defaultExpanded, resolved.expandByDefault]);

  useEffect(() => {
    if (!timed) {
      return;
    }

    const tickMs = 100;
    const timer = window.setInterval(() => {
      if (pausedRef.current || dismissedRef.current) {
        return;
      }
      const next = Math.max(0, remainingRef.current - tickMs);
      remainingRef.current = next;
      setRemainingMs(next);
      if (next <= 0) {
        dismissedRef.current = true;
        onDismissRef.current?.();
      }
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [timed, durationMs, title, description, tone]);

  const seconds = formatToastCountdownSeconds(remainingMs);
  const progress = computeToastElapsedProgress(remainingMs, durationMs);
  const showTimerFooter = timed && !paused;

  const stopTimer = () => {
    if (!timed || pausedRef.current) {
      return;
    }
    pausedRef.current = true;
    setPaused(true);
  };

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-[0_10px_28px_-10px_rgba(15,23,42,0.22),0_2px_8px_-2px_rgba(15,23,42,0.1)]">
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 sm:px-4 sm:py-3">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${meta.iconBg}`}
          aria-hidden="true"
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2.75} />
        </div>

        <p className="min-w-0 flex-1 truncate py-0.5 text-sm font-bold leading-snug text-slate-900">
          {resolved.title}
        </p>

        <div className="flex shrink-0 items-center gap-0.5">
          {resolved.hasDetail ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              aria-expanded={expanded}
              aria-label={expanded ? "ยุบรายละเอียด" : "ขยายรายละเอียด"}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" strokeWidth={2} />
              ) : (
                <ChevronDown className="h-4 w-4" strokeWidth={2} />
              )}
            </button>
          ) : null}
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              aria-label="ปิดการแจ้งเตือน"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          ) : null}
        </div>
      </div>

      {resolved.hasDetail ? (
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div className="space-y-2.5 px-3.5 pb-3 pt-0 sm:px-4 sm:pb-3.5">
              <p className="text-sm leading-5 text-slate-500">{resolved.description}</p>
              {onDismiss ? (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                >
                  ตกลง
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {showTimerFooter ? (
        <div>
          <div className="px-3.5 py-2 sm:px-4">
            <p className="text-xs leading-4 text-slate-500">
              {seconds > 0 ? (
                <>
                  ข้อความนี้จะปิดใน{" "}
                  <span className="font-semibold text-slate-800">{seconds}</span> วินาที.{" "}
                  <button
                    type="button"
                    onClick={stopTimer}
                    className="font-semibold text-slate-800 underline decoration-slate-400 underline-offset-2 transition-colors hover:text-slate-950 hover:decoration-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  >
                    คลิกเพื่อหยุด
                  </button>
                </>
              ) : (
                buildToastTimerLeftLabel(seconds)
              )}
            </p>
          </div>
          <div className="h-0.5 w-full bg-transparent">
            <div
              className={`h-full ${meta.progress} transition-[width] duration-100 ease-linear`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** สแต็ก toast — รองรับตำแหน่ง bottom-right / top-right / bottom-center */
export function DashboardToastStack({
  items,
  onDismiss,
  placement = "bottom-right",
}: DashboardToastStackProps) {
  if (items.length === 0) {
    return null;
  }

  const newestFirst = [...items].reverse();
  const stackDirection = placement === "top-right" ? "flex-col" : "flex-col-reverse";

  return (
    <div
      className={`pointer-events-none fixed z-[240] flex w-[min(92vw,22rem)] ${stackDirection} gap-2.5 ${placementClass[placement]}`}
      aria-relevant="additions text"
    >
      {newestFirst.map((item, visualIndex) => {
        const assertive = item.tone === "error" || item.tone === "warning";

        return (
          <div
            key={item.id}
            role={assertive ? "alert" : "status"}
            className="pointer-events-auto w-full origin-bottom"
            style={{
              animation: `toast-enter 480ms cubic-bezier(0.16, 1, 0.3, 1) both`,
              animationDelay: `${visualIndex * 40}ms`,
            }}
          >
            <NuCareToastCard
              title={item.title}
              description={item.description}
              tone={item.tone}
              durationMs={item.durationMs}
              onDismiss={() => onDismiss(item.id)}
              timed
            />
          </div>
        );
      })}
    </div>
  );
}

export type RoleToastTone = DashboardToastTone;
