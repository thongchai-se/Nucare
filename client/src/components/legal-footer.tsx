"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AppBrand } from "@/components/app-brand";
import { useSiteSettings } from "@/context/site-settings.context";
import { KKU_PDPA_POLICY_URL } from "@/lib/legal-links";

export default function LegalFooter() {
  const { settings } = useSiteSettings();

  return (
    <footer className="mt-auto border-t-4 border-[#278ACA] bg-blue-900 pb-8 pt-16 text-white">
      <div className="mx-auto max-w-[102rem] px-3 sm:px-4 lg:px-5">
        <div className="mb-12 grid grid-cols-1 gap-10 md:grid-cols-3">
          <div className="col-span-1">
            <div className="mb-5">
              <AppBrand size="compact" tone="onDark" />
            </div>
            <p className="text-sm leading-relaxed text-blue-100">{settings.contactAddress}</p>
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
                <Link href="/#pathways" className="flex items-center gap-2 text-blue-100 transition-colors hover:text-white">
                  <ChevronRight className="h-4 w-4" /> ติดต่ออาจารย์ที่ปรึกษา
                </Link>
              </li>
              <li>
                <Link href="/#pathways" className="flex items-center gap-2 text-blue-100 transition-colors hover:text-white">
                  <ChevronRight className="h-4 w-4" /> คุยกับเพื่อนในระบบ
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-5 inline-block border-b border-blue-700 pb-2 text-lg font-bold">Contact Us</h4>
            <ul className="space-y-3 text-sm text-blue-100">
              <li>
                โทร :{" "}
                <a href={`tel:${settings.contactPhoneTel}`} className="transition-colors hover:text-white">
                  {settings.contactPhoneDisplay}
                </a>
              </li>
              <li>FAX : {settings.contactFaxDisplay}</li>
              <li className="pt-2">
                <p className="font-semibold text-white">{settings.contactOfficeHoursLabel}</p>
                <p className="mt-1">{settings.contactOfficeHours}</p>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-blue-800 pt-6 text-xs text-blue-300 md:flex-row">
          <p>© 2026 {settings.facultyEnglishFullName}. All rights reserved.</p>
          <div className="flex gap-4">
            <a
              href={KKU_PDPA_POLICY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              นโยบายความเป็นส่วนตัว (Privacy)
            </a>
            <a href="#" className="transition-colors hover:text-white">
              ติดต่อผู้ดูแลระบบ
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
