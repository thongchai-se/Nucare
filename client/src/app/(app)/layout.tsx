import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";
import { DashboardToastProvider } from "@/context/dashboard-toast.context";
import { MaintenanceGate } from "@/components/maintenance-gate";

export const metadata: Metadata = createPageMetadata({
  title: "Workspace",
  description: "พื้นที่ทำงานภายในระบบ NUCARE สำหรับนักศึกษาและบุคลากร",
  path: "/student",
  noIndex: true,
});

/** Layout ของพื้นที่ dashboard — toast เฉพาะ feedback หลังกดปุ่ม (ไม่ครอบ login/สาธารณะ) */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardToastProvider>
      <MaintenanceGate>{children}</MaintenanceGate>
    </DashboardToastProvider>
  );
}
