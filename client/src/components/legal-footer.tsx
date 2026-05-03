import Link from "next/link";
import { ChevronRight, HeartPulse } from "lucide-react";
import { facultyEnglishFullName, facultyFullName } from "@/lib/brand";

export default function LegalFooter() {
  return (
    <footer className="mt-auto border-t-4 border-cyan-500 bg-blue-900 pb-8 pt-16 text-white">
      <div className="mx-auto max-w-[102rem] px-3 sm:px-4 lg:px-5">
        <div className="mb-12 grid grid-cols-1 gap-10 md:grid-cols-3">
          <div className="col-span-1">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white">
                <HeartPulse className="h-6 w-6" />
              </div>
              <div className="flex flex-col justify-center">
                <span className="mb-1 block text-xl font-bold leading-none">Nucare Sys.</span>
                <span className="block text-[11px] leading-none text-blue-200">{facultyEnglishFullName}</span>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-blue-100">
              พื้นที่ปลอดภัยสำหรับนักศึกษา {facultyFullName}
              <br className="hidden sm:block" />
              เพราะสุขภาพใจของคุณ สำคัญสำหรับเรา
            </p>
          </div>

          <div>
            <h4 className="mb-5 inline-block border-b border-blue-700 pb-2 text-lg font-bold">สำหรับนักศึกษา</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/?auth=login" className="flex items-center gap-2 text-blue-100 transition-colors hover:text-white">
                  <ChevronRight className="h-4 w-4" /> ทำแบบประเมินสุขภาพจิต
                </Link>
              </li>
              <li>
                <Link href="/#workflow" className="flex items-center gap-2 text-blue-100 transition-colors hover:text-white">
                  <ChevronRight className="h-4 w-4" /> นัดหมายอาจารย์ที่ปรึกษา
                </Link>
              </li>
              <li>
                <Link href="/#roles" className="flex items-center gap-2 text-blue-100 transition-colors hover:text-white">
                  <ChevronRight className="h-4 w-4" /> แหล่งความรู้การจัดการความเครียด
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-5 inline-block border-b border-blue-700 pb-2 text-lg font-bold">ติดต่อสอบถาม</h4>
            <ul className="space-y-3 text-sm text-blue-100">
              <li>งานพัฒนานักศึกษา {facultyFullName}</li>
              <li>Nucare@nursing.edu</li>
              <li>02-XXX-XXXX ต่อ 123</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-blue-800 pt-6 text-xs text-blue-300 md:flex-row">
          <p>© 2026 {facultyEnglishFullName}. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="transition-colors hover:text-white">
              นโยบายความเป็นส่วนตัว (Privacy)
            </Link>
            <a href="#" className="transition-colors hover:text-white">
              ติดต่อผู้ดูแลระบบ
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
