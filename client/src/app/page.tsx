"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { facultyFullName } from "@/lib/brand";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  ClipboardCheck,
  ClipboardEdit,
  Headphones,
  HeartHandshake,
  HeartPulse,
  LayoutDashboard,
  Lock,
  LogOut,
  LogIn,
  Menu,
  Music,
  Phone,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth.context";
import AuthPopup, { type AuthPopupView } from "@/components/auth-popup";
import LegalFooter from "@/components/legal-footer";
import { PUBLIC_NAV_ITEMS, PUBLIC_NAV_LABELS } from "@/components/public-nav-config";
import { getNameInitials } from "@/lib/name-prefix";

const getUserInitials = (name: string): string => getNameInitials(name, "NU");

const getAuthPopupViewFromUrl = (): AuthPopupView | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const auth = new URLSearchParams(window.location.search).get("auth");
  if (auth === "login" || auth === "forgot") {
    return auth;
  }

  return null;
};

const formatUserIdentifier = (studentId?: string | null, employeeId?: string | null, email?: string | null): string => {
  if (studentId) {
    if (/^\d{9}-\d$/.test(studentId)) {
      return `รหัสนักศึกษา: ${studentId}`;
    }

    if (/^\d{10}$/.test(studentId)) {
      return `รหัสนักศึกษา: ${studentId.slice(0, 9)}-${studentId.slice(9)}`;
    }

    return `รหัสนักศึกษา: ${studentId}`;
  }

  if (employeeId) {
    return `รหัสบุคลากร: ${employeeId}`;
  }

  return email ?? "-";
};

