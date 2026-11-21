"use client";

import type { ReactNode } from "react";
import { AppBrand } from "@/components/app-brand";
import { useAuth } from "@/context/auth.context";
import { useSiteSettings } from "@/context/site-settings.context";
import { PageLoader } from "@/components/ui/page-loader";

/** บล็อกพื้นที่แอปเมื่อเปิดโหมดปิดปรับปรุง — แอดมินยังเข้าได้ */
export function MaintenanceGate({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { settings, loading: settingsLoading } = useSiteSettings();

  if (authLoading || settingsLoading) {
    return <PageLoader label="กำลังตรวจสอบสถานะระบบ" />;
  }

  const isAdmin = Boolean(user?.role === "ADMIN" || user?.roles?.includes("ADMIN"));
  if (!settings.maintenanceEnabled || isAdmin) {
    return <>{children}</>;
  }

  const message =
    settings.maintenanceMessage.trim() ||
    "ระบบกำลังปิดปรับปรุงชั่วคราว กรุณาลองใหม่ภายหลัง";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-6 flex justify-center">
          <AppBrand size="compact" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">ปิดปรับปรุงชั่วคราว</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
      </div>
    </main>
  );
}
