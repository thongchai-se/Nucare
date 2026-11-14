/**
 * จัดรูปข้อความ Audit Log ให้เป็นทางการและอ่านรู้เรื่อง (ฝั่ง client)
 * — สอดคล้องกับ server/src/lib/audit-display.ts
 */

import {
  formatOfficialRecordCode,
  formatOfficialTargetCode,
} from "./official-ref";

type AuditDisplayInput = {
  action: string;
  description?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  createdAt?: Date | string | null;
  studentId?: string | null;
  employeeId?: string | null;
};

const ROLE_PREFIX_LABEL: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  advisor: "อาจารย์ที่ปรึกษา",
  alerts: "การแจ้งเตือน",
  auth: "การยืนยันตัวตน",
  consultation: "การนัดปรึกษา",
  executive: "ผู้บริหาร",
  instructor: "อาจารย์ผู้สอน",
  "mental-health": "ผู้เชี่ยวชาญ",
  mental_health: "ผู้เชี่ยวชาญ",
  "screening-review": "ทบทวนผลคัดกรอง",
  student: "นักศึกษา",
  "student-development": "ฝ่ายพัฒนานักศึกษา",
  student_development: "ฝ่ายพัฒนานักศึกษา",
};

const ACTION_LABEL_MAP: Record<string, string> = {
  "auth.login.success": "เข้าสู่ระบบสำเร็จ",
  "auth.login.failed": "เข้าสู่ระบบไม่สำเร็จ",
  "auth.logout": "ออกจากระบบ",
  "auth.password-reset.request": "ขอรีเซ็ตรหัสผ่าน",
  "auth.password-reset.complete": "รีเซ็ตรหัสผ่านสำเร็จ",
  "auth.password-change": "เปลี่ยนรหัสผ่านสำเร็จ",
  "auth.password-change.failed": "เปลี่ยนรหัสผ่านไม่สำเร็จ",
  "admin.student.create": "สร้างบัญชีนักศึกษา",
  "admin.user.create": "สร้างบัญชีบุคลากร",
  "admin.student.update": "แก้ไขบัญชีนักศึกษา",
  "admin.user.update": "แก้ไขบัญชีบุคลากร",
  "admin.student.delete": "ลบบัญชีนักศึกษา",
  "admin.user.delete": "ลบบัญชีบุคลากร",
  "admin.student.import": "นำเข้าข้อมูลนักศึกษา",
  "admin.user.import": "นำเข้าข้อมูลบุคลากร",
  "admin.student.study-year.bulk-update": "เลื่อนชั้นปีแบบกลุ่ม",
  "admin.advisor-assignment.assign": "มอบหมายอาจารย์ที่ปรึกษา",
  "admin.survey.create": "สร้างแบบประเมิน",
  "admin.survey.update": "แก้ไขแบบประเมิน",
  "admin.survey.delete": "ลบแบบประเมิน",
  "admin.survey.version.publish": "เผยแพร่เวอร์ชันแบบประเมิน",
  "admin.survey.duplicate": "ทำสำเนาแบบประเมิน",
  "admin.survey.wave.create": "สร้างรอบเปิดแบบประเมิน",
  "admin.survey.wave.open": "เปิดรอบแบบประเมิน",
  "admin.survey.wave.close": "ปิดรอบแบบประเมิน",
  "admin.survey.wave.cancel": "ยกเลิกรอบแบบประเมิน",
  "advisor.student-history.view": "เปิดดูประวัตินักศึกษา",
  "advisor.assessment-history.view": "เปิดดูประวัติผลประเมิน",
  "advisor.referral.create": "สร้างรายการส่งต่อ",
  "advisor.observation.create": "บันทึกการสังเกตการณ์",
  "advisor.consultation-request.update": "อัปเดตคำขอปรึกษา",
  "executive.student-detail.view": "เปิดดูรายละเอียดนักศึกษา",
  "executive.assessment-history.view": "เปิดดูประวัติผลประเมิน",
  "mental_health.assessment-history.view": "เปิดดูประวัติผลประเมิน",
  "mental-health.assessment-history.view": "เปิดดูประวัติผลประเมิน",
  "mental-health.student-history.view": "เปิดดูประวัตินักศึกษา",
  "mental-health.referral-history.view": "เปิดดูประวัติการส่งต่อ",
  "mental-health.appointment.create": "สร้างนัดหมาย",
  "mental-health.appointment.cancel": "ยกเลิกนัดหมาย",
  "mental-health.appointment.clear-scheduled": "ยกเลิกนัดหมายที่รอดำเนินการ",
  "mental-health.appointment.update-status": "อัปเดตสถานะนัดหมาย",
  "mental-health.referral.update-status": "อัปเดตสถานะการส่งต่อ",
  "mental-health.specialized-care.create": "เพิ่มบันทึกการดูแลเฉพาะทาง",
  "mental-health.emergency.resolve": "ปิดเคสฉุกเฉิน",
  "student-development.referral.update-status": "อัปเดตสถานะการส่งต่อ",
  "student-development.reminder.create": "สร้างการติดตาม/เตือน",
  "instructor.behavior-record.create": "เพิ่มบันทึกพฤติกรรม",
  "consultation.schedule-offer.create": "เสนอเวลานัดหมาย",
  "consultation.schedule-offer.accept": "ยืนยันเวลานัดหมาย",
  "alerts.acknowledge": "รับทราบการแจ้งเตือน",
  "screening-review.acknowledge": "รับทราบผลคัดกรอง",
  "screening-review.view-detail": "เปิดดูรายละเอียดผลคัดกรอง",
  "screening-review.refer": "ส่งต่อจากผลคัดกรอง",
  "student.assessment.submit": "ส่งแบบประเมิน",
  "student.survey.submit": "ส่งแบบสำรวจ",
  "student.sos.create": "แจ้งเหตุฉุกเฉิน",
  "student.consultation-request.create": "สร้างคำขอปรึกษา",
  "student.consultation-request.cancel-request": "ยกเลิกคำขอปรึกษา",
  "student.counseling-request.create": "ขอรับคำปรึกษาจากผู้เชี่ยวชาญ",
  "student.chat.message": "สนทนากับเพื่อน AI",
  "student.chat.blocked": "ข้อความแชทถูกบล็อก",
};

