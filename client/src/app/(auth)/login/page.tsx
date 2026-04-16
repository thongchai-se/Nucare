"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BookOpenCheck,
  Eye,
  EyeOff,
  GraduationCap,
  HeartPulse,
  Loader2,
  ShieldCheck,
  Stethoscope,
  UserRoundCheck,
} from "lucide-react";
import type { Role } from "@/types/auth";
import { useAuth } from "@/context/auth.context";

type AuthMode = "login" | "register";

type RoleOption = {
  value: Extract<Role, "STUDENT" | "ADVISOR" | "MENTAL_HEALTH" | "INSTRUCTOR">;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const roleOptions: RoleOption[] = [
  { value: "STUDENT", label: "นักศึกษา", icon: GraduationCap },
  { value: "ADVISOR", label: "อาจารย์ที่ปรึกษา", icon: UserRoundCheck },
  { value: "MENTAL_HEALTH", label: "บุคลากรสุขภาพจิต", icon: Stethoscope },
  { value: "INSTRUCTOR", label: "อาจารย์ผู้สอน", icon: BookOpenCheck },
];

const baseInputClassName =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function LoginPage() {
  const router = useRouter();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [registerRole, setRegisterRole] = useState<RoleOption["value"]>("STUDENT");
  const [registerName, setRegisterName] = useState("");
  const [registerIdentifier, setRegisterIdentifier] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);

  const identifierLabel =
    registerRole === "STUDENT" ? "รหัสนักศึกษา" : "รหัสพนักงาน/อาจารย์";

  const resetMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleModeChange = (nextMode: AuthMode) => {
    setMode(nextMode);
    resetMessages();
  };

  const handleLoginSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();

    try {
      setLoading(true);
      await login(loginIdentifier, loginPassword);
      router.push("/dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "เข้าสู่ระบบไม่สำเร็จ";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();

    if (registerPassword !== registerConfirmPassword) {
      setErrorMessage("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    try {
      setLoading(true);
      await register({
        role: registerRole,
        name: registerName,
        identifier: registerIdentifier,
        password: registerPassword,
      });
      setSuccessMessage("ลงทะเบียนสำเร็จ กำลังนำคุณไปยังแดชบอร์ด...");
      router.push("/dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "ลงทะเบียนไม่สำเร็จ";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen w-full md:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-blue-700 via-sky-600 to-cyan-500 p-8 text-white md:flex md:flex-col md:justify-between">
        <div className="absolute -left-16 -top-16 h-60 w-60 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute -bottom-16 -right-16 h-72 w-72 rounded-full bg-cyan-200/30 blur-2xl" />

        <div className="relative space-y-10">
          <div className="inline-flex items-center gap-3 rounded-2xl border border-white/30 bg-white/15 px-4 py-3 backdrop-blur">
            <HeartPulse className="h-8 w-8" />
            <div>
              <p className="text-sm font-medium text-blue-50">NUCARE</p>
              <h1 className="font-display text-2xl font-semibold leading-tight">
                ระบบดูแลและติดตามสุขภาวะนักศึกษา
              </h1>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/25 bg-white/15 p-4 backdrop-blur">
              <p className="text-3xl font-semibold">700+</p>
              <p className="text-sm text-blue-50">นักศึกษา</p>
            </div>
            <div className="rounded-2xl border border-white/25 bg-white/15 p-4 backdrop-blur">
              <p className="text-3xl font-semibold">80+</p>
              <p className="text-sm text-blue-50">อาจารย์</p>
            </div>
          </div>
        </div>

        <blockquote className="relative rounded-2xl border border-white/30 bg-white/15 p-5 text-sm leading-relaxed backdrop-blur">
          <p>
            "การดูแลสุขภาวะของนักศึกษา คือรากฐานของการพัฒนาพยาบาลวิชาชีพที่มีคุณภาพ"
          </p>
          <footer className="mt-3 text-blue-100">คณะพยาบาลศาสตร์</footer>
        </blockquote>
      </section>

      <section className="flex items-center justify-center bg-slate-100 p-5 md:p-10">
        <div className="w-full max-w-md animate-fade-up space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 md:p-8">
          <div className="space-y-2 text-center">
            <h2 className="font-display text-3xl font-semibold text-slate-900">
              {mode === "login" ? "เข้าสู่ระบบ" : "ลงทะเบียน"}
            </h2>
            <p className="text-sm text-slate-500">Student Mental Health Care System</p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => handleModeChange("login")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                mode === "login"
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-600 hover:bg-slate-200"
              }`}
            >
              เข้าสู่ระบบ
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("register")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                mode === "register"
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-600 hover:bg-slate-200"
              }`}
            >
              ลงทะเบียน
            </button>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          )}

          {mode === "login" ? (
            <form className="space-y-4" onSubmit={handleLoginSubmit}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="loginIdentifier">
                  รหัสนักศึกษา / รหัสพนักงาน / อีเมล
                </label>
                <input
                  id="loginIdentifier"
                  type="text"
                  autoComplete="username"
                  className={baseInputClassName}
                  value={loginIdentifier}
                  onChange={(event) => setLoginIdentifier(event.target.value)}
                  placeholder="เช่น 66012345 หรือ nurse@university.ac.th"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="loginPassword">
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <input
                    id="loginPassword"
                    type={showLoginPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className={`${baseInputClassName} pr-12`}
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    placeholder="กรอกรหัสผ่าน"
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 hover:text-slate-700"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    aria-label="toggle password visibility"
                  >
                    {showLoginPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "เข้าสู่ระบบ"}
              </button>

              <div className="relative py-2 text-center text-xs text-slate-400">
                <span className="relative z-10 bg-white px-2">หรือ</span>
                <div className="absolute left-0 right-0 top-1/2 -z-0 border-t border-slate-200" />
              </div>

              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ShieldCheck className="h-4 w-4" />
                SSO (เร็วๆ นี้)
              </button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleRegisterSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">เลือกบทบาท</label>
                <div className="grid grid-cols-2 gap-2">
                  {roleOptions.map((roleOption) => {
                    const Icon = roleOption.icon;
                    const active = registerRole === roleOption.value;

                    return (
                      <button
                        key={roleOption.value}
                        type="button"
                        onClick={() => setRegisterRole(roleOption.value)}
                        className={`rounded-xl border px-3 py-3 text-left transition ${
                          active
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span className="text-xs font-medium">{roleOption.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="registerName">
                  ชื่อ-นามสกุล
                </label>
                <input
                  id="registerName"
                  type="text"
                  className={baseInputClassName}
                  value={registerName}
                  onChange={(event) => setRegisterName(event.target.value)}
                  placeholder="เช่น นางสาวสมหญิง ใจดี"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="registerIdentifier">
                  {identifierLabel}
                </label>
                <input
                  id="registerIdentifier"
                  type="text"
                  className={baseInputClassName}
                  value={registerIdentifier}
                  onChange={(event) => setRegisterIdentifier(event.target.value)}
                  placeholder={registerRole === "STUDENT" ? "เช่น 66012345" : "เช่น EMP-2041"}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="registerPassword">
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <input
                    id="registerPassword"
                    type={showRegisterPassword ? "text" : "password"}
                    className={`${baseInputClassName} pr-12`}
                    value={registerPassword}
                    onChange={(event) => setRegisterPassword(event.target.value)}
                    placeholder="อย่างน้อย 8 ตัวอักษร"
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 hover:text-slate-700"
                    onClick={() => setShowRegisterPassword((prev) => !prev)}
                    aria-label="toggle password visibility"
                  >
                    {showRegisterPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  className="text-sm font-medium text-slate-700"
                  htmlFor="registerConfirmPassword"
                >
                  ยืนยันรหัสผ่าน
                </label>
                <div className="relative">
                  <input
                    id="registerConfirmPassword"
                    type={showRegisterConfirmPassword ? "text" : "password"}
                    className={`${baseInputClassName} pr-12`}
                    value={registerConfirmPassword}
                    onChange={(event) => setRegisterConfirmPassword(event.target.value)}
                    placeholder="กรอกรหัสผ่านอีกครั้ง"
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 hover:text-slate-700"
                    onClick={() => setShowRegisterConfirmPassword((prev) => !prev)}
                    aria-label="toggle confirm password visibility"
                  >
                    {showRegisterConfirmPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "สร้างบัญชี"}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-slate-600">
            {mode === "login" ? "ยังไม่มีบัญชี?" : "มีบัญชีแล้ว?"}{" "}
            <button
              type="button"
              className="font-medium text-blue-600 hover:text-blue-700"
              onClick={() => handleModeChange(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? "ลงทะเบียนที่นี่" : "เข้าสู่ระบบ"}
            </button>
          </p>

          <p className="text-center text-xs text-slate-500">
            ข้อมูลถูกเก็บรักษาตาม พ.ร.บ. PDPA
          </p>
        </div>
      </section>
    </main>
  );
}
