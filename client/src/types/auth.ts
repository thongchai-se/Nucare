export type Role =
  | "STUDENT"
  | "ADVISOR"
  | "MENTAL_HEALTH"
  | "INSTRUCTOR"
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
