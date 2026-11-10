import { NextRequest, NextResponse } from "next/server";
import { isProtectedPath } from "@/lib/auth-routes";

const decodeJwtPayload = (token: string): { exp?: number } | null => {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return null;
    }

    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const decoded = atob(padded);
    return JSON.parse(decoded) as { exp?: number };
  } catch {
    return null;
  }
};

const hasValidAccessToken = (token: string | undefined): boolean => {
  if (!token) {
    return false;
  }

  const payload = decodeJwtPayload(token) as { exp?: number; userId?: string } | null;
  if (!payload?.exp || !payload.userId) {
    return false;
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  return payload.exp > nowInSeconds;
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get("accessToken")?.value;
  const refreshToken = request.cookies.get("refreshToken")?.value;
  const hasValidAccess = hasValidAccessToken(accessToken);
  const hasRefreshSession = Boolean(refreshToken);

  // Only gate protected pages. Do not bounce public auth pages based on cookie shape —
  // that causes infinite flicker when cookies exist but /api/auth/session disagrees.
  if (isProtectedPath(pathname) && !hasValidAccess && !hasRefreshSession) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("auth", "login");
    loginUrl.searchParams.set("next", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("accessToken");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/student/:path*",
    "/admin/:path*",
    "/advisor/:path*",
    "/instructor/:path*",
    "/executive/:path*",
    "/mental-health/:path*",
    "/student-development/:path*",
    "/change-password",
    "/change-password/:path*",
    "/dashboard",
    "/dashboard/:path*",
  ],
};
