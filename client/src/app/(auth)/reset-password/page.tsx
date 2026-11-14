"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Lock } from "lucide-react";
import { InlineAlert } from "@/components/ui/inline-alert";
import api from "@/lib/axios";

const INVALID_RESET_TOKEN_MESSAGE = "ลิงก์เปลี่ยนรหัสผ่านไม่ถูกต้องหรือหมดอายุ";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isTokenChecking, setIsTokenChecking] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [error, setError] = useState("");
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successAnimationKey, setSuccessAnimationKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const validateResetToken = async () => {
      if (!token) {
        if (!isMounted) {
          return;
        }

        setIsTokenValid(false);
        setTokenError(INVALID_RESET_TOKEN_MESSAGE);
        setIsTokenChecking(false);
        return;
      }

      setIsTokenChecking(true);
      setIsTokenValid(false);
      setTokenError("");

      try {
        await api.get<{ message: string }>("/api/auth/reset-password/validate", {
          params: { token },
        });

        if (!isMounted) {
          return;
        }

        setIsTokenValid(true);
      } catch (requestError) {
        if (!isMounted) {
          return;
        }

        const message =
          typeof requestError === "object" &&
          requestError !== null &&
          "response" in requestError &&
          typeof (requestError as { response?: { data?: { message?: string } } }).response?.data
            ?.message === "string"
            ? (requestError as { response?: { data?: { message?: string } } }).response?.data?.message
            : INVALID_RESET_TOKEN_MESSAGE;

        setIsTokenValid(false);
        setTokenError(message || INVALID_RESET_TOKEN_MESSAGE);
      } finally {
        if (isMounted) {
          setIsTokenChecking(false);
        }
      }
    };

    void validateResetToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!showSuccessPopup) {
      return;
    }

    const timer = window.setTimeout(() => {
      router.replace("/?auth=login");
    }, 1500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [router, showSuccessPopup]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!isTokenValid) {
      setError(tokenError || INVALID_RESET_TOKEN_MESSAGE);
      return;
    }

    if (password.length < 8) {
      setError("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }

    if (password !== confirmPassword) {
      setError("รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    setIsLoading(true);

    try {
      await api.post<{ message: string }>("/api/auth/reset-password", {
        token,
        password,
      });
      setSuccessAnimationKey((current) => current + 1);
      setShowSuccessPopup(true);
      setPassword("");
      setConfirmPassword("");
    } catch (requestError) {
      const message =
        typeof requestError === "object" &&
        requestError !== null &&
        "response" in requestError &&
        typeof (requestError as { response?: { data?: { message?: string } } }).response?.data
          ?.message === "string"
          ? (requestError as { response?: { data?: { message?: string } } }).response?.data?.message
          : "ไม่สามารถเปลี่ยนรหัสผ่านได้";

      setError(message || "ไม่สามารถเปลี่ยนรหัสผ่านได้");
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
            เปลี่ยนรหัสผ่านสำเร็จ!
            <span className="mt-2 flex items-center justify-center gap-2 text-sm font-normal text-gray-500">
              <span className="loader h-4 w-4 text-blue-600" aria-hidden="true" />
              กำลังพาไปหน้าเข้าสู่ระบบ...
            </span>
          </p>
        </div>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">ตั้งรหัสผ่านใหม่</h1>
          <p className="mt-2 text-sm text-slate-500">กรอกรหัสผ่านใหม่ของคุณเพื่ออัปเดตบัญชี</p>
        </div>

        {isTokenChecking ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-600">
            <span className="loader h-7 w-7 text-blue-600" aria-hidden="true" />
            กำลังตรวจสอบลิงก์เปลี่ยนรหัสผ่าน...
          </div>
        ) : !isTokenValid ? (
          <div className="space-y-4">
            <InlineAlert>{tokenError || INVALID_RESET_TOKEN_MESSAGE}</InlineAlert>

            <Link
              href="/?auth=forgot"
              className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              ขอรับลิงก์เปลี่ยนรหัสผ่านใหม่
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">รหัสผ่านใหม่</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-10 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                  aria-label="toggle password"
                >
                  {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">ยืนยันรหัสผ่านใหม่</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-10 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ยืนยันรหัสผ่านใหม่"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                  aria-label="toggle confirm password"
                >
                  {showConfirmPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
            </div>

            {error ? <InlineAlert>{error}</InlineAlert> : null}

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? <span className="loader h-5 w-5 "></span> : "ยืนยันเปลี่ยนรหัสผ่าน"}
            </button>
          </form>
        )}

        <div className="mt-6">
          <Link
            href="/?auth=login"
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 font-sans text-slate-900">
          <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <span className="loader h-7 w-7 text-blue-600" aria-hidden="true" />
            <p className="text-sm text-slate-500">กำลังโหลดหน้าตั้งรหัสผ่านใหม่...</p>
          </div>
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
