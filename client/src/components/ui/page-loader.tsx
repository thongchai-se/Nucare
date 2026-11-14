type PageLoaderProps = {
  /** ข้อความเสริมใต้สปินเนอร์ — ว่างได้ */
  label?: string;
  /** เต็มหน้าจอ (auth / รอ role) */
  fullScreen?: boolean;
  className?: string;
};

/**
 * โหลดเดอร์มาตรฐานของระบบ — ใช้สปินเนอร์ `.loader` ที่ตั้งไว้ใน globals.css
 * ห้ามแทนด้วยข้อความล้วน ๆ
 */
export function PageLoader({
  label,
  fullScreen = true,
  className = "",
}: PageLoaderProps) {
  const body = (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`.trim()}>
      <span className="loader h-7 w-7 text-blue-600" aria-hidden="true" />
      {label ? <p className="text-sm font-medium text-slate-500">{label}</p> : null}
      <span className="sr-only">{label || "กำลังโหลด"}</span>
    </div>
  );

  if (!fullScreen) {
    return body;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100">{body}</main>
  );
}

type InlineLoaderProps = {
  label?: string;
  size?: "sm" | "md";
  className?: string;
};

/** โหลดในแผง/รายการ — สปินเนอร์เดียวกัน ขนาดเล็กลง */
export function InlineLoader({ label, size = "md", className = "" }: InlineLoaderProps) {
  const spinnerClass = size === "sm" ? "loader h-4 w-4 text-blue-600" : "loader h-6 w-6 text-blue-600";
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 py-6 ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <span className={spinnerClass} aria-hidden="true" />
      {label ? <p className="text-sm font-medium text-slate-500">{label}</p> : null}
      <span className="sr-only">{label || "กำลังโหลด"}</span>
    </div>
  );
}
