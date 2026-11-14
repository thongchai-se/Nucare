"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/?auth=login");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 font-sans text-slate-900">
      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="loader h-7 w-7 text-blue-600" aria-hidden="true" />
        <p className="text-sm text-slate-500">กำลังเปิดหน้าต่างเข้าสู่ระบบ...</p>
        <Link href="/?auth=login" className="mt-1 inline-block text-sm font-semibold text-blue-600 hover:text-blue-800">
          หากไม่เปลี่ยนหน้าอัตโนมัติ คลิกที่นี่
        </Link>
      </div>
    </main>
  );
}
