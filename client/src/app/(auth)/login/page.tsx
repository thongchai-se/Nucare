"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  HeartPulse,
  Lock,
  User,
} from "lucide-react";
import { useAuth } from "@/context/auth.context";

const KkuSsoIcon = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true" className="h-5 w-5">
    <defs>
      <linearGradient id="kkuGradient" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stopColor="#0055A5" />
        <stop offset="100%" stopColor="#2A7AD6" />
      </linearGradient>
    </defs>
    <circle cx="16" cy="16" r="15" fill="url(#kkuGradient)" />
    <text x="16" y="20" textAnchor="middle" fontSize="9" fontWeight="700" fill="#FFFFFF">
      KKU
    </text>
  </svg>
);

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const LOGIN_FAILED_MESSAGE = "ชื่อบัญชีหรือรหัสผ่านไม่ถูกต้อง";

  const [showPassword, setShowPassword] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const mapLoginErrorMessage = (_message: string): string => LOGIN_FAILED_MESSAGE;

  const formatStudentIdentifier = (value: string): string => {
    const compact = value.replace(/\s+/g, "");
    const onlyDigits = compact.replace(/\D/g, "").slice(0, 10);

    if (onlyDigits.length <= 9) {
      return onlyDigits;
    }

    return `${onlyDigits.slice(0, 9)}-${onlyDigits.slice(9)}`;
  };

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

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (isLoading) {
      return;
    }

    const normalizedIdentifier = identifier.trim();
    const normalizedPassword = password.trim();

    if (!normalizedIdentifier) {
      setError(LOGIN_FAILED_MESSAGE);
      return;
    }

    if (!normalizedPassword) {
      setError(LOGIN_FAILED_MESSAGE);
      return;
    }

    const isStudentIdInput =
      !normalizedIdentifier.includes("@") && /^[0-9-]+$/.test(normalizedIdentifier);

    if (isStudentIdInput) {
      const digitsOnly = normalizedIdentifier.replace(/\D/g, "");

      if (digitsOnly.length !== 10) {
        setError("รหัสนักศึกษาต้องมี 10 หลัก");
        return;
      }
    }

    const loginIdentifier = isStudentIdInput
      ? formatStudentIdentifier(normalizedIdentifier)
      : normalizedIdentifier;

    setIsLoading(true);

    try {
      await login(loginIdentifier, normalizedPassword);
      router.push("/dashboard");
    } catch (loginError) {
      const message =
        loginError instanceof Error
          ? mapLoginErrorMessage(loginError.message)
          : LOGIN_FAILED_MESSAGE;
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-4xl items-center justify-center">
        <div className="flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl md:flex-row">
          <div className="relative hidden flex-col justify-between overflow-hidden bg-blue-600 p-12 md:flex md:w-1/2">
            <div className="absolute inset-0 z-0 bg-gradient-to-br from-blue-600 to-indigo-800" />
            <div className="absolute right-[-10%] top-[-10%] h-64 w-64 rounded-full bg-white opacity-10" />
            <div className="absolute bottom-[-10%] left-[-10%] h-80 w-80 rounded-full bg-white opacity-10" />

            <div className="relative z-10">
              <div className="mb-8 flex items-center gap-2 text-white">
                <HeartPulse size={32} />
                <span className="text-2xl font-bold tracking-wider">NURSE CARE</span>
              </div>
              <h1 className="mb-4 text-3xl font-bold leading-tight text-white">
                ระบบดูแลและติดตาม
                <br />
                สุขภาพจิตนักศึกษา
              </h1>
              <p className="text-sm leading-relaxed text-blue-100">
                คณะพยาบาลศาสตร์
                <br />
                พื้นที่ปลอดภัยสำหรับทุกคน เพราะสุขภาพใจสำคัญไม่แพ้สุขภาพกาย ข้อมูลของคุณจะถูกเก็บรักษาเป็นความลับสูงสุด
              </p>
            </div>

            <div className="relative z-10 rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm font-medium text-white">"สุขภาพจิตที่ดี เริ่มต้นที่ความใส่ใจและการรับฟัง"</p>
            </div>
          </div>

          <div className="relative flex w-full flex-col justify-center p-8 md:w-1/2 md:p-12">
            <div className="mb-8 flex items-center justify-center gap-2 text-blue-600 md:hidden">
              <HeartPulse size={28} />
              <span className="text-xl font-bold tracking-wider">NURSE CARE</span>
            </div>

            <div className="mb-8 text-center md:text-left">
              <h2 className="mb-2 text-3xl font-bold text-slate-800">เข้าสู่ระบบ</h2>
              <p className="text-sm text-slate-500">Student Wellbeing Management System</p>
            </div>

            <form className="space-y-5" onSubmit={handleLogin}>
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">
                  <AlertCircle className="mt-0.5 shrink-0" size={16} />
                  <p>{error}</p>
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
                  <Link href="/forgot-password" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                    ลืมรหัสผ่าน?
                  </Link>
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
                disabled={isLoading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white shadow-sm transition-all hover:bg-blue-700 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
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

          </div>
        </div>
      </div>
    </div>
  );
}
