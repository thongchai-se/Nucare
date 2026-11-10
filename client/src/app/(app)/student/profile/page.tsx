"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  BookOpen,
  Contact,
  Edit3,
  GraduationCap,
  Hash,
  IdCard,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { StudentPageShell } from "@/components/student-page-shell";
import { facultyFullName } from "@/lib/brand";
import { formatThaiDate } from "@/lib/student-dashboard";
import type { User } from "@/types/auth";

type StudentProfileContentProps = {
  identifier: string;
  user: User;
  userInitials: string;
};

type ProfileInfoItemProps = {
  helper?: string;
  icon: LucideIcon;
  label: string;
  toneClassName?: string;
  value: ReactNode;
};

type ProfileStatProps = {
  label: string;
  value: ReactNode;
};

function ProfileStat({ label, value }: ProfileStatProps) {
  return (
    <div className="p-5">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 truncate text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}

function ProfileInfoItem({
  helper,
  icon: Icon,
  label,
  toneClassName = "bg-blue-50 text-blue-700",
  value,
}: ProfileInfoItemProps) {
  return (
    <div className="flex min-w-0 gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneClassName}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="mt-1 break-words text-sm font-bold leading-6 text-slate-900">{value}</p>
        {helper ? <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p> : null}
      </div>
    </div>
  );
}

function StudentProfileContent({ identifier, user, userInitials }: StudentProfileContentProps) {
  const studyYearLabel = user.studyYear ? `ปีที่ ${user.studyYear}` : "-";
  const sectionLabel = user.section?.trim() || "-";
  const studentIdLabel = user.studentId ? identifier : "-";
  const emailLabel = user.email || "-";
  const updatedAtLabel = formatThaiDate(user.updatedAt);

  return (
    <>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="bg-[linear-gradient(135deg,#f8fafc_0%,#eef6ff_58%,#ecfeff_100%)] p-5 sm:p-7 lg:p-8">
            <div className="flex w-fit items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5" />
              บัญชีนักศึกษา
            </div>

            <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-cyan-200 bg-cyan-100 text-3xl font-bold text-cyan-700 shadow-sm">
                {userInitials}
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
                  โปรไฟล์นักศึกษา
                </h1>
                <p className="mt-2 truncate text-xl font-bold text-blue-900">{user.name}</p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                  ข้อมูลสำหรับการติดต่อ ดูแล และยืนยันตัวตนในระบบ Nucare
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100 border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
            <ProfileStat label="รหัสนักศึกษา" value={studentIdLabel} />
            <ProfileStat label="ชั้นปี" value={studyYearLabel} />
            <ProfileStat label="เซค / กลุ่ม" value={sectionLabel} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <GraduationCap className="h-5 w-5 text-blue-600" />
                ข้อมูลนักศึกษา
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                ข้อมูลหลักที่ใช้ระบุตัวตนและประสานงานภายในคณะ
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2">
              <ProfileInfoItem
                icon={IdCard}
                label="รหัสนักศึกษา"
                value={studentIdLabel}
              />
              <ProfileInfoItem
                icon={UserRound}
                label="ชื่อ-นามสกุล"
                value={user.name}
                toneClassName="bg-cyan-50 text-cyan-700"
              />
              <ProfileInfoItem
                icon={BookOpen}
                label="คณะ / สาขาวิชา"
                value={`${facultyFullName} สาขาพยาบาลศาสตร์บัณฑิต`}
              />
              <ProfileInfoItem
                icon={GraduationCap}
                label="ชั้นปีการศึกษา"
                value={studyYearLabel}
                toneClassName="bg-cyan-50 text-cyan-700"
              />
              <ProfileInfoItem
                icon={Hash}
                label="เซค / กลุ่ม"
                value={sectionLabel}
              />
              <ProfileInfoItem
                icon={Users}
                label="อาจารย์ที่ปรึกษา"
                helper="ดูรายชื่อทีมดูแลและส่งคำขอปรึกษาได้จากหน้าที่ปรึกษา"
                toneClassName="bg-cyan-50 text-cyan-700"
                value={
                  <Link href="/student/advisor" className="text-blue-700 transition-colors hover:text-blue-900">
                    เปิดหน้าที่ปรึกษา
                  </Link>
                }
              />
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <Contact className="h-5 w-5 text-blue-600" />
                ข้อมูลการติดต่อ
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                ช่องทางที่ระบบใช้สำหรับการแจ้งเตือนและประสานงาน
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2">
              <ProfileInfoItem
                icon={Mail}
                label="อีเมลมหาวิทยาลัย"
                value={emailLabel}
              />
              <ProfileInfoItem
                icon={Phone}
                label="เบอร์โทรศัพท์มือถือ"
                value="-"
                toneClassName="bg-cyan-50 text-cyan-700"
              />
              <ProfileInfoItem
                icon={AlertCircle}
                label="ผู้ติดต่อกรณีฉุกเฉิน"
                helper="หากข้อมูลไม่ถูกต้องให้แจ้งผู้ดูแลเพื่อปรับปรุง"
                toneClassName="bg-red-50 text-red-600"
                value="-"
              />
              <ProfileInfoItem
                icon={ShieldCheck}
                label="อัปเดตล่าสุด"
                value={updatedAtLabel}
                toneClassName="bg-emerald-50 text-emerald-700"
              />
            </div>
          </section>

        </div>

        <aside className="space-y-6">
          <section className="rounded-lg border border-blue-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Edit3 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900">แจ้งแก้ไขข้อมูล</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  ส่งคำขอให้เจ้าหน้าที่ตรวจสอบ เมื่อข้อมูลส่วนตัวหรือข้อมูลติดต่อไม่ถูกต้อง
                </p>
              </div>
            </div>
            <a
              href="mailto:Nucare@nursing.edu"
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-800"
            >
              <Mail className="h-4 w-4" />
              ส่งคำขอแก้ไขข้อมูล
            </a>
          </section>
        </aside>
      </div>
    </>
  );
}

export default function StudentProfilePage() {
  return (
    <StudentPageShell activePage="profile">
      {(context) => <StudentProfileContent {...context} />}
    </StudentPageShell>
  );
}
