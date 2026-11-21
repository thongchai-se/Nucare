"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import api from "@/lib/axios";
import {
  PUBLIC_SITE_SETTINGS_FALLBACK,
  type PublicSiteSettings,
} from "@/lib/site-settings";

type SiteSettingsContextValue = {
  settings: PublicSiteSettings;
  loading: boolean;
  refresh: () => Promise<void>;
};

const SiteSettingsContext = createContext<SiteSettingsContextValue | null>(null);

/** โหลดการตั้งค่าสาธารณะสำหรับ footer และโหมดปิดปรับปรุง */
export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PublicSiteSettings>(PUBLIC_SITE_SETTINGS_FALLBACK);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await api.get<PublicSiteSettings>("/api/site-settings/public");
      setSettings({ ...PUBLIC_SITE_SETTINGS_FALLBACK, ...response.data });
    } catch {
      setSettings(PUBLIC_SITE_SETTINGS_FALLBACK);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      settings,
      loading,
      refresh,
    }),
    [settings, loading, refresh]
  );

  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>;
}

/** อ่านการตั้งค่าไซต์สาธารณะ — อยู่นอก provider จะได้ค่า fallback */
export function useSiteSettings(): SiteSettingsContextValue {
  const ctx = useContext(SiteSettingsContext);
  if (!ctx) {
    return {
      settings: PUBLIC_SITE_SETTINGS_FALLBACK,
      loading: false,
      refresh: async () => undefined,
    };
  }
  return ctx;
}
