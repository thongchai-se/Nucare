import { getNameInitials } from "@/lib/name-prefix";
import type { ActiveStudentSurveyResult, StudentFacingSurvey, Survey } from "@/types/survey";

export type StudentAssessmentSummary = {
  id: string;
  instrument: "Q2" | "ST5" | "Q9" | "Q8";
  totalScore: number;
  riskLevel: "NORMAL" | "MEDIUM" | "HIGH";
  assessedAt: string;
};

export type StudentCareTeamMember = {
  id: string;
  name: string;
  employeeId: string | null;
  image: string | null;
  initials: string;
  roleLabels: string[];
  isAssignedAdvisor: boolean;
};

export type ConsultationTeachersResponse = {
  teachers: StudentCareTeamMember[];
  topics: string[];
  preferredChannels: Record<string, string>;
};

export type ConsultationRequestStatus =
  | "PENDING"
  | "ACCEPTED"
  | "SCHEDULED"
  | "CANCEL_REQUESTED"
  | "CLOSED"
  | "CANCELLED";

export type ConsultationScheduleOfferItem = {
  id: string;
  proposedAt: string;
  location: string;
  note: string | null;
  status: "PENDING" | "ACCEPTED" | "SUPERSEDED" | "CANCELLED";
  createdAt: string;
  proposedById: string;
  proposedByName: string;
  proposedByRole: "ADVISOR" | "STUDENT";
  waitingOn: "ADVISOR" | "STUDENT" | null;
};

export type StudentConsultationRequest = {
  id: string;
  topic: string;
  preferredChannel: string;
  preferredChannelLabel: string;
  note: string | null;
  status: ConsultationRequestStatus;
  advisorNote: string | null;
  scheduledAt: string | null;
  scheduleLocation?: string | null;
  acceptedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  alertId: string | null;
  teacher: StudentCareTeamMember;
  latestPendingOffer?: ConsultationScheduleOfferItem | null;
  scheduleOffers?: ConsultationScheduleOfferItem[];
};

export type ActiveStudentSurveyResponse = {
  survey: (Survey | StudentFacingSurvey) | null;
  surveys?: Array<Survey | StudentFacingSurvey>;
  response: ActiveStudentSurveyResult | null;
  hasSubmitted: boolean;
};

export type AssessmentRiskStatus = StudentAssessmentSummary["riskLevel"] | "UNKNOWN";

export const defaultConsultationTopics = [
  "การเรียนและผลการเรียน",
  "การฝึกปฏิบัติ/ขึ้นวอร์ด",
  "สุขภาพใจและความเครียด",
  "ทุนการศึกษาและค่าใช้จ่าย",
  "ความสัมพันธ์และครอบครัว",
  "การปรับตัวในมหาวิทยาลัย",
  "อื่น ๆ",
];

/** ช่องทางที่นิสิตเลือกตอนส่งคำขอ — แค่ออนไลน์หรือพบตัว */
export const defaultPreferredChannels: Record<string, string> = {
  ONLINE: "ออนไลน์",
  IN_PERSON: "พบตัว / ที่คณะ",
};

/** คำใบ้ช่องกรอกสถานที่ตอนเสนอนัด (ฝั่งอาจารย์) */
export function scheduleLocationPlaceholder(channel: string): string {
  if (channel === "ONLINE") {
    return "เช่น Microsoft Teams / Zoom พร้อมลิงก์";
  }
  return "เช่น ห้องที่ปรึกษาชั้น 2";
}

/** นิสิตขอยกเลิกได้เมื่อยังไม่ยืนยันนัด */
export function canStudentCancelConsultation(status: ConsultationRequestStatus): boolean {
  return status === "PENDING" || status === "ACCEPTED";
}

export const consultationStatusMeta: Record<
  ConsultationRequestStatus,
  {
    label: string;
    className: string;
  }
> = {
  PENDING: {
    label: "รออาจารย์รับคำขอ",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  ACCEPTED: {
    label: "อาจารย์รับคำขอแล้ว",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  SCHEDULED: {
    label: "นัดหมายแล้ว",
    className: "border-cyan-200 bg-cyan-50 text-cyan-700",
  },
  CANCEL_REQUESTED: {
    label: "นศขอยกเลิก",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  CLOSED: {
    label: "ปิดเคสแล้ว",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  CANCELLED: {
    label: "ยกเลิก",
    className: "border-amber-200 bg-amber-100 text-amber-800",
  },
};

export const assessmentRiskMeta: Record<
  AssessmentRiskStatus,
  {
    dotClassName: string;
    helperText: string;
    iconClassName: string;
    label: string;
    pillClassName: string;
    stroke: string;
    strokeOffset: number;
  }
> = {
  UNKNOWN: {
    dotClassName: "bg-slate-400",
    helperText: "ยังไม่มีผลล่าสุด ระบบจะแสดงข้อมูลเมื่อมีการส่งแบบประเมินที่ผู้ดูแลระบบเปิดไว้",
    iconClassName: "text-slate-500",
    label: "ยังไม่มีข้อมูล",
    pillClassName: "border-slate-200 bg-slate-50 text-slate-700",
    stroke: "#94a3b8",
    strokeOffset: 190,
  },
  NORMAL: {
    dotClassName: "bg-emerald-500",
    helperText: "ผลล่าสุดอยู่ในเกณฑ์ปกติ ควรประเมินต่อเนื่องตามรอบเพื่อดูแนวโน้มของตนเอง",
    iconClassName: "text-emerald-600",
    label: "ปกติ",
    pillClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    stroke: "#10b981",
    strokeOffset: 72,
  },
  MEDIUM: {
    dotClassName: "bg-amber-500",
    helperText: "มีสัญญาณที่ควรติดตาม หากต้องการพูดคุยสามารถส่งคำขอถึงทีมดูแลได้ทันที",
    iconClassName: "text-amber-600",
    label: "เฝ้าระวัง",
    pillClassName: "border-amber-200 bg-amber-50 text-amber-700",
    stroke: "#f59e0b",
    strokeOffset: 104,
  },
  HIGH: {
    dotClassName: "bg-red-500",
    helperText: "ผลล่าสุดอยู่ในระดับที่ควรได้รับการดูแลใกล้ชิด โปรดติดต่อทีมดูแลหรือใช้ช่องทางด่วนหากไม่ปลอดภัย",
    iconClassName: "text-red-600",
    label: "เสี่ยงสูง",
    pillClassName: "border-red-200 bg-red-50 text-red-700",
    stroke: "#ef4444",
    strokeOffset: 42,
  },
};

export const getAssessmentRiskMeta = (assessment: StudentAssessmentSummary | null) =>
  assessmentRiskMeta[assessment?.riskLevel || "UNKNOWN"];

export { getApiErrorMessage } from "@/lib/api-error";

export const formatThaiDateTime = (value: string | null): string => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export const formatThaiDate = (value: string | null): string => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
  }).format(date);
};

export { formatStudentIdDisplay } from "@/lib/student-id";

/** ย่อชื่อโดยตัดคำนำหน้าออกก่อน — ใช้เฉพาะตัวอักษรแรกของชื่อและนามสกุล */
export const getUserInitials = (name: string): string => getNameInitials(name, "NU");
