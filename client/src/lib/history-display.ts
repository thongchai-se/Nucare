/**
 * จัดรูปข้อความประวัติติดตามให้อ่านง่าย (ฝั่ง client)
 * — สอดคล้องกับ server/src/lib/history-display.ts
 */

const SEED_MARKER_LINE =
  /^\s*\[(?:WALKTHROUGH|MH-DEMO|DEMO|DEMO-APPT|FULL-SEED|HISTORY-BULK)\]\s*/i;
const SEED_MARKER_INLINE =
  /\s*\[(?:WALKTHROUGH|MH-DEMO|DEMO|DEMO-APPT|FULL-SEED|HISTORY-BULK)\]\s*/gi;
/** คำเทคนิค/รหัสภายในที่ไม่ควรโชว์อาจารย์ */
const TECH_JARGON_INLINE =
  /\s*\((?:peer|advisor\.peer|mh\.test|student\.test|walkthrough|demo)\)\s*/gi;

const CANCEL_REQUEST_MARKER = "ขอยกเลิก";
const CANCEL_REQUEST_PREFIX = `${CANCEL_REQUEST_MARKER} — `;

/** ตัด marker ชุด seed/demo และคำเทคนิคออกจากข้อความที่แสดงผู้ใช้ */
export function stripSeedMarkers(text: string | null | undefined): string {
  if (!text) {
    return "";
  }
  return text
    .split("\n")
    .map((line) =>
      line
        .replace(SEED_MARKER_LINE, "")
        .replace(SEED_MARKER_INLINE, " ")
        .replace(TECH_JARGON_INLINE, " ")
        .replace(/\s{2,}/g, " ")
        .replace(/\s+—\s*$/u, "")
        .replace(/^\s*—\s*/u, "")
        .trim()
    )
    .filter(Boolean)
    .join("\n")
    .trim();
}

const CONSULTATION_STATUS_LABEL: Record<string, string> = {
  PENDING: "รอรับคำขอ",
  ACCEPTED: "รับคำขอแล้ว",
  SCHEDULED: "นัดหมายแล้ว",
  CANCEL_REQUESTED: "นศขอยกเลิก",
  CLOSED: "ปิดเคสแล้ว",
  CANCELLED: "ยกเลิก",
};

const REFERRAL_STATUS_LABEL: Record<string, string> = {
  PENDING: "รอผู้เชี่ยวชาญรับเคส",
  ACCEPTED: "กำลังดูแล",
  CLOSED: "ปิดเคสแล้ว",
};

const SEVERITY_LABEL: Record<string, string> = {
  HIGH: "สูง",
  MEDIUM: "ปานกลาง",
  LOW: "ต่ำ",
};

function presentAdvisorNote(note: string): string {
  if (note.startsWith(CANCEL_REQUEST_PREFIX)) {
    return note.slice(CANCEL_REQUEST_PREFIX.length).trim() || "ยกเลิก";
  }
  if (note === CANCEL_REQUEST_MARKER) {
    return "ยกเลิก";
  }
  return note;
}

function formatIsoDateInText(value: string, formatThaiDateTime: (iso: string) => string): string {
  return value.replace(
    /\b\d{4}-\d{2}-\d{2}T[\d:.]+Z\b/g,
    (match) => formatThaiDateTime(match)
  );
}

/**
 * จัดรูป outcome เก่าที่อาจยังมีสถานะอังกฤษ / ISO / marker
 * — ใช้เมื่อ API ยังส่งค่าเดิมหรือข้อมูลค้าง
 */
export function presentHistoryText(
  value: string | null | undefined,
  formatThaiDateTime: (iso: string) => string
): string | null {
  const cleaned = stripSeedMarkers(value);
  if (!cleaned) {
    return null;
  }

  const lines = cleaned.split("\n").map((line) => {
    let next = line.trim();

    next = next.replace(/^สถานะ:\s*([A-Z_]+)\b/u, (_full, status: string) => {
      const label =
        CONSULTATION_STATUS_LABEL[status] ?? REFERRAL_STATUS_LABEL[status] ?? "ไม่ทราบสถานะ";
      return `สถานะ: ${label}`;
    });

    next = next.replace(/^ระดับความเร่งด่วน:\s*([A-Z]+)\b/u, (_full, severity: string) => {
      return `ความเร่งด่วน: ${SEVERITY_LABEL[severity] ?? "ไม่ระบุ"}`;
    });

    next = next.replace(/^ความเร่งด่วน:\s*([A-Z]+)\b/u, (_full, severity: string) => {
      return `ความเร่งด่วน: ${SEVERITY_LABEL[severity] ?? "ไม่ระบุ"}`;
    });

    next = next.replace(/^หมายเหตุ:\s*(.+)$/u, (_full, note: string) => {
      return `หมายเหตุ: ${presentAdvisorNote(note.trim())}`;
    });

    next = formatIsoDateInText(next, formatThaiDateTime);
    return next;
  });

  return lines.filter(Boolean).join("\n") || null;
}
