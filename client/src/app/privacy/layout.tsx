import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata({
  title: "นโยบายความเป็นส่วนตัวและคุกกี้",
  description:
    "รายละเอียดการเก็บ ใช้ เปิดเผย ระยะเวลาเก็บรักษาข้อมูลส่วนบุคคล และการจัดการคุกกี้ของระบบ NUCARE",
  path: "/privacy",
  keywords: ["PDPA", "privacy policy", "cookie policy", "NUCARE"],
});

export default function PrivacyLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
