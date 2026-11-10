"use client";

import { Flag, Users } from "lucide-react";
import { UI_BUTTON_PRIMARY } from "@/lib/ui-classes";

type AcademicPlaceholderViewProps = {
  onOpenAdvisees?: () => void;
};

export function AcademicPlaceholderView({ onOpenAdvisees }: AcademicPlaceholderViewProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#278ACA]/10 text-[#0057A8]">
        <Flag className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-xl font-bold text-slate-800">สัญญาณจากผู้สอนอยู่ที่รายชื่อนักศึกษา</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
        บันทึกพฤติกรรมและการเรียนจากผู้สอนถูกสรุปในประวัตินักศึกษาแต่ละคนแล้ว
        หน้าจัดการแยกสำหรับประเด็นการเรียน/การฝึกปฏิบัติยังอยู่ระหว่างพัฒนา
      </p>
      {onOpenAdvisees ? (
        <button type="button" onClick={onOpenAdvisees} className={`mt-5 ${UI_BUTTON_PRIMARY} min-h-10`}>
          <Users className="h-4 w-4" />
          เปิดรายชื่อนักศึกษา
        </button>
      ) : null}
    </div>
  );
}
