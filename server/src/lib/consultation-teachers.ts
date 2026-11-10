/**
 * รวมรายชื่ออาจารย์สำหรับคำขอปรึกษา — คงที่ปรึกษาที่ผูกนิสิตครบ แล้วเติมคนอื่นจนครบ limit
 */
export function mergeConsultationTeacherLists<T extends { id: string }>(
  assignedTeachers: T[],
  otherTeachers: T[],
  limit = 20
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const teacher of assignedTeachers) {
    if (seen.has(teacher.id)) {
      continue;
    }
    seen.add(teacher.id);
    merged.push(teacher);
  }

  for (const teacher of otherTeachers) {
    if (merged.length >= limit) {
      break;
    }
    if (seen.has(teacher.id)) {
      continue;
    }
    seen.add(teacher.id);
    merged.push(teacher);
  }

  return merged;
}
