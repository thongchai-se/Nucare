export type InstructorStudent = {
  id: string;
  name: string;
  studentId: string | null;
};

export type BehaviorRecordStatus = "PENDING" | "ACKNOWLEDGED" | "COMPLETED";
export type BehaviorSeverity = "LOW" | "MEDIUM" | "HIGH";
export type StudentGroupId = "ALL" | "REPORTED" | "PENDING";

export type BehaviorRoadmapStep = {
  key: string;
  label: string;
  at: string;
  actorName?: string;
  detail?: string;
  kind?: "reported" | "acknowledged" | "closed" | "referred";
};

export type BehaviorRecord = {
  id: string;
  category: string;
  details: string;
  severity: BehaviorSeverity;
  observedAt: string;
  createdAt: string;
  status: BehaviorRecordStatus;
  advisorRecipients: string[];
  roadmap?: BehaviorRoadmapStep[];
  student: InstructorStudent;
};

export type StudentGroup = {
  id: StudentGroupId;
  name: string;
  code: string;
  description: string;
  students: number;
};
