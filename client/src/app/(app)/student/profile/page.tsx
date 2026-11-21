"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Contact,
  Edit3,
  GraduationCap,
  Hash,
  IdCard,
  Loader2,
  Phone,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { StudentContactPanel } from "@/components/student-contact-panel";
import { StudentPageShell } from "@/components/student-page-shell";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useAuth } from "@/context/auth.context";
import { getApiErrorMessage } from "@/lib/api-error";
import api from "@/lib/axios";
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
  const { refreshAuth } = useAuth();
  const studyYearLabel = user.studyYear ? `ปีที่ ${user.studyYear}` : "-";
  const sectionLabel = user.section?.trim() || "-";
  const studentIdLabel = user.studentId ? identifier : "-";
  const updatedAtLabel = formatThaiDate(user.updatedAt);
  const [phone, setPhone] = useState(user.phone || "");
  const [guardianPhone, setGuardianPhone] = useState(user.guardianPhone || "");
  const [editingContacts, setEditingContacts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!editingContacts) {
      setPhone(user.phone || "");
      setGuardianPhone(user.guardianPhone || "");
    }
  }, [user.phone, user.guardianPhone, editingContacts]);

  const openContactEditor = () => {
    setPhone(user.phone || "");
    setGuardianPhone(user.guardianPhone || "");
    setError("");
    setSuccess("");
    setEditingContacts(true);
  };

  const cancelContactEditor = () => {
    if (saving) {
      return;
    }
    setPhone(user.phone || "");
    setGuardianPhone(user.guardianPhone || "");
    setError("");
    setEditingContacts(false);
  };

  const handleSaveContacts = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) {
      return;
    }

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const response = await api.patch<{ message?: string }>("/api/student/contacts", {
        phone,
        guardianPhone,
      });
      await refreshAuth();
      setEditingContacts(false);
      setSuccess(response.data.message || "บันทึกเบอร์ติดต่อแล้ว");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "ไม่สามารถบันทึกเบอร์ติดต่อได้"));
    } finally {
      setSaving(false);
    }
  };

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
            <ProfileStat label="เซค" value={sectionLabel} />
          </div>
        </div>
      </section>

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
            <ProfileInfoItem icon={IdCard} label="รหัสนักศึกษา" value={studentIdLabel} />
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
            <ProfileInfoItem icon={Hash} label="เซค" value={sectionLabel} />
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
          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                  <Contact className="h-5 w-5 text-blue-600" />
                  ข้อมูลการติดต่อ
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  แก้ไขเบอร์โทรตัวเองและผู้ปกครองได้โดยตรง — อีเมลมหาวิทยาลัยแก้ผ่านระบบคณะ
                </p>
              </div>
              {!editingContacts ? (
                <button
                  type="button"
                  onClick={openContactEditor}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100"
                >
                  <Edit3 className="h-4 w-4" />
                  แก้ไขเบอร์
                </button>
              ) : null}
            </div>

            {!editingContacts ? (
              <div className="mt-4 space-y-3">
                <StudentContactPanel
                  email={user.email}
                  phone={user.phone}
                  guardianPhone={user.guardianPhone}
                />
                {success ? <InlineAlert tone="success">{success}</InlineAlert> : null}
                <p className="text-xs text-slate-500">อัปเดตล่าสุด {updatedAtLabel}</p>
              </div>
            ) : (
              <form onSubmit={handleSaveContacts} className="mt-4 space-y-4">
                <p className="text-sm font-semibold text-slate-800">กรอกเบอร์แล้วกดยืนยัน</p>
                <label className="block text-sm font-medium text-slate-700">
                  เบอร์โทรศัพท์มือถือ
                  <div className="relative mt-1.5">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="เช่น 0812345678"
                      maxLength={32}
                      autoFocus
                      className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm font-medium text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  เบอร์ผู้ปกครอง
                  <div className="relative mt-1.5">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={guardianPhone}
                      onChange={(event) => setGuardianPhone(event.target.value)}
                      placeholder="เช่น 0812345678"
                      maxLength={32}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm font-medium text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                  <span className="mt-1 block text-xs text-slate-500">ใช้ติดต่อกรณีฉุกเฉินหรือประสานงาน</span>
                </label>

                {error ? <InlineAlert>{error}</InlineAlert> : null}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-800 disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {saving ? "กำลังบันทึก..." : "ยืนยัน"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelContactEditor}
                    disabled={saving}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                  >
                    <X className="h-4 w-4" />
                    ยกเลิก
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
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
