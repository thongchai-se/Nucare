/**
 * กรองนิสิตจาก assignment ของคลื่นที่ยังไม่ทำแบบประเมิน
 * — ใช้ตอนเปิดคลื่นเพื่อแจ้งเฉพาะคนค้างทำ
 */
export function pickIncompleteWaveAssignees<
  T extends { completedAt: Date | string | null; student: { id: string } | null },
>(rows: ReadonlyArray<T>): Array<NonNullable<T["student"]>> {
  const seen = new Set<string>();
  const students: Array<NonNullable<T["student"]>> = [];

  for (const row of rows) {
    if (row.completedAt) {
      continue;
    }
    const student = row.student;
    if (!student?.id || seen.has(student.id)) {
      continue;
    }
    seen.add(student.id);
    students.push(student);
  }

  return students;
}

/** สร้างหัวข้อ/ข้อความแจ้งเตือนเมื่อเปิดคลื่นแบบประเมิน */
export function buildWaveOpenAlertCopy(input: {
  surveyTitle: string;
  waveLabel: string;
}): { title: string; message: string } {
  return {
    title: "มีแบบประเมินเปิดให้ทำแล้ว",
    message: `รอบ "${input.waveLabel}" ของแบบประเมิน "${input.surveyTitle}" เปิดแล้ว — กรุณาเข้าสู่ระบบเพื่อทำแบบประเมิน`,
  };
}
