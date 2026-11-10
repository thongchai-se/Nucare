"use client";

import Image from "next/image";
import { facultyFullName, facultyLogoThaiSrc } from "@/lib/brand";

type FacultyLogoProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

export function FacultyLogo({ size = 40, className = "", priority = false }: FacultyLogoProps) {
  return (
    <Image
      src={facultyLogoThaiSrc}
      alt={facultyFullName}
      width={size}
      height={size}
      priority={priority}
      sizes={`${size}px`}
      className={`shrink-0 bg-transparent object-contain ${className}`}
    />
  );
}
