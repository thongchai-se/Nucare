export type EphemeralChatPeer = {
  id: string;
  name: string;
  initials: string;
  studentId: string | null;
  employeeId: string | null;
  image: string | null;
  /** ชั้นปีของนิสิต — null ถ้าเป็นบุคลากรหรือไม่มีข้อมูล */
  studyYear?: string | null;
  roleLabels: string[];
  kind: "student" | "staff";
};

export type EphemeralChatPreview = {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
} | null;

export type EphemeralChatSession = {
  id: string;
  consultationRequestId: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  peer: EphemeralChatPeer;
  preview?: EphemeralChatPreview;
  unread?: boolean;
};

export type EphemeralChatMessage = {
  id: string;
  sessionId: string;
  senderId: string;
  body: string;
  createdAt: string;
};
