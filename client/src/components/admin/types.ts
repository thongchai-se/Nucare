import type { Role } from "@/types/auth";

export type AdminStaffPreview = {
  id: string;
  name: string;
  email: string | null;
  employeeId: string | null;
  role: Role;
};

export type AdminAuditLog = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  description: string | null;
  ipAddress: string | null;
  createdAt: string;
  targetStudentId?: string | null;
  targetEmployeeId?: string | null;
  actor: {
    id: string;
    name: string;
    role: Role;
  } | null;
};
