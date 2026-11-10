"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth.context";
import { UNAUTHENTICATED_PATH } from "@/lib/auth-routes";
import { getRoleHomePath } from "@/lib/roles";

/** หน้านี้เลิกใช้แล้ว — ส่งผู้ใช้กลับแดชบอร์ดตามบทบาท (ลอจิก login/forgot แยกอยู่) */
export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!isAuthenticated || !user) {
      router.replace(UNAUTHENTICATED_PATH);
      return;
    }

    router.replace(getRoleHomePath(user.role));
  }, [isAuthenticated, loading, router, user]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100">
      <span className="loader h-7 w-7 text-blue-600"></span>
    </main>
  );
}
