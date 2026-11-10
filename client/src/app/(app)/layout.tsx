import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";
import { MustChangePasswordGate } from "@/components/must-change-password-gate";
import { DashboardToastProvider } from "@/context/dashboard-toast.context";

export const metadata: Metadata = createPageMetadata({
  title: "Workspace",
  description: "พื้นที่ทำงานภายในระบบ NUCARE สำหรับนักศึกษาและบุคลากร",
  path: "/student",
  noIndex: true,
});

/** Layout ของพื้นที่ dashboard — toast เฉพาะ feedback หลังกดปุ่ม (ไม่ครอบ login/สาธารณะ) */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <MustChangePasswordGate>
      <DashboardToastProvider>{children}</DashboardToastProvider>
    </MustChangePasswordGate>
  );
}