const ACTION_DETAIL_MAP: Record<string, string> = {
  "auth.login.success": "สร้างเซสชันเข้าสู่ระบบใหม่ให้ผู้ใช้งาน",
  "auth.login.failed": "การยืนยันตัวตนไม่ผ่านหรือบัญชีไม่พร้อมใช้งาน",
  "auth.logout": "สิ้นสุดเซสชันของผู้ใช้งาน",
  "auth.password-reset.request": "บันทึกคำขอสำหรับตั้งรหัสผ่านใหม่",
  "auth.password-reset.complete": "ยืนยันการตั้งรหัสผ่านใหม่เรียบร้อย",
  "auth.password-change": "อัปเดตรหัสผ่านและออกโทเค็นการใช้งานใหม่",
  "auth.password-change.failed": "ปฏิเสธการเปลี่ยนรหัสผ่านจากข้อมูลเดิมไม่ถูกต้อง",
  "admin.student.create": "เพิ่มบัญชีนักศึกษาใหม่เข้าสู่ระบบ",
  "admin.user.create": "เพิ่มบัญชีบุคลากรใหม่เข้าสู่ระบบ",
  "admin.student.update": "ปรับปรุงข้อมูลนักศึกษาในระบบ",
  "admin.user.update": "ปรับปรุงข้อมูลบุคลากรในระบบ",
  "admin.student.delete": "ลบบัญชีนักศึกษาออกจากระบบ",
  "admin.user.delete": "ลบบัญชีบุคลากรออกจากระบบ",
  "admin.student.import": "นำเข้าข้อมูลนักศึกษาแบบกลุ่มจากไฟล์",
  "admin.user.import": "นำเข้าข้อมูลบุคลากรแบบกลุ่มจากไฟล์",
  "admin.student.study-year.bulk-update": "ปรับชั้นปีนักศึกษาแบบกลุ่มในครั้งเดียว",
  "admin.advisor-assignment.assign": "บันทึกการจับคู่นักศึกษากับอาจารย์ที่ปรึกษา",
  "admin.survey.create": "สร้างแบบประเมินใหม่ในระบบ",
  "admin.survey.update": "ปรับปรุงเนื้อหาหรือการตั้งค่าแบบประเมิน",
  "admin.survey.delete": "ลบแบบประเมินออกจากระบบ",
  "admin.survey.version.publish": "เผยแพร่เวอร์ชันแบบประเมินให้ใช้งาน",
  "admin.survey.duplicate": "สร้างสำเนาแบบประเมินจากต้นฉบับ",
  "admin.survey.wave.create": "กำหนดรอบเปิดให้แบบประเมิน",
  "admin.survey.wave.open": "เปิดรับการตอบแบบประเมินตามรอบที่กำหนด",
  "admin.survey.wave.close": "ปิดรับการตอบแบบประเมินของรอบนี้",
  "admin.survey.wave.cancel": "ยกเลิกรอบแบบประเมินก่อนเปิดหรือระหว่างรอบ",
  "advisor.student-history.view": "เข้าถึงหน้าประวัติและข้อมูลย้อนหลังของนักศึกษา",
  "advisor.assessment-history.view": "เข้าถึงประวัติผลประเมินย้อนหลังของนักศึกษา",
  "advisor.referral.create": "สร้างคำขอส่งต่อไปยังหน่วยงานที่เกี่ยวข้อง",
  "advisor.observation.create": "บันทึกข้อสังเกตเพื่อติดตามนักศึกษา",
  "advisor.consultation-request.update": "ปรับสถานะหรือรายละเอียดคำขอปรึกษา",
  "executive.student-detail.view": "เข้าถึงข้อมูลสรุปรายละเอียดของนักศึกษา",
  "executive.assessment-history.view": "เข้าถึงประวัติผลประเมินย้อนหลังของนักศึกษา",
  "mental_health.assessment-history.view": "เข้าถึงประวัติผลประเมินย้อนหลังของนักศึกษา",
  "mental-health.assessment-history.view": "เข้าถึงประวัติผลประเมินย้อนหลังของนักศึกษา",
  "mental-health.student-history.view": "เข้าถึงหน้าประวัติและข้อมูลย้อนหลังของนักศึกษา",
  "mental-health.referral-history.view": "เข้าถึงประวัติการส่งต่อของนักศึกษา",
  "mental-health.appointment.create": "สร้างนัดหมายติดตามกับนักศึกษา",
  "mental-health.appointment.cancel": "ยกเลิกนัดหมายที่กำหนดไว้",
  "mental-health.appointment.clear-scheduled": "ยกเลิกนัดหมายที่ยังไม่ถึงกำหนดหลายรายการ",
  "mental-health.appointment.update-status": "ปรับสถานะการนัดหมาย",
  "mental-health.referral.update-status": "อัปเดตสถานะการติดตามเคสส่งต่อ",
  "mental-health.specialized-care.create": "เพิ่มข้อมูลการดูแลเฉพาะทางในระบบ",
  "mental-health.emergency.resolve": "ปิดเคสฉุกเฉินหลังดำเนินการแล้ว",
  "student-development.referral.update-status": "อัปเดตสถานะการติดตามเคสส่งต่อ",
  "student-development.reminder.create": "สร้างรายการติดตามหรือเตือนสำหรับนักศึกษา",
  "instructor.behavior-record.create": "สร้างรายการบันทึกพฤติกรรมใหม่",
  "consultation.schedule-offer.create": "เสนอช่วงเวลานัดหมายให้ฝ่ายที่เกี่ยวข้องยืนยัน",
  "consultation.schedule-offer.accept": "ยืนยันช่วงเวลานัดหมายที่เสนอไว้",
  "alerts.acknowledge": "ผู้ใช้งานรับทราบเหตุแจ้งเตือนแล้ว",
  "screening-review.acknowledge": "รับทราบผลคัดกรองที่อยู่ในคิวทบทวน",
  "screening-review.view-detail": "เปิดดูรายละเอียดผลคัดกรองที่ต้องทบทวน",
  "screening-review.refer": "สร้างการส่งต่อจากผลคัดกรอง",
  "student.assessment.submit": "นักศึกษาส่งแบบประเมินเข้าระบบ",
  "student.survey.submit": "นักศึกษาส่งแบบสำรวจเข้าระบบ",
  "student.sos.create": "สร้างเหตุฉุกเฉินเพื่อขอความช่วยเหลือ",
  "student.consultation-request.create": "นักศึกษาสร้างคำขอปรึกษาใหม่",
  "student.consultation-request.cancel-request": "นักศึกษายกเลิกคำขอปรึกษา",
  "student.counseling-request.create": "นักศึกษาขอรับคำปรึกษาจากผู้เชี่ยวชาญ",
  "student.chat.message": "บันทึกการสนทนากับเพื่อน AI",
  "student.chat.blocked": "ระบบบล็อกข้อความที่ไม่ผ่านเกณฑ์ความปลอดภัย",
};

