import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

type ConfirmSubmitLabelProps = {
  children: ReactNode;
  busy?: boolean;
};

/** ป้ายปุ่มบันทึก/ยืนยันหลัก — ไอคอน CheckCircle2 ตามแพทเทิร์นแบรนด์ */
export function ConfirmSubmitLabel({ children, busy = false }: ConfirmSubmitLabelProps) {
  return (
    <>
      {busy ? (
        <span className="loader h-4 w-4" aria-hidden />
      ) : (
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
      )}
      {children}
    </>
  );
}
