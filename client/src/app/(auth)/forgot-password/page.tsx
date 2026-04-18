"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, Mail } from "lucide-react";
import api from "@/lib/axios";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successAnimationKey, setSuccessAnimationKey] = useState(0);

  useEffect(() => {
    if (!showSuccessPopup) {
      return;
    }

    const timer = window.setTimeout(() => {
      setShowSuccessPopup(false);
    }, 1800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [showSuccessPopup]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("กรุณากรอกอีเมล");
      return;
    }

    setIsLoading(true);

    try {
      await api.post<{ message: string }>("/api/auth/forgot-password", {
        email: normalizedEmail,
      });
      setSuccessAnimationKey((current) => current + 1);
      setShowSuccessPopup(true);
      setEmail("");
    } catch (requestError) {
      const message =
        typeof requestError === "object" &&
        requestError !== null &&
        "response" in requestError &&
        typeof (requestError as { response?: { data?: { message?: string } } }).response?.data
          ?.message === "string"
          ? (requestError as { response?: { data?: { message?: string } } }).response?.data?.message
          : "ไม่สามารถส่งอีเมลได้";

      setError(message || "ไม่สามารถส่งอีเมลได้");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-slate-50 p-4 font-sans text-slate-900">
      <div
        className={`absolute inset-0 z-[80] flex items-center justify-center p-6 transition-all duration-300 ease-out ${
          showSuccessPopup ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"
        }`}
      >
        <div className="flex flex-col items-center gap-5 rounded-[2rem] border border-gray-100 bg-white/95 px-10 py-8 text-center shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] backdrop-blur-sm">
          <svg
            key={successAnimationKey}
            className="checkmark"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 52 52"
            aria-hidden="true"
          >
            <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none" />
            <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
          </svg>
          <p className="text-lg font-medium tracking-wide text-gray-800">
            ส่งลิงก์เปลี่ยนรหัสผ่านสำเร็จ!
            <span className="mt-1 block text-sm font-normal text-gray-500">
              กรุณาตรวจสอบอีเมลเพื่อเปลี่ยนรหัสผ่าน
            </span>
          </p>
        </div>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">ลืมรหัสผ่าน</h1>
          <p className="mt-2 text-sm text-slate-500">
            กรอกอีเมลที่ใช้งานในระบบ แล้วเราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">อีเมล</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Mail size={18} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="your.email@domain.com"
                autoComplete="email"
                required
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              <AlertCircle className="mt-0.5 shrink-0" size={16} />
              <p>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? "กำลังส่งอีเมล..." : "ส่งลิงก์เปลี่ยนรหัสผ่าน"}
          </button>
        </form>

        <div className="mt-6">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft size={16} />
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </div>

      <style jsx>{`
        .checkmark {
          width: 56px;
          height: 56px;
          margin-left: auto;
          margin-right: auto;
          border-radius: 9999px;
          display: block;
          stroke-width: 2.5;
          stroke: #10b981;
          stroke-miterlimit: 10;
        }

        .checkmark-circle {
          stroke-dasharray: 166;
          stroke-dashoffset: 166;
          stroke-width: 2.5;
          stroke: #10b981;
          fill: none;
          animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
        }

        .checkmark-check {
          transform-origin: 50% 50%;
          stroke-dasharray: 48;
          stroke-dashoffset: 48;
          animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.6s forwards;
        }

        @keyframes stroke {
          100% {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </main>
  );
}