const ENTITY_LABEL_MAP: Record<string, string> = {
  AuthSession: "เซสชันเข้าสู่ระบบ",
  User: "บัญชีผู้ใช้งาน",
  StudentAccount: "บัญชีนักศึกษา",
  StaffAccount: "บัญชีบุคลากร",
  Alert: "การแจ้งเตือน",
  StudentAssessment: "แบบประเมินนักศึกษา",
  Survey: "แบบประเมิน",
  SurveyWave: "รอบแบบประเมิน",
  SurveyResponse: "ผลตอบแบบประเมิน",
  EmergencyCase: "เคสฉุกเฉิน",
  CaseReferral: "รายการส่งต่อ",
  BehaviorRecord: "บันทึกพฤติกรรม",
  SpecializedCareRecord: "บันทึกการดูแลเฉพาะทาง",
  StudentAdvisorAssignment: "การมอบหมายอาจารย์ที่ปรึกษา",
  ConsultationRequest: "คำขอปรึกษา",
  ConsultationScheduleOffer: "ข้อเสนอนัดหมาย",
  Appointment: "นัดหมาย",
  StudentChat: "การสนทนาเพื่อน AI",
  Reminder: "การติดตาม/เตือน",
};

const OP_LABEL_MAP: Record<string, string> = {
  create: "สร้างรายการใหม่",
  update: "ปรับปรุงข้อมูล",
  delete: "ลบรายการ",
  open: "เปิดใช้งาน",
  close: "ปิดใช้งาน",
  cancel: "ยกเลิก",
  duplicate: "ทำสำเนา",
  submit: "ส่งข้อมูล",
  confirm: "ยืนยัน",
  view_assessment_history: "เปิดดูประวัติผลประเมิน",
  view_advisee_history: "เปิดดูประวัตินักศึกษาในที่ปรึกษา",
  view_student_history: "เปิดดูประวัตินักศึกษา",
  view_referral_history: "เปิดดูประวัติการส่งต่อ",
  view_sensitive_detail: "เปิดดูรายละเอียดข้อมูลอ่อนไหว",
  create_referral: "สร้างรายการส่งต่อ",
  observation_report: "บันทึกการสังเกตการณ์",
  behavior_record: "บันทึกพฤติกรรม",
  care_note: "บันทึกการดูแล",
  create_appointment: "สร้างนัดหมาย",
  cancel_appointment: "ยกเลิกนัดหมาย",
  cancel_upcoming: "ยกเลิกนัดหมายที่รอดำเนินการ",
};

