import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata({
  title: "ข้อกำหนดการใช้งาน",
  description: "ข้อกำหนด เงื่อนไข และขอบเขตการใช้งานระบบ NUCARE สำหรับผู้ใช้งานทุกบทบาท",
  path: "/terms",
});

export default function TermsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
