"use client";

import { AlertCircle, Bell, Check } from "lucide-react";

export type RoleToastTone = "success" | "info" | "error";

type RoleToastProps = {
  description?: string;
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
    Icon: typeof Check;
  }
> = {
  success: {
    borderClassName: "border-emerald-500",
    iconBgClassName: "bg-emerald-100",
    iconClassName: "text-emerald-600",
    Icon: Check,
  },
  info: {
    borderClassName: "border-blue-500",
    iconBgClassName: "bg-blue-100",
    iconClassName: "text-blue-600",
    Icon: Bell,
  },
  error: {
    borderClassName: "border-red-500",
    iconBgClassName: "bg-red-100",
    iconClassName: "text-red-600",
    Icon: AlertCircle,
  },
};

export function RoleToast({
  description,
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
      className={`pointer-events-none fixed bottom-4 right-4 w-[min(92vw,24rem)] transition-all duration-300 sm:bottom-6 sm:right-6 ${zIndexClassName} ${
        open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
      role={tone === "error" ? "alert" : "status"}
    >
      <div className={`flex items-start gap-3 rounded-xl border-l-4 bg-white px-5 py-4 shadow-xl ${meta.borderClassName}`}>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.iconBgClassName} ${meta.iconClassName}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-slate-800">{title}</h4>
          {description ? <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p> : null}
        </div>
      </div>
    </div>
  );
}
