"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth.context";

/** บังคับไปหน้าเปลี่ยนรหัสผ่านเมื่อบัญชียังใช้รหัสชั่วคราว */
export function MustChangePasswordGate({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isChangePasswordPath = pathname === "/change-password" || pathname.startsWith("/change-password/");

  useEffect(() => {
    if (loading || !isAuthenticated || !user?.mustChangePassword) {
      return;
    }
    if (isChangePasswordPath) {
      return;
    }
    router.replace("/change-password");
  }, [loading, isAuthenticated, user?.mustChangePassword, isChangePasswordPath, router]);

  return <>{children}</>;
}
