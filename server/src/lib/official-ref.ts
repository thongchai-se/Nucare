/**
 * สร้างเลขอ้างอิงทางการจากรหัสภายในระบบ
 * ไม่โชว์ CUID ดิบหรือแบบตัดทับ (cmwda7eb…kfaj) ให้ผู้ใช้
 */

/** ชุดตัวอักษรอ่านง่าย ไม่สับสน 0/O หรือ 1/I */
const OFFICIAL_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export type OfficialRefKind =
  | "AUD"
  | "USR"
  | "STU"
  | "STF"
  | "REF"
  | "SES"
  | "SUR"
  | "WAV"
  | "ALR"
  | "CAS"
  | "APT"
  | "OBS"
  | "CHAT";

const ENTITY_KIND_MAP: Record<string, OfficialRefKind> = {
  AuditLog: "AUD",
  AuthSession: "SES",
  User: "USR",
  StudentAccount: "STU",
  StaffAccount: "STF",
  Alert: "ALR",
  StudentAssessment: "SUR",
  Survey: "SUR",
  SurveyWave: "WAV",
  SurveyResponse: "SUR",
  EmergencyCase: "CAS",
  CaseReferral: "CAS",
  BehaviorRecord: "OBS",
  SpecializedCareRecord: "CAS",
  StudentAdvisorAssignment: "STF",
  ConsultationRequest: "APT",
  ConsultationScheduleOffer: "APT",
  Appointment: "APT",
  StudentChat: "CHAT",
  Reminder: "REF",
};

/** สร้างโทเคนคงที่จากสตริงใดๆ (deterministic) */
export function deriveOfficialToken(value: string, length = 6): string {
  const source = value.trim();
  if (!source) {
    return OFFICIAL_ALPHABET[0].repeat(length);
  }

  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  let mixed = hash >>> 0;
  let token = "";
  for (let index = 0; index < length; index += 1) {
    const pivot = source.charCodeAt(source.length - 1 - (index % source.length));
    mixed = (Math.imul(mixed ^ pivot, 16777619) >>> 0) + index * 97;
    token += OFFICIAL_ALPHABET[mixed % OFFICIAL_ALPHABET.length];
    mixed = Math.floor(mixed / OFFICIAL_ALPHABET.length) ^ (pivot << 1);
  }

  return token;
}

const toBuddhistDateParts = (value: Date): { year: number; month: string; day: string } => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const yearPart = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const christianYear = Number.parseInt(yearPart || "1970", 10);
  return {
    year: Number.isFinite(christianYear) ? christianYear + 543 : 2513,
    month,
    day,
  };
};

const parseDate = (value: Date | string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * ตรวจว่าสตริงคล้าย CUID/ULID ภายในที่ไม่ควรโชว์ตรงๆ
 * (เช่น cmwdaeveq00a4ay2cv7ros5wd)
 */
export function isInternalOpaqueId(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  const trimmed = value.trim();
  if (trimmed.length < 16) {
    return false;
  }
  return /^c[a-z0-9]{20,}$/i.test(trimmed) || /^[0-9a-f]{24,}$/i.test(trimmed);
}

/** เลือกรหัสชนิดตาม entityType */
export function resolveOfficialRefKind(entityType?: string | null): OfficialRefKind {
  if (!entityType) {
    return "REF";
  }
  return ENTITY_KIND_MAP[entityType] ?? "REF";
}

/**
 * สร้างเลขอ้างอิงทางการ เช่น AUD-25691114-K4N7P2
 * ถ้ามีวันที่ จะใส่ พ.ศ.YYYYMMDD เพื่อให้อ่านเป็นทางการ
 */
export function formatOfficialRecordCode(input: {
  id: string | null | undefined;
  kind?: OfficialRefKind;
  entityType?: string | null;
  createdAt?: Date | string | null;
}): string {
  if (!input.id?.trim()) {
    return "-";
  }

  const kind = input.kind ?? resolveOfficialRefKind(input.entityType);
  const token = deriveOfficialToken(input.id.trim(), 6);
  const date = parseDate(input.createdAt ?? null);

  if (date) {
    const { year, month, day } = toBuddhistDateParts(date);
    return `${kind}-${year}${month}${day}-${token}`;
  }

  return `${kind}-${token}`;
}

/**
 * เลือกรหัสเป้าหมายที่มนุษย์อ่านได้
 * ลำดับ: รหัสนักศึกษา → รหัสบุคลากร → เลขอ้างอิงทางการ (ไม่ใช้ CUID)
 */
export function formatOfficialTargetCode(input: {
  entityId?: string | null;
  entityType?: string | null;
  studentId?: string | null;
  employeeId?: string | null;
  createdAt?: Date | string | null;
}): string {
  const studentId = input.studentId?.trim();
  if (studentId) {
    return studentId;
  }

  const employeeId = input.employeeId?.trim();
  if (employeeId) {
    return employeeId;
  }

  if (!input.entityId?.trim()) {
    return "-";
  }

  if (!isInternalOpaqueId(input.entityId) && input.entityId.trim().length <= 32) {
    return input.entityId.trim();
  }

  return formatOfficialRecordCode({
    id: input.entityId,
    entityType: input.entityType,
    createdAt: input.createdAt,
  });
}