const META_KEY_LABEL_MAP: Record<string, string> = {
  op: "การดำเนินการ",
  status: "สถานะ",
  outcome: "ผลลัพธ์",
  studentId: "รหัสนักศึกษา",
  surveyId: "แบบประเมิน",
  sourceSurveyId: "แบบประเมินต้นทาง",
  notifiedCount: "จำนวนที่แจ้งเตือน",
  count: "จำนวน",
  reason: "เหตุผล",
  persona: "บุคลิกแชท",
  note: "หมายเหตุ",
  issues: "ปัญหา",
  total: "ทั้งหมด",
  created: "เพิ่มใหม่",
  updated: "อัปเดต",
  skipped: "ข้าม",
  failed: "ไม่สำเร็จ",
  wasOpen: "เคยเปิดอยู่",
};

/** สร้างเลขอ้างอิงบันทึกระบบแบบทางการ (ไม่โชว์ CUID) */
export function formatAuditLogRef(
  id: string | null | undefined,
  createdAt?: Date | string | null
): string {
  return formatOfficialRecordCode({
    id,
    kind: "AUD",
    createdAt,
  });
}

/** สร้างรหัสเป้าหมายแบบทางการ หรือใช้รหัสนักศึกษา/บุคลากรถ้ามี */
export function formatAuditTargetRef(input: {
  entityId?: string | null;
  entityType?: string | null;
  createdAt?: Date | string | null;
  studentId?: string | null;
  employeeId?: string | null;
}): string {
  return formatOfficialTargetCode(input);
}

