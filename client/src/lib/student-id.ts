export const STUDENT_ID_PATTERN = /^\d{9}-\d$/;
export const STUDENT_ID_FORMAT_MESSAGE = "รหัสนักศึกษาต้องอยู่ในรูปแบบ 663380696-6";

export const formatStudentIdDisplay = (studentId: string | null | undefined): string => {
  if (!studentId) {
    return "-";
  }

  if (STUDENT_ID_PATTERN.test(studentId)) {
    return studentId;
  }

  if (/^\d{10}$/.test(studentId)) {
    return `${studentId.slice(0, 9)}-${studentId.slice(9)}`;
  }

  return studentId;
};

export const formatStudentIdInput = (value: string): string => {
  const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
  if (digitsOnly.length <= 9) {
    return digitsOnly;
  }

  return `${digitsOnly.slice(0, 9)}-${digitsOnly.slice(9)}`;
};
