"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRightLeft,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Contact,
  Eye,
  EyeOff,
  FileText,
  FileWarning,
  HeartPulse,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Send,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth.context";
import api from "@/lib/axios";
import { AdminShell } from "@/components/admin-shell";
import type { Role } from "@/types/auth";

const roleHomeMap: Record<Role, string> = {
  ADMIN: "/dashboard/admin",
  ADVISOR: "/dashboard/advisor",
  EXECUTIVE: "/dashboard/executive",
  INSTRUCTOR: "/dashboard/instructor",
  MENTAL_HEALTH: "/dashboard/mental-health",
  STUDENT: "/dashboard/student",
};

const roleChangePasswordMap: Record<Exclude<Role, "STUDENT">, string> = {
  ADMIN: "/dashboard/admin?view=change-password",
  ADVISOR: "/dashboard/advisor?view=change-password",
  EXECUTIVE: "/dashboard/executive?view=change-password",
  INSTRUCTOR: "/dashboard/instructor?view=change-password",
  MENTAL_HEALTH: "/dashboard/mental-health?view=change-password",
};

const roleLabelMap: Record<Role, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  ADVISOR: "อาจารย์ที่ปรึกษา",
  EXECUTIVE: "ผู้บริหาร",
  INSTRUCTOR: "ผู้สอน",
  MENTAL_HEALTH: "ผู้เชี่ยวชาญสุขภาพจิต",
  STUDENT: "นักศึกษา",
};

type PasswordFormTone = "student" | "portal" | "admin";

type PasswordFormProps = {
  cancelHref: string;
  description: string;
  onSuccessRedirect: string;
  submitLabel?: string;
  title: string;
  tone: PasswordFormTone;
};

type PortalShellConfig = {
  footerNote?: {
    description: string;
    title: string;
  };
  initialsFallback: string;
  navItems?: Array<{
    href?: string;
    icon: ReactNode;
    label: string;
  }>;
  portalLabel: string;
  sections?: Array<{
    items: Array<{
      active?: boolean;
      href?: string;
      icon: ReactNode;
      label: string;
    }>;
    title: string;
  }>;
  userRoleLabel: string;
};

const formatUserIdentifier = (studentId?: string | null, employeeId?: string | null, email?: string | null): string => {
  if (studentId) {
    if (/^\d{9}-\d$/.test(studentId)) {
      return studentId;
    }

    if (/^\d{10}$/.test(studentId)) {
      return `${studentId.slice(0, 9)}-${studentId.slice(9)}`;
    }

    return studentId;
  }

  if (employeeId) {
    return employeeId;
  }

  return email ?? "-";
};

const getInitials = (name: string, fallback: string): string => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return fallback;
  }

  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? "";
  return `${first}${second}`.toUpperCase();
};