/** แปลง IP ให้สื่อความหมาย โดยเฉพาะ localhost ของเครื่องพัฒนา */
export function formatAuditIpAddress(ip: string | null | undefined): string {
  if (!ip) {
    return "-";
  }

  const normalized = ip.trim().toLowerCase();
  if (
    normalized === "::1" ||
    normalized === "127.0.0.1" ||
    normalized === "::ffff:127.0.0.1"
  ) {
    return "localhost";
  }

  if (normalized.startsWith("::ffff:")) {
    return ip.trim().slice("::ffff:".length);
  }

  return ip.trim();
}

/** ปรับชื่อ action ของบัญชีนักศึกษาที่บันทึกด้วย prefix admin.user.* */
export function normalizeAuditAction(action: string, description?: string | null): string {
  if (!action.startsWith("admin.user.")) {
    return action;
  }

  if ((description || "").toUpperCase().includes("STUDENT ACCOUNT")) {
    return action.replace("admin.user.", "admin.student.");
  }

  return action;
}

const humanizeActionByPattern = (action: string): string | null => {
  if (/\.assessment-history\.view$/i.test(action)) {
    return "เปิดดูประวัติผลประเมิน";
  }

  if (/\.student-history\.view$/i.test(action)) {
    return "เปิดดูประวัตินักศึกษา";
  }

  if (/\.student-detail\.view$/i.test(action)) {
    return "เปิดดูรายละเอียดนักศึกษา";
  }

  if (/\.referral-history\.view$/i.test(action)) {
    return "เปิดดูประวัติการส่งต่อ";
  }

  return null;
};

/** คืนชื่อกิจกรรมภาษาไทย ถ้าไม่รู้จักจะพยายามเดาจากรูปแบบ action */
export function resolveAuditActionLabel(action: string, description?: string | null): string {
  const normalized = normalizeAuditAction(action, description);
  if (ACTION_LABEL_MAP[normalized]) {
    return ACTION_LABEL_MAP[normalized];
  }

  const patterned = humanizeActionByPattern(normalized);
  if (patterned) {
    return patterned;
  }

  const [prefix] = normalized.split(".");
  const roleLabel = ROLE_PREFIX_LABEL[prefix];
  if (roleLabel) {
    return `กิจกรรมของ${roleLabel}`;
  }

  return "กิจกรรมในระบบ";
}

const parseMetadataPairs = (description: string): Array<{ key: string; value: string }> => {
  const pairs: Array<{ key: string; value: string }> = [];
  for (const part of description.split(/\s+/)) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (!key || !value) {
      continue;
    }
    pairs.push({ key, value });
  }
  return pairs;
};

