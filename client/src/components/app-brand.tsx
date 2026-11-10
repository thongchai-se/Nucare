"use client";

import { FacultyLogo } from "@/components/faculty-logo";
import {
  facultyBrandNavy,
  facultyBrandOrange,
  facultyEnglishBanner,
  facultyFullName,
  facultyName,
  universityName,
} from "@/lib/brand";

type AppBrandProps = {
  /**
   * Kept for call-site compatibility. Official lockup always shows faculty identity;
   * portal labels belong in page chrome, not the brand mark.
   */
  subtitle?: string;
  subtitleClassName?: string;
  size?: "default" | "compact";
  /** Prefer loading the seal early on public chrome. */
  markPriority?: boolean;
  /** Use on dark surfaces (footer / auth panel) without a white plate. */
  tone?: "default" | "onDark";
};

/**
 * Designed faculty lockup: circular seal + divider + typography.
 * Seal PNG is circular with transparent corners — no white plate behind it.
 */
export function AppBrand({
  size = "default",
  markPriority = false,
  tone = "default",
}: AppBrandProps) {
  const compact = size === "compact";
  const onDark = tone === "onDark";
  const logoSize = compact ? 40 : 52;

  const facultyColor = onDark ? "#E8F4FC" : facultyBrandNavy;
  const universityColor = onDark ? "#FF8A5B" : facultyBrandOrange;
  const englishClass = onDark ? "text-blue-100/80" : "text-[#6B7280]";
  const dividerClass = onDark ? "bg-white/35" : "bg-[#C9CED6]";

  return (
    <div
      className={`flex min-w-0 items-center ${compact ? "gap-2" : "gap-2.5 sm:gap-3"}`}
      aria-label={facultyFullName}
    >
      <FacultyLogo size={logoSize} priority={markPriority} />

      <span
        aria-hidden="true"
        className={`shrink-0 ${dividerClass} ${compact ? "h-8 w-px" : "h-10 w-px sm:h-11"}`}
      />

      <div className="flex min-w-0 flex-col justify-center">
        <span
          className={`font-display font-semibold tracking-[-0.01em] ${
            compact ? "text-[13px] leading-[1.12]" : "text-[16px] leading-[1.12] sm:text-[18px]"
          }`}
          style={{ color: facultyColor }}
        >
          {facultyName}
        </span>
        <span
          className={`font-display font-semibold tracking-[-0.01em] ${
            compact ? "text-[13px] leading-[1.12]" : "text-[16px] leading-[1.12] sm:text-[18px]"
          }`}
          style={{ color: universityColor }}
        >
          {universityName}
        </span>
        <span
          className={`font-sans font-medium uppercase leading-none ${englishClass} ${
            compact
              ? "mt-1 text-[6.5px] tracking-[0.05em]"
              : "mt-1.5 text-[8px] tracking-[0.07em] sm:text-[8.5px]"
          }`}
        >
          {facultyEnglishBanner}
        </span>
      </div>
    </div>
  );
}
