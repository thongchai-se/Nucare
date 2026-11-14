"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { SiteMediaManager, type SiteMediaSlotOption } from "@/components/site-media/site-media-manager";
import { PageLoader } from "@/components/ui/page-loader";
import { useAuth } from "@/context/auth.context";
import { UNAUTHENTICATED_PATH } from "@/lib/auth-routes";

const SLOT_OPTIONS: SiteMediaSlotOption[] = [
  {
    value: "HOME_HERO",
    label: "แบนเนอร์หน้าแรก",
    hint: "สไลด์ใหญ่ด้านบนหน้าหลัก",
  },
  {
    value: "HOME_GALLERY",
    label: "แกลเลอรีหน้าแรก",
    hint: "กริดภาพกิจกรรมในส่วน Highlights",
  },
  {
    value: "HOME_VIDEO",
    label: "คลิปหน้าแรก",
    hint: "แปะลิงก์ YouTube แล้วแสดงในส่วนคลิปแนะนำระบบ",
  },
  {
    value: "STUDENT_ACTIVITY",
    label: "กิจกรรมหน้านิสิต",
    hint: "คารูเซลบนหน้าโฮมนิสิต — ใส่ลิงก์เมื่อกดภาพได้",
  },
];

export default function AdminSiteMediaPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!user) {
      router.replace(UNAUTHENTICATED_PATH);
      return;
    }
    if (user.role !== "ADMIN") {
      router.replace("/");
    }
  }, [authLoading, router, user]);

  if (authLoading || !user || user.role !== "ADMIN") {
    return <PageLoader />;
  }

  return (
    <AdminShell
      activeNav="siteMedia"
      title="จัดการสื่อประชาสัมพันธ์"
      userName={user.name}
      userRoleLabel="ผู้ดูแลระบบ"
      onLogout={logout}
    >
      <SiteMediaManager
        apiBasePath="/api/admin/site-media"
        slots={SLOT_OPTIONS}
        heading="ภาพและคลิปหน้าหลัก / หน้านิสิต"
        description="จัดการรูปและคลิป YouTube ที่แสดงบนหน้าหลักและหน้านิสิต"
      />
    </AdminShell>
  );
}
