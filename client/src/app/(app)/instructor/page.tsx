"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** บทบาทผู้สอนถูกยุบเข้าที่ปรึกษาแล้ว — redirect ไป /advisor */
export default function InstructorRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/advisor");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
        กำลังพาไปหน้าอาจารย์ที่ปรึกษา...
      </div>
    </main>
  );
}
