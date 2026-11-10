"use client";

import { Download } from "lucide-react";

type ExecutiveQuietExportProps = {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
};

/** ลิงก์ส่งออก CSV โทนเบา — วางในหัวข้อ section ไม่แข่งกับตัวกรองชั้นปี */
export function ExecutiveQuietExport({
  onClick,
  label = "ส่งออก CSV",
  disabled = false,
}: ExecutiveQuietExportProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-slate-500"
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
