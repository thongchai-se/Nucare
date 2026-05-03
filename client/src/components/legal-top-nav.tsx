"use client";

import Link from "next/link";
import { ChevronDown, ClipboardCheck, HeartPulse, LogIn, Menu, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/auth.context";
import { PUBLIC_NAV_ITEMS, PUBLIC_NAV_LABELS } from "@/components/public-nav-config";
import { getNameInitials } from "@/lib/name-prefix";

type LegalPageKey = "terms" | "privacy" | "cookies";

type LegalTopNavProps = {
  active: LegalPageKey;
};

const getUserInitials = (name: string): string => getNameInitials(name, "NU");

export default function LegalTopNav({ active }: LegalTopNavProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  void active;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setProfileMenuOpen(false);
      }
    };

    const nav = document.querySelector("nav");
    const onScroll = () => {
      if (!nav) return;
      if (window.scrollY > 10) {
        nav.classList.add("shadow-[0_4px_20px_-10px_rgba(0,0,0,0.14)]");
      } else {
        nav.classList.remove("shadow-[0_4px_20px_-10px_rgba(0,0,0,0.14)]");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", onScroll);
    onScroll();

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
  };

  const userInitials = getUserInitials(user?.name ?? "");

  return (
    <nav className="fixed z-50 w-full border-b border-white/70 bg-white/85 backdrop-blur-md transition-all duration-300">
      <div className="mx-auto max-w-[116rem] px-3 sm:px-4 lg:px-5">
        <div className="flex h-16 items-center justify-between sm:h-20">
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3">
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

          <div className="hidden items-center gap-5 lg:flex xl:gap-8">
            {PUBLIC_NAV_ITEMS.map((item) => (
              <Link
                key={item.id}
                href={`/#${item.id}`}
                className="whitespace-nowrap text-sm font-semibold text-slate-600 transition-colors hover:text-blue-700"
              >
                {item.label}
              </Link>
            ))}

            {!isAuthenticated && (
              <div className="flex items-center gap-2.5">
                <Link
                  href="/?auth=login"
                  className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-blue-700 px-4 py-2 text-sm font-semibold text-blue-700 transition-all hover:bg-blue-50"
                >
                  <User className="h-4 w-4" /> {PUBLIC_NAV_LABELS.login}
                </Link>
                <Link
                  href="/?auth=login"
                  className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800"
                >
                  <ClipboardCheck className="h-4 w-4" /> {PUBLIC_NAV_LABELS.assessment}
                </Link>
              </div>
            )}

            {isAuthenticated && (
              <div className="relative flex items-center border-l border-slate-200 pl-4" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-slate-50"
                  aria-expanded={profileMenuOpen}
                  aria-haspopup="menu"
                >
                  <div className="hidden text-right lg:block">
                    <p className="text-sm font-bold leading-tight text-blue-900">{user?.name}</p>
                    <p className="text-xs text-slate-500">{user?.studentId ? "นักศึกษาพยาบาลศาสตร์" : "บุคลากร"}</p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-100 font-bold text-cyan-700">
                    {userInitials}
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                <div
                  className={`absolute right-0 top-full z-50 mt-2 w-52 rounded-lg border border-slate-100 bg-white p-2 shadow-lg transition-all duration-150 ${
                    profileMenuOpen
                      ? "pointer-events-auto visible translate-y-0 opacity-100"
                      : "pointer-events-none invisible -translate-y-1 opacity-0"
                  }`}
                  role="menu"
                >
                  <Link
                    href="/dashboard"
                    className="block rounded-md px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-700"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    {PUBLIC_NAV_LABELS.dashboard}
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-1 flex w-full items-center gap-2 rounded-md px-4 py-2 text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                  >
                    {PUBLIC_NAV_LABELS.logout}
                  </button>
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
            <Link
              key={item.id}
              href={`/#${item.id}`}
              className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}

          {!isAuthenticated && (
            <div className="flex flex-col gap-3 pt-3">
              <Link
                href="/?auth=login"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 font-semibold text-[15px] text-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                <ClipboardCheck className="h-5 w-5" /> {PUBLIC_NAV_LABELS.assessment}
              </Link>
              <Link
                href="/?auth=login"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-700 px-4 py-3 font-semibold text-[15px] text-blue-700"
                onClick={() => setMobileMenuOpen(false)}
              >
                <LogIn className="h-5 w-5" /> {PUBLIC_NAV_LABELS.login}
              </Link>
            </div>
          )}

          {isAuthenticated && (
            <div className="flex flex-col gap-3 pt-3">
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 font-semibold text-[15px] text-white"
              >
                {PUBLIC_NAV_LABELS.dashboard}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 font-semibold text-[15px] text-slate-700"
              >
                {PUBLIC_NAV_LABELS.logout}
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
