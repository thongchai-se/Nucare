/** Where to send users when the client decides they are logged out. */
export const UNAUTHENTICATED_PATH = "/?auth=login";

/** Authenticated app route prefixes (no `/dashboard` wrapper). */
export const PROTECTED_PATH_PREFIXES = [
  "/student",
  "/admin",
  "/advisor",
  "/instructor",
  "/executive",
  "/mental-health",
  "/student-development",
  "/change-password",
] as const;

export const isProtectedPath = (pathname: string): boolean =>
  PROTECTED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

/**
 * Normalize a post-login `next` query to a same-origin protected path.
 * Accepts legacy `/dashboard/*` and strips the prefix.
 */
export const getSafeNextPath = (rawNext: string | null | undefined): string | null => {
  if (!rawNext || !rawNext.startsWith("/") || rawNext.startsWith("//")) {
    return null;
  }

  const [pathWithQuery] = rawNext.split("#");
  const [pathname, query = ""] = (pathWithQuery || "").split("?");
  if (!pathname) {
    return null;
  }

  let normalized = pathname;
  if (normalized === "/dashboard") {
    return null;
  }
  if (normalized.startsWith("/dashboard/")) {
    normalized = normalized.slice("/dashboard".length);
  }

  if (!isProtectedPath(normalized)) {
    return null;
  }

  return query ? `${normalized}?${query}` : normalized;
};