export default function HomePage() {
  const { logout, user, isAuthenticated, loading } = useAuth();
  const showAuthenticatedActions = isAuthenticated;
  const showGuestActions = !isAuthenticated;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthPopupOpen, setIsAuthPopupOpen] = useState(false);
  const [authPopupView, setAuthPopupView] = useState<AuthPopupView>("login");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const syncAuthPopupQuery = (view: AuthPopupView | null) => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);

    if (view) {
      url.searchParams.set("auth", view);
    } else {
      url.searchParams.delete("auth");
    }

    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const openAuthPopup = (view: AuthPopupView) => {
    setAuthPopupView(view);
    setIsAuthPopupOpen(true);
    setMobileMenuOpen(false);
    syncAuthPopupQuery(view);
  };

  const closeAuthPopup = () => {
    setIsAuthPopupOpen(false);
    setAuthPopupView("login");
    syncAuthPopupQuery(null);
  };

  const handleAuthPopupViewChange = (view: AuthPopupView) => {
    setAuthPopupView(view);
    syncAuthPopupQuery(view);
  };

  useEffect(() => {
    const nav = document.querySelector("nav");
    const onScroll = () => {
      if (!nav) {
        return;
      }

      if (window.scrollY > 10) {
        nav.classList.add("shadow-[0_4px_20px_-10px_rgba(0,0,0,0.14)]");
      } else {
        nav.classList.remove("shadow-[0_4px_20px_-10px_rgba(0,0,0,0.14)]");
      }
    };

    window.addEventListener("scroll", onScroll);
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    const syncPopupFromUrl = () => {
      const view = getAuthPopupViewFromUrl();

      if (view) {
        setAuthPopupView(view);
        setIsAuthPopupOpen(true);
        return;
      }

      setIsAuthPopupOpen(false);
    };

    syncPopupFromUrl();
    window.addEventListener("popstate", syncPopupFromUrl);

    return () => {
      window.removeEventListener("popstate", syncPopupFromUrl);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !isAuthPopupOpen) {
      return;
    }

    setIsAuthPopupOpen(false);
    syncAuthPopupQuery(null);
  }, [isAuthenticated, isAuthPopupOpen]);

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

  const userInitials = useMemo(() => {
    if (!user?.name) {
      return "NU";
    }

    return getUserInitials(user.name);
  }, [user?.name]);

  const userMenuSubtitle = useMemo(
    () => formatUserIdentifier(user?.studentId, user?.employeeId, user?.email),
    [user?.email, user?.employeeId, user?.studentId]
  );

  const handleLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
  };

  return (
    <div className="overflow-x-clip">
      <div className="fixed inset-0 -z-20 bg-[radial-gradient(circle_at_15%_20%,rgba(186,230,253,0.55),transparent_36%),radial-gradient(circle_at_82%_8%,rgba(125,211,252,0.45),transparent_32%),linear-gradient(135deg,#f8fafc_0%,#f0f9ff_40%,#eef2ff_100%)]" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.35)_40%,transparent_80%)]" />

      <nav className="fixed z-50 w-full border-b border-white/70 bg-white/85 backdrop-blur-md transition-all duration-300">
        <div className="mx-auto max-w-[116rem] px-3 sm:px-4 lg:px-5">
          <div className="flex h-16 items-center justify-between sm:h-20">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white shadow-md shadow-blue-500/30 sm:h-10 sm:w-10">
                <HeartPulse className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex flex-col justify-center">
                <span className="mb-0.5 block text-lg font-bold leading-none text-blue-900 sm:text-xl">
                  Nucare<span className="text-cyan-500">.</span>
                </span>
                <span className="block text-[10px] font-medium leading-none text-slate-500 sm:text-[11px]">{facultyFullName}</span>
              </div>
            </div>

            <div className="hidden items-center gap-5 lg:flex xl:gap-8">
              {PUBLIC_NAV_ITEMS.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="whitespace-nowrap text-sm font-semibold text-slate-600 transition-colors hover:text-blue-700"
                >
                  {item.label}
                </a>
              ))}

              {showGuestActions && (
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => openAuthPopup("login")}
                    className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-blue-700 px-4 py-2 text-sm font-semibold text-blue-700 transition-all hover:bg-blue-50"
                  >
                    <User className="h-4 w-4" /> {PUBLIC_NAV_LABELS.login}
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuthPopup("login")}
                    className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800"
                  >
                    <ClipboardCheck className="h-4 w-4" /> {PUBLIC_NAV_LABELS.assessment}
                  </button>
                </div>
              )}

              {showAuthenticatedActions && (
                <div className="flex items-center border-l border-slate-200 pl-4">
                  <div className="relative w-[15.5rem]" ref={profileMenuRef}>
                    <button
                      type="button"
                      onClick={() => setProfileMenuOpen((prev) => !prev)}
                      className={`flex w-full items-center justify-between gap-2.5 border border-slate-200 bg-white px-3 py-1.5 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50/90 ${
                        profileMenuOpen ? "rounded-b-none rounded-t-[1.35rem] border-b-transparent" : "rounded-[1.35rem]"
                      }`}
                      aria-expanded={profileMenuOpen}
                      aria-haspopup="menu"
                    >
                      <div className="hidden min-w-0 flex-1 overflow-hidden text-right lg:block">
                        <p className="truncate whitespace-nowrap text-sm font-bold leading-tight text-blue-900" title={user?.name || ""}>{user?.name}</p>
                        <p className="truncate whitespace-nowrap text-[11px] text-slate-500" title={userMenuSubtitle}>{userMenuSubtitle}</p>
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
                        href="/dashboard"
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-slate-50"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                          <LayoutDashboard className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{PUBLIC_NAV_LABELS.dashboard}</p>
                        </div>
                      </Link>
                      <Link
                        href="/dashboard/change-password"
                        className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-slate-50"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                          <Lock className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{PUBLIC_NAV_LABELS.changePassword}</p>
                        </div>
                      </Link>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="mt-1 flex w-full items-center gap-3 rounded-xl border-t border-slate-100 px-3 py-2.5 text-left transition-all hover:bg-red-50/80"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                          <LogOut className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-red-600">{PUBLIC_NAV_LABELS.logout}</p>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center lg:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-50 hover:text-blue-700"
                aria-label="toggle mobile menu"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        <div
          className={`overflow-hidden border-t border-slate-100 bg-white transition-all duration-300 lg:hidden ${
            mobileMenuOpen ? "max-h-[420px] pb-4" : "max-h-0"
          }`}
        >
          <div className="space-y-1 px-4 pt-4">
            {PUBLIC_NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {item.label}
              </a>
            ))}

            {showGuestActions && (
              <div className="flex flex-col gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => openAuthPopup("login")}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 font-semibold text-[15px] text-white"
                >
                  <ClipboardCheck className="h-5 w-5" /> {PUBLIC_NAV_LABELS.assessment}
                </button>
                <button
                  type="button"
                  onClick={() => openAuthPopup("login")}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-700 px-4 py-3 font-semibold text-[15px] text-blue-700"
                >
                  <LogIn className="h-5 w-5" /> {PUBLIC_NAV_LABELS.login}
                </button>
              </div>
            )}

            {showAuthenticatedActions && (
              <div className="space-y-3 pt-3">
                <div className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-100 font-bold text-cyan-700">
                    {userInitials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-slate-900">{user?.name}</p>
                    <p className="truncate text-xs font-medium text-slate-500">{userMenuSubtitle}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-[1.05rem] border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 hover:text-blue-700"
                  >
                    <LayoutDashboard className="h-4.5 w-4.5 text-blue-700" />
                    แดชบอร์ด
                  </Link>
                  <Link
                    href="/dashboard/change-password"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-[1.05rem] border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 hover:text-blue-700"
                  >
                    <Lock className="h-4.5 w-4.5 text-slate-700" />
                    {PUBLIC_NAV_LABELS.changePassword}
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="col-span-2 flex w-full items-center justify-center gap-2 rounded-[1.05rem] border border-red-200 bg-red-50/60 px-3 py-3 text-sm font-semibold text-red-600 shadow-sm transition-colors hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    ออกจากระบบ
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="relative flex min-h-screen flex-col justify-center">
        <section className="relative mx-auto w-full max-w-5xl overflow-hidden px-4 pb-12 pt-24 sm:px-6 sm:pb-16 sm:pt-32 lg:px-8">
          <div className="relative z-40 mb-8 text-center sm:mb-10">
            <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-semibold text-blue-800 shadow-sm backdrop-blur-md sm:mb-6 sm:px-4 sm:py-1.5 sm:text-sm">
              <Sparkles className="h-3 w-3 text-amber-500 sm:h-4 sm:w-4" />
              ระบบดูแลสุขภาพใจสำหรับมหาวิทยาลัย
            </div>
            <h1 className="mb-4 text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:mb-6 sm:text-5xl md:text-6xl">
              ดูแลนักศึกษา
              <br className="sm:hidden" />
              <span className="text-blue-700">อย่างปลอดภัยและเป็นระบบ</span>
            </h1>
            <p className="mx-auto max-w-2xl px-2 text-base leading-relaxed text-slate-600 sm:text-xl">
              เข้าสู่ระบบเพื่อทำแบบประเมิน ขอรับคำปรึกษา และติดตามการดูแลผ่านสิทธิ์ที่เหมาะสมกับบทบาทของคุณ
              <br className="hidden sm:block" />
              ข้อมูลสำคัญถูกจำกัดการเข้าถึงและบันทึก audit trail สำหรับการใช้งานจริง
            </p>
          </div>

          <div className="relative z-40 mx-auto flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:justify-center">
            {showGuestActions ? (
              <button
                type="button"
                onClick={() => openAuthPopup("login")}
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition-colors hover:bg-blue-800"
              >
                <LogIn className="h-4 w-4" /> เข้าสู่ระบบ
              </button>
            ) : (
              <Link
                href="/dashboard"
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition-colors hover:bg-blue-800"
              >
                <LayoutDashboard className="h-4 w-4" /> ไปที่แดชบอร์ด
              </Link>
            )}
            <a
              href="#support"
              className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white/80 px-6 py-3.5 text-sm font-bold text-blue-700 shadow-sm transition-colors hover:bg-white"
            >
              <ShieldCheck className="h-4 w-4" /> แนวทางดูแลข้อมูล
            </a>
          </div>
        </section>

        <section id="support" className="relative z-0 border-y border-slate-100 bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-[102rem] px-4 sm:px-6 lg:px-8">
            <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
              <div>
                <h2 className="mb-4 text-center text-3xl font-bold leading-tight text-slate-900 sm:text-4xl lg:text-left">
                  ให้ Nucare เป็น
                  <br className="hidden sm:block" />
                  <span className="text-blue-600"> Safe Zone ของคุณ</span>
                </h2>
                <p className="mb-8 text-center text-sm leading-relaxed text-slate-600 sm:text-base lg:text-left">
                  การเรียนพยาบาลเต็มไปด้วยแรงกดดัน เราเข้าใจว่าบางวันอาจเหนื่อย กังวล หรือรู้สึกโดดเดี่ยว Nucare
                  ช่วยให้คุณสำรวจสุขภาพใจอย่างเป็นส่วนตัว และเชื่อมต่อความช่วยเหลือที่อ่อนโยนได้ทันที
                </p>

                <ul className="space-y-5">
                  <li className="flex items-start gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:border-transparent sm:bg-transparent sm:p-0">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 sm:h-8 sm:w-8 sm:bg-blue-50">
                      <ShieldCheck className="h-5 w-5 sm:h-4 sm:w-4" />
                    </div>
                    <div>
                      <strong className="mb-0.5 block text-sm text-slate-800 sm:text-base">เป็นความลับ 100%</strong>
                      <span className="block text-xs leading-relaxed text-slate-500 sm:text-sm">
                        ข้อมูลของคุณถูกเก็บรักษาอย่างปลอดภัย และเข้าถึงได้เฉพาะผู้ดูแลที่เกี่ยวข้องเท่านั้น
                      </span>
                    </div>
                  </li>
                  <li className="flex items-start gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:border-transparent sm:bg-transparent sm:p-0">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 sm:h-8 sm:w-8 sm:bg-emerald-50">
                      <HeartHandshake className="h-5 w-5 sm:h-4 sm:w-4" />
                    </div>
                    <div>
                      <strong className="mb-0.5 block text-sm text-slate-800 sm:text-base">มีคนพร้อมรับฟังเสมอ</strong>
                      <span className="block text-xs leading-relaxed text-slate-500 sm:text-sm">
                        ทีมอาจารย์ที่ปรึกษาและผู้เชี่ยวชาญพร้อมช่วยเหลือ โดยไม่ตัดสินและเคารพความเป็นตัวคุณ
                      </span>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="relative mt-4 overflow-hidden rounded-[2rem] bg-blue-900 p-6 text-white shadow-xl sm:p-10 lg:mt-0">
                <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-cyan-300/10 blur-2xl" />
                <h3 className="relative z-10 mb-3 text-center text-xl font-bold sm:text-left sm:text-2xl">เช็คสุขภาพใจ (9Q)</h3>
                <p className="relative z-10 mb-8 text-center text-sm leading-relaxed text-blue-200 sm:text-left sm:text-base">
                  ใช้เวลาเพียง 3 นาที ทำแบบประเมินสั้นๆ เพื่อดูระดับความเสี่ยง และให้ระบบช่วยออกแบบการดูแลที่เหมาะกับคุณ
                </p>
                {showGuestActions ? (
                  <button
                    type="button"
                    onClick={() => openAuthPopup("login")}
                    className="relative z-10 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-bold text-blue-900 transition-colors hover:bg-slate-50 sm:py-4 sm:text-[15px]"
                  >
                    <ClipboardEdit className="h-4 w-4 sm:h-5 sm:w-5" /> เริ่มทำแบบประเมิน
                  </button>
                ) : (
                  <Link
                    href="/dashboard"
                    className="relative z-10 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-bold text-blue-900 transition-colors hover:bg-slate-50 sm:py-4 sm:text-[15px]"
                  >
                    <ClipboardEdit className="h-4 w-4 sm:h-5 sm:w-5" /> ไปที่แดชบอร์ด
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        <section id="resources" className="relative z-0 bg-slate-50 py-16 sm:py-20">
          <div className="mx-auto max-w-[102rem] px-4 sm:px-6 lg:px-8">
            <div className="mb-10 text-center sm:mb-12">
              <h2 className="mb-3 text-2xl font-bold text-slate-900 sm:text-3xl">ฮีลใจตัวเองเบื้องต้น</h2>
              <p className="px-2 text-sm text-slate-500 sm:text-base">คอนเทนต์สั้นๆ เพื่อเติมพลังใจในวันที่เหนื่อยล้า</p>
            </div>

            <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 md:grid-cols-3">
              <a
                href="#"
                className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-1 hover:border-blue-300 hover:shadow-md sm:p-6"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 sm:mb-5 sm:h-12 sm:w-12">
                  <Headphones className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:text-[11px]">Podcast</span>
                <h3 className="mb-2 text-base font-bold leading-tight text-slate-800 group-hover:text-blue-700 sm:mb-3 sm:text-lg">
                  จัดการความกดดันเมื่อต้องขึ้นวอร์ดครั้งแรก
                </h3>
                <p className="mt-auto flex items-center gap-1 pt-3 text-xs font-medium text-slate-500 sm:pt-4 sm:text-sm">
                  ฟังตอนนี้ <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                </p>
              </a>

              <a
                href="#"
                className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-1 hover:border-blue-300 hover:shadow-md sm:p-6"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 sm:mb-5 sm:h-12 sm:w-12">
                  <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:text-[11px]">Article</span>
                <h3 className="mb-2 text-base font-bold leading-tight text-slate-800 group-hover:text-blue-700 sm:mb-3 sm:text-lg">
                  เทคนิคหายใจลดความกังวลก่อนเข้าห้องสอบ
                </h3>
                <p className="mt-auto flex items-center gap-1 pt-3 text-xs font-medium text-slate-500 sm:pt-4 sm:text-sm">
                  อ่านบทความ <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                </p>
              </a>

              <a
                href="#"
                className="group hidden h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-1 hover:border-blue-300 hover:shadow-md md:flex sm:p-6"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 sm:mb-5 sm:h-12 sm:w-12">
                  <Music className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:text-[11px]">Playlist</span>
                <h3 className="mb-2 text-base font-bold leading-tight text-slate-800 group-hover:text-blue-700 sm:mb-3 sm:text-lg">
                  เสียงธรรมชาติบำบัด ช่วยให้นอนหลับสบาย
                </h3>
                <p className="mt-auto flex items-center gap-1 pt-3 text-xs font-medium text-slate-500 sm:pt-4 sm:text-sm">
                  ฟังเพลย์ลิสต์ <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                </p>
              </a>
            </div>

            <div className="mt-8 text-center sm:mt-10">
              <button type="button" className="p-2 text-sm font-bold text-blue-600 underline transition-colors hover:text-blue-800">
                ดูเนื้อหาฮีลใจทั้งหมด
              </button>
            </div>
          </div>
        </section>

        <section id="emergency" className="relative z-0 mt-auto bg-red-600 py-8 sm:py-10">
          <div className="mx-auto flex max-w-[102rem] flex-col items-center justify-between gap-6 px-4 sm:gap-8 sm:px-6 lg:flex-row lg:px-8">
            <div className="flex flex-col items-center gap-4 text-center text-white sm:flex-row sm:items-start sm:text-left lg:items-center">
              <div className="flex h-14 w-14 shrink-0 animate-pulse items-center justify-center rounded-full bg-white/20 backdrop-blur-sm sm:h-16 sm:w-16">
                <PhoneCall className="h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <div>
                <h3 className="mb-1 text-xl font-bold sm:mb-1.5 sm:text-2xl">ต้องการความช่วยเหลือด่วนใช่ไหม?</h3>
                <p className="text-xs text-red-100 sm:text-sm">หากรู้สึกไม่ปลอดภัย หรือมีความคิดทำร้ายตนเอง อย่าลังเลที่จะติดต่อเรา</p>
              </div>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-3 sm:flex-row sm:gap-4 lg:w-auto">
              <a
                href="tel:1323"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-center text-sm font-bold text-red-600 shadow-md transition-colors hover:bg-red-50 sm:w-auto sm:px-8 sm:py-3.5 sm:text-[15px]"
              >
                <Phone className="h-4 w-4 sm:h-5 sm:w-5" /> สายด่วน 1323
              </a>
              <button
                type="button"
                className="w-full rounded-lg bg-red-800 px-6 py-3 text-center text-sm font-bold text-white shadow-md transition-colors hover:bg-red-900 sm:w-auto sm:px-8 sm:py-3.5 sm:text-[15px]"
              >
                แจ้งเหตุฉุกเฉิน (คณะฯ)
              </button>
            </div>
          </div>
        </section>
      </main>

      <AuthPopup
        isOpen={!loading && !isAuthenticated && isAuthPopupOpen}
        view={authPopupView}
        onClose={closeAuthPopup}
        onViewChange={handleAuthPopupViewChange}
      />

      <LegalFooter />
    </div>
  );
}

