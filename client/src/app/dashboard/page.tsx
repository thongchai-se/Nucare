"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth.context";

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

    if (user.role === "ADMIN") {
      router.replace("/dashboard/admin");
      return;
    }

    router.replace("/dashboard/student");
  }, [isAuthenticated, loading, router, user]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100">
      <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
    </main>
  );
}