function ChangePasswordForm({
  cancelHref,
  description,
  onSuccessRedirect,
  submitLabel = "บันทึกรหัสผ่านใหม่",
  title,
  tone,
}: PasswordFormProps) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const panelClassName =
    tone === "student"
      ? "rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-8"
      : "rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6";

  const buttonClassName =
    tone === "admin"
      ? "bg-slate-800 hover:bg-slate-900"
      : "bg-blue-700 hover:bg-blue-800";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (newPassword.length < 8) {
      setError("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    if (currentPassword === newPassword) {
      setError("รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน");
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.post<{ message: string }>("/api/auth/change-password", {
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccessMessage(response.data.message || "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว");

      window.setTimeout(() => {
        router.replace(onSuccessRedirect);
      }, 1400);
    } catch (requestError) {
      const message =
        typeof requestError === "object" &&
        requestError !== null &&
        "response" in requestError &&
        typeof (requestError as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (requestError as { response?: { data?: { message?: string } } }).response?.data?.message
          : "ไม่สามารถเปลี่ยนรหัสผ่านได้";

      setError(message || "ไม่สามารถเปลี่ยนรหัสผ่านได้");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={panelClassName}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">รหัสผ่านปัจจุบัน</label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Lock className="h-4 w-4" />
            </div>
            <input
              type={showCurrentPassword ? "text" : "password"}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-10 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
              autoComplete="current-password"
              placeholder="กรอกรหัสผ่านที่ใช้อยู่ตอนนี้"
              required
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors hover:text-slate-600"
              aria-label="toggle current password"
            >
              {showCurrentPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">รหัสผ่านใหม่</label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Lock className="h-4 w-4" />
            </div>
            <input
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-10 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
              autoComplete="new-password"
              placeholder="อย่างน้อย 8 ตัวอักษร"
              required
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors hover:text-slate-600"
              aria-label="toggle new password"
            >
              {showNewPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">ยืนยันรหัสผ่านใหม่</label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Lock className="h-4 w-4" />
            </div>
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-10 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
              autoComplete="new-password"
              placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors hover:text-slate-600"
              aria-label="toggle confirm password"
            >
              {showConfirmPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</div>
        ) : null}

        {successMessage ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-[minmax(0,1fr)_8.5rem]">
          <button
            type="submit"
            disabled={submitting}
            className={`inline-flex h-12 min-w-0 items-center justify-center rounded-2xl px-4 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-70 ${buttonClassName}`}
          >
            {submitting ? <span className="loader h-5 w-5"></span> : submitLabel}
          </button>
          <Link
            href={cancelHref}
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            ยกเลิก
          </Link>
        </div>
      </form>
    </div>
  );
}

// Legacy fallback kept temporarily while the student page uses the profile-styled version below.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function StudentChangePasswordView({
  user,
  homePath,
  identifier,
}: {
  homePath: string;
  identifier: string;
  user: NonNullable<ReturnType<typeof useAuth>["user"]>;
}) {
  const userInitials = getInitials(user.name, "NU");

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <nav className="fixed z-50 w-full border-b border-white/70 bg-white/85 backdrop-blur-md transition-all duration-300">
        <div className="mx-auto max-w-[116rem] px-3 sm:px-4 lg:px-5">
          <div className="flex h-16 items-center justify-between sm:h-20">
            <Link href={homePath} className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white shadow-md shadow-blue-500/30 sm:h-10 sm:w-10">
                <HeartPulse className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex flex-col justify-center">
                <span className="mb-0.5 block text-lg font-bold leading-none text-blue-900 sm:text-xl">
                  Nucare<span className="text-cyan-500">.</span>
                </span>
                <span className="block text-[10px] font-medium leading-none text-slate-500 sm:text-[11px]">คณะพยาบาลศาสตร์</span>
              </div>
            </Link>

            <div className="hidden items-center gap-4 md:flex">
              <button
                type="button"
                className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-blue-700"
                aria-label="notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-white bg-red-500" />
              </button>

              <div className="h-7 border-l border-slate-200" />

              <div className="flex w-[14rem] items-center justify-between gap-2.5 rounded-[1.35rem] border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                <div className="hidden min-w-0 flex-1 text-right lg:block">
                  <p className="text-sm font-bold leading-tight text-blue-900">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.studentId ? `รหัสนักศึกษา: ${identifier}` : identifier}</p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-100 font-bold text-cyan-700">
                  {userInitials}
                </div>
              </div>
            </div>

            <Link
              href={homePath}
              className="rounded-lg border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-blue-700 md:hidden"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </nav>

      <section className="px-4 pb-12 pt-28 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-center gap-4">
            <Link
              href="/dashboard/student/profile"
              className="rounded-lg border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-blue-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold text-blue-900 sm:text-3xl">เปลี่ยนรหัสผ่าน</h1>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="relative h-32 bg-gradient-to-r from-blue-700 to-cyan-500 sm:h-48">
              <div className="absolute -bottom-12 left-6 h-24 w-24 rounded-full bg-white p-1.5 shadow-md sm:-bottom-16 sm:left-10 sm:h-32 sm:w-32">
                <div className="flex h-full w-full items-center justify-center rounded-full border border-cyan-200 bg-cyan-100 text-3xl font-bold text-cyan-700 sm:text-4xl">
                  {userInitials}
                </div>
              </div>
            </div>

            <div className="px-6 pb-8 pt-16 sm:px-10 sm:pb-12 sm:pt-20">
              <div className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-100 pb-8 sm:flex-row sm:items-start">
                <div>
                  <h2 className="mb-1 text-2xl font-bold text-slate-800 sm:text-3xl">{user.name}</h2>
                  <p className="font-medium text-slate-500">{user.studentId ? `รหัสนักศึกษา: ${identifier}` : identifier}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-8 sm:gap-12 md:grid-cols-2">
                <div>
                  <h3 className="mb-5 flex items-center gap-2 text-lg font-bold text-blue-900">
                    <span className="rounded-md bg-blue-100 p-1.5 text-blue-700">
                      <Lock className="h-4 w-4" />
                    </span>
                    ความปลอดภัยของบัญชี
                  </h3>
                  <div className="space-y-5">
                    <div>
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">รหัสผ่านเริ่มต้น</p>
                      <p className="text-sm font-medium text-slate-800">
                        หากบัญชีของคุณเริ่มด้วย `Nu` ตามด้วยรหัสนักศึกษา ควรเปลี่ยนทันทีหลังเข้าสู่ระบบครั้งแรก
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">คำแนะนำ</p>
                      <p className="text-sm font-medium text-slate-800">
                        ใช้รหัสผ่านใหม่ที่ยาวอย่างน้อย 8 ตัวอักษร และไม่ซ้ำกับรหัสผ่านเดิมเพื่อให้บัญชีปลอดภัยขึ้น
                      </p>
                    </div>
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                      <p className="text-sm font-medium leading-6 text-blue-900">
                        หลังเปลี่ยนรหัสผ่านสำเร็จ ระบบจะอัปเดตการเข้าใช้งานของคุณให้อัตโนมัติ และใช้รหัสใหม่สำหรับการเข้าสู่ระบบครั้งถัดไป
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <ChangePasswordForm
                    cancelHref="/dashboard/student/profile"
                    description="อัปเดตรหัสผ่านของบัญชีนักศึกษาในระบบ NuCare ได้จากหน้านี้โดยตรง"
                    onSuccessRedirect={homePath}
                    title="เปลี่ยนรหัสผ่าน"
                    tone="student"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t-4 border-cyan-500 bg-blue-900 pb-8 pt-16 text-white">
        <div className="mx-auto max-w-[102rem] px-3 sm:px-4 lg:px-5">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white">
                  <HeartPulse className="h-6 w-6" />
                </div>
                <div className="flex flex-col justify-center">
                  <span className="mb-1 block text-xl font-bold leading-none">Nucare Sys.</span>
                  <span className="block text-[11px] leading-none text-blue-200">Faculty of Nursing</span>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-blue-100">
                พื้นที่ปลอดภัยสำหรับนักศึกษาคณะพยาบาลศาสตร์ เพื่อให้การดูแลด้านสุขภาวะใจเกิดขึ้นอย่างต่อเนื่องและเป็นส่วนตัว
              </p>
            </div>

            <div className="space-y-3 text-sm text-blue-100">
              <Link href="/dashboard/student" className="block transition-colors hover:text-white">
                หน้าหลักนักศึกษา
              </Link>
              <Link href="/dashboard/student/profile" className="block transition-colors hover:text-white">
                ประวัติส่วนตัว
              </Link>
              <Link href="/dashboard/change-password" className="block text-white">
                เปลี่ยนรหัสผ่าน
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function StudentProfileStyledChangePasswordView({
  user,
  homePath,
  identifier,
  onLogout,
}: {
  homePath: string;
  identifier: string;
  onLogout: () => Promise<void>;
  user: NonNullable<ReturnType<typeof useAuth>["user"]>;
}) {
  const [studentMobileMenuOpen, setStudentMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuCloseTimerRef = useRef<number | null>(null);
  const userInitials = getInitials(user.name, "NU");

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (profileMenuCloseTimerRef.current !== null) {
        window.clearTimeout(profileMenuCloseTimerRef.current);
      }
    };
  }, []);

  const openProfileMenu = () => {
    if (profileMenuCloseTimerRef.current !== null) {
      window.clearTimeout(profileMenuCloseTimerRef.current);
      profileMenuCloseTimerRef.current = null;
    }

    setProfileMenuOpen(true);
  };

  const closeProfileMenuWithDelay = () => {
    if (profileMenuCloseTimerRef.current !== null) {
      window.clearTimeout(profileMenuCloseTimerRef.current);
    }

    profileMenuCloseTimerRef.current = window.setTimeout(() => {
      setProfileMenuOpen(false);
      profileMenuCloseTimerRef.current = null;
    }, 180);
  };

  const closeStudentMobileMenu = () => {
    setStudentMobileMenuOpen(false);
    setProfileMenuOpen(false);
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <nav className="fixed z-50 w-full border-b border-white/70 bg-white/85 backdrop-blur-md transition-all duration-300">
        <div className="mx-auto max-w-[116rem] px-3 sm:px-4 lg:px-5">
          <div className="flex h-16 items-center justify-between sm:h-20">
            <Link href={homePath} className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white shadow-md shadow-blue-500/30 sm:h-10 sm:w-10">
                <HeartPulse className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex flex-col justify-center">
                <span className="mb-0.5 block text-lg font-bold leading-none text-blue-900 sm:text-xl">
                  Nucare<span className="text-cyan-500">.</span>
                </span>
                <span className="block text-[11px] font-medium leading-none text-slate-500">คณะพยาบาลศาสตร์</span>
              </div>
            </Link>

            <div className="hidden items-center gap-4 md:flex">
              <button
                type="button"
                className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-blue-700"
                aria-label="notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-white bg-red-500" />
              </button>

              <div className="h-7 border-l border-slate-200" />

              <div
                className="relative w-[15.5rem]"
                ref={profileMenuRef}
                onMouseEnter={openProfileMenu}
                onMouseLeave={closeProfileMenuWithDelay}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (profileMenuCloseTimerRef.current !== null) {
                      window.clearTimeout(profileMenuCloseTimerRef.current);
                      profileMenuCloseTimerRef.current = null;
                    }

                    setProfileMenuOpen((prev) => !prev);
                  }}
                  onFocus={openProfileMenu}
                  className={`flex w-full items-center justify-between gap-2.5 border border-slate-200 bg-white px-3 py-1.5 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50/90 ${
                    profileMenuOpen ? "rounded-b-none rounded-t-[1.35rem] border-b-transparent" : "rounded-[1.35rem]"
                  }`}
                  aria-expanded={profileMenuOpen}
                  aria-haspopup="menu"
                >
                  <div className="hidden min-w-0 flex-1 text-right lg:block">
                    <p className="text-sm font-bold leading-tight text-blue-900">{user.name}</p>
                    <p className="truncate whitespace-nowrap text-[11px] text-slate-500">
                      {user.studentId ? `รหัสนักศึกษา: ${identifier}` : identifier}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-100 font-bold text-cyan-700">
                    {userInitials}
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>
                <div
                  className={`absolute inset-x-0 top-[calc(100%-1px)] z-50 origin-top overflow-hidden rounded-b-[1.35rem] border border-slate-200/90 border-t-0 bg-white p-1.5 shadow-[0_20px_36px_-28px_rgba(15,23,42,0.32)] transition-all duration-200 ${
                    profileMenuOpen
                      ? "pointer-events-auto visible translate-y-0 scale-100 opacity-100"
                      : "pointer-events-none invisible -translate-y-2 scale-95 opacity-0"
                  }`}
                  role="menu"
                >
                  <Link
                    href="/dashboard/student/profile"
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-slate-50"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <Contact className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">ประวัติส่วนตัว</p>
                    </div>
                  </Link>
                  <Link
                    href="/dashboard/change-password"
                    className="mt-1 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-left ring-1 ring-inset ring-blue-100"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                      <Lock className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-blue-700">เปลี่ยนรหัสผ่าน</p>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      void onLogout();
                    }}
                    className="mt-1 flex w-full items-center gap-3 rounded-xl border-t border-slate-100 px-3 py-2.5 text-left transition-all hover:bg-red-50/80"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                      <LogOut className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-red-600">ออกจากระบบ</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center md:hidden">
              <button
                type="button"
                onClick={() => setStudentMobileMenuOpen((prev) => !prev)}
                className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-50 hover:text-blue-700"
                aria-label="toggle mobile menu"
              >
                {studentMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        <div
          className={`overflow-hidden border-t border-slate-100 bg-white transition-all duration-300 md:hidden ${
            studentMobileMenuOpen ? "max-h-[420px] pb-4" : "max-h-0"
          }`}
        >
          <div className="space-y-3 px-4 py-3">
            <div className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-100 font-bold text-cyan-700">
                {userInitials}
              </div>
              <div>
                <p className="truncate text-base font-bold text-slate-900">{user.name}</p>
                <p className="truncate text-xs font-medium text-slate-500">{user.studentId ? `ID: ${identifier}` : identifier}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/dashboard/student/profile"
                className="flex items-center justify-center gap-2 rounded-[1.05rem] border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 hover:text-blue-700"
                onClick={closeStudentMobileMenu}
              >
                <Contact className="h-4.5 w-4.5 text-slate-700" />
                โปรไฟล์
              </Link>
              <Link
                href="/dashboard/change-password"
                className="flex items-center justify-center gap-2 rounded-[1.05rem] border border-blue-200 bg-blue-50 px-3 py-3 text-sm font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-100"
                onClick={closeStudentMobileMenu}
              >
                <Lock className="h-4.5 w-4.5" />
                เปลี่ยนรหัสผ่าน
              </Link>
              <button
                type="button"
                onClick={() => {
                  closeStudentMobileMenu();
                  void onLogout();
                }}
                className="col-span-2 flex w-full items-center justify-center gap-2 rounded-[1.05rem] border border-red-200 bg-red-50/60 px-3 py-3 text-sm font-semibold text-red-600 shadow-sm transition-colors hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      </nav>

      <section className="px-4 pb-12 pt-28 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-center gap-4">
            <Link
              href="/dashboard/student"
              className="rounded-lg border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-blue-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold text-blue-900 sm:text-3xl">เปลี่ยนรหัสผ่าน</h1>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="relative h-32 bg-gradient-to-r from-blue-700 to-cyan-500 sm:h-48">
              <div className="absolute -bottom-12 left-6 h-24 w-24 rounded-full bg-white p-1.5 shadow-md sm:-bottom-16 sm:left-10 sm:h-32 sm:w-32">
                <div className="flex h-full w-full items-center justify-center rounded-full border border-cyan-200 bg-cyan-100 text-3xl font-bold text-cyan-700 sm:text-4xl">
                  {userInitials}
                </div>
              </div>
            </div>

            <div className="px-6 pb-8 pt-16 sm:px-10 sm:pb-12 sm:pt-20">
              <div className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-100 pb-8 sm:flex-row sm:items-start">
                <div>
                  <h2 className="mb-1 text-2xl font-bold text-slate-800 sm:text-3xl">{user.name}</h2>
                  <p className="font-medium text-slate-500">{user.studentId ? `รหัสนักศึกษา: ${identifier}` : identifier}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-8 sm:gap-12 md:grid-cols-2">
                <div>
                  <h3 className="mb-5 flex items-center gap-2 text-lg font-bold text-blue-900">
                    <span className="rounded-md bg-blue-100 p-1.5 text-blue-700">
                      <Lock className="h-4 w-4" />
                    </span>
                    ความปลอดภัยของบัญชี
                  </h3>
                  <div className="space-y-5">
                    <div>
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">รหัสผ่านเริ่มต้น</p>
                      <p className="text-sm font-medium text-slate-800">
                        หากบัญชีของคุณเริ่มด้วย <span className="font-bold text-blue-700">Nu</span> ตามด้วยรหัสนักศึกษา
                        ควรเปลี่ยนทันทีหลังเข้าสู่ระบบครั้งแรก
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">คำแนะนำ</p>
                      <p className="text-sm font-medium text-slate-800">
                        ใช้รหัสผ่านใหม่ที่ยาวอย่างน้อย 8 ตัวอักษร และไม่ซ้ำกับรหัสผ่านเดิมเพื่อให้บัญชีปลอดภัยขึ้น
                      </p>
                    </div>
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                      <p className="text-sm font-medium leading-6 text-blue-900">
                        หลังเปลี่ยนรหัสผ่านสำเร็จ ระบบจะอัปเดตการเข้าใช้งานของคุณให้อัตโนมัติ และใช้รหัสใหม่สำหรับการเข้าสู่ระบบครั้งถัดไป
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <ChangePasswordForm
                    cancelHref="/dashboard/student/profile"
                    description="อัปเดตรหัสผ่านของบัญชีนักศึกษาในระบบ NuCare ได้จากหน้านี้โดยตรง"
                    onSuccessRedirect={homePath}
                    title="เปลี่ยนรหัสผ่าน"
                    tone="student"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t-4 border-cyan-500 bg-blue-900 pb-8 pt-16 text-white">
        <div className="mx-auto max-w-[102rem] px-3 sm:px-4 lg:px-5">
          <div className="mb-12 grid grid-cols-1 gap-10 md:grid-cols-3">
            <div className="col-span-1">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white">
                  <HeartPulse className="h-6 w-6" />
                </div>
                <div className="flex flex-col justify-center">
                  <span className="mb-1 block text-xl font-bold leading-none">Nucare Sys.</span>
                  <span className="block text-[11px] leading-none text-blue-200">Faculty of Nursing</span>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-blue-100">
                พื้นที่ปลอดภัยสำหรับนักศึกษา คณะพยาบาลศาสตร์
                <br className="hidden sm:block" />
                เพราะสุขภาพใจของคุณ สำคัญสำหรับเรา
              </p>
            </div>

            <div>
              <h4 className="mb-5 inline-block border-b border-blue-700 pb-2 text-lg font-bold">สำหรับนักศึกษา</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link href="/dashboard/student" className="flex items-center gap-2 text-blue-100 transition-colors hover:text-white">
                    หน้าหลักนักศึกษา
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/student/profile" className="flex items-center gap-2 text-blue-100 transition-colors hover:text-white">
                    ประวัติส่วนตัว
                  </Link>
                </li>
                <li>
                  <Link href="/" className="flex items-center gap-2 text-blue-100 transition-colors hover:text-white">
                    แหล่งความรู้การจัดการความเครียด
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-5 inline-block border-b border-blue-700 pb-2 text-lg font-bold">ติดต่อสอบถาม</h4>
              <ul className="space-y-3 text-sm text-blue-100">
                <li>งานพัฒนานักศึกษา คณะพยาบาลศาสตร์</li>
                <li>Nucare@nursing.edu</li>
                <li>02-XXX-XXXX ต่อ 123</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-blue-800 pt-6 text-xs text-blue-300 md:flex-row">
            <p>© 2026 Faculty of Nursing. All rights reserved.</p>
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
    </main>
  );
}

