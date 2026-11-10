"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { SiteMediaManager, type SiteMediaSlotOption } from "@/components/site-media/site-media-manager";
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
    value: "STUDENT_ACTIVITY",
    label: "กิจกรรมหน้านิสิต",
    hint: "คารูเซลจากงานพัฒนานิสิต",
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        กำลังโหลด...
      </div>
    );
  }

  return (
    <AdminShell
      activeNav="siteMedia"
      title="จัดการภาพประชาสัมพันธ์"
      userName={user.name}
      userRoleLabel="ผู้ดูแลระบบ"
      onLogout={logout}
    >
      <SiteMediaManager
        apiBasePath="/api/admin/site-media"
        slots={SLOT_OPTIONS}
        heading="ภาพหน้าหลักและหน้านิสิต"
        description="จัดการรูปที่แสดงบนหน้าหลักและหน้านิสิต"
      />
    </AdminShell>
  );
}
