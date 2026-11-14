"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock } from "lucide-react";
import { useAuth } from "@/context/auth.context";
import { ConfirmSubmitLabel } from "@/components/ui/confirm-submit-label";
import { InlineAlert } from "@/components/ui/inline-alert";
import api from "@/lib/axios";

export type PasswordFormTone = "student" | "portal" | "admin";

type ChangePasswordFormProps = {
  cancelHref: string;
  description: string;
  onSuccessRedirect: string;
  submitLabel?: string;
  title: string;
  tone: PasswordFormTone;
};

export function ChangePasswordForm({
  cancelHref,
  description,
  onSuccessRedirect,
  submitLabel = "บันทึกรหัสผ่านใหม่",
  title,
  tone,
}: ChangePasswordFormProps) {
  const router = useRouter();
  const { refreshAuth } = useAuth();
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
      ? "max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      : "rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6";

  const buttonClassName =
    tone === "admin"
      ? "bg-slate-800 hover:bg-slate-900"
      : "bg-[#0057A8] hover:bg-[#00468a]";

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
      await refreshAuth();

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

        {error ? <InlineAlert className="rounded-2xl">{error}</InlineAlert> : null}

        {successMessage ? (
          <InlineAlert tone="success" className="rounded-2xl">
            {successMessage}
          </InlineAlert>
        ) : null}

        <div className="grid grid-cols-[minmax(0,1fr)_7.75rem] gap-3 pt-2 sm:grid-cols-[minmax(0,1fr)_8.5rem]">
          <button
            type="submit"
            disabled={submitting}
            className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-sm transition ${buttonClassName} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <ConfirmSubmitLabel busy={submitting}>
              {submitting ? "กำลังบันทึก..." : submitLabel}
            </ConfirmSubmitLabel>
          </button>
          <button
            type="button"
            onClick={() => router.push(cancelHref)}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            ยกเลิก
          </button>
        </div>
      </form>
    </div>
  );
}
