import { Children, type ReactNode } from "react";
import { Filter, Search } from "lucide-react";
import { resolveRosterAvatarMark } from "@/lib/name-prefix";

export type RosterColumn = {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  /** ความกว้างคอลัมน์แบบล็อก เช่น w-[28%] หรือ 28% */
  width?: string;
};

/**
 * กรอบตารางมาตรฐาน — อิง Admin manage-students / audit
 * (rounded-2xl + toolbar slate-50 + ตาราง + pagination แยก)
 */
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
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 p-4 md:flex-row md:items-center">
          {toolbar}
        </div>
      ) : null}
      <div className="overflow-hidden">{children}</div>
    </section>
  );
}

/** ช่องค้นหาโทนเดียวกับ Admin manage-students */
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
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="block min-h-11 w-full rounded-xl border border-slate-200 bg-white p-2.5 pl-10 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

/** กลุ่มเครื่องมือด้านขวา — ดันไปขวาเสมอ แม้ไม่มีช่องค้นหา */
export function RosterToolbarEnd({ children }: { children: ReactNode }) {
  return <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">{children}</div>;
}

/**
 * @deprecated เลิกโชว์ช่องจำนวนใน toolbar ตาราง — คง export ไว้กัน import เก่าพัง
 */
export function RosterCountBadge({ count, label = "รายการ" }: { count: number; label?: string }) {
  return (
    <div className="inline-flex min-w-[7.5rem] items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium tabular-nums text-slate-700">
      {count} {label}
    </div>
  );
}

/** ตัวกรองแบบ select ใน toolbar — มีไอคอน Filter เสมอ */
export function RosterSelectFilter({
  value,
  onChange,
  children,
  "aria-label": ariaLabel = "กรองรายการ",
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  "aria-label"?: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600">
      <Filter className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={ariaLabel}
        className="max-w-[11rem] bg-transparent font-medium outline-none"
      >
        {children}
      </select>
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

/** ตารางเดสก์ท็อป — โทนหัวคอลัมน์และช่องว่างแบบ Admin */
export function RosterTable({
  columns,
  children,
  emptyMessage,
  minWidthClass = "min-w-[720px]",
}: {
  columns: RosterColumn[];
  children: ReactNode;
  emptyMessage?: ReactNode;
  /** ความกว้างขั้นต่ำตอน scroll แนวนอน */
  minWidthClass?: string;
}) {
  const rowCount = Children.count(children);
  const showEmpty = Boolean(emptyMessage) && rowCount === 0;

  return (
    <div className={`hidden overflow-x-auto md:block`}>
      <table className={`w-full ${minWidthClass} table-fixed text-left text-sm`}>
        <colgroup>
          {columns.map((column) => (
            <col
              key={column.key}
              className={columnWidthClass(column.width)}
              style={columnWidthStyle(column.width)}
            />
          ))}
        </colgroup>
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`px-6 py-4 font-medium ${
                  column.align === "center"
                    ? "text-center"
                    : column.align === "right"
                      ? "text-right"
                      : ""
                }`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {showEmpty ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-10 text-center text-slate-500">
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
  className = "",
  selected = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  selected?: boolean;
}) {
  return (
    <tr
      className={`transition-colors ${
        selected ? "bg-blue-50/70" : "hover:bg-slate-50"
      } ${onClick ? "cursor-pointer" : ""} ${className}`}
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
  return <td className={`max-w-0 px-6 py-4 align-middle ${alignClass} ${className}`}>{children}</td>;
}

/**
 * เซลล์ชื่อ — แบบ Admin: ชื่อหนา + เมตาใต้ ไม่บังคับอวาตาร์
 * ใส่ avatarText เมื่อต้องการเครื่องหมายย่อ (ค่าเริ่มต้นปิดเพื่อให้เหมือน Admin)
 */
export function RosterPersonCell({
  name,
  meta,
  avatarText,
  showAvatar = false,
  onClick,
}: {
  name: string;
  meta?: string;
  /** ถ้าเป็นรหัสนิสิต/เลข จะถูกละไว้ ใช้ย่อจากชื่อแทน */
  avatarText?: string;
  showAvatar?: boolean;
  onClick?: () => void;
}) {
  const mark = resolveRosterAvatarMark(name, avatarText);
  const body = (
    <div className={`flex min-w-0 items-center ${showAvatar ? "gap-3" : ""}`}>
      {showAvatar ? (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500">
          {mark}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-900">{name}</p>
        {meta ? <p className="mt-1 truncate text-xs font-normal text-slate-500">{meta}</p> : null}
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

/** รายการมือถือแบบ Admin — แถวแบ่งเส้น ไม่ใช่การ์ดขอบมน */
export function RosterMobileList({
  children,
  emptyMessage,
}: {
  children: ReactNode;
  emptyMessage?: ReactNode;
}) {
  const rowCount = Children.count(children);
  if (rowCount === 0 && emptyMessage) {
    return <div className="px-5 py-10 text-center text-sm text-slate-500 md:hidden">{emptyMessage}</div>;
  }
  return <div className="divide-y divide-slate-100 md:hidden">{children}</div>;
}

export function RosterMobileCard({ children }: { children: ReactNode }) {
  return <div className="space-y-3 px-4 py-4">{children}</div>;
}

/** ปุ่มจัดการในแถว — แคปซูลมีสี/ไอคอน ไมใช้ลิงก์ข้อความน้ำเงิน */
export function RosterActionLink({
  children,
  onClick,
  tone = "primary",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}) {
  const toneClass =
    tone === "danger"
      ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
      : tone === "secondary"
        ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        : "bg-[#0057A8] text-white hover:bg-[#00468a]";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${toneClass}`}
    >
      {children}
    </button>
  );
}
