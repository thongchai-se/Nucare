"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { InlineLoader } from "@/components/ui/page-loader";

/** เส้นทางเก่า — ส่งต่อไปหน้าที่ปรึกษาแล้วเปิดแผงคุยสั้น */
function StudentMessagesRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const peer = searchParams.get("peer")?.trim();
    const params = new URLSearchParams();
    if (peer) {
      params.set("peer", peer);
    }
    const query = params.toString();
    router.replace(query ? `/student/advisor?${query}` : "/student/advisor", {
      scroll: false,
    });
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <InlineLoader label="กำลังเปิดคุยสั้น" />
    </div>
  );
}

export default function StudentMessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <InlineLoader label="กำลังเปิดคุยสั้น" />
        </div>
      }
    >
      <StudentMessagesRedirect />
    </Suspense>
  );
}
