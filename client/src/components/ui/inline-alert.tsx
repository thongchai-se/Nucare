import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react";

export type InlineAlertTone = "error" | "success" | "warning" | "info";

type InlineAlertProps = {
  children: ReactNode;
  className?: string;
  role?: "alert" | "status";
  tone?: InlineAlertTone;
};

const toneMeta: Record<
  InlineAlertTone,
  { Icon: LucideIcon; shell: string }
> = {
  error: {
    Icon: AlertCircle,
    shell: "border-red-100 bg-red-50 text-red-600",
  },
  success: {
    Icon: CheckCircle2,
    shell: "border-emerald-100 bg-emerald-50 text-emerald-700",
  },
  warning: {
    Icon: AlertTriangle,
    shell: "border-amber-200 bg-amber-50 text-amber-800",
  },
  info: {
    Icon: Info,
    shell: "border-blue-100 bg-blue-50 text-blue-800",
  },
};

/** แบนเนอร์แจ้งเตือนแบบไอคอน + ข้อความ — ใช้โทนเดียวกันทั้งระบบ */
export function InlineAlert({
  children,
  className = "",
  role,
  tone = "error",
}: InlineAlertProps) {
  const meta = toneMeta[tone];
  const Icon = meta.Icon;
  const resolvedRole = role ?? (tone === "error" || tone === "warning" ? "alert" : "status");

  return (
    <div
      role={resolvedRole}
      className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${meta.shell} ${className}`.trim()}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" strokeWidth={2} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