/** แปลง description แบบ key=value ให้เป็นประโยคภาษาไทยสั้นๆ */
export function humanizeAuditMetadata(description: string | null | undefined): string | null {
  if (!description) {
    return null;
  }

  const text = description.trim();
  if (!text || text === "ok") {
    return null;
  }

  if (!text.includes("=")) {
    return text;
  }

  const pairs = parseMetadataPairs(text);
  if (pairs.length === 0) {
    return text;
  }

  const opPair = pairs.find((pair) => pair.key === "op");
  if (opPair && OP_LABEL_MAP[opPair.value]) {
    const extras = pairs
      .filter((pair) => pair.key !== "op")
      .map((pair) => {
        const keyLabel = META_KEY_LABEL_MAP[pair.key] ?? pair.key;
        return `${keyLabel} ${pair.value}`;
      });

    if (extras.length === 0) {
      return OP_LABEL_MAP[opPair.value];
    }

    return `${OP_LABEL_MAP[opPair.value]} (${extras.join(", ")})`;
  }

  return pairs
    .map((pair) => {
      const keyLabel = META_KEY_LABEL_MAP[pair.key] ?? pair.key;
      const valueLabel = OP_LABEL_MAP[pair.value] ?? pair.value;
      return `${keyLabel}: ${valueLabel}`;
    })
    .join(" · ");
}

/** คืนรายละเอียดกิจกรรมภาษาไทย โดยไม่โชว์ metadata ดิบถ้าแปลงได้ */
export function resolveAuditActionDetail(action: string, description?: string | null): string {
  const normalized = normalizeAuditAction(action, description);
  if (ACTION_DETAIL_MAP[normalized]) {
    return ACTION_DETAIL_MAP[normalized];
  }

  if (/\.assessment-history\.view$/i.test(normalized)) {
    return "เข้าถึงประวัติผลประเมินย้อนหลังของนักศึกษา";
  }

  if (/\.student-history\.view$/i.test(normalized)) {
    return "เข้าถึงหน้าประวัติและข้อมูลย้อนหลังของนักศึกษา";
  }

  const humanized = humanizeAuditMetadata(description);
  if (humanized) {
    return humanized;
  }

  return "บันทึกกิจกรรมภายในระบบ";
}

/** แปลงชนิด entity เป็นป้ายภาษาไทย */
export function resolveAuditEntityLabel(entityType: string | null | undefined): string {
  if (!entityType) {
    return "ระบบ";
  }

  return ENTITY_LABEL_MAP[entityType] ?? entityType;
}

/** เลือกป้ายเป้าหมายให้อ่านรู้เรื่องตามประเภทกิจกรรม */
export function resolveAuditTargetLabel(
  action: string,
  entityType?: string | null,
  description?: string | null
): string {
  const normalized = normalizeAuditAction(action, description);

  if (normalized.startsWith("admin.student.")) {
    return "บัญชีนักศึกษา";
  }

  if (normalized.startsWith("admin.user.")) {
    return "บัญชีบุคลากร";
  }

  if (
    /\.(student-history|assessment-history|student-detail|referral-history)\.view$/i.test(normalized) ||
    normalized.startsWith("student.") ||
    normalized.includes("referral") ||
    normalized.includes("appointment") ||
    normalized.includes("observation") ||
    normalized.includes("behavior-record") ||
    normalized.includes("specialized-care") ||
    normalized.includes("screening-review")
  ) {
    if (!entityType || entityType === "User") {
      return "บัญชีนักศึกษา";
    }
  }

  if (normalized.startsWith("auth.")) {
    return "เซสชันเข้าสู่ระบบ";
  }

  return resolveAuditEntityLabel(entityType);
}

/** รวมข้อความเป้าหมาย + เลขอ้างอิงทางการ สำหรับแสดงในตาราง */
export function formatAuditTargetDisplay(input: AuditDisplayInput): {
  label: string;
  reference: string;
} {
  return {
    label: resolveAuditTargetLabel(input.action, input.entityType, input.description),
    reference: formatAuditTargetRef({
      entityId: input.entityId,
      entityType: input.entityType,
      createdAt: input.createdAt,
      studentId: input.studentId,
      employeeId: input.employeeId,
    }),
  };
}
