"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth.context";
import { AppBrand } from "@/components/app-brand";
import api from "@/lib/axios";
import { getSafeNextPath } from "@/lib/auth-routes";
import { acquireBodyScrollLock } from "@/lib/body-scroll-lock";
import { facultyFullName } from "@/lib/brand";
import { getDefaultRole, getRoleHomePath } from "@/lib/roles";

export type AuthPopupView = "login" | "forgot";

type AuthPopupProps = {
  isOpen: boolean;
  view: AuthPopupView;
  onClose: () => void;
  onViewChange: (view: AuthPopupView) => void;
};

const LOGIN_FAILED_MESSAGE = "ชื่อบัญชีหรือรหัสผ่านไม่ถูกต้อง";
const STUDENT_ID_PATTERN = /^\d{9}-\d$/;
const STUDENT_ID_FORMAT_MESSAGE = "รหัสนักศึกษาต้องอยู่ในรูปแบบ 663380696-6";

const KkuSsoIcon = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true" className="h-5 w-5">
    <defs>
      <linearGradient id="kkuGradientPopup" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stopColor="#0055A5" />
        <stop offset="100%" stopColor="#2A7AD6" />
      </linearGradient>
    </defs>
    <circle cx="16" cy="16" r="15" fill="url(#kkuGradientPopup)" />
    <text x="16" y="20" textAnchor="middle" fontSize="9" fontWeight="700" fill="#FFFFFF">
      KKU
    </text>
  </svg>
);

const formatStudentIdentifier = (value: string): string => {
  const compact = value.replace(/\s+/g, "");
  const onlyDigits = compact.replace(/\D/g, "").slice(0, 10);

  if (onlyDigits.length <= 9) {
    return onlyDigits;
  }

  return `${onlyDigits.slice(0, 9)}-${onlyDigits.slice(9)}`;
};

