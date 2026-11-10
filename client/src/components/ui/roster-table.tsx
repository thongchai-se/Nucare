import { Children, type ReactNode } from "react";
import { Search } from "lucide-react";
import { resolveRosterAvatarMark } from "@/lib/name-prefix";

export type RosterColumn = {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  /** ความกว้างคอลัมน์แบบล็อก เช่น w-[28%] หรือ 28% */
  width?: string;
};

/** กรอบตารางรายชื่อมาตรฐาน (แบบติดตามคัดกรองฝ่ายพัฒนานิสิต) */
export function RosterTableCard({
  toolbar,
  children,
}: {
  toolbar?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {toolbar ? (
        <div className="flex flex-col gap-3 rounded-t-2xl border-b border-slate-100 bg-slate-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          {toolbar}
        </div>
      ) : null}
      {/* ไม่ใส่ overflow บน section — กันขอบขวาของกรอบถูกตัด */}
      <div className={toolbar ? "overflow-hidden rounded-b-2xl" : "overflow-hidden rounded-2xl"}>
        {children}
      </div>
    </section>
  );
}

/** ช่องค้นหาโทนเดียวกับตารางติดตามคัดกรอง */
export function RosterSearchInput({
  value,
  onChange,
  placeholder = "ค้นหาชื่อหรือรหัสนักศึกษา...",
  "aria-label": ariaLabel = "ค้นหา",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
}) {
  return (
    <div className="relative min-w-0 max-w-lg flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
      />
    </div>
  );
}

/** กลุ่มเครื่องมือด้านขวา — ดันไปขวาเสมอ แม้ไม่มีช่องค้นหา */
export function RosterToolbarEnd({ children }: { children: ReactNode }) {
  return <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">{children}</div>;
}

/** ป้ายจำนวนรายการมุมขวา — ความกว้างคงที่กันขยับตอนตัวเลขเปลี่ยน */
export function RosterCountBadge({ count, label = "รายการ" }: { count: number; label?: string }) {
  return (
    <div className="inline-flex min-w-[7.5rem] items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold tabular-nums text-slate-700">
      {count} {label}
    </div>
  );
}

function columnWidthClass(width?: string): string {
  if (!width) {
    return "";
  }
  if (width.startsWith("w-")) {
    return width;
  }
  return "";
}

function columnWidthStyle(width?: string): { width: string } | undefined {
  if (!width || width.startsWith("w-")) {
    return undefined;
  }
  return { width };
}

/** ตารางเดสก์ท็อป — table-fixed ล็อกคอลัมน์ ไม่ให้ขยับตอนค้นหา */
export function RosterTable({
  columns,
  children,
  emptyMessage,
}: {
  columns: RosterColumn[];
  children: ReactNode;
  emptyMessage?: ReactNode;
}) {
  const rowCount = Children.count(children);
  const showEmpty = Boolean(emptyMessage) && rowCount === 0;

  return (
    <div className="hidden lg:block">
      <table className="w-full table-fixed text-left text-sm">
        <colgroup>
          {columns.map((column) => (
            <col
              key={column.key}
              className={columnWidthClass(column.width)}
              style={columnWidthStyle(column.width)}
            />
          ))}
        </colgroup>
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`px-5 py-4 text-xs font-semibold text-slate-500 ${
                  column.align === "center" ? "text-center" : column.align === "right" ? "text-right" : ""
                }`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {showEmpty ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-16 text-center text-sm text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export function RosterRow({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <tr
      className={`transition-colors hover:bg-slate-50/80 ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function RosterTd({
  children,
  align = "left",
  className = "",
}: {
  children: ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
}) {
  const alignClass =
    align === "center" ? "text-center" : align === "right" ? "text-right" : "";
  return <td className={`max-w-0 px-5 py-4 align-middle ${alignClass} ${className}`}>{children}</td>;
}

/** เซลล์ชื่อนิสิต — อวตาร์สี่เหลี่ยมมน + ชื่อหนา + รหัสเทา */
export function RosterPersonCell({
  name,
  meta,
  avatarText,
  onClick,
}: {
  name: string;
  meta?: string;
  /** ถ้าเป็นรหัสนิสิต/เลข จะถูกละไว้ ใช้ย่อจากชื่อแทน */
  avatarText?: string;
  onClick?: () => void;
}) {
  const mark = resolveRosterAvatarMark(name, avatarText);
  const body = (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500">
        {mark}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-slate-900">{name}</p>
        {meta ? <p className="mt-1 truncate text-xs text-slate-500">{meta}</p> : null}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        className="w-full min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        {body}
      </button>
    );
  }
  return body;
}

export function RosterMobileList({
  children,
  emptyMessage,
}: {
  children: ReactNode;
  emptyMessage?: ReactNode;
}) {
  const rowCount = Children.count(children);
  if (rowCount === 0 && emptyMessage) {
    return <div className="p-10 text-center text-sm text-slate-500 lg:hidden">{emptyMessage}</div>;
  }
  return <div className="space-y-3 p-4 lg:hidden">{children}</div>;
}

export function RosterMobileCard({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-slate-100 p-4">{children}</div>;
}
