"use client";

import Link from "next/link";
import { Cookie, Settings, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ConfirmSubmitLabel } from "@/components/ui/confirm-submit-label";
import { acquireBodyScrollLock } from "@/lib/body-scroll-lock";
import api from "@/lib/axios";

const COOKIE_CONSENT_KEY = "nucare_cookie_consent_v1";
const COOKIE_PREFERENCES_KEY = "nucare_cookie_preferences_v1";
const COOKIE_ANONYMOUS_ID_KEY = "nucare_cookie_anonymous_id";
const CONSENT_POLICY_VERSION = "2026-09-08";

type CookiePreferences = {
  necessary: true;
  analytics: boolean;
};

type ConsentStatus = "accepted_all" | "customized" | "necessary_only";

export default function CookieConsentPopup() {
  const [isBannerVisible, setIsBannerVisible] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [allowAnalytics, setAllowAnalytics] = useState(true);
  const settingsDialogRef = useRef<HTMLDivElement | null>(null);

  const getAnonymousId = (): string => {
    const existing = window.localStorage.getItem(COOKIE_ANONYMOUS_ID_KEY);
    if (existing) {
      return existing;
    }

    const created = window.crypto?.randomUUID?.() || `anon-${Date.now()}`;
    window.localStorage.setItem(COOKIE_ANONYMOUS_ID_KEY, created);
    return created;
  };

  const saveConsent = (preferences: CookiePreferences, status: ConsentStatus) => {
    try {
      window.localStorage.setItem(
        COOKIE_CONSENT_KEY,
        JSON.stringify({ status, timestamp: new Date().toISOString(), policyVersion: CONSENT_POLICY_VERSION }),
      );
      window.localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(preferences));
      void api
        .post("/api/consent", {
          anonymousId: getAnonymousId(),
          status,
          analytics: preferences.analytics,
          policyVersion: CONSENT_POLICY_VERSION,
        })
        .catch((error) => {
          // Local consent still applies; surface sync failure for ops without blocking UI.
          console.warn("Failed to sync cookie consent to server", error);
        });
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

    const previousActiveElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const releaseScrollLock = acquireBodyScrollLock();
    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    window.setTimeout(() => {
      const focusableElements = settingsDialogRef.current?.querySelectorAll<HTMLElement>(
        focusableSelector
      );
      const firstFocusableElement = focusableElements?.[0];
      (firstFocusableElement ?? settingsDialogRef.current)?.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSettingsOpen(false);
        return;
      }

      if (event.key !== "Tab" || !settingsDialogRef.current) {
        return;
      }

      const focusableElements = Array.from(
        settingsDialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        settingsDialogRef.current.focus();
        return;
      }

      const firstFocusableElement = focusableElements[0];
      const lastFocusableElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstFocusableElement) {
        event.preventDefault();
        lastFocusableElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusableElement) {
        event.preventDefault();
        firstFocusableElement.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      releaseScrollLock();
      window.removeEventListener("keydown", onKeyDown);
      previousActiveElement?.focus();
    };
  }, [isSettingsOpen]);

  const handleAcceptAll = () => {
    saveConsent({ necessary: true, analytics: true }, "accepted_all");
    setAllowAnalytics(true);
    setIsBannerVisible(false);
    setIsSettingsOpen(false);
  };

  const handleAcceptNecessaryOnly = () => {
    saveConsent({ necessary: true, analytics: false }, "necessary_only");
    setAllowAnalytics(false);
    setIsBannerVisible(false);
    setIsSettingsOpen(false);
  };

  const handleSaveSettings = () => {
    saveConsent({ necessary: true, analytics: allowAnalytics }, "customized");
    setIsBannerVisible(false);
    setIsSettingsOpen(false);
  };

  return (
    <>
      {isBannerVisible && (
        <div
          className="fixed bottom-0 left-0 z-[150] max-h-[60dvh] w-full translate-y-0 overflow-y-auto bg-slate-900 text-white shadow-[0_-10px_40px_rgba(0,0,0,0.2)] transition-transform duration-500 sm:max-h-none sm:overflow-visible"
          role="region"
          aria-labelledby="cookie-banner-title"
          aria-describedby="cookie-banner-description"
        >
          <div className="mx-auto flex max-w-[102rem] flex-col items-stretch justify-between gap-3 px-3 py-3 sm:flex-row sm:items-center sm:px-4 sm:py-4 lg:px-5">
            <div className="flex items-start gap-3">
              <Cookie className="mt-1 h-5 w-5 shrink-0 text-cyan-400 sm:h-6 sm:w-6" />
              <div>
                <h4 id="cookie-banner-title" className="mb-1 text-sm font-bold">เว็บไซต์นี้ใช้คุกกี้ (Cookies)</h4>
                <p id="cookie-banner-description" className="max-w-3xl text-xs leading-relaxed text-slate-300">
                  ระบบ Nucare ใช้คุกกี้เพื่อจดจำการเข้าสู่ระบบและพัฒนาประสบการณ์ใช้งาน ข้อมูลของคุณจะถูกดูแลอย่างปลอดภัยตาม
                  {" "}
                  <Link href="/privacy#cookies" className="text-cyan-300 underline transition-colors hover:text-white">
                    นโยบายคุกกี้
                  </Link>
                </p>
              </div>
            </div>

            <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:w-auto sm:flex sm:flex-row sm:gap-3">
              <button
                type="button"
                onClick={handleAcceptAll}
                className="col-span-2 flex-1 whitespace-nowrap rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-500 sm:col-auto sm:flex-none sm:px-6 sm:py-2.5"
              >
                ยอมรับทั้งหมด
              </button>
              <button
                type="button"
                onClick={handleAcceptNecessaryOnly}
                className="flex flex-1 items-center justify-center whitespace-nowrap rounded border border-slate-600 bg-transparent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 sm:flex-none sm:px-6 sm:py-2.5"
              >
                ยอมรับเฉพาะจำเป็น
              </button>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded border border-slate-600 bg-transparent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 sm:flex-none sm:px-6 sm:py-2.5"
                aria-haspopup="dialog"
                aria-expanded={isSettingsOpen}
                aria-controls="cookie-settings-dialog"
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
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setIsSettingsOpen(false)}
          />

          <div className="fixed inset-0 z-10 flex items-center justify-center overflow-hidden p-3 sm:p-4">
            <div
              id="cookie-settings-dialog"
              ref={settingsDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="cookie-settings-title"
              aria-describedby="cookie-settings-description"
              tabIndex={-1}
              className="flex min-h-0 max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-5">
                <h3 id="cookie-settings-title" className="flex items-center gap-2 text-lg font-bold text-slate-800">
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

              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
                <p id="cookie-settings-description" className="text-sm leading-relaxed text-slate-600">
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
                    <h4 id="cookie-analytics-title" className="mb-1 text-sm font-bold text-slate-800">คุกกี้เพื่อการวิเคราะห์ (Analytics Cookies)</h4>
                    <p id="cookie-analytics-description" className="text-xs leading-relaxed text-slate-500">
                      ช่วยให้เราเข้าใจการใช้งานโดยรวม เพื่อปรับปรุงประสิทธิภาพและประสบการณ์ใช้งานของระบบ
                    </p>
                  </div>
                  <label htmlFor="cookie-analytics-preference" className="mt-1 inline-flex shrink-0 cursor-pointer items-center">
                    <input
                      id="cookie-analytics-preference"
                      type="checkbox"
                      checked={allowAnalytics}
                      onChange={(event) => setAllowAnalytics(event.target.checked)}
                      className="peer sr-only"
                      aria-labelledby="cookie-analytics-title"
                      aria-describedby="cookie-analytics-description"
                    />
                    <span className="relative h-6 w-11 rounded-full bg-slate-200 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white" />
                  </label>
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white p-6 sm:flex-row">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-800"
                >
                  <ConfirmSubmitLabel>บันทึกการตั้งค่า</ConfirmSubmitLabel>
                </button>
                <button
                  type="button"
                  onClick={handleAcceptNecessaryOnly}
                  className="flex-1 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200"
                >
                  ยอมรับเฉพาะจำเป็น
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