// Legacy portal shell kept temporarily while the role-aligned shell below is in use.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PortalShellChangePasswordView({
  config,
  homePath,
  identifier,
  onLogout,
  user,
}: {
  config: PortalShellConfig;
  homePath: string;
  identifier: string;
  onLogout: () => Promise<void>;
  user: NonNullable<ReturnType<typeof useAuth>["user"]>;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const userInitials = getInitials(user.name, config.initialsFallback);

  const SidebarItems = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {(config.navItems ?? []).map((item) => {
        const content = (
          <span className="flex min-w-0 items-center gap-3">
            <span className={item.href ? "text-slate-400" : "text-blue-600"}>{item.icon}</span>
            <span className="truncate text-sm">{item.label}</span>
          </span>
        );

        if (!item.href) {
          return (
            <div
              key={item.label}
              className="flex min-h-12 w-full items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-left font-medium text-blue-700"
            >
              {content}
            </div>
          );
        }

        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={() => {
              if (mobile) {
                setIsMobileMenuOpen(false);
              }
            }}
            className="flex min-h-12 w-full items-center justify-between rounded-xl border border-transparent px-3 py-2.5 text-left font-medium text-slate-600 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
          >
            {content}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F7FB] font-sans text-slate-800">
      <aside className="hidden h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-800">
                Nucare<span className="text-blue-600">.</span>
              </p>
              <p className="text-[10px] font-medium text-slate-500">{config.portalLabel}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-800">{user.name}</p>
            <p className="mt-1 text-xs text-slate-500">{config.userRoleLabel}</p>
            <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-medium text-slate-500">ID: {identifier}</p>
          </div>

          <div className="space-y-1">
            <SidebarItems />
          </div>
        </div>

        <div className="border-t border-slate-100 bg-slate-50/80 p-4">
          <button
            type="button"
            onClick={() => {
              void onLogout();
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="flex h-full w-72 flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <HeartPulse className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Nucare</p>
                  <p className="text-[10px] text-slate-500">{config.portalLabel}</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-800">{user.name}</p>
                <p className="mt-1 text-xs text-slate-500">{config.userRoleLabel}</p>
              </div>
              <div className="space-y-1">
                <SidebarItems mobile />
              </div>
            </div>

            <div className="border-t border-slate-100 p-4">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  void onLogout();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setIsMobileMenuOpen((current) => !current)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
              <Menu className="h-5 w-5" />
            </button>

            <div className="hidden items-center gap-2 text-sm font-medium text-slate-500 lg:flex">
              <span>{config.portalLabel}</span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
              <span className="font-bold text-slate-800">เปลี่ยนรหัสผ่าน</span>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <button type="button" className="relative text-slate-500 transition-colors hover:text-slate-700">
              <Bell className="h-5 w-5" />
            </button>
            <div className="hidden h-6 w-px bg-slate-200 sm:block"></div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-bold leading-none text-slate-800">{user.name}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{config.userRoleLabel}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-200 bg-blue-100 text-sm font-bold text-blue-700">
                {userInitials}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-3xl">
            <ChangePasswordForm
              cancelHref={homePath}
              description="อัปเดตรหัสผ่านของบัญชีนี้ได้จากหน้านี้โดยตรง"
              onSuccessRedirect={homePath}
              title="เปลี่ยนรหัสผ่าน"
              tone="portal"
            />
          </div>
        </main>
      </div>
    </div>
  );
}

function RoleAlignedChangePasswordView({
  config,
  homePath,
  identifier,
  onLogout,
  user,
}: {
  config: PortalShellConfig;
  homePath: string;
  identifier: string;
  onLogout: () => Promise<void>;
  user: NonNullable<ReturnType<typeof useAuth>["user"]>;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const userInitials = getInitials(user.name, config.initialsFallback);

  const SectionedSidebarItems = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {(config.sections ?? []).map((section) => (
        <div key={section.title}>
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{section.title}</p>
          <div className="space-y-1">
            {section.items.map((item) => {
              const active = item.active ?? false;
              const content = (
                <span className="flex min-w-0 items-center gap-3">
                  <span className={active ? "text-blue-600" : "text-slate-400"}>{item.icon}</span>
                  <span className="truncate text-sm">{item.label}</span>
                </span>
              );

              if (!item.href || active) {
                return (
                  <div
                    key={`${section.title}-${item.label}`}
                    className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left font-medium ${
                      active ? "border-blue-100 bg-blue-50 text-blue-700" : "border-transparent text-slate-600"
                    }`}
                  >
                    {content}
                  </div>
                );
              }

              return (
                <Link
                  key={`${section.title}-${item.label}`}
                  href={item.href}
                  onClick={() => {
                    if (mobile) {
                      setIsMobileMenuOpen(false);
                    }
                  }}
                  className="flex min-h-12 w-full items-center justify-between rounded-xl border border-transparent px-3 py-2.5 text-left font-medium text-slate-600 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                >
                  {content}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F7FB] font-sans text-slate-800">
      <aside className="hidden h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-slate-100 px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-bold leading-none text-slate-800">
                Nucare<span className="text-blue-600">.</span>
              </p>
              <p className="text-[10px] font-medium text-slate-500">{config.portalLabel}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
          <SectionedSidebarItems />
        </div>

        <div className="border-t border-slate-100 bg-slate-50/80 p-4">
          {config.footerNote ? (
            <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <div className="font-bold">{config.footerNote.title}</div>
              <p className="mt-1 text-xs leading-relaxed text-emerald-700">{config.footerNote.description}</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => {
              void onLogout();
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="flex h-full w-72 flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <HeartPulse className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Nucare</p>
                  <p className="text-[10px] text-slate-500">{config.portalLabel}</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-800">{user.name}</p>
                <p className="mt-1 text-xs text-slate-500">{config.userRoleLabel}</p>
                <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-medium text-slate-500">ID: {identifier}</p>
              </div>
              <SectionedSidebarItems mobile />
            </div>

            <div className="border-t border-slate-100 p-4">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  void onLogout();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setIsMobileMenuOpen((current) => !current)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
              <Menu className="h-5 w-5" />
            </button>

            <div className="hidden items-center gap-2 text-sm font-medium text-slate-500 lg:flex">
              <span>{config.portalLabel}</span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
              <span className="font-bold text-slate-800">เปลี่ยนรหัสผ่าน</span>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <button type="button" className="relative rounded-full p-1 text-slate-500 transition-colors hover:text-slate-800">
              <Bell className="h-5 w-5" />
            </button>
            <div className="hidden h-6 w-px bg-slate-200 sm:block"></div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-bold leading-none text-slate-800">{user.name}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{config.userRoleLabel}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-200 bg-blue-100 text-sm font-bold text-blue-700">
                {userInitials}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-3xl">
            <ChangePasswordForm
              cancelHref={homePath}
              description="อัปเดตรหัสผ่านของบัญชีนี้ได้จากหน้านี้โดยตรง"
              onSuccessRedirect={homePath}
              title="เปลี่ยนรหัสผ่าน"
              tone="portal"
            />
          </div>
        </main>
      </div>
    </div>
  );
}

function AdvisorChangePasswordView({
  homePath,
  onLogout,
  user,
}: {
  homePath: string;
  onLogout: () => Promise<void>;
  user: NonNullable<ReturnType<typeof useAuth>["user"]>;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const advisorInitials = getInitials(user.name, "AD");

  const SidebarItem = ({
    active,
    icon,
    label,
    onClick,
  }: {
    active: boolean;
    icon: ReactNode;
    label: string;
    onClick?: () => void;
  }) =>
    onClick ? (
      <button
        type="button"
        onClick={onClick}
        className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left font-medium transition-colors ${
          active
            ? "border-blue-100 bg-blue-50 text-blue-700"
            : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
        }`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className={active ? "text-blue-600" : "text-slate-400"}>{icon}</span>
          <span className="truncate text-sm">{label}</span>
        </span>
      </button>
    ) : (
      <div className="flex min-h-12 w-full items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-left font-medium text-blue-700">
        <span className="flex min-w-0 items-center gap-3">
          <span className="text-blue-600">{icon}</span>
          <span className="truncate text-sm">{label}</span>
        </span>
      </div>
    );

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const SidebarContent = () => (
    <>
      <div className="flex h-16 items-center border-b border-slate-100 px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <HeartPulse className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-none text-slate-800">
              Nucare<span className="text-blue-600">.</span>
            </h1>
            <p className="text-[10px] font-medium text-slate-500">Advisor Portal</p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">เมนูหลัก</p>
        <Link
          href="/dashboard/advisor"
          onClick={closeMobileMenu}
          className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
        >
          <LayoutDashboard size={20} className="text-slate-400" />
          <span className="truncate">หน้าหลัก</span>
        </Link>
        <Link
          href="/dashboard/advisor?view=advisees"
          onClick={closeMobileMenu}
          className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
        >
          <Users size={20} className="text-slate-400" />
          <span className="truncate">นักศึกษาในที่ปรึกษา</span>
        </Link>
        <Link
          href="/dashboard/advisor?view=referrals"
          onClick={closeMobileMenu}
          className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
        >
          <Send size={20} className="text-slate-400" />
          <span className="truncate">ติดตามการส่งต่อ</span>
        </Link>
        <Link
          href="/dashboard/advisor?view=academic"
          onClick={closeMobileMenu}
          className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
        >
          <BookOpen size={20} className="text-slate-400" />
          <span className="truncate">แจ้งปัญหาจากผู้สอน</span>
        </Link>
        <SidebarItem active={true} icon={<Lock size={20} />} label="เปลี่ยนรหัสผ่าน" />
      </div>

      <div className="border-t border-slate-100 bg-slate-50/80 p-4">
        <button
          type="button"
          onClick={() => {
            closeMobileMenu();
            void onLogout();
          }}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={18} /> ออกจากระบบ
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F7FB] font-sans text-slate-800">
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <SidebarContent />
      </aside>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" onClick={closeMobileMenu}>
          <div className="flex h-full w-72 flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <SidebarContent />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setIsMobileMenuOpen((current) => !current)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
              <Menu size={20} />
            </button>

            <div className="hidden items-center gap-2 text-sm font-medium text-slate-500 lg:flex">
              <span>Advisor Portal</span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
              <span className="font-bold text-slate-800">เปลี่ยนรหัสผ่าน</span>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <button type="button" className="relative text-slate-500 transition-colors hover:text-slate-700">
              <Bell size={20} />
            </button>
            <div className="hidden h-6 w-px bg-slate-200 sm:block" />
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-bold leading-none text-slate-800">{user.name}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{roleLabelMap.ADVISOR}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-200 bg-blue-100 text-sm font-bold text-blue-700">
                {advisorInitials}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-3xl">
            <ChangePasswordForm
              cancelHref={homePath}
              description="อัปเดตรหัสผ่านของบัญชีนี้ได้จากหน้านี้โดยตรง"
              onSuccessRedirect={homePath}
              title="เปลี่ยนรหัสผ่าน"
              tone="portal"
            />
          </div>
        </main>
      </div>
    </div>
  );
}

function ExpertChangePasswordView({
  onLogout,
  user,
}: {
  onLogout: () => Promise<void>;
  user: NonNullable<ReturnType<typeof useAuth>["user"]>;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const expertInitials = getInitials(user.name, "MH");
  const cancelHref = "/dashboard/mental-health?view=settings";

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const navClassName =
    "flex min-h-12 w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900";

  const ActiveNavItem = ({ icon, label }: { icon: ReactNode; label: string }) => (
    <div className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-sm font-medium text-blue-700">
      <span className="text-blue-600">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );

  const SidebarSections = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      <div>
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">เมนูหลัก</p>
        <div className="space-y-1">
          <Link href="/dashboard/mental-health" onClick={mobile ? closeMobileMenu : undefined} className={navClassName}>
            <LayoutDashboard className="h-5 w-5 text-slate-400" />
            <span className="truncate">หน้าหลัก</span>
          </Link>
          <Link href="/dashboard/mental-health?view=referrals" onClick={mobile ? closeMobileMenu : undefined} className={navClassName}>
            <ArrowRightLeft className="h-5 w-5 text-slate-400" />
            <span className="truncate">รายการส่งต่อ</span>
          </Link>
          <Link href="/dashboard/mental-health?view=cases" onClick={mobile ? closeMobileMenu : undefined} className={navClassName}>
            <Users className="h-5 w-5 text-slate-400" />
            <span className="truncate">เคสในการดูแล</span>
          </Link>
          <Link href="/dashboard/mental-health?view=appointments" onClick={mobile ? closeMobileMenu : undefined} className={navClassName}>
            <CalendarDays className="h-5 w-5 text-slate-400" />
            <span className="truncate">ปฏิทินนัดหมาย</span>
          </Link>
        </div>
      </div>

      <div>
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">ระบบและความปลอดภัย</p>
        <div className="space-y-1">
          <Link href="/dashboard/mental-health?view=settings" onClick={mobile ? closeMobileMenu : undefined} className={navClassName}>
            <Settings className="h-5 w-5 text-slate-400" />
            <span className="truncate">ตั้งค่าระบบ</span>
          </Link>
          <ActiveNavItem icon={<Lock className="h-5 w-5" />} label="เปลี่ยนรหัสผ่าน" />
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-[#F4F7FB] font-sans text-slate-800">
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="flex h-16 items-center border-b border-slate-100 px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-none text-slate-800">
                Nucare<span className="text-blue-600">.</span>
              </h1>
              <p className="text-[10px] font-medium text-slate-500">Expert Portal</p>
            </div>
          </Link>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
          <SidebarSections />
        </div>

        <div className="border-t border-slate-100 bg-slate-50/80 p-4">
          <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <div className="flex items-center gap-2 font-bold">
              <ShieldCheck className="h-4 w-4" />
              โหมดคุ้มครองข้อมูลเปิดใช้งาน
            </div>
            <p className="mt-1 text-xs leading-relaxed text-emerald-700">ข้อมูลเคสที่ยังไม่รับงานจะถูกปกปิดในหน้าจอจนกว่าจะยืนยันรับเคส</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void onLogout();
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" onClick={closeMobileMenu}>
          <div className="flex h-full w-72 flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <HeartPulse className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    Nucare<span className="text-blue-600">.</span>
                  </p>
                  <p className="text-[10px] font-medium text-slate-500">Expert Portal</p>
                </div>
              </div>
              <button type="button" onClick={closeMobileMenu} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-800">{user.name}</p>
                <p className="mt-1 text-xs text-slate-500">{roleLabelMap.MENTAL_HEALTH}</p>
              </div>

              <SidebarSections mobile />
            </div>

            <div className="border-t border-slate-100 p-4">
              <button
                type="button"
                onClick={() => {
                  closeMobileMenu();
                  void onLogout();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((current) => !current)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="hidden items-center gap-2 text-sm font-medium text-slate-500 lg:flex">
              <span>Expert Portal</span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
              <span className="font-bold text-slate-800">เปลี่ยนรหัสผ่าน</span>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              href="/dashboard/mental-health?view=referrals"
              className="relative rounded-full p-1 text-slate-500 transition-colors hover:text-slate-800"
            >
              <Bell className="h-5 w-5" />
            </Link>

            <div className="hidden h-6 w-px bg-slate-200 sm:block"></div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-bold leading-none text-slate-800">{user.name}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{roleLabelMap.MENTAL_HEALTH}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200 bg-indigo-100 text-sm font-bold text-indigo-700">
                {expertInitials}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-3xl">
            <ChangePasswordForm
              cancelHref={cancelHref}
              description="อัปเดตรหัสผ่านของบัญชีนี้ได้จากหน้านี้โดยตรง"
              onSuccessRedirect={cancelHref}
              title="เปลี่ยนรหัสผ่าน"
              tone="portal"
            />
          </div>
        </main>
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  const homePath = useMemo(() => {
    if (!user) {
      return "/dashboard";
    }

    return roleHomeMap[user.role];
  }, [user]);

  const identifier = useMemo(
    () => formatUserIdentifier(user?.studentId, user?.employeeId, user?.email),
    [user?.email, user?.employeeId, user?.studentId]
  );

  useEffect(() => {
    if (!loading && user && user.role !== "STUDENT") {
      router.replace(roleChangePasswordMap[user.role as Exclude<Role, "STUDENT">]);
    }
  }, [loading, router, user]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <span className="loader h-7 w-7 text-blue-600"></span>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  if (user.role !== "STUDENT") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <span className="loader h-7 w-7 text-blue-600"></span>
      </main>
    );
  }

  if (user.role === "STUDENT") {
    return (
      <StudentProfileStyledChangePasswordView
        user={user}
        homePath={homePath}
        identifier={identifier}
        onLogout={async () => {
          await logout();
          router.replace("/login");
        }}
      />
    );
  }

  if (user.role === "ADMIN") {
    return (
      <AdminShell
        activeNav="changePassword"
        onLogout={async () => {
          await logout();
          router.replace("/login");
        }}
        title="เปลี่ยนรหัสผ่าน"
        userName={user.name}
        userRoleLabel="ผู้ดูแลระบบ (System Admin)"
      >
        <div className="mx-auto max-w-3xl">
          <ChangePasswordForm
            cancelHref={homePath}
            description="อัปเดตรหัสผ่านของบัญชีผู้ดูแลระบบได้จากหน้านี้โดยตรง"
            onSuccessRedirect={homePath}
            title="เปลี่ยนรหัสผ่าน"
            tone="admin"
          />
        </div>
      </AdminShell>
    );
  }

  if (user.role === "ADVISOR") {
    return (
      <AdvisorChangePasswordView
        user={user}
        homePath={homePath}
        onLogout={async () => {
          await logout();
          router.replace("/login");
        }}
      />
    );
  }

  if (user.role === "MENTAL_HEALTH") {
    return (
      <ExpertChangePasswordView
        user={user}
        onLogout={async () => {
          await logout();
          router.replace("/login");
        }}
      />
    );
  }

  // Legacy config kept temporarily for reference while the aligned config below is in use.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const portalConfigMap: Record<Exclude<Role, "STUDENT" | "ADMIN">, PortalShellConfig> = {
    ADVISOR: {
      initialsFallback: "อจ",
      portalLabel: "Advisor Portal",
      userRoleLabel: roleLabelMap.ADVISOR,
      navItems: [
        { href: "/dashboard/advisor", icon: <LayoutDashboard size={20} />, label: "หน้าหลัก" },
        { href: "/dashboard/advisor?view=advisees", icon: <Users size={20} />, label: "นักศึกษาในที่ปรึกษา" },
        { href: "/dashboard/advisor?view=referrals", icon: <Send size={20} />, label: "ติดตามการส่งต่อ" },
        { href: "/dashboard/advisor?view=academic", icon: <BookOpen size={20} />, label: "แจ้งปัญหาจากผู้สอน" },
        { icon: <Lock size={20} />, label: "เปลี่ยนรหัสผ่าน" },
      ],
    },
    EXECUTIVE: {
      initialsFallback: "EX",
      portalLabel: "Executive Portal",
      userRoleLabel: roleLabelMap.EXECUTIVE,
      navItems: [
        { href: "/dashboard/executive", icon: <LayoutDashboard size={20} />, label: "แดชบอร์ดผู้บริหาร" },
        { href: "/dashboard/executive?view=reports", icon: <FileText size={20} />, label: "รายงานเชิงลึก" },
        { href: "/dashboard/executive?view=departments", icon: <Building2 size={20} />, label: "สถิติรายหลักสูตร" },
        { href: "/dashboard/executive?view=trends", icon: <TrendingUp size={20} />, label: "แนวโน้มรายปี" },
        { icon: <Lock size={20} />, label: "เปลี่ยนรหัสผ่าน" },
      ],
    },
    INSTRUCTOR: {
      initialsFallback: "IN",
      portalLabel: "Instructor Portal",
      userRoleLabel: roleLabelMap.INSTRUCTOR,
      navItems: [
        { href: "/dashboard/instructor", icon: <LayoutDashboard size={20} />, label: "หน้าหลัก" },
        { href: "/dashboard/instructor?view=courses", icon: <BookOpen size={20} />, label: "กลุ่มที่รับผิดชอบ" },
        { href: "/dashboard/instructor?view=history", icon: <FileWarning size={20} />, label: "ประวัติการส่งเรื่อง" },
        { icon: <Lock size={20} />, label: "เปลี่ยนรหัสผ่าน" },
      ],
    },
    MENTAL_HEALTH: {
      initialsFallback: "MH",
      portalLabel: "Expert Portal",
      userRoleLabel: roleLabelMap.MENTAL_HEALTH,
      navItems: [
        { href: "/dashboard/mental-health", icon: <LayoutDashboard size={20} />, label: "หน้าหลัก" },
        { href: "/dashboard/mental-health?view=referrals", icon: <Send size={20} />, label: "รายการส่งต่อ" },
        { href: "/dashboard/mental-health?view=cases", icon: <Users size={20} />, label: "เคสในการดูแล" },
        { href: "/dashboard/mental-health?view=appointments", icon: <CalendarDays size={20} />, label: "ปฏิทินนัดหมาย" },
        { href: "/dashboard/mental-health?view=settings", icon: <Settings size={20} />, label: "ตั้งค่าระบบ" },
        { icon: <Lock size={20} />, label: "เปลี่ยนรหัสผ่าน" },
      ],
    },
  };

  const alignedPortalConfigMap: Record<Exclude<Role, "STUDENT" | "ADMIN">, PortalShellConfig> = {
    ADVISOR: {
      initialsFallback: "AD",
      portalLabel: "Advisor Portal",
      userRoleLabel: roleLabelMap.ADVISOR,
      sections: [
        {
          title: "เมนูหลัก",
          items: [
            { href: "/dashboard/advisor", icon: <LayoutDashboard size={20} />, label: "หน้าหลัก" },
            { href: "/dashboard/advisor?view=advisees", icon: <Users size={20} />, label: "นักศึกษาในที่ปรึกษา" },
            { href: "/dashboard/advisor?view=referrals", icon: <Send size={20} />, label: "ติดตามการส่งต่อ" },
            { href: "/dashboard/advisor?view=academic", icon: <BookOpen size={20} />, label: "แจ้งปัญหาจากผู้สอน" },
            { icon: <Lock size={20} />, label: "เปลี่ยนรหัสผ่าน", active: true },
          ],
        },
      ],
    },
    EXECUTIVE: {
      initialsFallback: "EX",
      portalLabel: "Executive Portal",
      userRoleLabel: roleLabelMap.EXECUTIVE,
      sections: [
        {
          title: "ภาพรวมคณะ",
          items: [
            { href: "/dashboard/executive", icon: <LayoutDashboard size={20} />, label: "แดชบอร์ดผู้บริหาร" },
            { href: "/dashboard/executive?view=reports", icon: <FileText size={20} />, label: "รายงานเชิงลึก" },
          ],
        },
        {
          title: "เปรียบเทียบข้อมูล",
          items: [
            { href: "/dashboard/executive?view=departments", icon: <Building2 size={20} />, label: "สถิติรายหลักสูตร" },
            { href: "/dashboard/executive?view=trends", icon: <TrendingUp size={20} />, label: "แนวโน้มรายปี" },
            { icon: <Lock size={20} />, label: "เปลี่ยนรหัสผ่าน", active: true },
          ],
        },
      ],
    },
    INSTRUCTOR: {
      initialsFallback: "IN",
      portalLabel: "Instructor Portal",
      userRoleLabel: roleLabelMap.INSTRUCTOR,
      sections: [
        {
          title: "เมนูหลัก",
          items: [
            { href: "/dashboard/instructor", icon: <LayoutDashboard size={20} />, label: "หน้าหลัก" },
            { href: "/dashboard/instructor?view=courses", icon: <BookOpen size={20} />, label: "กลุ่มที่รับผิดชอบ" },
            { href: "/dashboard/instructor?view=history", icon: <FileWarning size={20} />, label: "ประวัติการส่งเรื่อง" },
            { icon: <Lock size={20} />, label: "เปลี่ยนรหัสผ่าน", active: true },
          ],
        },
      ],
    },
    MENTAL_HEALTH: {
      footerNote: {
        title: "โหมดคุ้มครองข้อมูลเปิดใช้งาน",
        description: "ข้อมูลเคสที่ยังไม่ได้รับมอบหมายจะถูกปกปิดในหน้าจอจนกว่าจะยืนยันรับเคส",
      },
      initialsFallback: "MH",
      portalLabel: "Expert Portal",
      userRoleLabel: roleLabelMap.MENTAL_HEALTH,
      sections: [
        {
          title: "เมนูหลัก",
          items: [
            { href: "/dashboard/mental-health", icon: <LayoutDashboard size={20} />, label: "หน้าหลัก" },
            { href: "/dashboard/mental-health?view=referrals", icon: <Send size={20} />, label: "รายการส่งต่อ" },
            { href: "/dashboard/mental-health?view=cases", icon: <Users size={20} />, label: "เคสในการดูแล" },
            { href: "/dashboard/mental-health?view=appointments", icon: <CalendarDays size={20} />, label: "ปฏิทินนัดหมาย" },
          ],
        },
        {
          title: "ระบบและความปลอดภัย",
          items: [
            { href: "/dashboard/mental-health?view=settings", icon: <Settings size={20} />, label: "ตั้งค่าระบบ" },
            { icon: <Lock size={20} />, label: "เปลี่ยนรหัสผ่าน", active: true },
          ],
        },
      ],
    },
  };

  return (
    <RoleAlignedChangePasswordView
      config={alignedPortalConfigMap[user.role as Exclude<Role, "STUDENT" | "ADMIN">]}
      homePath={homePath}
      identifier={identifier}
      onLogout={async () => {
        await logout();
        router.replace("/login");
      }}
      user={user}
    />
  );
}
