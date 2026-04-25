"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  BrainCircuit,
  Check,
  ChevronRight,
  ClipboardCheck,
  ClipboardEdit,
  HeartPulse,
  LogIn,
  Menu,
  MessageCircle,
  Phone,
  PhoneCall,
  Search,
  ShieldCheck,
  Siren,
  Smile,
  Sparkles,
  Stethoscope,
  User,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/context/auth.context";
import AuthPopup, { type AuthPopupView } from "@/components/auth-popup";

type WorkflowStep = {
  title: string;
  description: string;
  badge: string;
  cardClass: string;
  badgeClass: string;
  iconClass: string;
  icon: LucideIcon;
};

type CareRole = {
  title: string;
  description: string;
  iconClass: string;
  icon: LucideIcon;
};

const workflowSteps: WorkflowStep[] = [
  {
    title: "ทำแบบประเมิน",
    description:
      "เริ่มจากการทำแบบคัดกรองเบื้องต้น เพื่อให้เราเข้าใจสภาวะจิตใจของคุณในปัจจุบันได้ดียิ่งขึ้น",
    badge: "ขั้นตอนที่ 1",
    cardClass: "bg-slate-50 border border-slate-100",
    badgeClass: "bg-primary-100 text-primary-700",
    iconClass: "text-primary-600",
    icon: Search,
  },
  {
    title: "พูดคุยเบื้องต้น",
    description:
      "อาจารย์ที่ปรึกษาจะติดต่อนัดพูดคุย ให้คำปรึกษา และรับฟังคุณอย่างใกล้ชิดด้วยความเข้าใจ",
    badge: "ขั้นตอนที่ 2",
    cardClass: "bg-slate-50 border border-slate-100",
    badgeClass: "bg-cyan-100 text-cyan-700",
    iconClass: "text-cyan-600",
    icon: MessageCircle,
  },
  {
    title: "ดูแลเฉพาะทาง",
    description:
      "หากจำเป็น เราจะเชื่อมโยงคุณกับอาจารย์พยาบาลจิตเวชหรือนักจิตวิทยาเพื่อการดูแลที่ลึกซึ้งยิ่งขึ้น",
    badge: "ขั้นตอนที่ 3",
    cardClass: "bg-slate-50 border border-slate-100",
    badgeClass: "bg-indigo-100 text-indigo-700",
    iconClass: "text-indigo-600",
    icon: Stethoscope,
  },
  {
    title: "ช่วยเหลือทันที",
    description:
      "ในภาวะวิกฤต หรือมีความรู้สึกอยากทำร้ายตนเอง ทีมดูแลพิเศษพร้อมเข้าช่วยเหลือคุณอย่างเร่งด่วน",
    badge: "กรณีฉุกเฉิน",
    cardClass: "bg-red-50 border border-red-100",
    badgeClass: "bg-red-100 text-red-700",
    iconClass: "text-red-600",
    icon: Siren,
  },
];

const careRoles: CareRole[] = [
  {
    title: "อาจารย์ที่ปรึกษา",
    description:
      "ด่านแรกที่พร้อมรับฟังปัญหาของคุณ คอยติดตาม ถามไถ่ และให้คำแนะนำเบื้องต้นอย่างเป็นกันเองและอบอุ่น",
    iconClass: "bg-primary-100 text-primary-700",
    icon: UserCheck,
  },
  {
    title: "อาจารย์ผู้สอน",
    description:
      "คอยสังเกตความเปลี่ยนแปลงในชั้นเรียน หากพบว่าคุณดูเหนื่อยล้า จะคอยประสานงานเพื่อส่งความห่วงใยถึงคุณ",
    iconClass: "bg-cyan-100 text-cyan-700",
    icon: BookOpen,
  },
  {
    title: "ทีมผู้เชี่ยวชาญ",
    description:
      "อาจารย์พยาบาลสุขภาพจิตและนักจิตวิทยา ที่พร้อมให้คำปรึกษาเชิงลึกและวางแผนฟื้นฟูจิตใจให้กลับมาเข้มแข็ง",
    iconClass: "bg-indigo-100 text-indigo-700",
    icon: BrainCircuit,
  },
];

const getUserInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "NU";
  }

  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? "";
  return `${first}${second}`.toUpperCase();
};

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

