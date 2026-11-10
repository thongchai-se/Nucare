"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ClipboardList, FolderInput, Images, Users } from "lucide-react";

/** ทางลัดตั้งค่าแอดมินไปยังแบบประเมิน ไดเรกทอรี และจัดการผู้ใช้ */
export function SettingsView() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">ตั้งค่าระบบพื้นฐาน</h2>
        <p className="mt-1 text-sm text-slate-500">
          ทางลัดไปยังการจัดการผู้ใช้ แบบประเมิน และไดเรกทอรีภายนอก
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SettingsCard
          href="/admin/surveys"
          icon={<ClipboardList className="h-5 w-5 text-blue-600" />}
          title="แบบประเมินและรอบคัดกรอง"
          description="สร้าง เผยแพร่ และดูผลแบบประเมิน (รวม GHQ-28)"
        />
        <SettingsCard
          href="/admin/site-media"
          icon={<Images className="h-5 w-5 text-sky-600" />}
          title="ภาพประชาสัมพันธ์"
          description="เพิ่ม แก้ไข ลบภาพแบนเนอร์ แกลเลอรีหน้าแรก และกิจกรรมหน้านิสิต"
        />
        <SettingsCard
          href="/admin/external-directory"
          icon={<FolderInput className="h-5 w-5 text-indigo-600" />}
          title="ไดเรกทอรีภายนอก"
          description="ดึงรายชื่อจากระบบไดเรกทอรีของคณะเพื่อเตรียมนำเข้า"
        />
        <SettingsCard
          href="/admin/manage-students"
          icon={<Users className="h-5 w-5 text-emerald-600" />}
          title="จัดการนิสิตและบุคลากร"
          description="CRUD นิสิต การมอบหมายที่ปรึกษา/ผู้สอน และจัดการ staff"
        />
      </div>
    </div>
  );
}

function SettingsCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:bg-slate-50">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="font-bold text-slate-800">{title}</h3>
      </div>
      <p className="text-sm text-slate-500">{description}</p>
    </Link>
  );
}
