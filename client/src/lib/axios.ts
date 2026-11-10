import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from "axios";

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const AUTH_EXPIRED_EVENT = "nucare:auth-expired";

const normalizeApiBaseUrl = (value: string | undefined): string => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.replace(/\/+$/, "");
};

const API_BASE_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);

let refreshPromise: Promise<void> | null = null;

const refreshAccessToken = async (): Promise<void> => {
  if (!refreshPromise) {
    refreshPromise = api
      .post("/api/auth/refresh")
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const requestUrl = originalRequest?.url || "";
    const isAuthRequest =
      requestUrl.includes("/api/auth/login") ||
      requestUrl.includes("/api/auth/refresh") ||
      requestUrl.includes("/api/auth/session");

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthRequest
    ) {
      originalRequest._retry = true;

      try {
        await refreshAccessToken();
        return api(originalRequest);
      } catch (refreshError) {
        const refreshStatus = (refreshError as AxiosError | undefined)?.response?.status;
        // Only force logout on definitive auth failure, not proxy/network blips.
        if (refreshStatus === 401 || refreshStatus === 403 || refreshStatus === 404) {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
          }
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
