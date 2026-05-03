"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth.context";
import { getDefaultRole, getRoleHomePath } from "@/lib/roles";

export default function DashboardEntryPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!isAuthenticated || !user) {
      router.replace("/login");
      return;
    }

    const defaultRole = getDefaultRole(user);
    router.replace(defaultRole ? getRoleHomePath(defaultRole) : "/dashboard/student");
  }, [isAuthenticated, loading, router, user]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100">
      <span className="loader h-7 w-7  text-blue-600"></span>
    </main>
  );
}
