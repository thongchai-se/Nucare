export type Role =
  | "STUDENT"
  | "ADVISOR"
  | "STUDENT_DEVELOPMENT"
  | "MENTAL_HEALTH"
  | "INSTRUCTOR"
  | "EXECUTIVE"
  | "ADMIN";

export interface User {
  id: string;
  name: string;
  studentId: string | null;
  employeeId: string | null;
  email: string | null;
  role: Role;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  message?: string;
  user?: User;
  data?: T;
}
