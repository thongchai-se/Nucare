"use client";

import { AlertCircle, AlertTriangle, Bell, Check, X } from "lucide-react";

export type RoleToastTone = "success" | "info" | "error" | "warning";

type RoleToastProps = {
  description?: string;
  duration?: number;
  onClose?: () => void;
  open: boolean;
  title: string;
  tone?: RoleToastTone;
  zIndexClassName?: string;
};

const toneMeta: Record<
  RoleToastTone,
  {
    borderClassName: string;
    iconBgClassName: string;
    iconClassName: string;
    progressClassName: string;
    Icon: typeof Check;
  }
> = {
  success: {
    borderClassName: "border-emerald-500",
    iconBgClassName: "bg-emerald-100",
    iconClassName: "text-emerald-600",
    progressClassName: "bg-emerald-400",
    Icon: Check,
  },
  info: {
    borderClassName: "border-blue-500",
    iconBgClassName: "bg-blue-100",
    iconClassName: "text-blue-600",
    progressClassName: "bg-blue-400",
    Icon: Bell,
  },
  error: {
    borderClassName: "border-red-500",
    iconBgClassName: "bg-red-100",
    iconClassName: "text-red-600",
    progressClassName: "bg-red-400",
    Icon: AlertCircle,
  },
  warning: {
    borderClassName: "border-amber-500",
    iconBgClassName: "bg-amber-100",
    iconClassName: "text-amber-600",
    progressClassName: "bg-amber-400",
    Icon: AlertTriangle,
  },
};

export function RoleToast({
  description,
  duration = 3600,
  onClose,
  open,
  title,
  tone = "success",
  zIndexClassName = "z-[80]",
}: RoleToastProps) {
  const meta = toneMeta[tone];
  const Icon = meta.Icon;

  return (
    <div
      aria-hidden={!open}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`pointer-events-none fixed bottom-4 right-4 w-[min(92vw,24rem)] sm:bottom-6 sm:right-6 ${zIndexClassName} ${
        open
          ? "translate-y-0 opacity-100 transition-all duration-300"
          : "translate-y-4 opacity-0 transition-all duration-200"
      }`}
      role={tone === "error" ? "alert" : "status"}
    >
      <div className={`overflow-hidden rounded-xl border-l-4 bg-white shadow-xl ${meta.borderClassName}`}>
        <div className="flex items-start gap-3 px-5 py-4">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.iconBgClassName} ${meta.iconClassName}`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-slate-800">{title}</h4>
            {description ? (
              <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
            ) : null}
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="pointer-events-auto -mr-1 -mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="ปิดการแจ้งเตือน"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        {open ? (
          <div
            className={`h-0.5 origin-left ${meta.progressClassName}`}
            style={{ animation: `toast-timer ${duration}ms linear forwards` }}
          />
        ) : null}
      </div>
    </div>
  );
}
