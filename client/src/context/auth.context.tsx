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
import type { Role, User } from "@/types/auth";
import api from "@/lib/axios";

type RegisterPayload = {
  role: Role;
  name: string;
  identifier: string;
  password: string;
};

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const getErrorMessage = (error: unknown): string => {
  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message || "เกิดข้อผิดพลาดในการยืนยันตัวตน";
};

const getMe = async (): Promise<User> => {
  const response = await api.get<{ user: User }>("/api/auth/me");
  return response.data.user;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAuth = useCallback(async () => {
    try {
      const currentUser = await getMe();
      setUser(currentUser);
      return;
    } catch (_error) {
      try {
        await api.post("/api/auth/refresh");
        const refreshedUser = await getMe();
        setUser(refreshedUser);
      } catch (_refreshError) {
        setUser(null);
      }
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

  const register = useCallback(async (payload: RegisterPayload) => {
    try {
      const response = await api.post<{ user: User }>("/api/auth/register", payload);
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
      register,
      logout,
      refreshAuth,
    }),
    [user, loading, login, register, logout, refreshAuth]
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
