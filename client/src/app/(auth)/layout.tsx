import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Authentication",
  description: "หน้าลงชื่อเข้าใช้และจัดการสิทธิ์การเข้าถึงระบบ NUCARE",
  path: "/login",
  noIndex: true,
});

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
