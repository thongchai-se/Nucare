type PrefixRule = {
  canonical: string;
  pattern: RegExp;
};

/** คำนำหน้านักศึกษา — เรียงยาวก่อนสั้น เพื่อไม่ให้ "นาง" ตัด "นางสาว" */
const studentPrefixRules: PrefixRule[] = [
  { canonical: "นางสาว", pattern: /^\s*(?:นางสาว|น\.\s*ส\.?|นส\.)\s*/u },
  { canonical: "เด็กหญิง", pattern: /^\s*(?:เด็กหญิง|ด\.\s*ญ\.?)\s*/u },
  { canonical: "เด็กชาย", pattern: /^\s*(?:เด็กชาย|ด\.\s*ช\.?)\s*/u },
  { canonical: "นาย", pattern: /^\s*นาย\s*/u },
  { canonical: "นาง", pattern: /^\s*นาง\s*/u },
  { canonical: "คุณ", pattern: /^\s*คุณ\s*/u },
  { canonical: "Mr.", pattern: /^\s*Mr\.?\s+/iu },
  { canonical: "Mrs.", pattern: /^\s*Mrs\.?\s+/iu },
  { canonical: "Ms.", pattern: /^\s*Ms\.?\s+/iu },
  { canonical: "Miss", pattern: /^\s*Miss\s+/iu },
];

/** คำนำหน้าบุคลากร/วิชาการ — เรียงยาวก่อนสั้น */
const staffPrefixRules: PrefixRule[] = [
  { canonical: "ศ.ดร.", pattern: /^\s*ศ\.\s*ดร\.\s*/u },
  { canonical: "ศ.", pattern: /^\s*ศ\.\s*/u },
  { canonical: "รศ.ดร.", pattern: /^\s*รศ\.\s*ดร\.\s*/u },
  { canonical: "รศ.", pattern: /^\s*รศ\.\s*/u },
  { canonical: "ผศ.ดร.", pattern: /^\s*ผศ\.\s*ดร\.\s*/u },
  { canonical: "ผศ.", pattern: /^\s*ผศ\.\s*/u },
  { canonical: "รส.ดร.", pattern: /^\s*รส\.\s*ดร\.\s*/u },
  { canonical: "อ.ดร.", pattern: /^\s*อ\.\s*ดร\.\s*/u },
  { canonical: "ดร.", pattern: /^\s*ดร\.\s*/u },
  { canonical: "อาจารย์", pattern: /^\s*อาจารย์\s*/u },
  { canonical: "อ.", pattern: /^\s*อ\.\s*/u },
];

const allPrefixRules = [...staffPrefixRules, ...studentPrefixRules];

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const normalizeNameWithRules = (rawName: string, rules: PrefixRule[]): string => {
  const normalizedName = normalizeWhitespace(rawName);
  if (!normalizedName) {
    return "";
  }

  for (const rule of rules) {
    if (!rule.pattern.test(normalizedName)) {
      continue;
    }

    const nameWithoutPrefix = normalizeWhitespace(normalizedName.replace(rule.pattern, ""));
    return nameWithoutPrefix ? `${rule.canonical} ${nameWithoutPrefix}` : rule.canonical;
  }

  return normalizedName;
};

export const normalizeImportedStudentName = (rawName: string): string =>
  normalizeNameWithRules(rawName, studentPrefixRules);

export const normalizeImportedStaffName = (rawName: string): string =>
  normalizeNameWithRules(rawName, staffPrefixRules);

/** ตัดคำนำหน้าชื่อ (นาย, นางสาว, อ.ดร., ผศ.ดร. ฯลฯ) ออก เหลือเฉพาะชื่อ–นามสกุล */
export const stripKnownNamePrefix = (rawName: string): string => {
  let remaining = normalizeWhitespace(rawName);
  if (!remaining) {
    return "";
  }

  // ตัดซ้ำได้หลายชั้น เช่น "อ.ดร.นายสมชาย"
  for (let pass = 0; pass < 4; pass += 1) {
    let matched = false;
    for (const rule of allPrefixRules) {
      if (!rule.pattern.test(remaining)) {
        continue;
      }
      remaining = normalizeWhitespace(remaining.replace(rule.pattern, ""));
      matched = true;
      break;
    }
    if (!matched || !remaining) {
      break;
    }
  }

  return remaining;
};

/** แยกคำของชื่อจริงหลังตัดคำนำหน้า — ใช้ตอนย่อตัวอักษร */
export const getPersonalNameParts = (rawName: string): string[] =>
  stripKnownNamePrefix(rawName)
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-zก-๙]/g, ""))
    .filter(Boolean);

/** สระนำไทยที่เขียนก่อนพยัญชนะ — ตอนย่อต้องข้ามไปเอาพยัญชนะ */
const THAI_LEADING_VOWELS = /^[เแโใไ]+/u;

/** ตัวอักษรแรกที่ใช้ย่อ (ข้ามสระนำไทย เช่น ใจ → จ) */
export const getInitialChar = (part: string): string => {
  if (!part) {
    return "";
  }

  const withoutLeadingVowel = part.replace(THAI_LEADING_VOWELS, "");
  const ch = withoutLeadingVowel[0] ?? part[0] ?? "";
  return /[A-Za-z]/.test(ch) ? ch.toUpperCase() : ch;
};

/**
 * ย่อชื่อจากตัวอักษรแรกของชื่อ และตัวอักษรแรกของนามสกุลเท่านั้น
 * ไม่เอาคำนำหน้ามาย่อด้วย
 */
export const getNameInitials = (rawName: string, fallback = "NU"): string => {
  const parts = getPersonalNameParts(rawName);

  if (parts.length === 0) {
    return fallback;
  }

  if (parts.length === 1) {
    const only = parts[0];
    const first = getInitialChar(only);
    const rest = only.replace(THAI_LEADING_VOWELS, "").slice(1);
    const second = getInitialChar(rest) || only[1] || "";
    return `${first}${second}` || fallback;
  }

  const given = getInitialChar(parts[0] ?? "");
  const family = getInitialChar(parts[parts.length - 1] ?? "");
  return `${given}${family}` || fallback;
};

/** true ถ้าข้อความดูเป็นรหัสนิสิต/เลข ไม่ใช่ตัวย่อชื่อ */
export const looksLikeStudentCodeMark = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (/\d/.test(trimmed)) {
    return true;
  }
  return trimmed.length > 3;
};

/**
 * ตัวอักษรบนอวตาร์รายชื่อ — ใช้ย่อจากชื่อ ไม่ใช้ท้ายรหัสนิสิต (เช่น -0)
 * ถ้า avatarText เป็นตัวย่อสั้นที่ไม่มีเลขอยู่แล้ว ให้ใช้ตามนั้น
 */
export const resolveRosterAvatarMark = (
  name: string,
  avatarText?: string | null,
  fallback = "นศ"
): string => {
  const candidate = avatarText?.trim() || "";
  if (candidate && !looksLikeStudentCodeMark(candidate)) {
    return candidate.slice(0, 3);
  }
  return getNameInitials(name, fallback);
};
