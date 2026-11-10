/**
 * นิสิตที่ถือว่า “ค้างประเมิน” สำหรับงานพัฒนานิสิต
 * — มี assignment ของคลื่น OPEN ที่ยังไม่ทำ หรือยังไม่เคยมีผลประเมิน/ตอบแบบเลย
 */
export function isStudentDevelopmentPendingAssessment(student: {
  surveyAssignments: ReadonlyArray<unknown>;
  surveyResponses: ReadonlyArray<unknown>;
  studentAssessments: ReadonlyArray<unknown>;
}): boolean {
  return (
    student.surveyAssignments.length > 0 ||
    (student.surveyResponses.length === 0 && student.studentAssessments.length === 0)
  );
}

/** หนี HTML ในข้อความแจ้งเตือนอีเมล */
export function escapeHtmlForEmail(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
