import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Dashboard",
  description: "พื้นที่ทำงานภายในระบบ NUCARE สำหรับนักศึกษาและบุคลากร",
  path: "/dashboard",
  noIndex: true,
});

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
