/** ปุ่มยืนยันหลัก — แคปซูลทึบโทนแบรนด์ ไม่ใช้มุมกล่อง */
export const UI_BUTTON_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#0057A8] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#00468a] disabled:cursor-not-allowed disabled:opacity-50";

export const UI_BUTTON_SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

export const UI_BUTTON_DANGER =
  "inline-flex items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50";

export const UI_BUTTON_SUCCESS =
  "inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50";

export const UI_BUTTON_GHOST =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50";

export const UI_CHIP_ACTIVE =
  "shrink-0 rounded-full bg-[#0057A8] px-3.5 py-2 text-sm font-semibold whitespace-nowrap text-white shadow-sm transition-colors hover:bg-[#00468a]";

export const UI_CHIP_INACTIVE =
  "shrink-0 rounded-full bg-slate-200 px-3.5 py-2 text-sm font-semibold whitespace-nowrap text-slate-700 transition-colors hover:bg-slate-300";

/** ชิปเลือกค่า (urgency / severity) — แคปซูลทึบมีสีเสมอ */
export const UI_CHOICE_CHIP =
  "inline-flex min-h-10 flex-1 items-center justify-center rounded-full px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-[opacity,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

export const UI_CHOICE_CHIP_SELECTED = "opacity-100 ring-2 ring-offset-2";
export const UI_CHOICE_CHIP_UNSELECTED = "opacity-40 hover:opacity-70";

export const UI_CHOICE_CHIP_NEUTRAL = "bg-slate-600 hover:bg-slate-700 focus-visible:ring-slate-500";
export const UI_CHOICE_CHIP_PRIMARY = "bg-[#0057A8] hover:bg-[#00468a] focus-visible:ring-[#0057A8]";
export const UI_CHOICE_CHIP_DANGER = "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500";
export const UI_CHOICE_CHIP_SUCCESS = "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500";

export const UI_CARD =
  "rounded-2xl border border-slate-200/90 bg-white shadow-[0_10px_28px_-24px_rgba(15,23,42,0.45)]";

export const UI_CANVAS = "bg-slate-50";

export const UI_PAGE_TITLE = "font-display text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl";

export const UI_SECTION_LABEL = "text-xs font-medium text-slate-500";

export const UI_TEXT_LINK =
  "text-sm font-semibold text-[#0057A8] transition-colors hover:text-[#003f7a]";

export const UI_INLINE_ACTION =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50";

export const UI_BADGE_DEFAULT =
  "rounded-full bg-[#0057A8] px-2.5 py-1 text-[11px] font-semibold text-white";

export const UI_BADGE_MUTED = "rounded-full bg-slate-600 px-2.5 py-1 text-[11px] font-semibold text-white";

/** การ์ดสรุปสถานะ — พื้นกลางไม่ทับสีแบดจ์ */
export const UI_PANEL_NEUTRAL = "rounded-2xl border border-slate-200 bg-white px-4 py-3";

/** กล่องแจ้งข้อมูล — พื้นเทาอ่อน ตัวอักษร slate ไม่ใช้ฟ้าอ่อนตัดกับแบดจ์ */
export const UI_CALLOUT_INFO =
  "rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700";

/** สถานะรอ / ค้าง — แคปซูลทึบอ่านชัดบนพื้นขาว */
export const UI_STATUS_PENDING = "bg-amber-600 text-white";
/** สถานะกำลังทำ / รับเรื่องแล้ว — ฟ้าแบรนด์ FON-KKU ทึบ */
export const UI_STATUS_ACTIVE = "bg-[#0057A8] text-white";
/** สถานะนัดหมาย / ขั้นกลาง — ส้มแบรนด์ทึบ */
export const UI_STATUS_SCHEDULED = "bg-[#F15A22] text-white";
/** สถานะเสร็จ / ปิดเรื่อง */
export const UI_STATUS_DONE = "bg-emerald-600 text-white";
/** สถานะเสี่ยง / เร่งด่วน */
export const UI_STATUS_DANGER = "bg-red-600 text-white";

/** ความเร่งด่วนต่ำ */
export const UI_SEVERITY_LOW = "bg-emerald-600 text-white";
/** ความเร่งด่วนปานกลาง */
export const UI_SEVERITY_MEDIUM = "bg-[#0057A8] text-white";
/** ความเร่งด่วนสูง */
export const UI_SEVERITY_HIGH = "bg-red-600 text-white";

export const UI_ACTION_PRIMARY_COMPACT =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-[#0057A8] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#00468a] disabled:cursor-not-allowed disabled:opacity-60";

export const UI_ACTION_SECONDARY_COMPACT =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

export const UI_ACTION_SCHEDULE_COMPACT =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-[#F15A22]/25 bg-[#F15A22]/8 px-3.5 py-2 text-xs font-semibold text-[#C24712] transition-colors hover:bg-[#F15A22]/15 disabled:cursor-not-allowed disabled:opacity-60";

export const UI_BUTTON_FULL_WIDTH = "w-full sm:w-auto";

export const STAFF_SIDEBAR_FOOTER = "border-t border-slate-100 bg-slate-50/80 p-4";

export const STAFF_SIDEBAR_LOGOUT_BUTTON =
  "flex w-full items-center gap-2 rounded-full px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700";

export const STAFF_SIDEBAR_NAV_ITEM_BASE =
  "flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors";

export const STAFF_SIDEBAR_NAV_ITEM_ACTIVE = "border-[#278ACA]/30 bg-[#278ACA]/10 text-[#0057A8]";

export const STAFF_SIDEBAR_NAV_ITEM_INACTIVE =
  "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900";

export const STAFF_SIDEBAR_ICON_SIZE = 20;

export const STAFF_SIDEBAR_ASIDE =
  "sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex";

export const STAFF_SIDEBAR_HEADER = "flex min-h-16 items-center border-b border-slate-100 px-4 py-2.5 sm:px-5";

export const STAFF_SIDEBAR_MOBILE_HEADER =
  "flex h-16 items-center justify-between border-b border-slate-100 px-4";

export const STAFF_SIDEBAR_NAV_SCROLL = "flex-1 space-y-6 overflow-y-auto px-4 py-6";

export const STAFF_SIDEBAR_MOBILE_NAV_SCROLL = "flex-1 space-y-6 overflow-y-auto px-4 py-5";
