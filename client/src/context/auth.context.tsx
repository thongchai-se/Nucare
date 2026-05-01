"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AxiosError } from "axios";
import type { User } from "@/types/auth";
import api from "@/lib/axios";

const AUTH_EXPIRED_EVENT = "nucare:auth-expired";
const SESSION_CHECK_INTERVAL_MS = 60 * 1000;

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const getErrorMessage = (error: unknown): string => {
  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message || "เกิดข้อผิดพลาดในการยืนยันตัวตน";
};

const getSessionUser = async (): Promise<User | null> => {
  const response = await api.get<{ user: User | null }>("/api/auth/session");
  return response.data.user;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAuth = useCallback(async () => {
    try {
      const currentUser = await getSessionUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const hydrateAuth = async () => {
      setLoading(true);
      await refreshAuth();
      setLoading(false);
    };

    void hydrateAuth();
  }, [refreshAuth]);

  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const runSessionCheck = () => {
      void refreshAuth();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        runSessionCheck();
      }
    };

    const intervalId = window.setInterval(runSessionCheck, SESSION_CHECK_INTERVAL_MS);
    window.addEventListener("focus", runSessionCheck);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", runSessionCheck);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user, refreshAuth]);

  const login = useCallback(async (identifier: string, password: string) => {
    try {
      const response = await api.post<{ user: User }>("/api/auth/login", {
        identifier,
        password,
      });
      setUser(response.data.user);
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refreshAuth,
    }),
    [user, loading, login, logout, refreshAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
};
