"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
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

    if (user.role === "EXECUTIVE") {
      router.replace("/dashboard/executive");
      return;
    }

    if (user.role === "ADVISOR") {
      router.replace("/dashboard/advisor");
      return;
    }

    if (user.role === "STUDENT_DEVELOPMENT") {
      router.replace("/dashboard/student-development");
      return;
    }

    if (user.role === "MENTAL_HEALTH") {
      router.replace("/dashboard/mental-health");
      return;
    }

    if (user.role === "INSTRUCTOR") {
      router.replace("/dashboard/instructor");
      return;
    }

    router.replace("/dashboard/student");
  }, [isAuthenticated, loading, router, user]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100">
      <span className="loader h-7 w-7  text-blue-600"></span>
    </main>
  );
}