export default function AuthPopup({
  isOpen,
  view,
  onClose,
  onViewChange,
}: AuthPopupProps) {
  const router = useRouter();
  const { login } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [isForgotLoading, setIsForgotLoading] = useState(false);

  const resetPopupState = () => {
    setShowPassword(false);
    setIdentifier("");
    setPassword("");
    setLoginError("");
    setIsLoginLoading(false);
    setEmail("");
    setForgotError("");
    setForgotSuccess("");
    setIsForgotLoading(false);
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const releaseScrollLock = acquireBodyScrollLock();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      releaseScrollLock();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      resetPopupState();
    }
  }, [isOpen]);

  const handleIdentifierChange = (value: string): void => {
    const compact = value.replace(/\s+/g, "");

    if (compact.includes("@")) {
      setIdentifier(compact);
      return;
    }

    if (/[A-Za-zก-๙]/.test(compact)) {
      setIdentifier(value);
      return;
    }

    setIdentifier(formatStudentIdentifier(value));
  };

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError("");

    if (isLoginLoading) {
      return;
    }

    const normalizedIdentifier = identifier.trim();
    const normalizedPassword = password.trim();

    if (!normalizedIdentifier || !normalizedPassword) {
      setLoginError(LOGIN_FAILED_MESSAGE);
      return;
    }

    const isStudentIdInput =
      !normalizedIdentifier.includes("@") && /^[0-9-]+$/.test(normalizedIdentifier);

    if (isStudentIdInput) {
      if (!STUDENT_ID_PATTERN.test(normalizedIdentifier)) {
        setLoginError(STUDENT_ID_FORMAT_MESSAGE);
        return;
      }
    }

    const loginIdentifier = normalizedIdentifier;

    setIsLoginLoading(true);

    try {
      const loggedInUser = await login(loginIdentifier, normalizedPassword);
      onClose();
      if (loggedInUser.mustChangePassword) {
        router.push("/change-password");
        return;
      }
      const nextParam =
        typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") : null;
      const defaultRole = getDefaultRole(loggedInUser);
      router.push(getSafeNextPath(nextParam) || (defaultRole ? getRoleHomePath(defaultRole) : getRoleHomePath("STUDENT")));
    } catch {
      setLoginError(LOGIN_FAILED_MESSAGE);
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleForgotSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setForgotError("");
    setForgotSuccess("");

    if (isForgotLoading) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setForgotError("กรุณากรอกอีเมล");
      return;
    }

    setIsForgotLoading(true);

    try {
      const response = await api.post<{ message: string }>("/api/auth/forgot-password", {
        email: normalizedEmail,
      });
      setForgotSuccess(response.data.message || "ส่งลิงก์เปลี่ยนรหัสผ่านสำเร็จ");
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

      setForgotError(message || "ไม่สามารถส่งอีเมลได้");
    } finally {
      setIsForgotLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center overflow-hidden p-3 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/60"
        onClick={onClose}
        aria-label="close auth popup backdrop"
      />

      <div className="relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-x-hidden overflow-y-auto rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] md:min-h-[34.25rem] md:flex-row md:overflow-hidden">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 rounded-full bg-white/80 p-1.5 text-slate-500 transition-colors hover:bg-white hover:text-slate-700"
          aria-label="close auth popup"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative hidden flex-col justify-between overflow-hidden bg-blue-600 p-12 md:flex md:w-1/2">
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-blue-600 to-indigo-800" />
          <div className="absolute right-[-10%] top-[-10%] h-64 w-64 rounded-full bg-white opacity-10" />
          <div className="absolute bottom-[-10%] left-[-10%] h-80 w-80 rounded-full bg-white opacity-10" />

          <div className="relative z-10">
            <div className="mb-8">
              <AppBrand markPriority tone="onDark" />
            </div>
            <h2 className="mb-4 text-3xl font-bold leading-tight text-white">
              ระบบดูแลและติดตาม
              <br />
              สุขภาพนักศึกษา
            </h2>
            <p className="text-sm leading-relaxed text-blue-100">
              {facultyFullName}
              <br />
              พื้นที่ปลอดภัยสำหรับทุกคน เพราะสุขภาพใจสำคัญไม่แพ้สุขภาพกาย ข้อมูลของคุณจะถูกเก็บรักษาเป็นความลับสูงสุด
            </p>
          </div>

          <div className="relative z-10 rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-sm font-medium text-white">สุขภาพนักศึกษาที่ดี เริ่มต้นที่ความใส่ใจและการรับฟัง</p>
          </div>
        </div>

        <div className="relative flex w-full flex-col justify-center p-6 sm:p-8 md:w-1/2 md:justify-start md:p-12">
          <div className="mb-8 flex justify-center md:hidden">
            <AppBrand size="compact" />
          </div>

          {view === "login" ? (
            <>
              <div className="mb-8 text-center md:text-left">
                <h3 className="mb-2 text-3xl font-bold text-slate-800">เข้าสู่ระบบ</h3>
                <p className="text-sm text-slate-500">ระบบดูแลสุขภาพนักศึกษา {facultyFullName}</p>
              </div>

              <form className="space-y-5" onSubmit={handleLoginSubmit}>
                {loginError && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">
                    <AlertCircle className="mt-0.5 shrink-0" size={16} />
                    <p>{loginError}</p>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">รหัสประจำตัว หรือ อีเมล</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <User size={18} />
                    </div>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(event) => handleIdentifierChange(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="รหัสนักศึกษา หรือ อีเมล"
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-700">รหัสผ่าน</label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotError("");
                        setForgotSuccess("");
                        onViewChange("forgot");
                      }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      ลืมรหัสผ่าน?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Lock size={18} />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-10 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="******"
                      autoComplete="current-password"
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

                <button
                  type="submit"
                  disabled={isLoginLoading}
                  className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white shadow-sm transition-all hover:bg-blue-700 disabled:cursor-not-allowed"
                >
                  {isLoginLoading ? (
                    <span className="loader h-5 w-5"></span>
                  ) : (
                    <>
                      เข้าสู่ระบบ <ArrowRight size={18} />
                    </>
                  )}
                </button>

                <div className="mt-6">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="bg-white px-2 text-slate-500">หรือ</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled
                    className="mt-4 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600 shadow-sm"
                    title="กำลังรอเชื่อมต่อ SSO API จากมหาวิทยาลัย"
                  >
                    <KkuSsoIcon />
                    เข้าสู่ระบบด้วยบัญชีมหาวิทยาลัยขอนแก่น (SSO)
                  </button>
                  <p className="mt-2 text-center text-xs text-slate-400">กำลังรอเชื่อมต่อ SSO API จากมหาวิทยาลัย</p>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="mb-8 text-center md:text-left">
                <h3 className="mb-2 text-3xl font-bold text-slate-800">ลืมรหัสผ่าน</h3>
                <p className="text-sm text-slate-500">
                  กรอกอีเมลที่ใช้งานในระบบ แล้วเราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้
                </p>
              </div>

              <form className="space-y-4" onSubmit={handleForgotSubmit}>
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

                {forgotError && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                    <AlertCircle className="mt-0.5 shrink-0" size={16} />
                    <p>{forgotError}</p>
                  </div>
                )}

                {forgotSuccess && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    {forgotSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isForgotLoading}
                  className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isForgotLoading ? <span className="loader h-5 w-5 "></span> : "ส่งลิงก์เปลี่ยนรหัสผ่าน"}
                </button>
              </form>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setLoginError("");
                    onViewChange("login");
                  }}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800"
                >
                  <ArrowLeft size={16} />
                  กลับไปหน้าเข้าสู่ระบบ
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
