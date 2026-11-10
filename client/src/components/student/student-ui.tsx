"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { PageHeader, type PageHeaderProps } from "@/components/ui/page-header";

/** โทนสีบริการนักศึกษา — institutional blue แบบเงียบ ไม่ใช่ dashboard SaaS */
export const studentTone = {
  bg: "bg-white",
  canvas: "bg-[#F5F6F7]",
  text: "text-[#242424]",
  muted: "text-[#737373]",
  border: "border-[#E7E7E7]",
  blue: "text-[#278FD0]",
  blueBg: "bg-[#278FD0]",
  softBlue: "bg-[#EAF5FC]",
  mutedSurface: "bg-[#F4F9FD]",
  charcoal: "bg-[#242424]",
} as const;

export type StudentPageHeaderProps = PageHeaderProps;

/** ส่วนหัวหน้าที่อื่นของนักศึกษา — คง API เดิมไว้ระหว่างปรับทีละหน้า */
export function StudentPageHeader(props: StudentPageHeaderProps) {
  return <PageHeader {...props} />;
}

export type StudentEmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

export function StudentEmptyState({
  title,
  description,
  action,
  className = "",
}: StudentEmptyStateProps) {
  return (
    <div className={`py-2 ${className}`}>
      <p className="text-sm font-medium text-[#242424]">{title}</p>
      <p className="mt-1 max-w-xl text-sm leading-6 text-[#737373]">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

type StudentTextLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

export function StudentTextLink({ href, children, className = "" }: StudentTextLinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 text-sm font-medium text-[#278FD0] underline-offset-4 transition-colors hover:text-[#1f74a8] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278FD0]/40 ${className}`}
    >
      {children}
    </Link>
  );
}

export function StudentPrimaryButtonClassName(disabled = false): string {
  return disabled
    ? "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[#E7E7E7] px-4 py-2 text-sm font-medium text-[#737373]"
    : "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[#242424] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#3a3a3a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#242424]/35";
}

export function StudentSecondaryButtonClassName(): string {
  return "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#E7E7E7] bg-white px-4 py-2 text-sm font-medium text-[#242424] transition-colors hover:border-[#278FD0]/50 hover:text-[#278FD0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278FD0]/35";
}

type StudentSectionProps = {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: string;
  /** แสดงเส้นแบ่งด้านบน (ค่าเริ่มต้น true) */
  showDivider?: boolean;
};

/** ส่วนเนื้อหาแบบรายการ — ใช้เส้นแบ่ง ไม่ห่อทุกอย่างด้วยการ์ด */
export function StudentSection({
  title,
  description,
  action,
  children,
  className = "",
  showDivider = true,
}: StudentSectionProps) {
  return (
    <section className={`${showDivider ? "border-t border-[#E7E7E7] pt-6" : "pt-0"} ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-[#242424]">{title}</h2>
          {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-[#737373]">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0 pt-0.5">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

type StudentStatusRowProps = {
  items: Array<{ label: string; value: ReactNode }>;
};

/** สถานะแบบบรรทัดเดียว — ไม่ใช้กริดการ์ดสถิติ */
export function StudentStatusRow({ items }: StudentStatusRowProps) {
  return (
    <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-2 text-sm">
      {items.map((item, index) => (
        <div key={item.label} className="flex items-baseline gap-1.5">
          {index > 0 ? <span className="mr-1 hidden text-[#E7E7E7] sm:inline" aria-hidden>|</span> : null}
          <dt className="text-[#737373]">{item.label}</dt>
          <dd className="font-medium tabular-nums text-[#242424]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

type StudentWelcomeProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  status?: Array<{ label: string; value: ReactNode }>;
};

export function StudentWelcome({ title, description, actions, status }: StudentWelcomeProps) {
  return (
    <header className="space-y-5">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-[#242424] sm:text-[1.75rem] sm:leading-snug">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#737373] sm:text-[0.95rem]">{description}</p>
      </div>
      {actions ? <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">{actions}</div> : null}
      {status && status.length > 0 ? <StudentStatusRow items={status} /> : null}
    </header>
  );
}
