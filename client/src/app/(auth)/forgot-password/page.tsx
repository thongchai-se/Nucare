"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/?auth=forgot");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 font-sans text-slate-900">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-slate-500">กำลังเปิดหน้าต่างลืมรหัสผ่าน...</p>
        <Link href="/?auth=forgot" className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:text-blue-800">
          หากไม่เปลี่ยนหน้าอัตโนมัติ คลิกที่นี่
        </Link>
      </div>
    </main>
  );
}
