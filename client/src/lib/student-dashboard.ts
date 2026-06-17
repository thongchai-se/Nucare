import type { ActiveStudentSurveyResult, Survey } from "@/types/survey";

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
  initials: string;
  roleLabels: string[];
  isAssignedAdvisor: boolean;
};

export type ConsultationTeachersResponse = {
  teachers: StudentCareTeamMember[];
  topics: string[];
  preferredChannels: Record<string, string>;
};

export type ConsultationRequestStatus = "PENDING" | "ACCEPTED" | "SCHEDULED" | "CLOSED";

export type StudentConsultationRequest = {
  id: string;
  topic: string;
  preferredChannel: string;
  preferredChannelLabel: string;
  note: string | null;
  status: ConsultationRequestStatus;
  advisorNote: string | null;
  scheduledAt: string | null;
  acceptedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  alertId: string | null;
  teacher: StudentCareTeamMember;
};

export type ActiveStudentSurveyResponse = {
  survey: Survey | null;
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

export const defaultPreferredChannels: Record<string, string> = {
  IN_PERSON: "พบที่คณะ/ห้องพักอาจารย์",
  ONLINE: "ออนไลน์",
  PHONE: "โทรศัพท์",
  MESSAGE: "ข้อความในระบบ",
};

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
  CLOSED: {
    label: "ปิดคำขอแล้ว",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
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

export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
  ) {
    return (error as { response: { data: { message: string } } }).response.data.message;
  }

  return error instanceof Error ? error.message : fallback;
};

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

export const formatStudentIdDisplay = (studentId: string | null | undefined): string => {
  if (!studentId) {
    return "-";
  }

  if (/^\d{9}-\d$/.test(studentId)) {
    return studentId;
  }

  if (/^\d{10}$/.test(studentId)) {
    return `${studentId.slice(0, 9)}-${studentId.slice(9)}`;
  }

  return studentId;
};

export const getUserInitials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "NU";
