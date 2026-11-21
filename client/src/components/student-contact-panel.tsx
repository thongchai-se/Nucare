"use client";

import { Mail, Phone } from "lucide-react";
import { formatThaiPhoneDisplay, phoneTelHref } from "@/lib/phone-display";

type StudentContactPanelProps = {
  email?: string | null;
  phone?: string | null;
  guardianPhone?: string | null;
  className?: string;
  compact?: boolean;
};

function ContactLine({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
  href?: string | null;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      {href && value !== "—" ? (
        <a
          href={href}
          className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-bold text-blue-700 hover:underline"
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          {value}
        </a>
      ) : (
        <p className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-slate-800">
          <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          {value}
        </p>
      )}
    </div>
  );
}

/** แผงเบอร์/อีเมลนิสิต — ใช้ในหน้ารายละเอียดทุกบทบาท */
export function StudentContactPanel({
  email,
  phone,
  guardianPhone,
  className = "",
  compact = false,
}: StudentContactPanelProps) {
  const phoneLabel = formatThaiPhoneDisplay(phone);
  const guardianLabel = formatThaiPhoneDisplay(guardianPhone);
  const emailLabel = email?.trim() || "—";

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-slate-50 ${compact ? "p-3" : "p-4"} ${className}`}
    >
      <p className="text-xs font-bold text-slate-700">ช่องทางติดต่อ</p>
      <div className={`mt-3 grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        <ContactLine icon={Phone} label="เบอร์นิสิต" value={phoneLabel} href={phoneTelHref(phone)} />
        <ContactLine
          icon={Phone}
          label="เบอร์ผู้ปกครอง"
          value={guardianLabel}
          href={phoneTelHref(guardianPhone)}
        />
        {!compact ? (
          <ContactLine
            icon={Mail}
            label="อีเมล"
            value={emailLabel}
            href={email?.trim() ? `mailto:${email.trim()}` : null}
          />
        ) : null}
      </div>
    </div>
  );
}
