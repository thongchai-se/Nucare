"use client";

import { HeartPulse } from "lucide-react";
import { facultyFullName, facultyName } from "@/lib/brand";

type AppBrandProps = {
  subtitle: string;
  subtitleClassName?: string;
  size?: "default" | "compact";
};

export function AppBrand({ subtitle, subtitleClassName = "", size = "default" }: AppBrandProps) {
  const compact = size === "compact";
  const resolvedSubtitle = subtitle === facultyName ? facultyFullName : subtitle;

  return (
    <div className={`flex items-center ${compact ? "gap-2.5" : "gap-3"}`}>
      <div
        className={`flex items-center justify-center rounded-xl bg-blue-700 text-white shadow-md shadow-blue-500/30 ${
          compact ? "h-9 w-9" : "h-10 w-10"
        }`}
      >
        <HeartPulse className={compact ? "h-5 w-5" : "h-6 w-6"} />
      </div>
      <div className="flex flex-col justify-center">
        <span className={`block font-bold leading-none text-blue-900 ${compact ? "text-lg" : "text-xl"}`}>
          Nucare<span className="text-cyan-500">.</span>
        </span>
        <span className={`mt-0.5 block font-medium leading-none text-slate-500 ${compact ? "text-[10px]" : "text-[11px]"} ${subtitleClassName}`}>
          {resolvedSubtitle}
        </span>
      </div>
    </div>
  );
}
