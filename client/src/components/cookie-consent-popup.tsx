"use client";

import Link from "next/link";
import { Cookie, Settings, X } from "lucide-react";
import { useEffect, useState } from "react";

const COOKIE_CONSENT_KEY = "nucare_cookie_consent_v1";
const COOKIE_PREFERENCES_KEY = "nucare_cookie_preferences_v1";

type CookiePreferences = {
  necessary: true;
  analytics: boolean;
};

export default function CookieConsentPopup() {
  const [isBannerVisible, setIsBannerVisible] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [allowAnalytics, setAllowAnalytics] = useState(true);

  const saveConsent = (preferences: CookiePreferences) => {
    try {
      window.localStorage.setItem(
        COOKIE_CONSENT_KEY,
        JSON.stringify({ status: "accepted", timestamp: new Date().toISOString() }),
      );
      window.localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      // Ignore storage errors to avoid blocking UI interactions.
    }
  };

  useEffect(() => {
    try {
      const consent = window.localStorage.getItem(COOKIE_CONSENT_KEY);
      setIsBannerVisible(!consent);

      const savedPreferences = window.localStorage.getItem(COOKIE_PREFERENCES_KEY);
      if (savedPreferences) {
        const parsed = JSON.parse(savedPreferences) as Partial<CookiePreferences>;
        if (typeof parsed.analytics === "boolean") {
          setAllowAnalytics(parsed.analytics);
        }
      }
    } catch {
      setIsBannerVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!isSettingsOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSettingsOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isSettingsOpen]);

  const handleAcceptAll = () => {
    saveConsent({ necessary: true, analytics: true });
    setAllowAnalytics(true);
    setIsBannerVisible(false);
    setIsSettingsOpen(false);
  };

  const handleSaveSettings = () => {
    saveConsent({ necessary: true, analytics: allowAnalytics });
    setIsBannerVisible(false);
    setIsSettingsOpen(false);
  };

  return (
    <>
      {isBannerVisible && (
        <div className="fixed bottom-0 left-0 z-[150] w-full translate-y-0 bg-slate-900 text-white shadow-[0_-10px_40px_rgba(0,0,0,0.2)] transition-transform duration-500">
          <div className="mx-auto flex max-w-[102rem] flex-col items-center justify-between gap-4 px-3 py-4 sm:flex-row sm:px-4 sm:py-6 lg:px-5">
            <div className="flex items-start gap-4">
              <Cookie className="mt-1 h-6 w-6 shrink-0 text-cyan-400" />
              <div>
                <h4 className="mb-1 text-sm font-bold">เว็บไซต์นี้ใช้คุกกี้ (Cookies)</h4>
                <p className="max-w-3xl text-xs leading-relaxed text-slate-300">
                  ระบบ Nucare ใช้คุกกี้เพื่อจดจำการเข้าสู่ระบบและพัฒนาประสบการณ์ใช้งาน ข้อมูลของคุณจะถูกดูแลอย่างปลอดภัยตาม
                  {" "}
                  <Link href="/cookies" className="text-cyan-300 underline transition-colors hover:text-white">
                    นโยบายคุกกี้
                  </Link>
                </p>
              </div>
            </div>

            <div className="flex w-full shrink-0 gap-3 sm:w-auto">
              <button
                type="button"
                onClick={handleAcceptAll}
                className="flex-1 whitespace-nowrap rounded bg-blue-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-500 sm:flex-none"
              >
                ยอมรับทั้งหมด
              </button>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded border border-slate-600 bg-transparent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 sm:flex-none"
              >
                <Settings className="h-4 w-4" />
                ตั้งค่าคุกกี้
              </button>
            </div>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[200]">
          <button
            type="button"
            aria-label="close cookie settings"
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setIsSettingsOpen(false)}
          />

          <div className="fixed inset-0 z-10 flex items-center justify-center p-4">
            <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-5">
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                  <Settings className="h-5 w-5 text-blue-600" /> ตั้งค่าความเป็นส่วนตัว
                </h3>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-slate-400 transition-colors hover:text-slate-600"
                  aria-label="close cookie settings modal"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6 overflow-y-auto p-6">
                <p className="text-sm leading-relaxed text-slate-600">
                  คุณสามารถเลือกเปิดหรือปิดคุกกี้แต่ละประเภทได้ ยกเว้นคุกกี้ที่จำเป็นต่อการทำงานของระบบซึ่งไม่สามารถปิดได้
                </p>

                <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <h4 className="mb-1 text-sm font-bold text-slate-800">คุกกี้ที่จำเป็นอย่างยิ่ง (Strictly Necessary)</h4>
                    <p className="text-xs leading-relaxed text-slate-500">
                      ใช้สำหรับการเข้าสู่ระบบ session และความปลอดภัยพื้นฐานของเว็บไซต์
                    </p>
                  </div>
                  <div className="mt-1 shrink-0">
                    <span className="rounded-md bg-blue-100 px-2 py-1 text-[11px] font-bold text-blue-700">เปิดใช้งานเสมอ</span>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-4">
                  <div>
                    <h4 className="mb-1 text-sm font-bold text-slate-800">คุกกี้เพื่อการวิเคราะห์ (Analytics Cookies)</h4>
                    <p className="text-xs leading-relaxed text-slate-500">
                      ช่วยให้เราเข้าใจการใช้งานโดยรวม เพื่อปรับปรุงประสิทธิภาพและประสบการณ์ใช้งานของระบบ
                    </p>
                  </div>
                  <label className="mt-1 inline-flex shrink-0 cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={allowAnalytics}
                      onChange={(event) => setAllowAnalytics(event.target.checked)}
                      className="peer sr-only"
                    />
                    <span className="relative h-6 w-11 rounded-full bg-slate-200 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white" />
                  </label>
                </div>
              </div>

              <div className="flex shrink-0 gap-3 border-t border-slate-200 bg-white p-6">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="flex-1 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-800"
                >
                  บันทึกการตั้งค่า
                </button>
                <button
                  type="button"
                  onClick={handleAcceptAll}
                  className="flex-1 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200"
                >
                  ยอมรับทั้งหมด
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