export default function HomePage() {
  const { logout, user, isAuthenticated, loading } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [isAuthPopupOpen, setIsAuthPopupOpen] = useState(false);
  const [authPopupView, setAuthPopupView] = useState<AuthPopupView>("login");

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
        nav.classList.add("shadow-md");
      } else {
        nav.classList.remove("shadow-md");
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
    if (!showToast) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setShowToast(false);
    }, 4000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [showToast]);

  const userInitials = useMemo(() => {
    if (!user?.name) {
      return "NU";
    }

    return getUserInitials(user.name);
  }, [user?.name]);

  const handleLogout = async () => {
    await logout();
    setToastMessage("ออกจากระบบเรียบร้อยแล้ว");
    setShowToast(true);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <div
        className={`fixed bottom-6 right-6 z-[60] flex transform items-center gap-3 rounded-lg border-l-4 border-emerald-500 bg-white px-5 py-4 shadow-xl transition-all duration-300 ${
          showToast ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-20 opacity-0"
        }`}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Check className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-800">สถานะระบบ</h4>
          <p className="mt-0.5 text-xs text-slate-500">{toastMessage}</p>
        </div>
      </div>

      <nav className="fixed z-50 w-full border-b border-slate-100 bg-white transition-all duration-300">
        <div className="mx-auto max-w-[116rem] px-1.5 sm:px-2 lg:px-3">
          <div className="flex h-20 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white shadow-sm">
                <HeartPulse className="h-6 w-6" />
              </div>
              <div className="flex flex-col justify-center">
                <span className="mb-1 block text-xl font-bold leading-none text-blue-900">
                  Nucare<span className="text-2xl leading-none text-cyan-500">.</span>
                </span>
                <span className="block text-[11px] font-medium leading-none text-slate-500">คณะพยาบาลศาสตร์</span>
              </div>
            </div>

            <div className="hidden items-center gap-5 lg:flex xl:gap-8">
              <a href="#home" className="whitespace-nowrap font-medium text-slate-600 transition-colors hover:text-blue-700">
                หน้าแรก
              </a>
              <a href="#workflow" className="whitespace-nowrap font-medium text-slate-600 transition-colors hover:text-blue-700">
                ขั้นตอนการดูแล
              </a>
              <a href="#roles" className="whitespace-nowrap font-medium text-slate-600 transition-colors hover:text-blue-700">
                ทีมผู้เชี่ยวชาญ
              </a>

              <div className="mx-2 h-6 border-l border-slate-200" />

              {!loading && !isAuthenticated && (
                <div className="flex items-center gap-2.5 xl:gap-3">
                  <button
                    type="button"
                    onClick={() => openAuthPopup("login")}
                    className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-blue-700 px-4 py-2.5 text-sm font-semibold text-blue-700 transition-all hover:bg-blue-50 xl:px-5"
                  >
                    <User className="h-4 w-4" /> เข้าสู่ระบบ
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuthPopup("login")}
                    className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800 xl:px-5"
                  >
                    <ClipboardCheck className="h-4 w-4" /> ทำแบบประเมิน
                  </button>
                </div>
              )}

              {!loading && isAuthenticated && (
                <div className="flex items-center gap-3 xl:gap-4">
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800 xl:px-5"
                  >
                    ไปที่แดชบอร์ด
                  </Link>
                  <div className="group flex cursor-pointer items-center gap-3 border-l border-slate-200 pl-4">
                    <div className="hidden text-right lg:block">
                      <p className="text-sm font-bold leading-tight text-blue-900">{user?.name}</p>
                      <p className="text-xs text-slate-500">{user?.studentId ? "นักศึกษาพยาบาลศาสตร์" : "บุคลากร"}</p>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-100 font-bold text-cyan-700">
                      {userInitials}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    ออกจากระบบ
                  </button>
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
          <div className="space-y-1 px-4 pt-2">
            <a
              href="#home"
              className="block rounded-md px-3 py-3 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-700"
              onClick={() => setMobileMenuOpen(false)}
            >
              หน้าแรก
            </a>
            <a
              href="#workflow"
              className="block rounded-md px-3 py-3 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-700"
              onClick={() => setMobileMenuOpen(false)}
            >
              ขั้นตอนการดูแล
            </a>
            <a
              href="#roles"
              className="block rounded-md px-3 py-3 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-700"
              onClick={() => setMobileMenuOpen(false)}
            >
              ทีมผู้เชี่ยวชาญ
            </a>

            {!loading && !isAuthenticated && (
              <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => openAuthPopup("login")}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white"
                >
                  <ClipboardCheck className="h-5 w-5" /> ทำแบบประเมิน
                </button>
                <button
                  type="button"
                  onClick={() => openAuthPopup("login")}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-700 px-4 py-3 font-semibold text-blue-700"
                >
                  <LogIn className="h-5 w-5" /> เข้าสู่ระบบ
                </button>
              </div>
            )}

            {!loading && isAuthenticated && (
              <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4">
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white"
                >
                  ไปที่แดชบอร์ด
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-700"
                >
                  ออกจากระบบ
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main>
        <section id="home" className="relative overflow-hidden border-b border-slate-100 bg-slate-50 pb-20 pt-32 lg:pb-32 lg:pt-40">
          <div className="pointer-events-none absolute -top-16 left-0 h-64 w-64 rounded-full bg-cyan-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 top-12 h-80 w-80 rounded-full bg-blue-300/30 blur-3xl" />

          <div className="relative mx-auto grid max-w-[102rem] grid-cols-1 items-center gap-12 px-3 sm:px-4 lg:grid-cols-2 lg:px-5">
            <div className="max-w-2xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-100 px-4 py-1.5 text-sm font-semibold text-cyan-700">
                <ShieldCheck className="h-4 w-4" /> พื้นที่ปลอดภัยสำหรับนักศึกษา
              </div>
              <h1 className="mb-6 text-4xl font-bold leading-[1.2] text-blue-900 md:text-5xl lg:text-6xl">
                สุขภาพใจที่ดี
                <br className="hidden sm:block" />
                <span className="text-blue-600">เริ่มต้นที่การพูดคุย</span>
              </h1>
              <p className="mb-8 text-lg leading-relaxed text-slate-600">
                ระบบจัดการและดูแลสุขภาวะนักศึกษา คณะพยาบาลศาสตร์ เราพร้อมรับฟัง ให้คำปรึกษา และดูแลคุณในทุกสถานการณ์
                <span className="mt-2 block font-semibold text-blue-800">ข้อมูลของคุณจะถูกเก็บเป็นความลับสูงสุด</span>
              </p>

              {!loading && !isAuthenticated && (
                <div className="flex flex-col gap-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => openAuthPopup("login")}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-8 py-3.5 text-[15px] font-bold text-white shadow-md transition-all hover:bg-blue-800 hover:shadow-lg sm:w-auto"
                  >
                    <ClipboardEdit className="h-5 w-5" />
                    เริ่มทำแบบประเมิน
                  </button>
                  <a
                    href="#emergency"
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-8 py-3.5 text-[15px] font-bold text-slate-700 transition-all hover:bg-slate-50 sm:w-auto"
                  >
                    ติดต่อขอความช่วยเหลือ
                  </a>
                </div>
              )}

              {!loading && isAuthenticated && (
                <div className="flex flex-col gap-4 sm:flex-row">
                  <Link
                    href="/dashboard"
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-8 py-3.5 text-[15px] font-bold text-white shadow-md transition-all hover:bg-blue-800 sm:w-auto"
                  >
                    <ClipboardEdit className="h-5 w-5" />
                    ไปที่แดชบอร์ด
                  </Link>
                  <a
                    href="#workflow"
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-8 py-3.5 text-[15px] font-bold text-slate-700 transition-all hover:bg-slate-50 sm:w-auto"
                  >
                    ดูขั้นตอนการดูแล
                  </a>
                </div>
              )}
            </div>

            <div className="relative hidden lg:block">
              <div className="absolute inset-0 z-0 scale-105 rotate-3 rounded-2xl bg-blue-100" />
              <div className="relative z-10 -rotate-1 transform rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-transform duration-300 hover:rotate-0">
                <div className="absolute -right-5 -top-5 z-0 flex h-20 w-20 items-center justify-center rounded-full bg-cyan-100">
                  <Sparkles className="h-8 w-8 text-cyan-500" />
                </div>
                <div className="relative z-10">
                  <div className="mb-8 flex items-center gap-4 border-b border-slate-100 pb-6">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <Smile className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="mb-0.5 text-xl font-bold text-blue-900">ยินดีต้อนรับ</h3>
                      <p className="text-sm text-slate-500">เราพร้อมอยู่เคียงข้างคุณเสมอ</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">การรักษาความลับ</h4>
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                          ข้อมูลสุขภาพจิตของคุณจะถูกเก็บรักษาอย่างปลอดภัย และเข้าถึงได้เฉพาะผู้ดูแลที่เกี่ยวข้องเท่านั้น
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
                      <Users className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">เข้าถึงทีมผู้เชี่ยวชาญ</h4>
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                          สามารถรับคำปรึกษาจากอาจารย์ที่ปรึกษา และทีมพยาบาลจิตเวชได้โดยตรงเมื่อคุณต้องการ
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="border-b border-slate-100 bg-white py-20">
          <div className="mx-auto max-w-[102rem] px-3 sm:px-4 lg:px-5">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-bold text-blue-900">เมื่อต้องการความช่วยเหลือ เราดูแลคุณอย่างไร?</h2>
              <p className="mx-auto max-w-2xl text-slate-600">
                กระบวนการดูแลที่ออกแบบมาเพื่อนักศึกษาโดยเฉพาะ เป็นระบบ ปลอดภัย และเข้าใจคุณ
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {workflowSteps.map((step) => (
                <div
                  key={step.title}
                  className={`rounded-xl p-8 text-center transition-shadow hover:shadow-md ${step.cardClass}`}
                >
                  <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                    <step.icon className={`h-8 w-8 ${step.iconClass}`} />
                  </div>
                  <div
                    className={`mb-4 inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-bold ${step.badgeClass}`}
                  >
                    {step.badge}
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-slate-800">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="roles" className="bg-slate-50 py-20">
          <div className="mx-auto max-w-[102rem] px-3 sm:px-4 lg:px-5">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-bold text-blue-900">ใครบ้างที่พร้อมดูแลคุณ?</h2>
              <p className="mx-auto max-w-2xl text-slate-600">
                เราทำงานร่วมกันเป็นทีม เพื่อให้มั่นใจว่านักศึกษาจะได้รับการดูแลอย่างดีที่สุดในทุกก้าวเดิน
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {careRoles.map((role) => (
                <div
                  key={role.title}
                  className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm"
                >
                  <div className={`mb-6 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${role.iconClass}`}>
                    <role.icon className="h-8 w-8" />
                  </div>
                  <h3 className="mb-3 text-xl font-bold text-blue-900">{role.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600">{role.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="emergency" className="bg-red-600 py-10">
          <div className="mx-auto flex max-w-[102rem] flex-col items-center justify-between gap-8 px-3 sm:px-4 lg:flex-row lg:px-5">
            <div className="flex flex-col items-center gap-5 text-center text-white sm:flex-row sm:items-start sm:text-left lg:items-center">
              <div className="flex h-16 w-16 shrink-0 animate-pulse items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <PhoneCall className="h-8 w-8" />
              </div>
              <div>
                <h3 className="mb-1.5 text-2xl font-bold">ต้องการความช่วยเหลือด่วนใช่ไหม?</h3>
                <p className="text-sm text-red-100 sm:text-base">
                  หากรู้สึกไม่ปลอดภัย หรือมีความคิดทำร้ายตนเอง อย่าลังเลที่จะติดต่อเรา
                </p>
              </div>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-4 sm:flex-row lg:w-auto">
              <a
                href="tel:1323"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-8 py-3.5 text-center text-[15px] font-bold text-red-600 shadow-md transition-colors hover:bg-red-50 sm:w-auto"
              >
                <Phone className="h-5 w-5" /> สายด่วน 1323
              </a>
              <button
                type="button"
                className="w-full rounded-lg bg-red-800 px-8 py-3.5 text-center text-[15px] font-bold text-white shadow-md transition-colors hover:bg-red-900 sm:w-auto"
              >
                แจ้งเหตุฉุกเฉิน (คณะพยาบาลฯ)
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
                  <a href="#" className="flex items-center gap-2 text-blue-100 transition-colors hover:text-white">
                    <ChevronRight className="h-4 w-4" /> ทำแบบประเมินสุขภาพจิต
                  </a>
                </li>
                <li>
                  <a href="#" className="flex items-center gap-2 text-blue-100 transition-colors hover:text-white">
                    <ChevronRight className="h-4 w-4" /> นัดหมายอาจารย์ที่ปรึกษา
                  </a>
                </li>
                <li>
                  <a href="#" className="flex items-center gap-2 text-blue-100 transition-colors hover:text-white">
                    <ChevronRight className="h-4 w-4" /> แหล่งความรู้การจัดการความเครียด
                  </a>
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
    </>
  );
}
